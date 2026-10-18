export type PortalRequest = {
  path: string;
  method?: 'GET' | 'POST';
  responseType?: 'text' | 'pdf';
  params?: Record<string, string | undefined>;
  signal?: AbortSignal;
};

export type PortalResponse = {
  status: number;
  body: string;
  pdfBase64?: string;
  contentType?: string;
};

/** The transport decodes the declared ISO-8859-1 as windows-1252, as browsers
 * do, and must settle requests after native cookie processing has finished.
 * cancelAndDrain prevents a late Set-Cookie from reaching the jar after it
 * has been cleared for the next account. */
export interface PortalTransport {
  request(request: PortalRequest): Promise<PortalResponse>;
  cancelAndDrain(): Promise<void>;
}

export interface PortalCookieJar {
  clear(): Promise<void>;
}

export type PortalOperation =
  | 'grades'
  | 'history'
  | 'curriculum'
  | 'schedule'
  | 'partialRid'
  | 'enrollmentResult'
  | 'subjectDetails'
  | 'universalSubjects'
  | 'documents';

export type PortalOperationParams = { subjectId?: string };
