import { envLabel, who } from "@/lib/security/login-throttle";
import type { RequestInfo } from "@/lib/security/request-info";
import { sendSecurityAlert } from "@/lib/security/telegram";

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
