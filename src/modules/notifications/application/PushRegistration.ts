import { AppError } from '@root/shared/errors/AppError';
import type { NotificationStore, PushRegistrationServerPort } from './ports';

/** O que é do aparelho, não da conta: fica fora das chaves que o logout apaga. */
export const DEVICE_SCOPE = 'device';

type Dependencies = {
  server: PushRegistrationServerPort;
  /** O token de push do aparelho; `null` sem ele. */
  token: () => Promise<string | null>;
  store: NotificationStore;
  /** A marca, em `DEVICE_SCOPE`, de que este aparelho se registrou. */
  key: string;
};

/**
 * O registro do iPhone para um push do servidor: o Agora no campus (os avisos
 * do próprio aviso e o "ainda está lá?") e o cutucão da verificação no
 * portal. Ligado, registra de novo a cada abertura (o servidor esquece o
 * aparelho que não renova); desligado, só tira do servidor o aparelho que se
 * registrou (quem nunca ligou não faz pedido nenhum). Um servidor sem o push
 * (`push_unavailable`) não é perguntado de novo até o app abrir outra vez.
 */
export class PushRegistration {
  /** O servidor disse que não manda push, nesta abertura do app. */
  private unavailable = false;

  constructor(private readonly dependencies: Dependencies) {}

  /** O servidor manda push (a chave da Apple configurada). */
  async available(): Promise<boolean> {
    const { available } = await this.dependencies.server.status();
    if (!available) this.unavailable = true;
    return available;
  }

  /** Falha (sem token, sem rede) sobe: quem chama tenta de novo depois. */
  async apply(enabled: boolean): Promise<void> {
    const { server, token, store, key } = this.dependencies;
    if (enabled) {
      if (this.unavailable) return;
      const current = await token();
      if (!current) throw new Error('Sem o token de push do aparelho');
      try {
        await server.register(current);
      } catch (error) {
        if (error instanceof AppError && error.code === 'SERVICE_UNAVAILABLE') {
          this.unavailable = true;
          return;
        }
        throw error;
      }
      await store.write(DEVICE_SCOPE, key, true);
      return;
    }
    if (!(await store.read<boolean>(DEVICE_SCOPE, key))) return;
    await server.unregister();
    await store.write(DEVICE_SCOPE, key, null);
  }

  /** Saída da conta, antes de a sessão de aluno acabar: o aparelho sai do servidor. */
  async signOut(): Promise<void> {
    await this.apply(false).catch(() => undefined);
  }
}
