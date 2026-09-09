# Trading Journal

Личный трейд-журнал с риск-менеджментом на одного пользователя.
Next.js (App Router) + Postgres (Neon) через Prisma, деплой на Vercel.

## Локальный запуск

```bash
npm install
cp .env.example .env   # заполнить DATABASE_URL, ANTHROPIC_API_KEY, APP_PASSWORD
npx prisma migrate dev
npx prisma db seed     # создаёт единственный Account
npm run dev
```

### Переменные окружения

| Переменная          | Назначение                                              |
| ------------------- | ------------------------------------------------------- |
| `DATABASE_URL`      | строка подключения к Postgres (Neon)                     |
| `ANTHROPIC_API_KEY` | ключ для разбора скриншотов, только на сервере           |
| `APP_PASSWORD`      | пароль для входа (MVP-заглушка вместо полноценного auth) |

## Деплой на Vercel + Neon

1. Импортировать репозиторий в Vercel.
2. Подключить Neon через Vercel-интеграцию — она сама заводит `DATABASE_URL`.
3. Добавить `ANTHROPIC_API_KEY` и `APP_PASSWORD` в Environment Variables.
4. Задеплоить: `npm run build` прогоняет `prisma migrate deploy` перед сборкой.
5. Один раз после первого деплоя выполнить сид, чтобы появился `Account`:
   ```bash
   DATABASE_URL="<neon-url>" npx prisma db seed
   ```

## Структура

```
prisma/schema.prisma          Account / BalanceEvent / Trade / Fix
src/lib/trading-math.ts       формулы: risk, position size, закрытие сделки
src/lib/risk-budget.ts        бюджет риска и его зоны
src/app/api/**                route handlers (zod-валидация, транзакции)
src/app/(pages)               дашборд, /trades/new, /trades/[id], /trades, /settings
```

### Что важно знать про расчёты

- Все денежные вычисления идут на сервере; клиент считает live-превью тем же
  `lib/trading-math.ts` — логика не продублирована.
- `Trade` хранит снапшоты `depositAtEntry` и `feeRateAtEntry`, поэтому изменение
  настроек не меняет уже открытые сделки.
- Сделка закрывается автоматически, когда сумма `sizePct` фиксаций достигает 100:
  в одной транзакции считается результат, создаётся `BalanceEvent` типа
  `trade_settlement` и обновляется баланс аккаунта.
- Баланс нельзя изменить напрямую через `PATCH /api/account` — только через
  `BalanceEvent` или закрытие сделки.
- Лимит бюджета риска в схеме ТЗ не задан отдельным полем, поэтому выводится из
  базового риска: не более трёх базовых рисков одновременно в рынке
  (`RISK_BUDGET_MULTIPLIER` в `src/lib/risk-budget.ts`).

## Вне рамок MVP

Интеграция с API биржи, полноценный auth, хранение скриншотов и автоматическое
определение направления/стопа моделью — фаза 2, сейчас не реализовано.
