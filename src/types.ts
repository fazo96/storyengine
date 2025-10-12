export type Role = "user" | "assistant" | "system" | "game" | "tool" | "error";

export interface ChatMessage {
  role: Role;
  content: string;
}

export interface Save {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
}
