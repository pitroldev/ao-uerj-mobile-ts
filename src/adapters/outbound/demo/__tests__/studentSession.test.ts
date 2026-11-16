import { AppError } from '@root/shared/errors/AppError';
import type {
  Attestation,
  StoredSession,
  StudentSessionStorePort,
} from '@root/modules/trust/application/ports';
import type { SessionCrypto } from '@root/modules/trust/domain/studentSession';
import { StudentSession } from '@root/modules/trust/application/StudentSession';
import { createDemoStudentSessionApi } from '../ports/studentSession';

function memoryStore(): StudentSessionStorePort {
  let saved: StoredSession | null = null;
  let installation: string | null = null;
  return {
    read: async () => saved,
    write: async next => {
      saved = next;
    },
    clear: async () => {
      saved = null;
    },
    readInstallation: async () => installation,
    writeInstallation: async next => {
      installation = next;
    },
  };
}

describe('createDemoStudentSessionApi', () => {
  it('answers like a server with the identification turned off', async () => {
    const api = createDemoStudentSessionApi();
    await expect(api.challenge()).resolves.toBeNull();
    await expect(
      api.create({
        challenge: new Uint8Array(),
        installation: new Uint8Array(),
        proof: { token: 'x' },
        matricula: '1',
        name: 'Demo',
      }),
    ).resolves.toEqual({ created: false, refusal: 'unavailable' });
    await expect(api.end('token')).resolves.toBeUndefined();
  });

  it('makes StudentSession give up before the device attests', async () => {
    const attest = jest.fn<Promise<Attestation>, [string]>(async () => ({
      token: 'play',
    }));
    const session = new StudentSession({
      api: createDemoStudentSessionApi(),
      // a criptografia nem chega a ser usada: a sessão desiste antes
      device: { crypto: {} as SessionCrypto, attest },
      store: memoryStore(),
      account: () => ({
        scope: 'demo',
        matricula: '000000000000',
        name: 'Demo',
      }),
    });

    const error = await session.token().catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('STUDENT_PROOF_UNAVAILABLE');
    expect(attest).not.toHaveBeenCalled();
    // de novo: a recusa fica guardada, e o aparelho continua de fora
    await expect(session.token()).rejects.toBeInstanceOf(AppError);
    expect(attest).not.toHaveBeenCalled();
  });
});
