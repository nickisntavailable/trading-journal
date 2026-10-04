import { Bar, RowBar, SkeletonPage } from "@/components/skeleton";

/** История: заголовок, фильтры, строки сделок. */
export default function Loading() {
  return (
    <SkeletonPage>
      <div className="flex items-baseline justify-between border-b border-rule pb-3">
        <p className="text-[13px] font-medium">История</p>
        <Bar className="h-3 w-24" />
      </div>

      <div className="flex flex-wrap items-end gap-3 border-b border-rule py-4">
        <Bar className="h-8 w-32" />
        <Bar className="h-8 w-32" />
        <Bar className="h-8 w-32" />
        <Bar className="h-8 w-20" />
      </div>

      <div className="pt-4">
        {Array.from({ length: 6 }, (_, i) => (
          <RowBar key={i} />
        ))}
      </div>
    </SkeletonPage>
  );
}
