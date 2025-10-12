import { ChatMessage } from "./types.ts";
import { toolDefinitions, executeTool } from "./tools.ts";

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

// Non-streaming tool-call runner: lets the model call functions until it returns a final message.
export async function inferenceWithTools(messages: ChatMessage[]): Promise<string> {
  const apiKey = Deno.env.get("API_KEY");
  const apiUrl = Deno.env.get("API_URL");
  const model = Deno.env.get("MODEL");
  if (!apiKey || !apiUrl || !model) {
    return `Must set API_KEY, API_URL, and MODEL environment variables`;
  }

  // Convert our minimal messages into provider messages
  const workingMessages: Array<Record<string, unknown>> = messages.map((m) => ({ role: m.role, content: m.content }));

  // Map our tool definitions to provider format
  const providerTools = toolDefinitions.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters ?? { type: "object", properties: {} },
    },
  }));

  console.log('providerTools', providerTools);

  // Reasonable safety cap on recursive tool calls
  for (let iteration = 0; iteration < 8; iteration++) {
    const response = await fetch(`${apiUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: workingMessages,
        stream: false,
        tools: providerTools,
        tool_choice: "auto",
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Error from API (${response.status}): ${body.slice(0, 512)}`);
    }

    const json = await response.json() as Record<string, unknown>;
    const choicesUnknown = (json as Record<string, unknown>)["choices"] as unknown;
    const choice0 = Array.isArray(choicesUnknown) ? (choicesUnknown[0] as Record<string, unknown>) : undefined;
    const message = (choice0?.["message"] as Record<string, unknown>) ?? {};
    const contentVal = message["content"];
    const content: string | null = typeof contentVal === "string" ? contentVal : null;
    const toolCallsVal = message["tool_calls"] as unknown;
    const toolCalls: Array<Record<string, unknown>> = Array.isArray(toolCallsVal) ? (toolCallsVal as Array<Record<string, unknown>>) : [];

    // If there are tool calls, execute them and continue the loop
    if (toolCalls && toolCalls.length > 0) {
      // Include the assistant message that made the tool calls
      workingMessages.push({
        role: "assistant",
        content: content ?? "",
        tool_calls: toolCalls,
      });

      for (const tc of toolCalls) {
        const id = typeof (tc as Record<string, unknown>)["id"] === "string" ? (tc as Record<string, unknown>)["id"] as string : undefined;
        const fnUnknown = (tc as Record<string, unknown>)["function"] as unknown;
        const fnObj = (fnUnknown && typeof fnUnknown === "object") ? (fnUnknown as Record<string, unknown>) : {};
        const name = typeof fnObj["name"] === "string" ? (fnObj["name"] as string) : "";
        const args = typeof fnObj["arguments"] === "string" ? (fnObj["arguments"] as string) : "{}";
        const tool = { id, type: "function" as const, function: { name, arguments: args } };
        const resultMessage = await executeTool(tool);
        if (resultMessage) {
          workingMessages.push({
            role: "tool",
            tool_call_id: resultMessage.tool_call_id,
            name: resultMessage.name,
            content: resultMessage.content,
          });
        }
      }
      continue; // Ask the model again with tool results attached
    }

    // No tool calls: return content (may be empty)
    if (content && content.length > 0) {
      return content;
    }
    // Fallback: stringify full message if content missing
    return JSON.stringify(message);
  }

  return "Tool loop limit reached without final content.";
}
