/** A página do app na Play: o convite e a avaliação levam ao mesmo lugar. */
export const PLAY_LISTING_URL =
  'https://play.google.com/store/apps/details?id=com.aouerjmobile';

/** O id do app na App Store (no App Store Connect, "Apple ID"). */
export const APP_STORE_ID = '6835308883';

/**
 * A página do app na App Store do Brasil, o único país onde ele está. Sem o
 * nome no caminho, o link fica curto, e a Apple completa ao abrir.
 */
export const APP_STORE_LISTING_URL = `https://apps.apple.com/br/app/id${APP_STORE_ID}`;

/** A loja de cada sistema: a Play no Android, a App Store no iPhone. */
export type StorePlatform = 'android' | 'ios';

/**
 * De onde saiu o convite. Vai no link da Play como `utm_source`, e o Play
 * Console separa visitas e instalações por origem: nada é medido dentro do
 * app.
 */
export type InviteSource =
  | 'menu'
  | 'sobre'
  | 'qr'
  | 'grade'
  | 'gerador'
  | 'mural'
  | 'campus'
  | 'companhia';

/**
 * O link de uma loja. O da Play leva a origem (curto: o QR do convite fica na
 * versão 6); o da App Store vai sem ela, que a Apple só lê junto com o
 * código do provedor.
 */
export function inviteLink(
  source: InviteSource,
  platform: StorePlatform,
): string {
  if (platform === 'ios') return APP_STORE_LISTING_URL;
  return `${PLAY_LISTING_URL}&referrer=${encodeURIComponent(`utm_source=${source}`)}`;
}

/**
 * Os dois links, um por linha: quem recebe o convite pode ter qualquer um
 * dos dois celulares.
 */
export const inviteLinks = (source: InviteSource): string =>
  `Android: ${inviteLink(source, 'android')}\niPhone: ${inviteLink(source, 'ios')}`;
