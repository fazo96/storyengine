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
