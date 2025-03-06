# Story Engine

Story Engine is a text adventure terminal / CLI game with an engine inspired by
single player gamebooks like Fabled Lands and solo tabletop RPGs like
Notorious and Ironsworn.

Story engine combines a "mechanical" system with LLMs to generate stories
based on the "Oracles" built into the game, inspired by the TTRPG
community.

The project is currently a **partial prototype** that is not playable yet,
being still in experimentation phase to validate the limitations of the approach.

## Installation

You will need `npm` and `node` installed.

Clone the repository then run:

```bash
npm install
```

### Preparing the LLM

You need [ollama](https://ollama.com/) installed and running for the
game to work.

By default the game will use the `mistral-small:22b` model but you
can use other models, however if the game's prompts are not optimized for
the model you choose, it will not work well or at all.

Downloading this model requires almost 20 GB of free space.

Running the default model requires **lots of memory** (16GB free RAM)
and hardware acceleration (CUDA/ROCM) with 16 GB VRAM
for it to be fast enough to be smooth.

If you don't have hardware acceleration for ollama I recommend using
the `llama3.3:3b` model instead. The quality is significantly lower but
it's a lot easier to run and the game should be functional.

Downloading this model requires only a couple GBs of free space.

```bash
# Install the model
ollama pull mistral-small:22b

# Alternatively install the smaller model
ollama pull llama3.3:3b
```

## Running the game

```bash
npm run build-and-run
```

The game will connect to ollama at `http://localhost:11434` by default.

You can also specify a different model or ollama address:

```bash
npm run build-and-run -- --model=llama3.3:3b --ollamaAddress=http://localhost:11434
```

Finally pass the `--debug` flag to see detailed debug info during gameplay.

