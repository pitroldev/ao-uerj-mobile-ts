/**
 * Tela aberta quando o app é aberto de fora: aviso tocado, atalho do ícone
 * ou toque no widget. O Android leva o destino no intent da abertura
 * (AppLaunch.kt), e o app o lê uma vez.
 */
const LAUNCH_TARGETS = ['home', 'grades', 'map', 'documents'] as const;

export type LaunchTarget = (typeof LAUNCH_TARGETS)[number];

export function toLaunchTarget(
  value: string | null | undefined,
): LaunchTarget | null {
  return LAUNCH_TARGETS.includes(value as LaunchTarget)
    ? (value as LaunchTarget)
    : null;
}

/**
 * O mapa abre sem conta (é o "Explorar o mapa" do login); as outras telas
 * esperam o login.
 */
export function needsAccount(target: LaunchTarget): boolean {
  return target !== 'map';
}
