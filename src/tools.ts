import { ChatMessage } from "./types.ts";

export interface ToolDefinition {
  name: string;
  description: string;
  // Simple args schema description for the model
  parameters?: Record<string, unknown>;
}

export interface ToolCall {
  id?: string;
  type: "function";
  function: {
    name: string;
    arguments: string; // JSON string per OpenAI-compatible schema
  };
}

export interface ToolResultMessage {
  role: "tool";
  tool_call_id?: string;
  name: string;
  content: string; // JSON string result
}

export const toolDefinitions: ToolDefinition[] = [
  {
    name: "roll_d6",
    description: "Roll a d6 and return the face value and whether it is a success (5 or 6).",
    parameters: {
      type: "object",
      properties: {},
    },
  },
];

export async function executeTool(tool: ToolCall): Promise<ToolResultMessage | null> {
  if (tool.type !== "function") return null;
  const name = tool.function?.name ?? "";
  switch (name) {
    case "roll_d6": {
      const value = 1 + Math.floor(Math.random() * 6);
      const success = value >= 5;
      const payload = { die: 6, value, success };
      console.log('roll_d6', payload);
      return {
        role: "tool",
        tool_call_id: tool.id,
        name,
        content: JSON.stringify(payload),
      };
    }
    default:
      return {
        role: "tool",
        tool_call_id: tool.id,
        name,
        content: JSON.stringify({ error: `Unknown tool: ${name}` }),
      };
  }
}

export type ChatLikeMessage = ChatMessage | ToolResultMessage | { role: "system" | "assistant" | "user"; content: string; name?: string };


