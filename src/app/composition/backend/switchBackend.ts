import { isDemoAccount } from '@root/adapters/outbound/demo/account';
import type { Credentials } from '@root/modules/identity/domain/types';
import type { Backend } from './Backend';

type Options = {
  /**
   * As credenciais guardadas no cofre: decidem o backend ao abrir o app e
   * nas rodadas em segundo plano que não fazem login (Companhia, campus,
   * "Avisar quando voltar"). Lidas uma vez, antes da primeira chamada.
   */
  savedCredentials: () => Promise<Credentials | null>;
  /** O backend da conta de demonstração, criado só quando ela entra. */
  loadDemo: () => Backend;
};

type Method = (...args: unknown[]) => unknown;

/** Os métodos de uma porta, os próprios e os da classe. */
function methodsOf(port: object): string[] {
  const names = new Set<string>();
  for (
    let level: object | null = port;
    level && level !== Object.prototype;
    level = Object.getPrototypeOf(level) as object | null
  ) {
    for (const name of Object.getOwnPropertyNames(level)) {
      if (
        name !== 'constructor' &&
        typeof (port as Record<string, unknown>)[name] === 'function'
      )
        names.add(name);
    }
  }
  return [...names];
}

/** Uma porta que repassa cada chamada à mesma porta do backend da vez. */
function follow<K extends keyof Backend>(
  key: K,
  real: Backend,
  current: () => Promise<Backend>,
): Backend[K] {
  const forwarded: Record<string, Method> = {};
  for (const method of methodsOf(real[key])) {
    forwarded[method] = async (...args: unknown[]) => {
      const port = (await current())[key] as unknown as Record<string, Method>;
      return port[method](...args);
    };
  }
  return forwarded as unknown as Backend[K];
}

/**
 * A troca entre o backend real e o da conta de demonstração. É o único
 * lugar do app que pergunta se a conta é a demo: telas, módulos e
 * adaptadores reais recebem um `Backend` e não ficam sabendo.
 *
 * Quem decide é a conta: a cada login e a cada saída, pelas credenciais; ao
 * abrir, pela conta guardada. Decidir só no login não basta, porque há
 * rodadas em segundo plano que não fazem login.
 */
export function switchBackend(
  real: Backend,
  { savedCredentials, loadDemo }: Options,
): Backend {
  let demo: Backend | null = null;
  // um só para o app aberto: o que a demo guarda na memória (as mensagens
  // postadas, as mesas) fica até o app fechar
  const demoBackend = () => (demo ??= loadDemo());
  const pick = (credentials: Credentials | null) =>
    credentials && isDemoAccount(credentials) ? demoBackend() : real;

  let selected: Promise<Backend> = savedCredentials().then(pick, () => real);
  const current = () => selected;

  const ports = Object.fromEntries(
    (Object.keys(real) as (keyof Backend)[]).map(key => [
      key,
      follow(key, real, current),
    ]),
  ) as Backend;

  return {
    ...ports,
    authentication: {
      async signIn(credentials) {
        const previous = await selected;
        const next = pick(credentials);
        selected = Promise.resolve(next);
        // a sessão do outro lado não fica aberta (o portal, ao entrar na demo)
        if (previous !== next) await previous.authentication.signOut();
        return next.authentication.signIn(credentials);
      },
      refresh: async () => (await selected).authentication.refresh(),
      async signOut() {
        const previous = await selected;
        selected = Promise.resolve(real);
        await previous.authentication.signOut();
      },
    },
  };
}
