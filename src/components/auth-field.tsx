/** Поле формы входа: подпись + инпут в стиле журнала. */
export function AuthField({
  id,
  label,
  hint,
  ...input
}: {
  id: string;
  label: string;
  hint?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="mt-4 first:mt-0">
      <label htmlFor={id} className="block text-[12px] text-ink-soft">
        {label}
      </label>
      <input
        id={id}
        name={id}
        {...input}
        className="num mt-1.5 w-full rounded-[3px] border border-rule bg-white px-2.5 py-2 text-[14px] outline-none focus:border-ink read-only:bg-transparent read-only:text-ink-soft"
      />
      {hint ? <p className="mt-1 text-[11px] text-ink-soft">{hint}</p> : null}
    </div>
  );
}
