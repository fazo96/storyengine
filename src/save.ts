import { world, systemPrompt } from "./game.ts";
import { ChatMessage, Save } from "./types.ts";
import { getDB } from "./db.ts";
import { inference } from "./llm.ts";
import { ensureArrayOfMessages } from "./utils.ts";


function nowMs(): number {
  return Date.now();
}

async function deriveTitle(messages: ChatMessage[]): Promise<string | null> {
  try {
    if (!messages.find((m) => m.role === "user")) return null;
    const chatHistory = messages.filter((m) => m.role !== "system").map((m) => `[${m.role}]: ${m.content}`).join("\n\n");
    const assistant = await inference([
      { role: "system", content: `Derive a title for this roleplaying session. Reply with ONLY THE TITLE, no other text.\n\n${systemPrompt}\n\nHere is the chat history:\n${chatHistory}`},
    ]);
    return assistant;
  } catch (err) {
    console.error(`Failed to derive title: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

export function createSave(initialMessages: ChatMessage[]): { id: string; title: string; messages: ChatMessage[] } {
  const id = crypto.randomUUID();
  const title = world.name; // placeholder until first user message
  const messagesJson = JSON.stringify(initialMessages.filter((m) => ["user", "assistant", "game"].includes(m.role)));
  const ts = nowMs();
  getDB().prepare(
    "INSERT INTO saves (id, title, messages_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
  ).run(id, title, messagesJson, ts, ts);
  return { id, title, messages: initialMessages };
}

export function getSave(id: string): Save | null {
  const row = getDB().prepare("SELECT id, title, messages_json, updated_at FROM saves WHERE id = ? LIMIT 1").get(id);
  if (!row) return null;
  const messages = ensureArrayOfMessages(JSON.parse(row.messages_json as string));
  return { id: row.id as string, title: row.title as string, messages, updatedAt: row.updated_at as number };
}

export async function updateSave(id: string, messages: ChatMessage[]): Promise<{ title: string }> {
  // Fetch current title
  const existing = getDB().prepare("SELECT title FROM saves WHERE id = ? LIMIT 1").get(id);
  if (!existing) {
    // If save missing, create anew
    const created = createSave(messages);
    return { title: created.title };
  }
  let title = existing.title;
  if (!title || title === world.name) {
    const derived = await deriveTitle(messages);
    if (derived) title = derived;
  }
  const messagesJson = JSON.stringify(messages.filter((m) => ["user", "assistant", "game"].includes(m.role)));
  const ts = nowMs();
  getDB().prepare(
    "UPDATE saves SET title = ?, messages_json = ?, updated_at = ? WHERE id = ?",
  ).run(title, messagesJson, ts, id);
  return { title: title as string };
}

export function listSaves(): Array<Pick<Save, "id" | "title" | "updatedAt">> {
  const rows = getDB().prepare("SELECT id, title, updated_at FROM saves ORDER BY updated_at DESC").all();
  return rows.map((r) => ({ id: r.id as string, title: r.title as string, updatedAt: r.updated_at as number }));
}

export function deleteSave(id: string): boolean {
  try {
    const result = getDB().prepare("DELETE FROM saves WHERE id = ?").run(id);
    const changes = (result as { changes?: number } | undefined)?.changes ?? 0;
    return changes > 0;
  } catch (err) {
    console.error(`Failed to delete save: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}
