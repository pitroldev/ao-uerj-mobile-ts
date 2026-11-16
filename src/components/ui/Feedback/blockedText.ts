/**
 * Textos únicos do portal bloqueado (`AppError` `POSSIBLY_BLOCKED`), os
 * mesmos em todas as telas. A UERJ fecha as consultas do Aluno Online (quase
 * sempre na inscrição em disciplinas) com o login funcionando: não é erro do
 * app nem da conta, e volta sem o aluno fazer nada.
 * - com dados salvos, no aviso: `<Notice kind="blocked" />` (já usa este texto);
 * - sem dados, no lugar do conteúdo: `<BlockedState onRetry={refetch} />`.
 *
 * Módulo sem React: pode ser importado por regras e formatadores puros.
 */
export const PORTAL_BLOCKED_TITLE = 'Aluno Online bloqueado';
export const PORTAL_BLOCKED_TEXT = 'Aluno Online bloqueado pela UERJ.';
export const PORTAL_BLOCKED_FULL_TEXT =
  'A UERJ costuma bloquear notas, grade e histórico na época de inscrição. Volta sozinho quando ela liberar.';
