"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    await fetch("/api/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={className ?? "text-[12px] text-ink-soft underline underline-offset-2 hover:text-ink disabled:opacity-40"}
    >
      {pending ? "Выхожу…" : "Выйти"}
    </button>
  );
}
