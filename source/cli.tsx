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
    --debug (defaults to false)

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
      debug: {
        type: 'boolean',
        default: false,
      },
		},
	},
);

render(
  <App
    ollamaAddress={cli.flags.ollamaAddress}
    model={cli.flags.model}
    debug={cli.flags.debug}
  />,
);
