import { AccessibilityInfo, Platform } from 'react-native';

import { dismiss, display } from './hosts';
import { snackbarLabel, type SnackbarKind } from './Snackbar';

export type SnackbarMessage = {
  kind?: SnackbarKind;
  /** Título (14/20 semibold). */
  title: string;
  /** Detalhe (13/18). */
  detail?: string;
};

/**
 * Avisos curtos no rodapé. Telas e features só falam com esta fachada; o
 * react-native-toast-message fica dentro de `Snackbar/`, e o `SnackbarHost`
 * do topo (o da folha aberta ou o da raiz) desenha o aviso.
 *
 *   snackbar.success('Créditos salvos', 'O progresso foi recalculado.');
 *   snackbar.error(errorMessage(error));
 */
export const snackbar = {
  show({ kind = 'info', title, detail }: SnackbarMessage): void {
    display({ type: kind, text1: title, text2: detail });
    // no Android a live region do Snackbar lê o aviso; o VoiceOver não lê
    // live regions, então o aviso entra na fila de fala
    if (Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibilityWithOptions(
        snackbarLabel(title, detail),
        { queue: true },
      );
    }
  },
  success(title: string, detail?: string): void {
    snackbar.show({ kind: 'success', title, detail });
  },
  error(title: string, detail?: string): void {
    snackbar.show({ kind: 'error', title, detail });
  },
  info(title: string, detail?: string): void {
    snackbar.show({ kind: 'info', title, detail });
  },
  hide(): void {
    dismiss();
  },
};
