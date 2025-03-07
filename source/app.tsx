import React, {useState} from 'react';
import {Text, Box } from 'ink';
import TextInput from 'ink-text-input';
import _ from 'lodash';
import useGame from './hooks/game/useGame.js';
import { LogEntry } from './components/LogEntry.js';
import Spinner from 'ink-spinner';
export default function App({
  ollamaAddress,
  model,
  debug,
}: {
  ollamaAddress: string | undefined;
  model: string;
  debug: boolean;
}) {
  const [input, setInput] = useState('');

  const { log, llm, play } = useGame({
    ollamaAddress,
    model,
  });

  const handleSubmit = () => {
		play(input);
		setInput('');
	};

  const logEntries = debug ? log : log.filter((logEntry) => logEntry.role !== 'debug');

	return (
		<Box flexDirection="column">
			{/* Game log */}
			{logEntries.map((logEntry, index) => (
				<LogEntry key={index} logEntry={logEntry} debug={debug} />
			))}

			{/* Loading indicator */}
			{llm.isLoading && (
        <Box flexDirection="row" alignItems="center" justifyContent="center">
          <Spinner />
        </Box>
			)}

			{/* Input field */}
			{!llm.isLoading && (
				<Box marginTop={1} borderStyle="single">
					<Text color="green">You: </Text>
					<TextInput
						value={input}
						onChange={setInput}
						onSubmit={handleSubmit}
					/>
				</Box>
			)}
		</Box>
	);
}
