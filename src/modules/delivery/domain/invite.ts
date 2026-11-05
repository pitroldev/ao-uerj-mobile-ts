/** A página do app na Play: o convite e a avaliação levam ao mesmo lugar. */
export const PLAY_LISTING_URL =
  'https://play.google.com/store/apps/details?id=com.aouerjmobile';

/**
 * De onde saiu o convite. Vai no link como `utm_source`, e o Play Console
 * separa visitas e instalações por origem: nada é medido dentro do app.
 */
export type InviteSource =
  'menu' | 'sobre' | 'qr' | 'grade' | 'mural' | 'campus' | 'companhia';

/** O link da Play com a origem (curto: o QR do convite fica na versão 6). */
export function inviteLink(source: InviteSource): string {
  return `${PLAY_LISTING_URL}&referrer=${encodeURIComponent(`utm_source=${source}`)}`;
}
