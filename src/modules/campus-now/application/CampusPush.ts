import type { CampusNowStorePort, CampusPushServerPort } from './ports';

/** O que é do aparelho, não da conta: fica fora das chaves que o logout apaga. */
export const DEVICE_SCOPE = 'device';
/** Este aparelho está registrado no servidor para o push do campus. */
export const CAMPUS_PUSH_KEY = 'campus-push';

type Dependencies = {
  server: CampusPushServerPort;
  /** O token de push do aparelho; `null` sem ele. */
  token: () => Promise<string | null>;
  store: CampusNowStorePort;
};

/**
 * O Agora no campus em segundo plano no iPhone: o registro do aparelho no
 * servidor, que manda os avisos do próprio aviso e acorda o app para o
 * "ainda está lá?". Ligado, registra de novo a cada abertura (o servidor
 * esquece em 30 dias sem renovação); desligado, só tira do servidor o
 * aparelho que registrou (quem nunca ligou não faz pedido nenhum).
 */
export class CampusPush {
  constructor(private readonly dependencies: Dependencies) {}

  /** O servidor manda push (a chave da Apple configurada). */
  async available(): Promise<boolean> {
    return (await this.dependencies.server.status()).available;
  }

  /** Falha (sem token, sem rede) sobe: quem chama tenta de novo depois. */
  async apply(enabled: boolean): Promise<void> {
    const { server, token, store } = this.dependencies;
    if (enabled) {
      const current = await token();
      if (!current) throw new Error('Sem o token de push do aparelho');
      await server.register(current);
      await store.write(DEVICE_SCOPE, CAMPUS_PUSH_KEY, true);
      return;
    }
    if (!(await store.read<boolean>(DEVICE_SCOPE, CAMPUS_PUSH_KEY))) return;
    await server.unregister();
    await store.write(DEVICE_SCOPE, CAMPUS_PUSH_KEY, null);
  }

  /** Saída da conta, antes de a sessão de aluno acabar: o aparelho sai do servidor. */
  async signOut(): Promise<void> {
    await this.apply(false).catch(() => undefined);
  }
}
