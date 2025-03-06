#!/usr/bin/env node
import React from 'react';
import {render} from 'ink';
import meow from 'meow';
import App from './app.js';

const cli = meow(
	`
	Usage
	  $ storyengine

	Options
		--ollama-address address (defaults to http://localhost:11434)
		--model model (defaults to mistral-small:22b)

	Examples
	  $ storyengine --ollama-address http://localhost:11434 --model llama3.2:3b
`,
	{
		importMeta: import.meta,
		flags: {
			ollamaAddress: {
				type: 'string',
			},
			model: {
				type: 'string',
				default: 'mistral-small:22b',
			},
		},
	},
);

render(<App ollamaAddress={cli.flags.ollamaAddress} model={cli.flags.model} />);
