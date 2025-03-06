import { Tool, ToolCall } from "ollama"
import { GameState } from "./useGame.js"
import { Tools } from "./useLLM.js";

/**
 * Use LLM tools hook: manages the tools available to the LLM
 * to interact with the game state
 * @param gameState - The game state
 * @returns The tools available to the LLM
 */
export default function useLLMTools(gameState: GameState): Tools {
  const tools: Tool[] = [
    {
      type: 'function',
      function: {
        name: 'move',
        description: 'Move to a new location',
        parameters: {
          type: 'object',
          properties: {
            locationId: { type: 'integer', description: 'The ID of the location to move to' },
          },
          required: ['locationId'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'reply',
        description: 'Reply to the player',
        parameters: {
          type: 'object',
          properties: {
            message: { type: 'string', description: 'The message to reply with' },
          },
          required: ['message'],
        },
      },
    }
  ]

  const executeToolCall = (toolCall: ToolCall) => {
    gameState.addLogEntry({
      role: 'narrator',
      content: `Executing tool call: ${toolCall.function.name} ${JSON.stringify(toolCall.function.arguments)}`,
    });

    if (toolCall.function.name === 'move') {
      gameState.move(toolCall.function.arguments['locationId']);
    } else if (toolCall.function.name === 'reply') {
      gameState.addLogEntry({
        role: 'narrator',
        content: toolCall.function.arguments['message'],
      });
    } else {
      gameState.addLogEntry({
        role: 'event',
        content: `Unknown tool call: ${toolCall.function.name} ${JSON.stringify(toolCall.function.arguments)}`,
      });
    }
  }

  return {
    tools,
    executeToolCall
  }
}
