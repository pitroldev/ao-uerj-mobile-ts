import BootSplash from 'react-native-bootsplash';

let pending = true;

/**
 * Cada raiz do app (recriar a atividade monta outra) começa com o splash
 * nativo na tela, que só sai depois que a primeira tela foi desenhada.
 */
export function resetSplash() {
  pending = true;
}

/**
 * Esconde o splash no primeiro layout de tela da raiz atual. O `onReady` da
 * navegação chega antes de o react-native-screens montar a tela, e esconder
 * nele deixava um instante de azul vazio entre o splash e a primeira tela.
 */
export function hideSplash() {
  if (!pending) return;
  pending = false;
  BootSplash.hide({ fade: true }).catch(() => undefined);
}
