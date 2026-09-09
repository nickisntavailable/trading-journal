import { LoginForm } from "@/app/login/login-form";

export const metadata = { title: "Вход — Trading Journal" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center px-5">
      <div className="w-full max-w-[320px]">
        <h1 className="text-[15px] font-medium tracking-tight">Trading Journal</h1>
        <p className="mt-1 text-[13px] text-ink-soft">Личный журнал сделок</p>
        <LoginForm from={from} />
      </div>
    </main>
  );
}
