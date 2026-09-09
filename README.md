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
- Параметры открытой сделки можно поправить (`PATCH /api/trades/:id`): riskAmount и
  positionSize пересчитываются, а снапшоты депозита и комиссии остаются прежними.
  У закрытой сделки правка запрещена.
- `realizedRR` — знаковый R-мультипликатор `netPnL / riskAmount`. Это осознанное
  отступление от формулы раздела 4 ТЗ, которая брала модуль хода цены и поэтому
  давала убыточной сделке положительный R:R.
- Скриншоты разбирает `claude-opus-5` (модель задана в
  `src/app/api/parse-screenshot/route.ts`). Без `ANTHROPIC_API_KEY` приложение
  работает полностью, кроме кнопки загрузки скриншота — она вернёт понятную
  ошибку, а сделка заводится руками.
- Лимит бюджета риска — поле `Account.riskLimitPct` (потолок суммарного риска
  открытых позиций в процентах от баланса, по умолчанию 3%), редактируется в
  `/settings`. Жёлтая зона начинается после 2/3 лимита.

## Вне рамок MVP

Интеграция с API биржи, полноценный auth, хранение скриншотов и автоматическое
определение направления/стопа моделью — фаза 2, сейчас не реализовано.
