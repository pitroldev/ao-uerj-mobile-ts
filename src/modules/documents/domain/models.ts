export type StudentDocument = {
  /** Stable document type and revision, independent of the portal session. */
  id: string;
  title: string;
  validUntil: string | null;
  hasExistingDocument: boolean;
  canIssue: boolean;
  canDelete: boolean;
  /** Opaque revision used to avoid deleting a document changed since selection. */
  revision: string | null;
};

export type DocumentPdf = {
  base64: string;
  filename: string;
  mimeType: 'application/pdf';
};
