import {useState} from 'react';
import { Ollama, ToolCall, Tool, Options } from 'ollama';

export interface Message {
  /**
   * The role of the message sender - whether it came from the player or the LLM
   * or 'tool' if this is a tool call response
   */
	role: 'user' | 'assistant' | 'tool';
  /**
   * The content of the message
   */
	content: string;
  /**
   * The tool calls made by the LLM
   */
  toolCalls?: ToolCall[];
  /**
   * The raw LLM response
   */
  response?: any;
};

export interface Tools {
  tools: Tool[];
  executeToolCall: (toolCall: ToolCall) => void | Promise<void>;
}

export interface LLM {
  inference: (systemPrompt: string, userPrompt: string, tools?: Tools, callback?: ((content: string) => void) | null) => Promise<string>;
  isLoading: boolean;
}

/**
 * Use LLM hook: manages communication with the LLM
 * @param prompt - The prompt to use for the LLM
 * @param ollamaAddress - The address of the Ollama server
 * @param tools - The tools available to the LLM
 * @returns The LLM hook
 */
export function useLLM(ollamaAddress: string | undefined, model: string | undefined = 'mistral-small:22b'): LLM {
	const [isLoading, setIsLoading] = useState(false);

	// Initialize Ollama client
	const ollama = new Ollama({
		host: ollamaAddress || 'http://localhost:11434'
	});

  const options: Partial<Options> = {
    temperature: 0.8,
    num_ctx: 16384,
  };

	const inference = async (systemPrompt: string, userPrompt: string, tools?: Tools, callback?: ((content: string) => void) | null) => {
		setIsLoading(true);

    const responseGenerator = await ollama.chat({
      model,
      options,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      stream: true,
      tools: tools?.tools
    });

    let content = '';
    let toolCalls: ToolCall[] = [];

    for await (const chunk of responseGenerator) {
      content += chunk.message.content;
      if (chunk.message.tool_calls) {
        toolCalls = [...toolCalls, ...chunk.message.tool_calls];
      }
      callback?.(content);
    }


    try {
      const responseJson = JSON.parse(content.replace(/^```json/g, '').replace(/```$/g, ''));
      if (responseJson?.type === 'function') {
        toolCalls = [responseJson];
        content = ''
      }

      if (Array.isArray(responseJson)) {
        toolCalls = responseJson;
        content = ''
      }
    } catch {
      // Do nothing
    }

    if (toolCalls.length > 0) {
      for (const toolCall of toolCalls) {
        await tools?.executeToolCall(toolCall);
      }
    }

		setIsLoading(false);

    return content
	};

	return {
		isLoading,
		inference,
	};
}
