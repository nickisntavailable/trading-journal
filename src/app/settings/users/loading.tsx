import { Bar, RowBar, SkeletonPage } from "@/components/skeleton";

/** Пользователи (только админ). Свой скелет — иначе показался бы скелет настроек. */
export default function Loading() {
  return (
    <SkeletonPage>
      <p className="border-b border-rule pb-3 text-[13px] font-medium">
        <span className="text-ink-soft">Настройки / </span>Пользователи
      </p>
      <div className="border-b border-rule py-5">
        <Bar className="h-2.5 w-20" />
        <Bar className="mt-3 h-10 w-full max-w-[560px]" />
      </div>
      <div className="py-5">
        <RowBar />
        <RowBar />
        <RowBar />
      </div>
    </SkeletonPage>
  );
}
