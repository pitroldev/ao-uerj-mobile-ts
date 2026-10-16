import type { DocumentPdf, StudentDocument } from '../domain/models';

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
