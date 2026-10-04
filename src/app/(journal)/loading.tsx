import { Bar, LabeledBar, RowBar, SkeletonPage } from "@/components/skeleton";

/** Дашборд: бюджет риска, маржа, метрики, открытые позиции. */
export default function Loading() {
  return (
    <SkeletonPage>
      <div className="border-b border-rule pb-5">
        <Bar className="h-2.5 w-28" />
        <Bar className="mt-2 h-7 w-40" />
        <Bar className="mt-4 h-2 w-full" />
      </div>

      <div className="border-b border-rule py-4">
        <Bar className="h-2.5 w-20" />
        <Bar className="mt-2 h-2 w-full" />
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-4 border-b border-rule py-5 md:grid-cols-4">
        <LabeledBar />
        <LabeledBar />
        <LabeledBar valueWidth="w-16" />
        <LabeledBar valueWidth="w-16" />
      </div>

      <div className="pt-5">
        <p className="text-[13px] font-medium">Открытые позиции</p>
        <div className="mt-3">
          <RowBar />
          <RowBar />
          <RowBar />
        </div>
      </div>
    </SkeletonPage>
  );
}
