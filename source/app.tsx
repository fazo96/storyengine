import React, {useState} from 'react';
import {Text, Box } from 'ink';
import Divider from 'ink-divider';
import TextInput from 'ink-text-input';
import Markdown from './components/Markdown.js';
import _ from 'lodash';
import Spinner from 'ink-spinner';
import useGame from './hooks/useGame.js';

export default function App({ollamaAddress, model}: {ollamaAddress: string | undefined, model: string}) {
	const [input, setInput] = useState('');
	const {log, llm, play} = useGame(ollamaAddress, model);
	const handleSubmit = () => {
		play(input);
		setInput('');
	};

	return (
		<Box flexDirection="column" padding={1}>
			{/* Game log */}
			{log.map((logEntry, index) => (
				<Box key={index} marginBottom={1} flexDirection="column" width="100%">
					<Divider
						title={_.capitalize(logEntry.label || logEntry.role)}
					/>
					<Markdown>{logEntry.content}</Markdown>
					{logEntry.debugInfo && (
						<Text color="gray" wrap="wrap">
							{JSON.stringify(logEntry.debugInfo, null, 2)}
						</Text>
					)}
				</Box>
			))}

			{/* Loading indicator */}
			{llm.isLoading && (
        <Box flexDirection="row" alignItems="center" justifyContent="center">
          <Spinner />
        </Box>
			)}

			{/* Input field */}
			{!llm.isLoading && (
				<Box marginTop={1}>
					<Text>You: </Text>
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
