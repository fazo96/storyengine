# Storyengine

An experimental prototype TTRPG engine that uses AI as game master
and narrator.

## Requirements

- Deno
- Node.JS
- LLM Inference API with GLM 4.6 or similar model

## Getting Started

Run the install task
```bash
deno install
```

Run the dev:api task to run the backend.
You need to pass some environment variables:

- API_KEY: api key for LLM inference
- API_URL: base URL for LLM inference, such as `https://nano-gpt.com/api/v1`
- MODEL: set to `glm-4.6` (recommended) however in theory any model with tool calling can work.

```bash
env API_KEY="..." API_URL="..." MODEL="glm-4.6" npm run dev:api
```

Now run the frontend in a separate terminal:

```bash
npm run dev:vite
```

Open the app:
```text
http://localhost:3000/
```
