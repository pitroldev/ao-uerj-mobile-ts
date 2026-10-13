import React, { useEffect, useId, useRef, useSyncExternalStore } from 'react';
import { StyleSheet } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// oxlint-disable-next-line no-restricted-imports -- a pasta Snackbar é a única porta para a lib
import Toast, {
  type ToastAnimationConfig,
  type ToastShowParams,
} from 'react-native-toast-message';

import { useReducedMotion } from '../hooks/useReducedMotion';
import {
  addHost,
  hostGone,
  hostReady,
  removeHost,
  subscribeHosts,
  topHost,
} from './hosts';
import { toastConfig } from './Snackbar';

const VISIBLE_MS = 10000;
/** Distância entre o aviso e a área segura inferior (ou o teclado). */
const GAP = 16;
const NO_MOTION: ToastAnimationConfig = { type: 'timing', duration: 0 };

/**
 * Onde os avisos do `snackbar` aparecem: um na raiz do app e um em cada folha
 * aberta (a folha é um `Modal`, uma janela acima do app). Desenha só o host
 * montado por último; quando ele sai com um aviso na tela, o aviso passa para
 * o de baixo (o "Relato enviado" de uma folha que fecha não se perde). O
 * aviso fica acima da área segura inferior e sobe junto com o teclado.
 */
export function SnackbarHost() {
  const id = useId();
  const active = useSyncExternalStore(subscribeHosts, topHost) === id;
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const showing = useRef<ToastShowParams | null>(null);

  useEffect(() => {
    addHost(id);
    return () => removeHost(id);
  }, [id]);

  useEffect(() => {
    if (!active) return;
    hostReady(id);
    return () => {
      hostGone(id, showing.current);
      showing.current = null;
    };
  }, [active, id]);

  if (!active) return null;

  return (
    <KeyboardStickyView
      pointerEvents="box-none"
      style={StyleSheet.absoluteFill}
      offset={{ opened: insets.bottom }}
    >
      <Toast
        config={toastConfig}
        position="bottom"
        visibilityTime={VISIBLE_MS}
        bottomOffset={insets.bottom + GAP}
        // quem acompanha o teclado é o KeyboardStickyView, nas duas plataformas
        avoidKeyboard={false}
        animationConfig={reduced ? NO_MOTION : undefined}
        onShow={params => {
          showing.current = params;
        }}
        onHide={() => {
          showing.current = null;
        }}
      />
    </KeyboardStickyView>
  );
}
