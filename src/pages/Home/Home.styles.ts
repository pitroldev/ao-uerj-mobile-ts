import { StyleSheet } from 'react-native';

import { layout, spacing } from '@root/themes/tokens';

export const styles = StyleSheet.create({
  /** Avisos de estado ficam no topo, com 20 abaixo. */
  notice: { marginBottom: layout.gutter },
  /** ".errbox": 24 abaixo da saudação. */
  errorCard: { marginTop: spacing.xxl },
  /** Conta de demonstração: logo abaixo da saudação. */
  demo: { marginTop: spacing.md },
  /** Convite de lembretes: logo abaixo da próxima aula. */
  prompt: { marginTop: spacing.md },
});
