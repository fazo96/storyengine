import { ToolCall } from "./tools.ts";

export type Role = "user" | "assistant" | "system" | "game" | "tool" | "error";

export type ChatMessageText = {
  role: Role;
  content: string;
}

export type ChatMessageToolCall = {
  role: "assistant";
  tool_calls: ToolCall[];
}

export type ChatMessage = ChatMessageText | ChatMessageToolCall;

export interface Save {
  id: string;
  worldId: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
}

export interface World {
  id?: string;
  name: string;
  synopsis: string;
  description: string;
  intro: string;
}
