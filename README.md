# Storyengine

A minimal Deno + TypeScript starter. It demonstrates a tiny entrypoint (`main.ts`) and a `deno.json` task for a fast dev loop.

## Overview
- Uses the Deno runtime (no Node/npm required)
- Written in TypeScript
- Includes a dev task with file watching
- Import map configured for `@std/assert`

When run, the program serves a Datastar-powered chat UI and a NanoGPT-backed `/api/chat` endpoint.

## Requirements
- Install Deno: https://deno.land

Verify your install:
```bash
deno --version
```

## Getting Started
Set your NanoGPT API key (use a real key):
```bash
export NANOGPT_API_KEY="sk-..."
```

Run the dev task (watches files and restarts automatically):
```bash
deno task dev
```

Open the app:
```text
http://localhost:8080/
```

Run once without watch:
```bash
deno run --allow-net --allow-env --allow-read main.ts
```

## Project Structure
```text
.
├─ deno.json        # Tasks and import map
├─ index.html       # Datastar UI
├─ main.ts          # Deno server + /api/chat (NanoGPT)
└─ README.md        # This file
```

## Scripts (deno.json)
- `dev`: `deno run --allow-net --allow-env --allow-read --watch main.ts`

Run any task with:
```bash
deno task <name>
```

## Import Map
The project maps `@std/assert` to the official Standard Library distribution via JSR for convenient imports in tests and utilities.

## Notes
- The UI uses Datastar attributes to `@post('/api/chat')`, and the server returns HTML fragments that Datastar patches into `#messages`. See Datastar docs: [data-star.dev](https://data-star.dev/).
- The backend calls NanoGPT's OpenAI-compatible chat endpoint. See Quickstart: [docs.nano-gpt.com/quickstart#text-generation](https://docs.nano-gpt.com/quickstart#text-generation).

## Linting and Formatting
Deno includes linting and formatting out of the box:
```bash
deno lint
```
```bash
deno fmt
```

## Building a Binary (optional)
You can compile to a standalone executable:
```bash
deno compile -o storyengine main.ts
```

## License
Add your preferred license (e.g., MIT) in a `LICENSE` file.
