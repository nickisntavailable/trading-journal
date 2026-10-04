import { Bar, FieldBar, LabeledBar, SkeletonPage } from "@/components/skeleton";

/**
 * Новая сделка. Блок скриншота не рисуем: он есть не у всех, и у кого его
 * нет, форма прыгнула бы вверх при подмене.
 */
export default function Loading() {
  return (
    <SkeletonPage>
      <div className="mt-4 max-w-[560px]">
        <p className="mb-4 text-[13px] font-medium">Новая сделка</p>

        <div className="grid grid-cols-2 gap-4 border-y border-rule py-4">
          <FieldBar />
          <FieldBar />
          <FieldBar />
          <FieldBar />
        </div>

        <div className="border-b border-rule py-4">
          <div className="flex items-baseline justify-between">
            <Bar className="h-2.5 w-24" />
            <Bar className="h-3.5 w-12" />
          </div>
          <Bar className="mt-3 h-2 w-full" />
        </div>

        <div className="grid grid-cols-2 gap-4 border-b border-rule py-4 md:grid-cols-4">
          <LabeledBar valueWidth="w-16" />
          <LabeledBar valueWidth="w-16" />
          <LabeledBar valueWidth="w-16" />
          <LabeledBar valueWidth="w-16" />
        </div>

        <Bar className="mt-5 h-9 w-36" />
      </div>
    </SkeletonPage>
  );
}
