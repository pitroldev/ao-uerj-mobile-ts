import { useEffect, useState } from 'react';
import {
  Keyboard,
  LayoutAnimation,
  Platform,
  type KeyboardEvent,
} from 'react-native';

/** Primeiro nível do Android em que o edge-to-edge é obrigatório (targetSdk 36). */
const ANDROID_FORCED_EDGE_TO_EDGE = 35;

/**
 * A janela é desenhada atrás das barras do sistema e o `adjustResize` não a
 * encolhe quando o teclado abre: quem desvia do teclado é a tela. No iOS é
 * sempre assim. No Android vale a partir do 15 (edge-to-edge obrigatório) ou
 * quando o app já recebe a área segura inferior (barra de navegação por cima).
 */
function windowIgnoresKeyboard(bottomInset: number): boolean {
  if (Platform.OS === 'ios') return true;
  return (
    Number(Platform.Version) >= ANDROID_FORCED_EDGE_TO_EDGE || bottomInset > 0
  );
}

/**
 * Quanto a tela precisa subir para que um rodapé fixo (o compositor do mural)
 * fique logo acima do teclado. Aplique como `paddingBottom` num contêiner que
 * vai até o fim da tela.
 *
 * O rodapé já reserva a área segura inferior; ela fica sob o teclado, então o
 * valor desconta `bottomInset`. No Android, a altura informada pelo React
 * Native já vem sem a barra de navegação. Substitui o `KeyboardAvoidingView`,
 * que no Android edge-to-edge não sobe a tela (comportamento indefinido) ou
 * deixa sobra ao fechar o teclado (`padding`/`height`).
 */
export function useKeyboardInset(bottomInset: number): number {
  const [keyboard, setKeyboard] = useState(0);

  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const animate = (event: KeyboardEvent) => {
      // no iOS o teclado anima; a tela acompanha com a mesma curva
      if (!ios || !event.duration) return;
      LayoutAnimation.configureNext({
        duration: event.duration,
        update: {
          duration: event.duration,
          type: LayoutAnimation.Types[event.easing] ?? 'keyboard',
        },
      });
    };
    const subscriptions = [
      Keyboard.addListener(
        ios ? 'keyboardWillShow' : 'keyboardDidShow',
        event => {
          animate(event);
          setKeyboard(event.endCoordinates.height);
        },
      ),
      Keyboard.addListener(
        ios ? 'keyboardWillHide' : 'keyboardDidHide',
        event => {
          animate(event);
          setKeyboard(0);
        },
      ),
    ];
    return () => subscriptions.forEach(subscription => subscription.remove());
  }, []);

  if (keyboard <= 0 || !windowIgnoresKeyboard(bottomInset)) return 0;
  return Math.max(0, Platform.OS === 'ios' ? keyboard - bottomInset : keyboard);
}

export default useKeyboardInset;
