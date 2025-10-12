import { ChatMessage } from "./types.ts";
import { narratorPrompt } from "./game.ts";
import { inferenceWithTools } from "./llm.ts";
import { getSave, createSave, updateSave } from "./save.ts";
import { world } from "./game.ts";
import { ensureArrayOfMessages } from "./utils.ts";

export async function handleChat(request: Request): Promise<Response> {
  // Accept JSON body with full chat history and saveId
  // { saveId?: string, messages: [{ role: 'user'|'assistant', content: string }, ...] }
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

  // Build OpenAI-compatible chat request from provided history
  const apiMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];
  apiMessages.push({ role: "system", content: narratorPrompt });
  for (const m of providedMessages.filter((m) => ["user", "assistant"].includes(m.role))) {
    apiMessages.push({ role: m.role as "user" | "assistant", content: m.content });
  }

  const enc = new TextEncoder();
  let saveId = providedSaveId ?? "";
  let title = "New Game";
  let fullContent = "";

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      (async () => {
        try {
          // Use tool-enabled inference (non-streaming), then emit as NDJSON
          fullContent = await inferenceWithTools(apiMessages);
          // Emit one delta with the full content for UI compatibility
          controller.enqueue(enc.encode(JSON.stringify({ type: "delta", content: fullContent }) + "\n"));

          // Persist to a save (create if missing)
          try {
            const existing = saveId ? getSave(saveId) : null;
            const messagesWithAssistant: ChatMessage[] = [...providedMessages!, { role: "assistant", content: fullContent }];
            if (!existing) {
              const created = createSave(messagesWithAssistant);
              saveId = created.id;
              const updated = await updateSave(saveId, messagesWithAssistant);
              title = updated.title;
            } else {
              const updated = await updateSave(saveId, messagesWithAssistant);
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
    { role: "assistant", content: world.intro },
  ];
  return new Response(
    JSON.stringify({ saveId: null, title: "New Game", messages: seedMessages }),
    { headers: { "content-type": "application/json; charset=utf-8" } },
  );
}
