import { systemPrompt, intro, narratorPrompt } from "./src/game.ts";
import { DatabaseSync as DB } from "node:sqlite";
import { inference } from "./src/llm.ts";

const serverPort = 8080;

// Open SQLite database and ensure schema
const db = new DB(Deno.env.get("DB_PATH") || "storyengine.sqlite");
db.exec(`
CREATE TABLE IF NOT EXISTS saves (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  messages_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
`);

export type Role = "user" | "assistant" | "system" | "game" | "error";

export interface ChatMessage {
  role: Role;
  content: string;
}

interface Save {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
}

function nowMs(): number {
  return Date.now();
}

function ensureArrayOfMessages(value: unknown, includeRoles: Role[] = []): ChatMessage[] {
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

function createSave(initialMessages: ChatMessage[]): { id: string; title: string; messages: ChatMessage[] } {
  const id = crypto.randomUUID();
  const title = "New Game"; // placeholder until first user message
  const messagesJson = JSON.stringify(initialMessages.filter((m) => ["user", "assistant", "game"].includes(m.role)));
  const ts = nowMs();
  db.prepare(
    "INSERT INTO saves (id, title, messages_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
  ).run(id, title, messagesJson, ts, ts);
  return { id, title, messages: initialMessages };
}

function getSave(id: string): Save | null {
  const row = db.prepare("SELECT id, title, messages_json, updated_at FROM saves WHERE id = ? LIMIT 1").get(id);
  if (!row) return null;
  const messages = ensureArrayOfMessages(JSON.parse(row.messages_json as string));
  return { id: row.id as string, title: row.title as string, messages, updatedAt: row.updated_at as number };
}

async function updateSave(id: string, messages: ChatMessage[]): Promise<{ title: string }> {
  // Fetch current title
  const existing = db.prepare("SELECT title FROM saves WHERE id = ? LIMIT 1").get(id);
  if (!existing) {
    // If save missing, create anew
    const created = createSave(messages);
    return { title: created.title };
  }
  let title = existing.title;
  if (!title || title === "New Game") {
    const derived = await deriveTitle(messages);
    if (derived) title = derived;
  }
  const messagesJson = JSON.stringify(messages.filter((m) => ["user", "assistant", "game"].includes(m.role)));
  const ts = nowMs();
  db.prepare(
    "UPDATE saves SET title = ?, messages_json = ?, updated_at = ? WHERE id = ?",
  ).run(title, messagesJson, ts, id);
  return { title: title as string };
}

function listSaves(): Array<Pick<Save, "id" | "title" | "updatedAt">> {
  const rows = db.prepare("SELECT id, title, updated_at FROM saves ORDER BY updated_at DESC").all();
  return rows.map((r) => ({ id: r.id as string, title: r.title as string, updatedAt: r.updated_at as number }));
}

async function serveIndex(_request: Request): Promise<Response> {
  try {
    const file = await Deno.readFile(new URL("./index.html", import.meta.url));
    return new Response(file, {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(`Failed to read index.html: ${message}`, { status: 500 });
  }
}

async function handleChat(request: Request): Promise<Response> {
  // Accept JSON body with full chat history and saveId
  // { saveId?: string, messages: [{ role: 'u'|'a'|'user'|'assistant', content: string }, ...] }
  const contentType = request.headers.get("content-type") ?? "";
  let providedMessages: ChatMessage[] | null = null;
  let providedSaveId: string | null = null;
  if (contentType.includes("application/json")) {
    const data: unknown = await request.json().catch(() => ({} as unknown));
    if (typeof data === "object" && data !== null) {
      const obj = data as Record<string, unknown>;
      const msgs = obj.messages;
      if (Array.isArray(msgs)) providedMessages = ensureArrayOfMessages(msgs);
      const sid = obj.saveId;
      if (typeof sid === "string" && sid.trim().length > 0) providedSaveId = sid.trim();
    }
  }

  // If neither history nor prompt provided, no-op
  if (!providedMessages || providedMessages.length === 0) {
    return new Response(JSON.stringify({ assistant: "" }), {
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  // Build OpenAI-compatible chat request from provided history or legacy prompt
  const apiMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];
  apiMessages.push({ role: "system", content: narratorPrompt });
  if (providedMessages && providedMessages.length > 0) {
    // Map frontend roles ('u'|'a') to OpenAI roles
    for (const m of providedMessages.filter((m) => ["user", "assistant"].includes(m.role))) {
      apiMessages.push({ role: m.role as "user" | "assistant", content: m.content });
    }
  }

  let content = "No response from API";
  let success = false;

   try {
    content = await inference(apiMessages);
    success = true;
  } catch (err) {
    success = false;
    return new Response(JSON.stringify({ assistant: "", error: err instanceof Error ? err.message : String(err) }), {
      headers: { "content-type": "application/json; charset-utf-8" },
    });
  }

  // Persist to a save (create if missing)
  let title = "New Game";
  let saveId = providedSaveId ?? "";
  if (success) {
    try {
      const existing = saveId ? getSave(saveId) : null;
      const messagesWithAssistant: ChatMessage[] = [...(providedMessages ?? []), { role: "assistant", content: String(content) }];
      if (!existing) {
        const created = createSave(messagesWithAssistant);
        saveId = created.id;
        // Immediately update to derive title from first user message
        const updated = await updateSave(saveId, messagesWithAssistant);
        title = updated.title;
      } else {
        const updated = await updateSave(saveId, messagesWithAssistant);
        title = updated.title;
      }
    } catch (err) {
      success = false;
      content = err instanceof Error ? err.message : String(err);
    }
  }

  // Return JSON response { role, content, saveId, title }
  return new Response(
    JSON.stringify({ role: success ? "assistant" : "error", content: String(content), saveId, title }),
    { headers: { "content-type": "application/json; charset=utf-8" } },
  );
}

function handleHistory(request: Request): Response {
  const url = new URL(request.url);
  const saveIdParam = (url.searchParams.get("saveId") ?? "").trim();

  if (saveIdParam) {
    const existing = getSave(saveIdParam);
    if (existing) {
      return new Response(
        JSON.stringify({ saveId: existing.id, title: existing.title, messages: existing.messages }),
        { headers: { "content-type": "application/json; charset=utf-8" } },
      );
    }
    // If not found, create a new game (as requested)
  }

  // Create a new save seeded with the intro assistant message
  // Do not save it to the DB for now.
  const seedMessages: ChatMessage[] = [
    { role: "assistant", content: intro },
  ];
  return new Response(
    JSON.stringify({ saveId: null, title: "New Game", messages: seedMessages }),
    { headers: { "content-type": "application/json; charset=utf-8" } },
  );
}

function router(request: Request): Promise<Response> | Response {
  const url = new URL(request.url);
  if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
    return serveIndex(request);
  }
  if (request.method === "GET" && url.pathname === "/api/history") {
    return handleHistory(request);
  }
  if (request.method === "POST" && url.pathname === "/api/chat") {
    return handleChat(request);
  }
  if (request.method === "GET" && url.pathname === "/api/saves") {
    const saves = listSaves();
    return new Response(JSON.stringify({ saves }), {
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
  return new Response("Not Found", { status: 404 });
}

if (import.meta.main) {
  Deno.serve({ port: serverPort }, router);
  // Log a helpful message
  console.log(`Server running at http://localhost:${serverPort}`);
}
