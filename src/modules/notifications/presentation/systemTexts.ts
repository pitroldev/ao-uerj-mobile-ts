import { Platform } from 'react-native';

import { CHECK_INTERVAL_HOURS } from '../domain/checkState';

/** Os textos dos avisos que citam o sistema: o Android ou o iPhone. */
type SystemTexts = {
  /** Título do snackbar quando o pedido foi recusado de vez. */
  blockedTitle: string;
  blockedHint: string;
  deniedHint: string;
  /** Aviso no topo da tela de Notificações. */
  blockedNotice: string;
  deniedNotice: string;
  openSettings: string;
  openSettingsLabel: string;
  /** Convite do Início recusado no sistema. */
  promptRefused: string;
  /** Quando o app olha o portal (seção "Aluno Online" das Notificações). */
  checkSchedule: string;
  /** O que o sistema exige para a verificação; `null` sem nada a dizer. */
  checkNote: string | null;
  /** "Avisar quando voltar" pedido: o que esperar; `null` sem nada a dizer. */
  returnRequestedHint: string | null;
  /** "Avisar quando voltar" sem a permissão de avisos. */
  returnDeniedHint: string;
};

const ANDROID: SystemTexts = {
  blockedTitle: 'Avisos bloqueados no Android',
  blockedHint: 'Toque em “Abrir configurações”, no topo da tela, para liberar.',
  deniedHint: 'O Android precisa da sua permissão para mostrar avisos.',
  blockedNotice: 'O Android está bloqueando os avisos do AO UERJ.',
  deniedNotice: 'Os avisos precisam da sua permissão no Android.',
  openSettings: 'Abrir configurações',
  openSettingsLabel: 'Abrir as configurações de avisos do Android',
  promptRefused:
    'Sem a permissão do Android, o app não mostra avisos. Dá para ligar depois em Notificações.',
  checkSchedule: `O app consulta o portal a cada ${CHECK_INTERVAL_HOURS} horas, das 7h às 22h, com a conta salva neste aparelho.`,
  checkNote: null,
  returnRequestedHint: null,
  returnDeniedHint:
    'Permita as notificações do AO UERJ nas configurações do Android.',
};

const IOS: SystemTexts = {
  blockedTitle: 'Avisos bloqueados no iPhone',
  blockedHint: 'Toque em “Abrir Ajustes”, no topo da tela, para liberar.',
  deniedHint: 'O iPhone precisa da sua permissão para mostrar avisos.',
  blockedNotice: 'O iPhone está bloqueando os avisos do AO UERJ.',
  deniedNotice: 'Os avisos precisam da sua permissão no iPhone.',
  openSettings: 'Abrir Ajustes',
  openSettingsLabel: 'Abrir os Ajustes de avisos do iPhone',
  promptRefused:
    'Sem a permissão do iPhone, o app não mostra avisos. Dá para ligar depois em Notificações.',
  checkSchedule:
    'O iPhone escolhe quando o app pode olhar o portal, das 7h às 22h, com a conta salva neste aparelho. Por isso, o aviso pode chegar horas depois.',
  checkNote:
    'Precisa da Atualização em 2º Plano ligada nos Ajustes. Se você fechar o app no seletor de apps, o iPhone só volta a olhar depois que você abrir o app de novo.',
  returnRequestedHint:
    'No iPhone, o aviso pode demorar: quem escolhe a hora de olhar é o iPhone.',
  returnDeniedHint: 'Permita os avisos do AO UERJ nos Ajustes do iPhone.',
};

/** Lido a cada desenho (os testes trocam a plataforma). */
export function systemTexts(): SystemTexts {
  return Platform.OS === 'ios' ? IOS : ANDROID;
}
