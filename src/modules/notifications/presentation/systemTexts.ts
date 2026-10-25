import { Platform } from 'react-native';

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
};

/** Lido a cada desenho (os testes trocam a plataforma). */
export function systemTexts(): SystemTexts {
  return Platform.OS === 'ios' ? IOS : ANDROID;
}
