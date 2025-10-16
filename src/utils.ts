import { Role, ChatMessage } from "./types.ts";

export function nowMs(): number { return Date.now(); }

export function ensureArrayOfMessages(value: unknown, includeRoles: Role[] = []): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((m: unknown) => {
      const obj = m as Record<string, unknown>;
      const role = typeof obj.role === "string" ? obj.role.trim() : "";
      const content = typeof obj.content === "string" ? obj.content.trim() : "";
      return { role: role as Role, content };
    })
    .filter((m) => m.content.length > 0 && (includeRoles.length === 0 || includeRoles.includes(m.role)));
}
