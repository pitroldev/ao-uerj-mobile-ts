import type { SavedDocumentsPort } from '@root/modules/documents/application/ports';
import type { SavedDocument } from '@root/modules/documents/domain/models';
import type { SecureVault } from './vault-storage';

/** Os mais recentes ficam; o mais antigo sai quando passa disso. */
export const MAX_SAVED_DOCUMENTS = 5;

const itemName = (scope: string) => `documents:${scope}`;

function savedDocument(value: unknown): SavedDocument | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  const pdf = item.pdf as Record<string, unknown> | undefined;
  if (
    typeof item.id !== 'string' ||
    typeof item.title !== 'string' ||
    (item.validUntil !== null && typeof item.validUntil !== 'string') ||
    typeof item.savedAt !== 'number' ||
    !pdf ||
    typeof pdf.base64 !== 'string' ||
    typeof pdf.filename !== 'string' ||
    pdf.mimeType !== 'application/pdf'
  )
    return null;
  return {
    id: item.id,
    title: item.title,
    validUntil: item.validUntil,
    savedAt: item.savedAt,
    pdf: {
      base64: pdf.base64,
      filename: pdf.filename,
      mimeType: 'application/pdf',
    },
  };
}

/** Os PDFs guardados de cada conta, num item cifrado do cofre. */
export function createSavedDocumentsStore(
  vault: SecureVault,
): SavedDocumentsPort {
  async function list(scope: string): Promise<SavedDocument[]> {
    const raw = await vault.read(itemName(scope)).catch(() => null);
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed
            .map(savedDocument)
            .filter((item): item is SavedDocument => item !== null)
        : [];
    } catch {
      return [];
    }
  }
  async function write(scope: string, documents: SavedDocument[]) {
    if (documents.length) {
      await vault.write(itemName(scope), JSON.stringify(documents));
    } else {
      await vault.remove(itemName(scope));
    }
  }
  return {
    list,
    async save(scope, document) {
      const others = (await list(scope)).filter(
        item => item.id !== document.id,
      );
      await write(scope, [document, ...others].slice(0, MAX_SAVED_DOCUMENTS));
    },
    async remove(scope, id) {
      await write(
        scope,
        (await list(scope)).filter(item => item.id !== id),
      );
    },
    clear: scope => vault.remove(itemName(scope)).catch(() => undefined),
  };
}
