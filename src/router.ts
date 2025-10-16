import { serveIndex } from "./staticFileServer.ts";
import { serveDir } from "@std/http/file-server";
import { handleHistory, handleChat } from "./conversation.ts";
import { listWorlds, createWorld, updateWorld, deleteWorld } from "./worlds.ts";
import { getDB } from "./db.ts";
import { listSaves, deleteSave } from "./save.ts";

export async function router(request: Request): Promise<Response> {
  const url = new URL(request.url);
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
  if (request.method === "GET" && url.pathname === "/api/worlds") {
    const worlds = listWorlds();
    return new Response(JSON.stringify({ worlds }), {
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
  if (request.method === "POST" && url.pathname === "/api/worlds") {
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return new Response(JSON.stringify({ error: "Expected application/json" }), { status: 400, headers: { "content-type": "application/json; charset=utf-8" } });
    }
    const body = await request.json().catch(() => ({} as unknown));
    const obj = (typeof body === "object" && body !== null) ? body as Record<string, unknown> : {};
    const name = typeof obj.name === "string" ? obj.name.trim() : "";
    const synopsis = typeof obj.synopsis === "string" ? obj.synopsis.trim() : "";
    const description = typeof obj.description === "string" ? obj.description.trim() : "";
    const intro = typeof obj.intro === "string" ? obj.intro.trim() : "";
    if (!name || !synopsis || !description || !intro) {
      return new Response(JSON.stringify({ error: "Missing required fields: name, synopsis, description, intro" }), { status: 400, headers: { "content-type": "application/json; charset=utf-8" } });
    }
    const world = createWorld(name, synopsis, description, intro);
    return new Response(JSON.stringify({ world }), { status: 201, headers: { "content-type": "application/json; charset=utf-8" } });
  }
  if (request.method === "PUT" && url.pathname.startsWith("/api/worlds/")) {
    const id = decodeURIComponent(url.pathname.slice("/api/worlds/".length)).trim();
    if (!id) {
      return new Response(JSON.stringify({ error: "Missing id" }), { status: 400, headers: { "content-type": "application/json; charset=utf-8" } });
    }
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return new Response(JSON.stringify({ error: "Expected application/json" }), { status: 400, headers: { "content-type": "application/json; charset=utf-8" } });
    }
    const body = await request.json().catch(() => ({} as unknown));
    const obj = (typeof body === "object" && body !== null) ? body as Record<string, unknown> : {};
    const updates: Record<string, unknown> = {};
    if (typeof obj.name === "string") updates.name = obj.name.trim();
    if (typeof obj.synopsis === "string") updates.synopsis = obj.synopsis.trim();
    if (typeof obj.description === "string") updates.description = obj.description.trim();
    if (typeof obj.intro === "string") updates.intro = obj.intro.trim();
    if (Object.keys(updates).length === 0) {
      return new Response(JSON.stringify({ error: "No valid fields to update" }), { status: 400, headers: { "content-type": "application/json; charset=utf-8" } });
    }
    const world = updateWorld(id, updates as { name?: string; synopsis?: string; description?: string; intro?: string });
    if (!world) {
      return new Response(JSON.stringify({ error: "World not found" }), { status: 404, headers: { "content-type": "application/json; charset=utf-8" } });
    }
    return new Response(JSON.stringify({ world }), { headers: { "content-type": "application/json; charset=utf-8" } });
  }
  if (request.method === "DELETE" && url.pathname.startsWith("/api/worlds/")) {
    const id = decodeURIComponent(url.pathname.slice("/api/worlds/".length)).trim();
    if (!id) {
      return new Response(JSON.stringify({ error: "Missing id" }), { status: 400, headers: { "content-type": "application/json; charset=utf-8" } });
    }
    // Prevent deleting worlds that still have saves
    const row = getDB().prepare("SELECT COUNT(1) as c FROM saves WHERE world_id = ?").get(id) as { c?: number } | undefined;
    const count = (row?.c ?? 0) as number;
    if (count > 0) {
      return new Response(JSON.stringify({ ok: false, error: "World has saves; delete saves first" }), { status: 409, headers: { "content-type": "application/json; charset=utf-8" } });
    }
    const ok = deleteWorld(id);
    return new Response(JSON.stringify({ ok }), { status: ok ? 200 : 404, headers: { "content-type": "application/json; charset=utf-8" } });
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
  if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
    return serveIndex(request);
  }
  if (request.method === "GET" && url.pathname.startsWith("/static")) {
    return serveDir(request);
  }
  return new Response("Not Found", { status: 404 });
}
