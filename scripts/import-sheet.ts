/**
 * Разовый перенос истории сделок из Google-таблицы в журнал.
 *
 *   npx tsx scripts/import-sheet.ts <ссылка-или-id-таблицы>            # только показать
 *   npx tsx scripts/import-sheet.ts <ссылка-или-id-таблицы> --apply    # записать в БД
 *
 * Таблица должна быть открыта по ссылке (экспорт CSV идёт без авторизации).
 * Результаты считаются формулами самого приложения (lib/trading-math), а не
 * берутся из колонок таблицы: журнал должен быть внутренне согласован.
 * Повторный запуск безопасен — сделки с теми же входом, стопом и направлением
 * пропускаются.
 */
import { PrismaClient } from "@prisma/client";
import { closeTrade, positionSize, riskAmount, type Direction } from "../src/lib/trading-math";

const prisma = new PrismaClient();

const COL = {
  date: 0,
  pair: 1,
  direction: 2,
  entry: 3,
  deposit: 4,
  riskPct: 5,
  stop: 6,
  fixes: [
    [11, 12],
    [13, 14],
    [15, 16],
    [17, 18],
    [19, 20], // закрытие по стопу
  ] as const,
};

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else quoted = false;
      } else cur += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cur);
      cur = "";
    } else if (ch === "\n") {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
    } else if (ch !== "\r") cur += ch;
  }
  if (cur.length > 0 || row.length > 0) {
    row.push(cur);
    rows.push(row);
  }
  return rows;
}

/** «78 340,0000» → 78340. Пробелы бывают неразрывными, дробная часть — через запятую. */
function num(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[\s  ]/g, "").replace(",", ".");
  if (cleaned.length === 0) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/** «24.08.26» → 2026-08-24, время — полдень, чтобы не путаться с часовыми поясами. */
function parseDate(raw: string | undefined): Date | null {
  const match = raw?.trim().match(/^(\d{2})\.(\d{2})\.(\d{2,4})$/);
  if (!match) return null;
  const [, dd, mm, yy] = match;
  const year = yy.length === 2 ? 2000 + Number(yy) : Number(yy);
  return new Date(Date.UTC(year, Number(mm) - 1, Number(dd), 12, 0, 0));
}

function normalizePair(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s/\\-]/g, "");
}

type ImportedTrade = {
  date: Date;
  pair: string;
  direction: Direction;
  entryPrice: number;
  stopLoss: number;
  depositAtEntry: number;
  riskPct: number;
  fixes: { price: number; sizePct: number }[];
};

function readSheet(rows: string[][]): ImportedTrade[] {
  const trades: ImportedTrade[] = [];

  for (const row of rows.slice(1)) {
    const date = parseDate(row[COL.date]);
    const pair = (row[COL.pair] ?? "").trim();
    const entryPrice = num(row[COL.entry]);
    const stopLoss = num(row[COL.stop]);
    const direction = num(row[COL.direction]);
    const depositAtEntry = num(row[COL.deposit]);
    const riskPct = num(row[COL.riskPct]);

    // Строки-хвосты таблицы (заметки, пустые) просто пропускаем.
    if (!date || !pair || entryPrice === null || stopLoss === null) continue;
    if (direction !== 1 && direction !== -1) continue;
    if (depositAtEntry === null || riskPct === null) continue;

    const fixes: { price: number; sizePct: number }[] = [];
    for (const [priceCol, pctCol] of COL.fixes) {
      const price = num(row[priceCol]);
      const sizePct = num(row[pctCol]);
      if (price !== null && sizePct !== null && sizePct > 0) fixes.push({ price, sizePct });
    }

    trades.push({
      date,
      pair: normalizePair(pair),
      direction: direction as Direction,
      entryPrice,
      stopLoss,
      depositAtEntry,
      riskPct,
      fixes,
    });
  }

  return trades;
}

const money = (v: number) => v.toFixed(2).padStart(7);

async function main() {
  const [, , source, ...flags] = process.argv;
  const apply = flags.includes("--apply");

  if (!source) {
    console.error("Укажи ссылку на таблицу или её id");
    process.exit(1);
  }

  const id = source.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]+)/)?.[1] ?? source;
  const url = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv`;

  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) {
    console.error(`Таблица недоступна: HTTP ${response.status}. Открой доступ по ссылке.`);
    process.exit(1);
  }

  const sheet = readSheet(parseCSV(await response.text()));
  const account = await prisma.account.findFirstOrThrow({ orderBy: { createdAt: "asc" } });
  const feeRate = Number(account.feeRatePct);

  console.log(`Найдено в таблице: ${sheet.length} сделок`);
  console.log(`Аккаунт ${account.id}, баланс ${account.balance}, комиссия ${feeRate}%`);
  console.log(apply ? "\nРЕЖИМ ЗАПИСИ\n" : "\nПРЕДВАРИТЕЛЬНЫЙ ПРОГОН (в базу ничего не пишется)\n");

  const existing = await prisma.trade.findMany({ where: { accountId: account.id } });
  const seen = new Set(
    existing.map((t) => `${Number(t.entryPrice)}|${Number(t.stopLoss)}|${t.direction}`),
  );

  let netTotal = 0;
  let imported = 0;

  for (const trade of sheet) {
    const key = `${trade.entryPrice}|${trade.stopLoss}|${trade.direction}`;
    const label = `${trade.date.toISOString().slice(0, 10)} ${trade.pair.padEnd(11)} ${
      trade.direction === 1 ? "long " : "short"
    }`;

    if (seen.has(key)) {
      console.log(`  ПРОПУСК  ${label} — уже есть в журнале`);
      continue;
    }

    const totalPct = trade.fixes.reduce((acc, f) => acc + f.sizePct, 0);
    if (Math.abs(totalPct - 100) > 0.01) {
      console.log(
        `  ПРОПУСК  ${label} — фиксации дают ${totalPct.toFixed(2)}%, а не 100%: сделка не закрыта`,
      );
      continue;
    }

    const riskAmountValue = riskAmount(trade.depositAtEntry, trade.riskPct);
    const positionSizeValue = positionSize(riskAmountValue, trade.entryPrice, trade.stopLoss);
    const result = closeTrade(
      {
        entryPrice: trade.entryPrice,
        stopLoss: trade.stopLoss,
        direction: trade.direction,
        positionSize: positionSizeValue,
        depositAtEntry: trade.depositAtEntry,
        feeRateAtEntry: feeRate,
        riskAmount: riskAmountValue,
      },
      trade.fixes,
    );

    console.log(
      `  ИМПОРТ   ${label} позиция ${money(positionSizeValue)} · net ${money(result.netPnL)} · ${result.realizedRR.toFixed(2)}R · фиксаций ${trade.fixes.length}`,
    );

    netTotal += result.netPnL;
    imported++;

    if (!apply) continue;

    await prisma.$transaction(async (tx) => {
      const created = await tx.trade.create({
        data: {
          accountId: account.id,
          pair: trade.pair,
          direction: trade.direction,
          entryPrice: trade.entryPrice,
          stopLoss: trade.stopLoss,
          riskPct: trade.riskPct,
          depositAtEntry: trade.depositAtEntry,
          feeRateAtEntry: feeRate,
          riskAmount: riskAmountValue,
          positionSize: positionSizeValue,
          status: "closed",
          createdAt: trade.date,
          closedAt: trade.date,
          grossPnL: result.grossPnL,
          totalFees: result.totalFees,
          netPnL: result.netPnL,
          netPnlPctOfDeposit: result.netPnlPctOfDeposit,
          realizedAvgExit: result.realizedAvgExit,
          realizedRR: result.realizedRR,
        },
      });

      for (const fix of trade.fixes) {
        await tx.fix.create({
          data: {
            tradeId: created.id,
            price: fix.price,
            sizePct: fix.sizePct,
            // Цена закрытия, совпавшая со стопом, — это срабатывание стопа.
            type: fix.price === trade.stopLoss ? "stop" : "manual",
            createdAt: trade.date,
          },
        });
      }

      await tx.balanceEvent.create({
        data: {
          accountId: account.id,
          type: "trade_settlement",
          amount: result.netPnL,
          relatedTradeId: created.id,
          note: `${trade.pair} ${trade.direction === 1 ? "long" : "short"} (перенос из таблицы)`,
          createdAt: trade.date,
        },
      });

      await tx.account.update({
        where: { id: account.id },
        data: { balance: { increment: result.netPnL } },
      });
    });
  }

  console.log(`\nСделок к переносу: ${imported}, суммарный net ${netTotal.toFixed(2)}`);
  console.log(
    apply
      ? `Баланс: ${account.balance} → ${(Number(account.balance) + netTotal).toFixed(2)}`
      : `Баланс изменится с ${account.balance} на ${(Number(account.balance) + netTotal).toFixed(2)}. Запуск с --apply запишет это в базу.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
