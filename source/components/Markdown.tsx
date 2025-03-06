import React from 'react';
import { Text } from 'ink';
import { marked } from 'marked';
import { markedTerminal } from 'marked-terminal';
import Spinner from 'ink-spinner';

function Markdown({ children, loading }: { children: string, loading?: boolean }) {
  if (!children) {
    return null;
  }

  marked.use(markedTerminal() as any);
  return <Text>{marked.parse(children) as string} {loading && <Spinner />}</Text>;
}

export default Markdown;
