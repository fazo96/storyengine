import dedent from "dedent";
import { locationModifiers } from "../../../oracles/index.js";
import { LLM } from "../../llm/useLLM.js";
import { locationTypes } from "../../../oracles/index.js";
import { GameState, systemPrompt, Location } from "../useGame.js";
import _ from 'lodash';

export function useGenerateLocation(gameStore: GameState, llm: LLM) {
  return async function(connectedLocationIds: number[]): Promise<Omit<Location, 'id'>> {
    const locationType = _.sample(locationTypes);
    const locationModifier = _.sample(locationModifiers);
    const name = `${locationType} of ${locationModifier}`;

    const prompt = dedent(`
      Generate a short description of a ${locationType} location that is ${locationModifier}.
      The description should be a few sentences long and include key details about the location.
    `)

    gameStore.addLogEntry({
      role: 'debug',
      content: `PROMPT: ${prompt}`,
    })

    const description = await llm.inference(systemPrompt, prompt);

    gameStore.addLogEntry({
      role: 'debug',
      content: `DESCRIPTION: ${description}`,
    })

    return {
      name: name,
      description: description,
      connections: connectedLocationIds,
    }
  }
}
