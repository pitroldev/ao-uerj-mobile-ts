import {
  CALL_KINDS,
  DESTINATION_IDS,
  type Membership,
} from '@root/modules/companion/domain/companion';
import type { MembershipStorePort } from '@root/modules/companion/application/ports';
import type { SecureVault } from './vault-storage';

const MEMBERSHIPS = 'companion:memberships';
const SPOTS = ['ru', 'lago', 'concha', 'portao-1', 'portao-5'];

/** Uma participação salva, ou `null` se o formato não for este. */
function parseMembership(raw: unknown): Membership | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const item = raw as Record<string, unknown>;
  const finite = (value: unknown) =>
    typeof value === 'number' && Number.isFinite(value);
  if (
    typeof item.callId !== 'string' ||
    typeof item.memberKey !== 'string' ||
    typeof item.host !== 'boolean' ||
    !CALL_KINDS.includes(item.kind as Membership['kind']) ||
    !finite(item.at) ||
    !finite(item.expiresAt) ||
    !SPOTS.includes(item.spot as string) ||
    (item.destination !== null &&
      !DESTINATION_IDS.includes(item.destination as never))
  )
    return null;
  return {
    callId: item.callId,
    memberKey: item.memberKey,
    host: item.host,
    kind: item.kind as Membership['kind'],
    at: item.at as number,
    spot: item.spot as Membership['spot'],
    destination: item.destination as Membership['destination'],
    expiresAt: item.expiresAt as number,
  };
}

/**
 * As participações da Companhia agora, num item cifrado do cofre (fora do
 * backup do Android): cada uma leva a chave de membro, um segredo.
 */
export function createCompanionStore(vault: SecureVault): MembershipStorePort {
  return {
    async read() {
      const raw = await vault.read(MEMBERSHIPS);
      if (!raw) return [];
      try {
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed)
          ? parsed
              .map(parseMembership)
              .filter((item): item is Membership => item !== null)
          : [];
      } catch {
        return [];
      }
    },
    write: memberships =>
      memberships.length
        ? vault.write(MEMBERSHIPS, JSON.stringify(memberships))
        : vault.remove(MEMBERSHIPS),
  };
}
