import 'styled-components/native';
import 'styled-components';
import type { AppTheme } from '@root/themes/types';

declare module 'styled-components/native' {
  // O tema do app (tokens semânticos de `src/themes`).
  export interface DefaultTheme extends AppTheme {}
}

declare module 'styled-components' {
  export interface DefaultTheme extends AppTheme {}
}
