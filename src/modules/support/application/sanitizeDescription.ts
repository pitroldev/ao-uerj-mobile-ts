export function sanitizeDescription(
  description: string,
  personalValues: string[],
): string {
  let safe = description
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(
      /\b(?:set-cookie|cookie|authorization)\s*[:=][^\r\n]*/gi,
      '[credencial removida]',
    )
    .replace(/\b(?:https?:\/\/)[^\s]+/gi, '[endereço removido]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[e-mail removido]')
    .replace(
      /\b(?:senha|password|token|_token|cookie|authorization|matricula|matrícula|cpf)\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s;,]+)/gi,
      '[dado removido]',
    )
    .replace(/\b\d(?:[.\s()-]*\d){7,}\b/g, '[identificador removido]');
  for (const personal of personalValues.filter(
    value => value.trim().length > 1,
  )) {
    const escaped = personal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    safe = safe.replace(new RegExp(escaped, 'gi'), '[dado removido]');
  }
  return safe.trim().slice(0, 4000);
}
