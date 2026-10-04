import { Bar, LabeledBar, SkeletonPage } from "@/components/skeleton";

/** Сделка: заголовок, параметры, разбор, прогресс, фиксации. */
export default function Loading() {
  return (
    <SkeletonPage>
      <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-3">
        <Bar className="h-4 w-32" />
        <Bar className="h-3 w-28" />
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-4 border-b border-rule py-4 md:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <LabeledBar key={i} valueWidth="w-20" />
        ))}
      </div>

      <div className="border-b border-rule py-4">
        <p className="text-[13px] font-medium">Разбор</p>
        <div className="mt-3 flex gap-1.5">
          <Bar className="h-6 w-12" />
          <Bar className="h-6 w-10" />
          <Bar className="h-6 w-14" />
        </div>
        <Bar className="mt-3 h-16 w-full" />
      </div>

      <div className="border-b border-rule py-4">
        <div className="flex items-baseline justify-between">
          <Bar className="h-2.5 w-24" />
          <Bar className="h-3.5 w-12" />
        </div>
        <Bar className="mt-2 h-1.5 w-full" />
      </div>

      <div className="py-4">
        <p className="text-[13px] font-medium">Фиксации</p>
        <Bar className="mt-3 h-10 w-full max-w-[360px]" />
      </div>
    </SkeletonPage>
  );
}
