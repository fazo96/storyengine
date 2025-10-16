import { ChatMessage } from "./types.ts";
import { toolDefinitions, executeTool, ToolCall } from "./tools.ts";

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

  const providerTools = toolDefinitions.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters ?? { type: "object", properties: {} },
    },
  }));

  let accumulatedMessages: ChatMessage[] = [ ...messages ]
  let doneWithTools = false;

  while (!doneWithTools) {
    doneWithTools = true; // this will get set to false if there are tool calls during this inference
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
        messages: accumulatedMessages,
        stream: true,
        tools: providerTools,
        tool_choice: "auto",
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

      let allToolCalls: Array<ToolCall> = []

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
          break; // stream end
        }
        try {
          const json = JSON.parse(data) as Record<string, unknown>;
          // Try common shapes from OpenAI-compatible providers
          const choices = (json["choices"] as unknown[]) ?? [];
          const firstUnknown = choices && choices.length > 0 ? (choices[0] as unknown) : null;
          let deltaText = "";
          let finishReason: string | null = null;
          if (firstUnknown && typeof firstUnknown === "object") {
            const firstObj = firstUnknown as Record<string, unknown>;
            finishReason = firstObj["finish_reason"] as string | null;
            const delta = firstObj["delta"];
            if (delta && typeof delta === "object") {
              const content = (delta as Record<string, unknown>)["content"];
              if (typeof content === "string") {
                deltaText = content;
              }
              const toolCalls = (delta as Record<string, unknown>)["tool_calls"];
              if (Array.isArray(toolCalls) && toolCalls.length > 0) {
                allToolCalls = [...allToolCalls, ...toolCalls];
                accumulatedMessages = [...accumulatedMessages, {
                  role: 'assistant',
                  tool_calls: toolCalls,
                }];
                doneWithTools = false;
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
          if (finishReason === "tool_calls") {
            if (allToolCalls.length <= 0) {
              console.error('No tool calls');
            }
            for (const tc of allToolCalls) {
              yield "[Calling tool: " + tc.function.name + "]\n\n";
              // TODO: execute tools in parallel (not very important)
              const result = await executeTool(tc);
              if (result) {
                yield "[Tool result: " + result.content + "]\n\n";
                accumulatedMessages = [...accumulatedMessages, result];
                doneWithTools = false;
              }
            }
          } else if (finishReason) {
            break;
          }
        } catch (_) {
          // Ignore JSON parse errors for malformed lines
        }
      }
    }
  }
}
