export async function serveIndex(_request: Request): Promise<Response> {
  try {
    const file = await Deno.readFile(new URL("../static/index.html", import.meta.url));
    return new Response(file, {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(`Failed to read index.html: ${message}`, { status: 500 });
  }
}
