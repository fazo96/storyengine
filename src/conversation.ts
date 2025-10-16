import { ChatMessage } from "./types.ts";
import { inferenceStream } from "./llm.ts";
import { getSave, createSave, updateSave } from "./save.ts";
import { getWorldById } from "./worlds.ts";
import { ensureArrayOfMessages } from "./utils.ts";
import { buildSystemPrompt } from "./game.ts";

export async function handleChat(request: Request): Promise<Response> {
  // Accept JSON body with full chat history and saveId
  // { saveId?: string, messages: [{ role: 'user'|'assistant', content: string }, ...] }
  const contentType = request.headers.get("content-type") ?? "";
  let providedMessages: ChatMessage[] | null = null;
  let providedSaveId: string | null = null;
  let providedWorldId: string | null = null;
  if (contentType.includes("application/json")) {
    const data: unknown = await request.json().catch(() => ({} as unknown));
    if (typeof data === "object" && data !== null) {
      const obj = data as Record<string, unknown>;
      const msgs = obj.messages;
      if (Array.isArray(msgs)) providedMessages = ensureArrayOfMessages(msgs);
      const sid = obj.saveId;
      if (typeof sid === "string" && sid.trim().length > 0) providedSaveId = sid.trim();
      const wid = obj.worldId;
      if (typeof wid === "string" && wid.trim().length > 0) providedWorldId = wid.trim();
    }
  }

  // If no history provided, return a minimal NDJSON stream that immediately finalizes
  if (!providedMessages || providedMessages.length === 0) {
    const enc = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(enc.encode(JSON.stringify({ type: "final", role: "assistant", content: "" }) + "\n"));
        controller.close();
      },
    });
    return new Response(body, {
      headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-cache" },
    });
  }

  const enc = new TextEncoder();
  let saveId = providedSaveId ?? "";
  const worldId = providedWorldId ?? (await getSave(saveId)?.worldId ?? "");
  let title = "New Game";
  let fullContent = "";

  // Build OpenAI-compatible chat request from provided history
  // Also prepend the system prompt
  const world = getWorldById(worldId);
  if (!world) throw new Error(`World not found: ${worldId}`);

  const systemPrompt = buildSystemPrompt(world);
  const apiMessages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...providedMessages.filter((m) => ["user", "assistant"].includes(m.role)),
  ];

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      (async () => {
        try {
          // Stream assistant tokens
          for await (const chunk of inferenceStream(apiMessages)) {
            console.log('chunk', chunk);
            fullContent += String(chunk);
            const line = JSON.stringify({ type: "delta", content: String(chunk) }) + "\n";
            controller.enqueue(enc.encode(line));
          }
          // Persist to a save (create if missing)
          try {
            const existing = saveId ? getSave(saveId) : null;
            const messagesWithAssistant: ChatMessage[] = [...providedMessages!, { role: "assistant", content: fullContent }];
            if (!existing) {
              const created = createSave(messagesWithAssistant, worldId);
              saveId = created.id;
              const updated = await updateSave(saveId, messagesWithAssistant, worldId);
              title = updated.title;
            } else {
              const updated = await updateSave(saveId, messagesWithAssistant, worldId);
              title = updated.title;
            }
          } catch (err) {
            const finalErr = err instanceof Error ? err.message : String(err);
            const finalLine = JSON.stringify({ type: "final", role: "error", error: finalErr, content: fullContent, saveId, title }) + "\n";
            controller.enqueue(enc.encode(finalLine));
            controller.close();
            return;
          }

          const finalLine = JSON.stringify({ type: "final", role: "assistant", content: fullContent, saveId, title }) + "\n";
          controller.enqueue(enc.encode(finalLine));
          controller.close();
        } catch (err) {
          const finalErr = err instanceof Error ? err.message : String(err);
          const finalLine = JSON.stringify({ type: "final", role: "error", error: finalErr, content: fullContent, saveId, title }) + "\n";
          controller.enqueue(enc.encode(finalLine));
          controller.close();
        }
      })();
    },
  });

  return new Response(body, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-cache",
    },
  });
}

export function handleHistory(request: Request): Response {
  const url = new URL(request.url);
  const saveIdParam = (url.searchParams.get("saveId") ?? "").trim();
  const worldIdParam = (url.searchParams.get("worldId") ?? "").trim();

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

  // Starting a new game requires a worldId
  if (!worldIdParam) {
    return new Response(JSON.stringify({ error: "Missing worldId" }), {
      status: 400,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
  const world = getWorldById(worldIdParam);
  if (!world) {
    return new Response(JSON.stringify({ error: "World not found" }), {
      status: 404,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
  // Create a new session seeded with the world's intro (no save yet)
  const seedMessages: ChatMessage[] = [
    { role: "assistant", content: world.intro },
  ];
  return new Response(
    JSON.stringify({ saveId: null, worldId: world.id, title: world.name || "New Game", messages: seedMessages }),
    { headers: { "content-type": "application/json; charset=utf-8" } },
  );
}
