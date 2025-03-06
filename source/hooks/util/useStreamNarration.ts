import { systemPrompt } from "../game/useGame.js";

import { GameState } from "../game/useGame.js";
import { LLM } from "../llm/useLLM.js";

export function useStreamNarration(gameStore: GameState, llm: LLM) {
  return async function(narrationPrompt: string) {
    let entryId: null | number = null

    const narration = await llm.inference(systemPrompt, narrationPrompt, undefined, (content: string) => {
      if (entryId === null) {
        entryId = gameStore.addLogEntry({
          role: 'narrator',
          content: content,
          loading: true,
        })
      } else {
        gameStore.updateLogEntry(entryId, {
          content: content,
        })
      }
    });

    if (entryId !== null) {
      gameStore.updateLogEntry(entryId, {
        loading: false,
      })
    }

    return narration;
  }

}
