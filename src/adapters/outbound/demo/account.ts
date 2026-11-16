import type { Credentials } from '@root/modules/identity/domain/types';

/**
 * A conta de demonstração, para quem revisa o app nas lojas (a App Store e a
 * Google Play pedem um acesso que funcione sempre). As credenciais são
 * públicas: a conta não chega ao Aluno Online nem entra como aluno no nosso
 * servidor, e nada do que se faz nela sai do aparelho.
 *
 * Só dígitos, porque o campo da matrícula abre o teclado numérico. Matrícula
 * de verdade tem 12 dígitos, então não há colisão.
 */
export const DEMO_CREDENTIALS: Credentials = {
  matricula: '123456',
  password: 'aouerj-demo',
};

/**
 * A conta é a de demonstração pela matrícula: com a senha errada ela também
 * fica no aparelho (e o login demo recusa), nunca vai ao portal.
 */
export function isDemoAccount(credentials: Pick<Credentials, 'matricula'>) {
  return credentials.matricula.trim() === DEMO_CREDENTIALS.matricula;
}
