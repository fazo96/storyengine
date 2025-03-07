import { Box, Text } from "ink";
import Markdown from "./Markdown.js";
import React from "react";
import { LogEntry as LogEntryType } from "../hooks/game/useGame.js";
import _ from 'lodash';
import ProgressBar from "./ProgressBar.js";

export function LogEntry({ logEntry, debug }: { logEntry: LogEntryType, debug: boolean }) {
  let color = 'gray'
  if (logEntry.role === 'player') {
    color = 'green'
  } else if (logEntry.role === 'narrator') {
    color = 'yellow'
  } else if (logEntry.role === 'event') {
    color = 'red'
  }

  if (!logEntry.content) {
    return null;
  }

  return (
    <Box flexDirection="column" width="100%">
      <Text color={color} wrap="wrap">{_.capitalize(logEntry.label || logEntry.role)}: </Text>
      <Markdown>{logEntry.content}</Markdown>
      {logEntry.debugInfo && debug && (
        <Text color="gray" wrap="wrap">
          {JSON.stringify(logEntry.debugInfo, null, 2)}
        </Text>
      )}
      {logEntry.progress !== undefined && logEntry.progress < 1 && (
        <Text color="gray">
          <ProgressBar
            percent={logEntry.progress}
          />
        </Text>
      )}
    </Box>
  )
}
