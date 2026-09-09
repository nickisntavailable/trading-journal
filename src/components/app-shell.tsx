import { MobileTabBar, TopNav } from "@/components/nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopNav />
      {/* нижний отступ на мобильной — под таб-бар */}
      <main className="mx-auto w-full max-w-[1100px] px-5 pb-24 pt-5 md:px-6 md:pb-12 md:pt-7">
        {children}
      </main>
      <MobileTabBar />
    </>
  );
}
