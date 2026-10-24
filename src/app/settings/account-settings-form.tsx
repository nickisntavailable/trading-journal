"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FEE_PRESETS, matchPreset } from "@/lib/fee-presets";
import type { AccountDTO } from "@/lib/serialize";

const inputClass =
  "num w-full rounded-[3px] border border-rule bg-white px-2.5 py-2 text-[14px] outline-none focus:border-ink";

export function AccountSettingsForm({ account }: { account: AccountDTO }) {
  const router = useRouter();
  const [baseRiskPct, setBaseRiskPct] = useState(String(account.baseRiskPct));
  const [riskLimitPct, setRiskLimitPct] = useState(String(account.riskLimitPct));
  const [makerFeePct, setMakerFeePct] = useState(String(account.makerFeePct));
  const [takerFeePct, setTakerFeePct] = useState(String(account.takerFeePct));
  const preset = matchPreset(Number(makerFeePct), Number(takerFeePct));

  function choosePreset(id: string) {
    const next = FEE_PRESETS.find((p) => p.id === id);
    if (!next) return;
    setMakerFeePct(String(next.makerFeePct));
    setTakerFeePct(String(next.takerFeePct));
  }
  const [defaultLeverage, setDefaultLeverage] = useState(String(account.defaultLeverage));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setPending(true);

    const response = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        baseRiskPct: Number(baseRiskPct),
        riskLimitPct: Number(riskLimitPct),
        makerFeePct: Number(makerFeePct),
        takerFeePct: Number(takerFeePct),
        defaultLeverage: Number(defaultLeverage),
      }),
    });

    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Не удалось сохранить");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 max-w-[560px]">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <div>
          <label htmlFor="baseRiskPct" className="block text-[11px] text-ink-soft">
            Базовый риск, %
          </label>
          <input
            id="baseRiskPct"
            type="number"
            step="0.01"
            inputMode="decimal"
            value={baseRiskPct}
            onChange={(e) => setBaseRiskPct(e.target.value)}
            className={inputClass + " mt-1"}
          />
        </div>
        <div>
          <label htmlFor="riskLimitPct" className="block text-[11px] text-ink-soft">
            Лимит риска, %
          </label>
          <input
            id="riskLimitPct"
            type="number"
            step="0.01"
            inputMode="decimal"
            value={riskLimitPct}
            onChange={(e) => setRiskLimitPct(e.target.value)}
            className={inputClass + " mt-1"}
          />
        </div>
        <div>
          <label htmlFor="defaultLeverage" className="block text-[11px] text-ink-soft">
            Плечо, ×
          </label>
          <input
            id="defaultLeverage"
            type="number"
            step="1"
            min="1"
            inputMode="decimal"
            value={defaultLeverage}
            onChange={(e) => setDefaultLeverage(e.target.value)}
            className={inputClass + " mt-1"}
          />
        </div>
        <div>
          <label htmlFor="feePreset" className="block text-[11px] text-ink-soft">
            Биржа
          </label>
          <select
            id="feePreset"
            value={preset?.id ?? "custom"}
            onChange={(e) => choosePreset(e.target.value)}
            className={inputClass + " mt-1"}
          >
            {FEE_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
            <option value="custom" disabled>
              свои ставки
            </option>
          </select>
        </div>
        <div>
          <label htmlFor="makerFeePct" className="block text-[11px] text-ink-soft">
            Лимит (maker), %
          </label>
          <input
            id="makerFeePct"
            type="number"
            step="0.0001"
            inputMode="decimal"
            value={makerFeePct}
            onChange={(e) => setMakerFeePct(e.target.value)}
            className={inputClass + " mt-1"}
          />
        </div>
        <div>
          <label htmlFor="takerFeePct" className="block text-[11px] text-ink-soft">
            Рынок и стоп (taker), %
          </label>
          <input
            id="takerFeePct"
            type="number"
            step="0.0001"
            inputMode="decimal"
            value={takerFeePct}
            onChange={(e) => setTakerFeePct(e.target.value)}
            className={inputClass + " mt-1"}
          />
        </div>
      </div>

      <p className="mt-2 text-[11px] text-ink-soft">
        Лимит риска — потолок суммарного риска открытых позиций в процентах от баланса,
        по нему считается бюджет на дашборде. Плечо подставляется в новую сделку по
        умолчанию и на риск не влияет — только на маржу. Комиссии берутся с номинала:
        лимитная заявка — maker, рыночная и стоп — taker; риск сделки считается вместе с
        ними. Ставки — обычный уровень биржи; со скидкой (VIP, BNB) поправь вручную.
        Базовый риск, комиссии и плечо применяются к сделкам, открытым после сохранения:
        у уже открытых снапшот не меняется.
      </p>

      {error ? <p className="mt-2 text-[12px] text-short">{error}</p> : null}

      <div className="mt-3 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-[3px] bg-btn px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-40"
        >
          {pending ? "Сохраняю…" : "Сохранить"}
        </button>
        {saved ? <span className="text-[12px] text-ink-soft">сохранено</span> : null}
      </div>
    </form>
  );
}
