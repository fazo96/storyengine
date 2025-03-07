import { Tool, ToolCall } from "ollama"
import { GameState } from "../game/useGame.js"
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
      role: 'debug',
      content: `Executing tool call: ${toolCall.function.name} ${JSON.stringify(toolCall.function.arguments)}`,
    });

    try {
    if (toolCall.function.name === 'move') {
      gameState.move(parseInt(toolCall.function.arguments['locationId'], 10));
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
    } catch(error) {
      gameState.addLogEntry({
        role: 'debug',
        content: `Error executing tool call: ${toolCall.function.name} ${JSON.stringify(toolCall.function.arguments)}`,
        debugInfo: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  return {
    tools,
    executeToolCall
  }
}
