import { serveIndex } from "./staticFileServer.ts";
import { handleHistory, handleChat } from "./conversation.ts";
import { listSaves, deleteSave } from "./save.ts";

export function router(request: Request): Promise<Response> | Response {
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
  if (request.method === "DELETE" && url.pathname.startsWith("/api/saves/")) {
    const id = decodeURIComponent(url.pathname.slice("/api/saves/".length)).trim();
    if (!id) {
      return new Response(JSON.stringify({ ok: false, error: "Missing id" }), {
        status: 400,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }
    const ok = deleteSave(id);
    return new Response(JSON.stringify({ ok }), {
      status: ok ? 200 : 404,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
  return new Response("Not Found", { status: 404 });
}
