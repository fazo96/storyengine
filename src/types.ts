import { ToolCall } from "./tools.ts";

export type Role = "user" | "assistant" | "system" | "game" | "tool" | "error";

export interface ChatMessage {
  role: Role;
  content: string;
  tool_calls?: ToolCall[];
}

export interface Save {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
}
