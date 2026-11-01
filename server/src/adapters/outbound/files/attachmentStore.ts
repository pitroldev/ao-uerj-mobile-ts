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

/** Os ids que `save` gera (UUID), com folga para os antigos. */
const ANY_ID = /^[A-Za-z0-9-]{1,64}$/;

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

  /**
   * O arquivo do anexo. Um relato antigo com outra regra de nome da página
   * ainda acha o seu pelo id (um UUID, único na pasta).
   */
  async function locate(page: string, id: string): Promise<string | null> {
    const expected = fileOf(page, id);
    try {
      await fs.access(expected);
      return expected;
    } catch {
      const names = await fs.readdir(directory).catch(() => [] as string[]);
      const name = names.find(entry => entry.endsWith(`-${id}.html`));
      return name ? path.join(directory, name) : null;
    }
  }

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

    async read(page, id, { maxBytes } = {}) {
      // o id vem da URL: só o formato de um id, nada de caminho
      if (!ANY_ID.test(id)) return null;
      const file = await locate(page, id);
      if (!file) return null;
      const handle = await fs.open(file, 'r');
      try {
        const { size } = await handle.stat();
        const length = Math.min(size, maxBytes ?? size);
        const buffer = Buffer.alloc(length);
        await handle.read(buffer, 0, length, 0);
        return { bytes: size, text: buffer.toString('utf8') };
      } finally {
        await handle.close();
      }
    },
  };
}
