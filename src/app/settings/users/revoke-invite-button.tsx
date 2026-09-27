"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RevokeInviteButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    await fetch(`/api/admin/invites/${id}`, { method: "DELETE" });
    // Даже при ошибке (уже приняли, пока страница была открыта) — перечитываем статус.
    router.refresh();
    setPending(false);
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="text-[12px] text-ink-soft underline underline-offset-2 hover:text-ink disabled:opacity-40"
    >
      {pending ? "…" : "отозвать"}
    </button>
  );
}
