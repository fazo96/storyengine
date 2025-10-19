import { buildSystemPrompt } from "./game.ts";
import type { ChatMessage, Save, ChatMessageText, World } from "../types.ts";
import { getDB } from "./db.ts";
import { inference } from "./llm.ts";
import { ensureArrayOfMessages } from "./utils.ts";
import { getWorldById } from "./worlds.ts";

function nowMs(): number {
  return Date.now();
}

async function deriveTitle(messages: ChatMessage[], world: World): Promise<string | null> {
  try {
    if (!messages.find((m) => m.role === "user")) return null;
    const chatHistory = messages
      .filter((m): m is ChatMessageText => (m as ChatMessageText).content !== undefined && m.role !== "system")
      .map((m) => `[${m.role}]: ${m.content}`)
      .join("\n\n");
    const systemPrompt = world ? buildSystemPrompt(world) : "This is a roleplaying game with the user as the player.";
    const assistant = await inference([
      { role: "system", content: `Derive a title for this roleplaying session. Reply with ONLY THE TITLE, no other text.\n\n${systemPrompt}\n\nHere is the chat history:\n${chatHistory}`},
    ]);
    return assistant;
  } catch (err) {
    console.error(`Failed to derive title: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

export function createSave(initialMessages: ChatMessage[], worldId: string): Save {
  const id = crypto.randomUUID();
  const world = getWorldById(worldId);
  if (!world) throw new Error(`World not found: ${worldId}`);

  const title = world.name;
  const messagesJson = JSON.stringify(initialMessages.filter((m) => ["user", "assistant", "game"].includes(m.role)));
  const ts = nowMs();
  getDB().prepare(
    "INSERT INTO saves (id, world_id, title, messages_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(id, worldId, title, messagesJson, ts, ts);
  const save = getSave(id);
  if (!save) throw new Error(`Failed to create save: ${id}`);
  console.log('created save', save);
  return save;
}

export function getSave(id: string): Save | null {
  const row = getDB().prepare("SELECT id, world_id, title, messages_json, updated_at FROM saves WHERE id = ? LIMIT 1").get(id);
  if (!row) return null;
  const messages = ensureArrayOfMessages(JSON.parse(row.messages_json as string));
  return { id: row.id as string, worldId: row.world_id as string, title: row.title as string, messages, updatedAt: row.updated_at as number };
}

export async function updateSave(id: string, messages: ChatMessage[], worldId: string): Promise<{ title: string }> {
  // Fetch current title
  const existing = getDB().prepare("SELECT title FROM saves WHERE id = ? LIMIT 1").get(id);
  if (!existing) {
    // If save missing, create anew
    const created = createSave(messages, worldId);
    return { title: created.title };
  }
  const world = getWorldById(worldId);
  if (!world) throw new Error(`World not found: ${worldId}`);
  let title = existing.title;
  if (!title || (world && title === world.name)) {
    const derived = await deriveTitle(messages, world);
    if (derived) title = derived;
  }
  const messagesJson = JSON.stringify(messages.filter((m) => ["user", "assistant", "game"].includes(m.role)));
  const ts = nowMs();
  getDB().prepare(
    "UPDATE saves SET title = ?, messages_json = ?, updated_at = ? WHERE id = ?",
  ).run(title, messagesJson, ts, id);
  console.log('updated save', id);
  return { title: title as string };
}

export function listSaves(): Array<Omit<Save, "messages">> {
  const rows = getDB().prepare("SELECT id, world_id, title, updated_at FROM saves ORDER BY updated_at DESC").all();
  return rows.map((r) => ({ id: r.id as string, worldId: r.world_id as string, title: r.title as string, updatedAt: r.updated_at as number }));
}

export function deleteSave(id: string): boolean {
  try {
    const result = getDB().prepare("DELETE FROM saves WHERE id = ?").run(id);
    const changes = (result as { changes?: number } | undefined)?.changes ?? 0;
    console.log('deleted save', id, changes);
    return changes > 0;
  } catch (err) {
    console.error(`Failed to delete save: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}
