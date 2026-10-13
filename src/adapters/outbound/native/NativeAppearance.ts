import { Appearance } from 'react-native';

import type { NativeAppearance } from '@root/modules/appearance/application/ports';

/**
 * Repassa a escolha ao React Native. No Android vira o modo noturno do
 * AppCompat (alertas, seletores e os botões da barra de navegação, que a
 * MainActivity reaplica); no iOS, o estilo das janelas. `useColorScheme()`
 * passa a devolver o esquema escolhido.
 */
export const nativeAppearance: NativeAppearance = {
  apply(preference) {
    Appearance.setColorScheme(preference === 'system' ? 'auto' : preference);
  },
};
