/**
 * Relatos de erro do app. Os anexos vão para arquivo e o relato, para o
 * banco, com os ids dos anexos. Desde a 2.0 o anexo é um JSON de diagnóstico;
 * o da 1.x era a página do portal, com dados pessoais.
 */

export type NewErrorReport = {
  page: string;
  description?: string;
  email?: string;
  attachments: string[];
};

export type ErrorReport = {
  id: string;
  page: string;
  description?: string;
  email?: string;
  attachmentIds: string[];
  createdAt: Date;
  updatedAt: Date;
};

/** Bem acima do que os apps mandam (o atual corta a descrição em 4000). */
export const REPORT_LIMITS = {
  page: 200,
  description: 20000,
  email: 254,
  attachments: 10,
} as const;

/** A listagem de administração traz os mais recentes, no máximo estes. */
export const RECENT_REPORTS = 100;
