import { systemPrompt, intro } from "./src/game.ts";

const serverPort = 8080;

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
  // Accept JSON body with full chat history: { messages: [{ role: 'u'|'a'|'user'|'assistant', content: string }, ...] }
  // Fallback to legacy shape { prompt: string } for backward compatibility.
  const contentType = request.headers.get("content-type") ?? "";
  let providedMessages: Array<{ role: string; content: string }> | null = null;
  let legacyPrompt = "";
  if (contentType.includes("application/json")) {
    const data: unknown = await request.json().catch(() => ({} as unknown));
    if (typeof data === "object" && data !== null) {
      const msgs = (data as Record<string, unknown>).messages;
      if (Array.isArray(msgs)) {
        providedMessages = msgs
          .map((m: unknown) => {
            const obj = m as Record<string, unknown>;
            const role = typeof obj.role === "string" ? obj.role : "";
            const content = typeof obj.content === "string" ? obj.content : "";
            return { role, content };
          })
          .filter((m) => m.content.trim().length > 0);
      } else {
        const maybePrompt = (data as Record<string, unknown>).prompt;
        legacyPrompt = typeof maybePrompt === "string" ? maybePrompt : "";
      }
    }
  } else {
    const form = await request.formData();
    const value = form.get("prompt");
    legacyPrompt = typeof value === "string" ? value : "";
  }

  // If neither history nor prompt provided, no-op
  if ((!providedMessages || providedMessages.length === 0) && !legacyPrompt.trim()) {
    return new Response(JSON.stringify({ assistant: "" }), {
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  const apiKey = Deno.env.get("NANOGPT_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Server misconfigured: missing NANOGPT_API_KEY" }),
      { status: 500, headers: { "content-type": "application/json; charset=utf-8" } },
    );
  }

  // Build OpenAI-compatible chat request from provided history or legacy prompt
  const apiMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];
  apiMessages.push({ role: "system", content: systemPrompt });
  if (providedMessages && providedMessages.length > 0) {
    // Map frontend roles ('u'|'a') to OpenAI roles
    for (const m of providedMessages) {
      let normalizedRole: "user" | "assistant" | null = null;
      if (m.role === "u" || m.role === "user") normalizedRole = "user";
      if (m.role === "a" || m.role === "assistant") normalizedRole = "assistant";
      if (normalizedRole) apiMessages.push({ role: normalizedRole, content: m.content });
    }
  } else if (legacyPrompt.trim()) {
    // Legacy behavior: start with intro and the single user prompt
    apiMessages.push({ role: "assistant", content: intro });
    apiMessages.push({ role: "user", content: legacyPrompt.trim() });
  }

  const payload = {
    model: "glm-4.6",
    messages: apiMessages,
    stream: false,
  };

  let assistant = "";
  try {
    const response = await fetch("https://nano-gpt.com/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text();
      assistant = `Error from NanoGPT (${response.status}): ${body.slice(0, 512)}`;
    } else {
      const json = await response.json();
      assistant = json?.choices?.[0]?.message?.content ?? "(no response)";
    }
  } catch (err) {
    assistant = `Request failed: ${err instanceof Error ? err.message : String(err)}`;
  }

  // Return JSON response { assistant }
  return new Response(
    JSON.stringify({ assistant: String(assistant) }),
    { headers: { "content-type": "application/json; charset=utf-8" } },
  );
}

function handleHistory(_request: Request): Response {
  // Return initial chat history containing the first assistant message only
  const history = {
    messages: [
      { role: "a", content: intro },
    ],
  };
  return new Response(JSON.stringify(history), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
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
  return new Response("Not Found", { status: 404 });
}

if (import.meta.main) {
  Deno.serve({ port: serverPort }, router);
  // Log a helpful message
  console.log(`Server running at http://localhost:${serverPort}`);
}
