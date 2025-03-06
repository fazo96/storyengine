import { create } from 'zustand'
import { useLLM } from '../llm/useLLM.js'
import { useEffect } from 'react'
import dedent from 'dedent'
import useLLMTools from '../llm/useLLMTools.js'
import { useGenerateLocation } from './generators/useGenerateLocation.js'
import { useStreamNarration } from '../util/useStreamNarration.js'

export interface Location {
  id: number,
  /**
   * The name of the location
   */
  name: string,
  /**
   * Short description of the location with key details
   */
  description: string,
  /**
   * The directions that can be moved to from this location
   */
  connections: number[],
}

export interface LogEntry {
  role: 'player' | 'narrator' | 'event' | 'debug',
  label?: string,
  content: string,
  debugInfo?: any,
  loading?: boolean,
}

export interface GameState {
  currentLocationId: number | null,
  log: LogEntry[],
  world: {
    locations: Location[]
  },
  getStateForLLM: () => string,
  /**
   * Move to a new location
   * @param locationId - The ID of the location to move to
   */
  move: (locationId: number) => void,
  /**
   * Add a new location
   * @param name - The name of the new location
   * @param description - The short description of the new location with key details
   * @param connections - The directions that can be moved to from this location
   * @returns The ID of the new location
   */
  addLocation: (location: Omit<Location, 'id'>) => number,
  /**
   * Roll a die
   * @returns The result of the die roll, from 1 to 6
   */
  rollDie: () => number,
  /**
   * Add a log entry
   * @param entry - The log entry to add
   * @returns The index of the log entry
   */
  addLogEntry: (entry: LogEntry) => number,
  /**
   * Update a log entry
   * @param index - The index of the log entry to update
   * @param entry - The updated entry fields
   */
  updateLogEntry: (index: number, entry: Partial<LogEntry>) => void,
  /**
   * Initialize the game
   */
  initGame: (locations: Location[], currentLocationId: number) => Promise<void>,
  /**
   * Get the current location
   * @returns The current location
   */
  getCurrentLocation: () => Location | null,
}

const useGameStore = create<GameState>((set, get) => ({
  currentLocationId: null,
  log: [],
  world: {
    locations: [],
  },
  getStateForLLM: () => {
    const currentLocation = get().getCurrentLocation();
    const connections = currentLocation?.connections || [];
    const connectedLocations = get().world.locations.filter((location) => connections.includes(location.id));

    let state = '# Current game state\n\n'

    if (currentLocation) {
      state += '## Current location\n\n'
      state += `The player is currently in the location ${currentLocation.name} (ID: ${currentLocation.id}).\n\n${currentLocation.description}\n\n`

      if (connectedLocations.length > 0) {
        state += '## Connected locations\n\n'
        state += 'The player can move to the following locations:\n\n'
        state += connectedLocations.map((location) => `### ${location.name} (ID: ${location.id})\n\n${location.description}\n\n`).join('\n')
      }
    }

    return state;
  },
  move: (locationId: number) => {
    // TODO: check valid move
    set((state) => {
      return {
        ...state,
        currentLocationId: locationId,
      }
    })
  },
  addLocation: (location: Omit<Location, 'id'>) => {
    const newLocationId = get().world.locations.length + 1;
    set((state) => {
      const newLocation: Location = {
        id: newLocationId,
        ...location,
      }

      const currentLocation = state.world.locations.find((location) => location.id === state.currentLocationId);
      let newLocations = [
        ...state.world.locations.map(l => ({
          ...l,
          connections: location.connections.includes(l.id) ? [...l.connections, newLocationId] : l.connections,
        })),
        newLocation,
      ];

      return {
        currentLocationId: currentLocation ? currentLocation.id : newLocation.id,
        world: {
          locations: newLocations,
        },
      }
    })
    return newLocationId;
  },
  rollDie: () => {
    return Math.floor(Math.random() * 6) + 1;
  },
  addLogEntry: (entry: LogEntry) => {
    set((state) => ({
      log: [...state.log, entry],
    }))

    return get().log.length - 1
  },
  updateLogEntry: (index: number, entry: Partial<LogEntry>) => {
    set((state) => {
      const existingLogEntry = state.log[index];
      if (!existingLogEntry) {
        return state;
      }
      return {
        log: [...state.log.slice(0, index), { ...existingLogEntry, ...entry }, ...state.log.slice(index + 1)],
      }
    })
  },
  initGame: async (locations: Location[], currentLocationId: number) => {
    set(() => ({
      currentLocationId,
      log: [],
      world: {
        locations,
      },
    }))
  },
  getCurrentLocation: () => {
    const currentLocationId = get().currentLocationId;
    if (!currentLocationId) {
      return null;
    }
    return get().world.locations.find((location) => location.id === currentLocationId) || null;
  }
}))

export const systemPrompt = dedent(`
  You are a game engine for text role playing.
  Your job is to ONLY DESCRIBE THE WORLD.
  You should not make any decisions or take any actions.
  You should not ask the player for any input.
  You should not provide any options or choices.
  You should not provide any advice or guidance.:
  You MUST always refer to the player as "You"
`)

interface GameOptions {
  ollamaAddress: string | undefined;
  model: string;
}

/**
 * Use Game hook: manages the game state
 * @param ollamaAddress - The address of the Ollama server
 * @param model - The model to use for the LLM
 * @returns The game state and actions to interact with the game
 */
function useGame(options: GameOptions) {
  const gameStore = useGameStore();
  const tools = useLLMTools(gameStore);
  const llm = useLLM(options.ollamaAddress, options.model);

  const generateLocation = useGenerateLocation(gameStore, llm);
  const streamNarration = useStreamNarration(gameStore, llm);

  function debugPrintGameState() {
    gameStore.addLogEntry({
      role: 'debug',
      label: 'Game state',
      content: `${gameStore.getStateForLLM()}`,
    })
  }

  async function describeCurrentLocation() {
    const currentLocation = gameStore.getCurrentLocation();
    if (!currentLocation) {
      return;
    }
    return streamNarration(dedent(`
      ${gameStore.getStateForLLM()}

      Your task: Describe the current location

      If there are any other locations that can be moved to, YOU MUST list them with a bullet point list.
      If there are no other locations that can be moved to, you should say so.
    `));
  }

  // This is the function that will be called when the game is initialized

  async function initGame() {
    gameStore.addLogEntry({
      role: 'narrator',
      content: 'Welcome to the game! Generating world...',
    })

    const firstLocationId = gameStore.addLocation(await generateLocation([]));

    // Generate three locations connected to the first location
    for (let i = 0; i < 3; i++) {
      gameStore.addLocation(await generateLocation([firstLocationId]));
    }

    gameStore.addLogEntry({
      role: 'narrator',
      content: 'World generated!',
    })

    debugPrintGameState();

    await describeCurrentLocation()
  }

  // This is the function that will be called when the player makes a move
  async function play(command: string) {
    gameStore.addLogEntry({
      role: 'player',
      content: command,
    })

    const fullSystemPrompt = dedent(`
      ${systemPrompt}

      You are given a command from the player.
      You should call a tool depending on the command.
      If there is no relevant tool for the command, use the 'reply' tool
      to explain the situation.

      What follows is the current game state:

      ${gameStore.getStateForLLM()}
    `)

    const locationBefore = gameStore.getCurrentLocation();

    const result = await llm.inference(fullSystemPrompt, command, tools);

    const locationAfter = gameStore.getCurrentLocation();

    if (result) {
      gameStore.addLogEntry({
        role: 'narrator',
        content: result,
      })
    }

    gameStore.addLogEntry({
      role: 'debug',
      content: 'Game state after command',
      debugInfo: {
        locationBefore,
        locationAfter,
      },
    })
    if (locationAfter && locationBefore !== locationAfter) {
      if (locationAfter.connections.length < 2) {
        // Add two other connections
        gameStore.addLocation(await generateLocation([locationAfter.id]));
        gameStore.addLocation(await generateLocation([locationAfter.id]));
      }

      await describeCurrentLocation();
    }
  }

  // Initialize the game automatically when the hook is mounted
  useEffect(() => {
    initGame();
  }, []);

  // Return the game state and actions to interact with the game
  return {
    ...gameStore,
    llm, // expose the LLM itself
    play,
    initGame,
  }
}

export default useGame;
