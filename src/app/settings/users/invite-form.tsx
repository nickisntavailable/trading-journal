"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { OneTimeLink } from "@/components/one-time-link";

const inputClass =
  "mt-1 w-full rounded-[3px] border border-rule bg-white px-2.5 py-2 text-[14px] outline-none focus:border-ink";

export function InviteForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [link, setLink] = useState<{ email: string; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLink(null);
    setPending(true);

    const response = await fetch("/api/admin/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Не удалось создать приглашение");
      return;
    }

    setLink({ email: email.trim(), url: data.url });
    setEmail("");
    router.refresh();
  }

  return (
    <div className="mt-2 max-w-[560px]">
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
        <div>
          <label htmlFor="inviteEmail" className="block text-[11px] text-ink-soft">
            Почта
          </label>
          <input
            id="inviteEmail"
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={pending || !email.trim()}
            className="w-full rounded-[3px] bg-btn px-3 py-2 text-[13px] font-medium text-white disabled:opacity-40"
          >
            {pending ? "…" : "Создать ссылку"}
          </button>
        </div>
      </form>

      {error ? <p className="mt-2 text-[12px] text-short">{error}</p> : null}

      {link ? (
        <OneTimeLink
          note={`Ссылка для ${link.email}: одноразовая, работает 7 дней.`}
          url={link.url}
        />
      ) : null}
    </div>
  );
}
