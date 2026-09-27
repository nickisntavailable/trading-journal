import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/better-auth";

// Эндпоинты Better Auth: сессия, выход, позже — вход через Google.
export const { GET, POST } = toNextJsHandler(auth);
