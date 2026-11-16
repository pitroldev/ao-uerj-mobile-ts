import type { AuthenticationPort } from '@root/modules/identity/application/ports';
import type { StudentProfile } from '@root/modules/identity/domain/types';
import { AppError } from '@root/shared/errors/AppError';
import { DEMO_CREDENTIALS } from '../account';
import type { DemoClock } from '../clock';
import { DEMO_STUDENT_NAME } from '../data/student';

/**
 * O login da demonstração: só a matrícula e a senha públicas entram. Como no
 * adaptador real, o perfil repete a matrícula como foi digitada (o cofre de
 * credenciais recusa uma conta em que as duas diferem), e o período é sempre
 * o corrente.
 */
export function createDemoAuthentication(clock: DemoClock): AuthenticationPort {
  let matricula = DEMO_CREDENTIALS.matricula;
  const profile = (): StudentProfile => ({
    matricula,
    name: DEMO_STUDENT_NAME,
    period: clock.period(),
    demo: true,
  });
  return {
    async signIn(credentials) {
      if (
        credentials.matricula.trim() !== DEMO_CREDENTIALS.matricula ||
        credentials.password !== DEMO_CREDENTIALS.password
      )
        throw new AppError('LOGIN_FAILED');
      return clock.respond(() => {
        matricula = credentials.matricula;
        return profile();
      });
    },
    refresh: () => clock.respond(profile),
    signOut: () => clock.respond(() => undefined),
  };
}
