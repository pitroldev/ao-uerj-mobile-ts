import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  useAppServices,
  useIdentity,
} from '@root/app/providers/AppServicesProvider';
import type {
  DocumentPdf,
  SavedDocument,
  StudentDocument,
} from '../domain/models';

/**
 * PDFs guardados no aparelho da conta ativa. Leitura local (vale sem
 * internet e com o portal fora); fica na memória só enquanto a tela de
 * documentos está aberta.
 */
export function useSavedDocuments() {
  const { savedDocuments, documentSharing } = useAppServices();
  const { account } = useIdentity();
  const client = useQueryClient();
  const scope = account?.scope ?? null;
  const key = ['saved-documents', scope ?? 'signed-out'];
  const query = useQuery({
    queryKey: key,
    queryFn: () =>
      savedDocuments && scope
        ? savedDocuments.list(scope)
        : Promise.resolve([]),
    enabled: Boolean(savedDocuments && scope),
    networkMode: 'always',
    staleTime: Infinity,
    gcTime: 0,
  });
  const documents: SavedDocument[] = query.data ?? [];

  const save = async (document: StudentDocument, pdf: DocumentPdf) => {
    if (!savedDocuments || !scope) return;
    await savedDocuments.save(scope, {
      id: document.id,
      title: document.title,
      validUntil: document.validUntil,
      savedAt: Date.now(),
      pdf,
    });
    await client.invalidateQueries({ queryKey: key, exact: true });
  };

  const remove = async (id: string) => {
    if (!savedDocuments || !scope) return;
    await savedDocuments.remove(scope, id);
    await client.invalidateQueries({ queryKey: key, exact: true });
  };

  return {
    supported: Boolean(savedDocuments),
    documents,
    isSaved: (id: string) => documents.some(item => item.id === id),
    save,
    remove,
    share: (document: SavedDocument) => documentSharing.share(document.pdf),
  };
}
