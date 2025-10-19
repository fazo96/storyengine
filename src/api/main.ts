/// <reference lib="deno.ns" />

import { router } from "./router.ts";

if (import.meta.main) {
  const serverPort = Number(Deno.env.get("PORT") || 8080);
  Deno.serve({ port: serverPort }, router);
  // Log a helpful message
  console.log(`Server running at http://localhost:${serverPort}`);
}
