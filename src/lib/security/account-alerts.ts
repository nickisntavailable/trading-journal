import { envLabel, who } from "@/lib/security/login-throttle";
import type { RequestInfo } from "@/lib/security/request-info";
import { escapeHtml, sendSecurityAlert } from "@/lib/security/telegram";

/**
 * Сигналы об изменениях учётки. Если пароль сменил не владелец, а тот, кто
 * увёл сессию, — это единственный способ узнать об этом быстро.
 */
export function alertPasswordChanged(info: RequestInfo): Promise<void> {
  return sendSecurityAlert([
    `<b>Пароль изменён</b> ${envLabel()}`,
    who(info),
    "Остальные устройства разлогинены.",
  ]);
}

export function alertSessionsRevoked(info: RequestInfo): Promise<void> {
  return sendSecurityAlert([
    `<b>Выход на остальных устройствах</b> ${envLabel()}`,
    who(info),
  ]);
}

export function alertNewUser(email: string, info: RequestInfo): Promise<void> {
  return sendSecurityAlert([
    `<b>Новый пользователь по приглашению</b> ${envLabel()}`,
    escapeHtml(email),
    who(info),
  ]);
}

export function alertPasswordReset(email: string, info: RequestInfo): Promise<void> {
  return sendSecurityAlert([
    `<b>Пароль сброшен по ссылке</b> ${envLabel()}`,
    escapeHtml(email),
    who(info),
    "Все прежние сессии этого пользователя удалены.",
  ]);
}
