import {DefaultTheme} from 'styled-components/native';

export function getAliasPeriod(alias: string): keyof DefaultTheme['COLORS'] {
  if (alias.includes('M')) {
    return 'MORNING';
  }

  if (alias.includes('T')) {
    return 'AFTERNOON';
  }

  return 'NIGHT';
}
