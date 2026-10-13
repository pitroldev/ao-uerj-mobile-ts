const DAY = 24 * 60 * 60 * 1000;

export type UpdateType = 'flexible' | 'immediate';

/** Atualização oferecida pela loja (Play In-App Updates). */
export type AppUpdate = {
  /** `inProgress`: fluxo já iniciado pelo app (download flexível ou imediata interrompida). */
  availability: 'available' | 'inProgress' | 'none';
  versionCode: number;
  /** Dias desde que a loja conhece a versão nova; `null` se ela não informar. */
  stalenessDays: number | null;
  /** 0 a 5, definida no envio do release. */
  priority: number;
  flexibleAllowed: boolean;
  immediateAllowed: boolean;
  installStatus: InstallStatus;
};

export type InstallStatus =
  | 'pending'
  | 'downloading'
  | 'downloaded'
  | 'installing'
  | 'installed'
  | 'failed'
  | 'canceled'
  | 'unknown';

/** Atualização flexível só depois de alguns dias na loja (o rollout pode parar). */
export const FLEXIBLE_AFTER_DAYS = 3;
/** Releases com prioridade a partir desta pedem a flexível na hora. */
export const FLEXIBLE_PRIORITY = 3;
/** Intervalo mínimo entre dois pedidos de atualização flexível. */
export const FLEXIBLE_PROMPT_INTERVAL = 2 * DAY;

/**
 * Qual fluxo pedir: imediato quando a versão instalada não é mais suportada
 * (aviso remoto), flexível quando a nova já está há alguns dias na loja (ou
 * veio com prioridade alta), nenhum quando já está baixada.
 */
export function chooseUpdate(
  update: AppUpdate,
  { required }: { required: boolean },
): UpdateType | null {
  if (update.installStatus === 'downloaded') return null;
  if (required) {
    const canStart =
      update.availability === 'inProgress' ||
      (update.availability === 'available' && update.immediateAllowed);
    return canStart ? 'immediate' : null;
  }
  if (update.availability !== 'available' || !update.flexibleAllowed)
    return null;
  const aged = (update.stalenessDays ?? 0) >= FLEXIBLE_AFTER_DAYS;
  return aged || update.priority >= FLEXIBLE_PRIORITY ? 'flexible' : null;
}
