import type { AppStatusSource } from '@root/modules/delivery/application/ports';
import { AppError } from '@root/shared/errors/AppError';

/**
 * Público e sem dados do aluno: a busca só revela o IP ao GitHub.
 *
 * O endereço fica gravado em todo app publicado, inclusive nos que nunca
 * forem atualizados. A conta `pitroldev` e o repositório não podem ser
 * renomeados, transferidos nem apagados enquanto houver versões com este
 * endereço: outra pessoa poderia registrar o nome vago e publicar o arquivo
 * (avisos, versão mínima e telas desativadas). O documento não tem
 * assinatura; o que limita o estrago é a validação em
 * src/modules/delivery/domain/appStatus.ts (links só para destinos da lista),
 * a confirmação com a Play antes de bloquear a versão e o tamanho máximo
 * abaixo.
 */
export const APP_STATUS_URL =
  'https://raw.githubusercontent.com/pitroldev/ao-uerj-mobile-ts/main/config/app-status.json';
const TIMEOUT_MS = 8000;
/** O arquivo tem centenas de bytes; bem acima disso, não é o aviso. */
export const MAX_APP_STATUS_LENGTH = 64 * 1024;

type FetchLike = (
  url: string,
  init: { signal: AbortSignal; headers: Record<string, string> },
) => Promise<{
  ok: boolean;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}>;

/**
 * JSON do aviso remoto, com tempo-limite e tamanho máximo. Erro HTTP, corpo
 * grande demais ou JSON inválido rejeitam.
 */
export function createRemoteAppStatusSource({
  url = APP_STATUS_URL,
  timeoutMs = TIMEOUT_MS,
  fetchImpl = fetch,
}: {
  url?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
} = {}): AppStatusSource {
  return {
    async fetch() {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(url, {
          signal: controller.signal,
          headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
        });
        if (!response.ok) throw new AppError('SERVICE_UNAVAILABLE');
        // o tamanho declarado evita baixar o corpo; sem ele (gzip), confere depois
        const declared = Number(response.headers.get('Content-Length'));
        if (declared > MAX_APP_STATUS_LENGTH)
          throw new AppError('SERVICE_UNAVAILABLE');
        const body = await response.text();
        if (body.length > MAX_APP_STATUS_LENGTH)
          throw new AppError('SERVICE_UNAVAILABLE');
        return JSON.parse(body) as unknown;
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError('NETWORK');
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
