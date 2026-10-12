/**
 * Textos únicos do portal bloqueado (`AppError` `POSSIBLY_BLOCKED`), os
 * mesmos do protótipo em todas as telas:
 * - com dados salvos, no aviso: `<Notice kind="blocked" />` (já usa este texto);
 * - sem dados, no lugar do conteúdo: `<BlockedState onRetry={refetch} />`.
 *
 * Módulo sem React: pode ser importado por regras e formatadores puros.
 */
export const PORTAL_BLOCKED_TEXT =
  'O Aluno Online está temporariamente bloqueado.';
export const PORTAL_BLOCKED_FULL_TEXT =
  'Parece que o Aluno Online está temporariamente bloqueado. Tente novamente mais tarde.';
