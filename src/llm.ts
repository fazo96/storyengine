import { ChatMessage } from "../main.ts";

export async function inference(messages: ChatMessage[]): Promise<string> {
    const apiKey = Deno.env.get("API_KEY");
    const apiUrl = Deno.env.get("API_URL");
    const model = Deno.env.get("MODEL");
    if (!apiKey || !apiUrl || !model) {
      return `Must set API_KEY, API_URL, and MODEL environment variables`;
    }

    const response = await fetch(`${apiUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        stream: false,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Error from API
        (${response.status}): ${body.slice(0, 512)}`);
    } else {
      const json = await response.json();
      const content = json?.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error(`No response from API`);
      }
      return content;
    }

}

// Stream tokens from a Chat Completions-compatible SSE endpoint.
// Yields only the textual deltas as they arrive.
export async function* inferenceStream(messages: ChatMessage[]): AsyncGenerator<string, void, unknown> {
  const apiKey = Deno.env.get("API_KEY");
  const apiUrl = Deno.env.get("API_URL");
  const model = Deno.env.get("MODEL");
  if (!apiKey || !apiUrl || !model) {
    // Yield the error and end
    yield `Must set API_KEY, API_URL, and MODEL environment variables`;
    return;
  }

  const response = await fetch(`${apiUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      // Many providers use SSE for streaming; accept isn't strictly required but kept for clarity
      "Accept": "text/event-stream",
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
    }),
  });

  if (!response.ok || !response.body) {
    const body = await response.text().catch(() => "");
    yield `Error from API (${response.status}): ${body.slice(0, 512)}`;
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Split on SSE line boundaries
    const lines = buffer.split(/\r?\n/);
    // Keep the last partial line in the buffer
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === "" || trimmed.startsWith(":")) {
        continue; // ignore comments/keep-alives
      }
      const prefix = "data: ";
      if (!trimmed.startsWith(prefix)) {
        continue;
      }
      const data = trimmed.slice(prefix.length).trim();
      if (data === "[DONE]") {
        return; // stream end
      }
      try {
        const json = JSON.parse(data) as Record<string, unknown>;
        // Try common shapes from OpenAI-compatible providers
        const choices = (json["choices"] as unknown[]) ?? [];
        const firstUnknown = choices && choices.length > 0 ? (choices[0] as unknown) : null;
        let deltaText = "";
        if (firstUnknown && typeof firstUnknown === "object") {
          const firstObj = firstUnknown as Record<string, unknown>;
          const delta = firstObj["delta"];
          if (delta && typeof delta === "object") {
            const content = (delta as Record<string, unknown>)["content"];
            if (typeof content === "string") {
              deltaText = content;
            }
          } else {
            const textVal = firstObj["text"];
            if (typeof textVal === "string") {
              // Some providers stream raw text
              deltaText = textVal;
            }
          }
        }
        if (deltaText) {
          yield deltaText;
        }
      } catch (_) {
        // Ignore JSON parse errors for malformed lines
      }
    }
  }
}
