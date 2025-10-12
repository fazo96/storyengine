export async function inference(messages: ChatMessage[]): Promise<string> {
  try {
    const apiKey = Deno.env.get("NANOGPT_API_KEY");
    if (!apiKey) {
      return `NanoGPT API key is not set`;
    }

    const response = await fetch("https://nano-gpt.com/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "glm-4.6",
        messages: messages,
        stream: false,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      return `Error from NanoGPT (${response.status}): ${body.slice(0, 512)}`;
    } else {
      const json = await response.json();
      return json?.choices?.[0]?.message?.content ?? "(no response)";
    }
  } catch (err) {
    return `Request failed: ${err instanceof Error ? err.message : String(err)}`;
  }
}
