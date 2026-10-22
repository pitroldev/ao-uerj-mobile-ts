import type {
  DocumentPdf,
  SavedDocument,
  StudentDocument,
} from '../domain/models';

export type DocumentRequestOptions = { signal?: AbortSignal };

export interface DocumentsPort {
  list(options?: DocumentRequestOptions): Promise<StudentDocument[]>;
  issue(id: string, options?: DocumentRequestOptions): Promise<DocumentPdf>;
  remove(
    document: Pick<StudentDocument, 'id' | 'revision'>,
    options?: DocumentRequestOptions,
  ): Promise<void>;
}

export interface DocumentSharingPort {
  share(document: DocumentPdf): Promise<void>;
}

/** PDFs guardados no aparelho, por conta (cifrados; o logout apaga). */
export interface SavedDocumentsPort {
  list(scope: string): Promise<SavedDocument[]>;
  /** Guarda (ou substitui, pelo id) e mantém só os mais recentes. */
  save(scope: string, document: SavedDocument): Promise<void>;
  remove(scope: string, id: string): Promise<void>;
  clear(scope: string): Promise<void>;
}
