import React from 'react';
import { Text } from 'ink';

interface BarProps {
  percent?: number;
  columns?: number;
  left?: number;
  right?: number;
  character?: string;
  rightPad?: boolean;
  [key: string]: any; // For additional props passed to Text component
}

const Bar: React.FC<BarProps> = (props) => {
  const {
    percent = 1,
    columns = 0,
    left = 0,
    right = 0,
    character = '█',
    rightPad = false,
    ...restProps
  } = props;

  const getString = () => {
    const screen = columns || process.stdout.columns || 80;
    const space = screen - right - left;
    const max = Math.min(Math.floor(space * percent), space);
    const chars = character.repeat(max);

    if (!rightPad) {
      return chars;
    }

    return chars + ' '.repeat(space - max);
  };

  return (
    <Text {...restProps}>
      {getString()}
    </Text>
  );
};

export default Bar;
