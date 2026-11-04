import type { CampusNotice, NoticeList } from '../domain/campusNow';
import { askTarget, spotsAt, type NearReason } from '../domain/nearby';
import {
  CAMPUS_STATE_KEY,
  normalizeCampusState,
  type CampusState,
  type OwnNotice,
} from './campusState';
import type { CampusNotification, CampusNowStorePort } from './ports';

/** Quantas vezes por dia o celular pergunta "ainda está lá?". */
export const MAX_ASKS_PER_DAY = 3;

type Messages = {
  ask: (notice: CampusNotice, near: NearReason) => CampusNotification;
  confirmed: (notice: CampusNotice) => CampusNotification;
  thanks: (
    notice: OwnNotice,
    thanks: number,
    views: number,
  ) => CampusNotification;
  level: (level: number) => CampusNotification;
};

type Dependencies = {
  device: {
    notify(content: CampusNotification): Promise<void>;
    /** Liga ou desliga a tarefa do Android a cada 15 minutos. */
    setCampusWatch(enabled: boolean): Promise<void>;
  };
  store: CampusNowStorePort;
  /** Conta salva (keychain), lida sem o portal. */
  savedScope: () => Promise<string | null>;
  /** O aluno quer estes avisos (a chave em Notificações, os avisos do app ligados). */
  allowed: (scope: string) => Promise<boolean>;
  /** O aviso remoto desligou o Agora no campus. */
  disabled: () => boolean;
  /** A lista do servidor, com a sessão de aluno. */
  list: () => Promise<NoticeList>;
  messages: Messages;
  now: () => number;
};

export type WatchResult = 'stopped' | 'idle' | 'waiting' | 'done';

/**
 * Os avisos do Agora no campus no celular, pela tarefa do Android a cada 15
 * minutos, com o app fora da tela. Sem aula por perto e sem aviso do aluno
 * em aberto, nem chega a buscar: com 10 mil alunos, a lista só é pedida por
 * quem vai passar pelo campus logo. Avisa:
 *
 * - "ainda está lá?" de um aviso confirmado no caminho da próxima aula (no
 *   máximo três por dia, uma vez por aviso);
 * - o aviso do aluno confirmado pela primeira vez;
 * - quando o aviso do aluno acaba, quantos agradeceram;
 * - o nível novo.
 */
export class CampusWatch {
  constructor(private readonly dependencies: Dependencies) {}

  async checkInBackground(): Promise<WatchResult> {
    const { store, savedScope, allowed, disabled, device, list, now } =
      this.dependencies;
    const scope = await savedScope().catch(() => null);
    if (!scope || disabled() || !(await allowed(scope).catch(() => false))) {
      await device.setCampusWatch(false).catch(() => undefined);
      return 'stopped';
    }
    const at = now();
    const raw = await store
      .read<unknown>(scope, CAMPUS_STATE_KEY)
      .catch(() => null);
    const state = normalizeCampusState(raw, at);
    if (!state.visited) {
      await device.setCampusWatch(false).catch(() => undefined);
      return 'stopped';
    }
    const spots = spotsAt(state.classes, new Date(at));
    const open = state.own.filter(item => !item.done);
    if (!spots.length && !open.length) return 'idle';

    let current: NoticeList;
    try {
      current = await list();
    } catch {
      // sem rede ou sem a sessão agora: a próxima rodada tenta de novo
      return 'waiting';
    }
    const next = await this.notify(state, current, spots, at);
    await store
      .write<CampusState>(scope, CAMPUS_STATE_KEY, next)
      .catch(() => undefined);
    return 'done';
  }

  private async notify(
    state: CampusState,
    current: NoticeList,
    spots: ReturnType<typeof spotsAt>,
    at: number,
  ): Promise<CampusState> {
    const { device, messages } = this.dependencies;
    const send = (content: CampusNotification) =>
      device.notify(content).catch(() => undefined);

    const own = await Promise.all(
      state.own.map(async item => {
        if (item.done) return item;
        const live = current.notices.find(notice => notice.id === item.id);
        if (!live) {
          // acabou (ou sumiu sozinho): quem agradeceu fica sabendo, uma vez
          if (item.thanks > 0)
            await send(messages.thanks(item, item.thanks, item.views));
          return { ...item, done: true };
        }
        let told = item.confirmedTold;
        if (!told && live.confirmed && live.confirmations > 0) {
          await send(messages.confirmed(live));
          told = true;
        }
        return {
          ...item,
          confirmedTold: told,
          thanks: live.thanks ?? item.thanks,
          views: live.views ?? item.views,
        };
      }),
    );

    if (state.level !== null && current.you.level > state.level)
      await send(messages.level(current.you.level));

    const asked = [...state.asked];
    if (spots.length && asked.length < MAX_ASKS_PER_DAY) {
      const target = askTarget(current.notices, spots, {
        skipped: [...state.skipped, ...asked],
        now: at,
        confirmedOnly: true,
      });
      if (target) {
        await send(messages.ask(target.notice, target.near));
        asked.push(target.notice.id);
      }
    }

    return { ...state, own, asked, level: current.you.level };
  }
}
