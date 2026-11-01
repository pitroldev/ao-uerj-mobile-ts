import { createHmac, timingSafeEqual } from 'node:crypto';

import type { Request } from 'express';

/** O cookie do login da administração (`/aouerj/admin`). */
export const ADMIN_COOKIE = 'ao_uerj_admin';

/** O login vale 30 dias; "Sair" apaga antes, trocar o ADMIN_TOKEN derruba todos. */
export const ADMIN_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

/** Compara segredos sem vazar, pelo tempo, quanto deles bateu. */
export function sameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Um valor tirado do token para um fim: o cookie não é o próprio token. */
const derive = (token: string, purpose: string) =>
  createHmac('sha256', token)
    .update(`ao-uerj-admin:${purpose}:v1`)
    .digest('base64url');

/** O valor de um cookie do pedido, sem depender de um parser. */
export function cookieOf(req: Request, name: string): string | undefined {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const at = part.indexOf('=');
    if (at !== -1 && part.slice(0, at).trim() === name)
      return part.slice(at + 1).trim();
  }
  return undefined;
}

/**
 * O acesso de administração: o `Authorization: Bearer <ADMIN_TOKEN>` (os
 * scripts) ou o cookie do login (o navegador). O cookie é `HttpOnly`,
 * `SameSite=Strict` e `Secure` em HTTPS; os formulários que gravam levam
 * também o `csrf`, outro valor tirado do token.
 */
export function adminSession(token: string, cookiePath: string) {
  const session = derive(token, 'session');
  const csrf = derive(token, 'csrf');
  const cookie = (secure: boolean, value: string, maxAge: number) =>
    [
      `${ADMIN_COOKIE}=${value}`,
      `Path=${cookiePath}`,
      'HttpOnly',
      'SameSite=Strict',
      `Max-Age=${maxAge}`,
      ...(secure ? ['Secure'] : []),
    ].join('; ');

  return {
    csrf,
    allows(req: Request): boolean {
      const bearer = /^Bearer\s+(.+)$/i.exec(
        req.get('authorization') ?? '',
      )?.[1];
      // um token errado no cabeçalho não cai para o cookie
      if (bearer !== undefined) return sameSecret(bearer, token);
      const given = cookieOf(req, ADMIN_COOKIE);
      return given !== undefined && sameSecret(given, session);
    },
    isToken: (given: unknown) =>
      typeof given === 'string' && sameSecret(given.trim(), token),
    isCsrf: (given: unknown) =>
      typeof given === 'string' && sameSecret(given, csrf),
    /** O `Set-Cookie` do login. */
    login: (req: Request) => cookie(req.secure, session, ADMIN_COOKIE_MAX_AGE),
    /** O `Set-Cookie` do "Sair". */
    logout: (req: Request) => cookie(req.secure, '', 0),
  };
}

export type AdminSession = ReturnType<typeof adminSession>;
