import { Bar, FieldBar, SkeletonPage } from "@/components/skeleton";

/** Настройки: параметры счёта, теги, баланс. Ниже — за пределами экрана. */
export default function Loading() {
  return (
    <SkeletonPage>
      <p className="border-b border-rule pb-3 text-[13px] font-medium">Настройки</p>

      <div className="border-b border-rule py-5">
        <Bar className="h-2.5 w-32" />
        <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-4">
          <FieldBar />
          <FieldBar />
          <FieldBar />
          <FieldBar />
        </div>
      </div>

      <div className="border-b border-rule py-5">
        <Bar className="h-2.5 w-36" />
        <div className="mt-3 flex gap-1.5">
          <Bar className="h-6 w-12" />
          <Bar className="h-6 w-10" />
          <Bar className="h-6 w-14" />
        </div>
      </div>

      <div className="py-5">
        <div className="flex items-baseline justify-between">
          <Bar className="h-2.5 w-16" />
          <Bar className="h-4 w-20" />
        </div>
        <Bar className="mt-3 h-10 w-full max-w-[560px]" />
      </div>
    </SkeletonPage>
  );
}
