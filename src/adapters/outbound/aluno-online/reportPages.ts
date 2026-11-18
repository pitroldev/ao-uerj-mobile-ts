import { AppError } from '@root/shared/errors/AppError';
import type {
  PortalPage,
  PortalPagesPort,
} from '@root/modules/support/application/ports';

import { anonymizePortalPage } from './anonymizePage';
import type { PortalOperation, PortalOperationParams } from './contracts';

type Diagnostics = {
  fetch(
    operation: PortalOperation,
    params?: PortalOperationParams,
    options?: { signal?: AbortSignal },
  ): Promise<string>;
};

/** A página do portal de cada leitura do app (as atividades estão no histórico). */
const OPERATIONS: Record<string, PortalOperation> = {
  schedule: 'schedule',
  grades: 'grades',
  'partial-rid': 'partialRid',
  history: 'history',
  'complementary-activities': 'history',
  curriculum: 'curriculum',
  'universal-subjects': 'universalSubjects',
  synthesis: 'synthesis',
  'subject-details': 'subjectDetails',
};

const MAX_PAGES = 3;
/** As páginas juntas, para o relato caber no corpo de 100 KB do servidor. */
const MAX_TOTAL_CHARS = 72_000;

/**
 * As páginas do relato, buscadas uma a uma no portal (com a sessão de
 * sempre) e anonimizadas antes de sair daqui.
 */
export function createPortalPages(diagnostics: Diagnostics): PortalPagesPort {
  return {
    async capture(reads, { personal, subjectCode, signal }) {
      const pages: PortalPage[] = [];
      const failures: Record<string, string> = {};
      // uma leitura por página (as atividades vêm no histórico), até três
      const wanted: Array<[read: string, operation: PortalOperation]> = [];
      for (const read of reads) {
        const operation = OPERATIONS[read];
        if (!operation || wanted.some(([, seen]) => seen === operation))
          continue;
        if (operation === 'subjectDetails' && !subjectCode) continue;
        if (wanted.length < MAX_PAGES) wanted.push([read, operation]);
      }
      // com uma página só, ela fica com o espaço inteiro (menos a linha de
      // título que cada uma ganha)
      const maxChars =
        Math.floor(MAX_TOTAL_CHARS / Math.max(wanted.length, 1)) - 100;
      let total = 0;
      for (const [read, operation] of wanted) {
        try {
          const html = await diagnostics.fetch(
            operation,
            operation === 'subjectDetails' ? { subjectId: subjectCode } : {},
            { signal },
          );
          const page = anonymizePortalPage(html, {
            personal,
            label: read,
            maxChars,
          });
          if (total + page.length > MAX_TOTAL_CHARS) {
            failures[read] = 'TOO_LARGE';
            continue;
          }
          total += page.length;
          pages.push({ read, html: page });
        } catch (error) {
          if (signal?.aborted) {
            failures[read] = 'TIMEOUT';
            break;
          }
          failures[read] = error instanceof AppError ? error.code : 'UNKNOWN';
        }
      }
      return { pages, failures };
    },
  };
}
