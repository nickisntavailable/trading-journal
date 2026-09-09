import { money, pct } from "@/lib/format";
import { RISK_BUDGET_MULTIPLIER, type RiskBudget } from "@/lib/risk-budget";

type Segment = { id: string; label: string; amount: number };

/**
 * Герой дашборда. На десктопе — сегментированный горизонтальный бар
 * (по сегменту на открытую позицию), на мобильной — круговой индикатор.
 */
export function RiskBudgetHero({
  budget,
  segments,
  baseRiskPct,
}: {
  budget: RiskBudget;
  segments: Segment[];
  baseRiskPct: number;
}) {
  const zoneColor = budget.zone === "warning" ? "var(--amber)" : "var(--long)";
  const usedRatio = Math.min(budget.ratio, 1);

  return (
    <section className="border-b border-rule pb-6">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-[13px] font-medium">Бюджет риска</h1>
        <p className="text-[12px] text-ink-soft">
          лимит {RISK_BUDGET_MULTIPLIER} × <span className="num">{pct(baseRiskPct)}</span>
        </p>
      </div>

      <div className="mt-4 flex items-center gap-6">
        {/* Круговой индикатор — мобильная ширина */}
        <div className="md:hidden">
          <RiskDonut ratio={usedRatio} color={zoneColor} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="num text-[26px] leading-none" style={{ color: zoneColor }}>
            {money(budget.usedAmount)}
          </p>
          <p className="mt-1.5 text-[12px] text-ink-soft">
            из <span className="num">{money(budget.limitAmount)}</span> лимита
            {budget.limitAmount > 0 ? (
              <>
                {" · "}
                <span className="num">{pct(budget.ratio * 100)}</span>
              </>
            ) : null}
          </p>

          {/* Сегментированный бар — десктоп */}
          <div className="mt-4 hidden md:block">
            <RiskBar budget={budget} segments={segments} color={zoneColor} />
          </div>
        </div>
      </div>

      {/* На мобильной бар не дублируем — вместо него круг выше */}
      {segments.length === 0 ? (
        <p className="mt-4 text-[12px] text-ink-soft">Открытых позиций нет</p>
      ) : null}
    </section>
  );
}

function RiskBar({
  budget,
  segments,
  color,
}: {
  budget: RiskBudget;
  segments: Segment[];
  color: string;
}) {
  const scale = budget.limitAmount > 0 ? budget.limitAmount : 1;
  const warningLeft = `${(2 / 3) * 100}%`;

  return (
    <div>
      <div className="relative h-2.5 w-full overflow-hidden rounded-[2px] bg-white ring-1 ring-rule ring-inset">
        {/* граница предупредительной зоны */}
        <div
          className="absolute top-0 bottom-0 w-px bg-rule"
          style={{ left: warningLeft }}
          aria-hidden
        />
        <div className="flex h-full">
          {segments.map((segment) => (
            <div
              key={segment.id}
              title={`${segment.label}: ${money(segment.amount)}`}
              className="h-full border-r border-bg last:border-r-0"
              style={{
                width: `${Math.min((segment.amount / scale) * 100, 100)}%`,
                background: color,
              }}
            />
          ))}
        </div>
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-ink-soft">
        <span>0</span>
        <span>предупреждение</span>
        <span className="num">{money(budget.limitAmount)}</span>
      </div>
    </div>
  );
}

function RiskDonut({ ratio, color }: { ratio: number; color: string }) {
  const size = 84;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--rule)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="butt"
        strokeDasharray={`${circumference * ratio} ${circumference}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}
