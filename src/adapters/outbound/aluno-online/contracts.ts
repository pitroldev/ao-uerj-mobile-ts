export type PortalRequest = {
  path: string;
  params?: Record<string, string | undefined>;
  signal?: AbortSignal;
};

export type PortalResponse = { status: number; body: string };

/** The transport decodes ISO-8859-1 and must settle requests after native
 * cookie processing has finished. cancelAndDrain prevents a late Set-Cookie
 * from reaching the jar after it has been cleared for the next account. */
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
  | 'subjectDetails'
  | 'universalSubjects';

export type PortalOperationParams = { subjectId?: string };
