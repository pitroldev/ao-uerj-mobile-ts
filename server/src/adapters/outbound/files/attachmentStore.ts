import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import type { AttachmentStore } from '../../../modules/reports/ports.ts';

/** Um nome de arquivo seguro: sem acento, sem barra, no máximo 80 letras. */
export function slugify(value: string): string {
  return (
    value
      .normalize('NFKD')
      .replace(/\p{M}/gu, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'report'
  );
}

/**
 * Os anexos dos relatos como arquivos `<página>-<id>.html` numa pasta (fora
 * do Git: um relato da 1.x traz dados pessoais). Nenhum arquivo sobrescreve
 * outro, e uma gravação que falha apaga o que já tinha gravado.
 */
export function createFileAttachmentStore(directory: string): AttachmentStore {
  const fileOf = (page: string, id: string) =>
    path.join(directory, `${slugify(page)}-${id}.html`);

  const discard = async (page: string, ids: readonly string[]) => {
    await Promise.allSettled(ids.map(id => fs.unlink(fileOf(page, id))));
  };

  return {
    async save(page, documents) {
      if (!documents.length) return [];
      await fs.mkdir(directory, { recursive: true });
      const ids = documents.map(() => randomUUID());
      const results = await Promise.allSettled(
        documents.map((document, index) =>
          fs.writeFile(fileOf(page, ids[index]), document, {
            encoding: 'utf8',
            flag: 'wx',
          }),
        ),
      );
      const failed = results.find(result => result.status === 'rejected');
      if (failed) {
        await discard(
          page,
          ids.filter((_, index) => results[index].status === 'fulfilled'),
        );
        throw failed.reason;
      }
      return ids;
    },
    discard,
  };
}
