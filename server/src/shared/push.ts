/*
 * O push para o aparelho do aluno, comum à Companhia agora, ao Agora no
 * campus e aos avisos do portal: hoje só o iPhone, pelo APNs (o Android lê
 * as listas e testa o portal sozinho).
 */

/** Onde o aviso chega: o iPhone, pelo token do APNs. */
export type PushDevice = { platform: 'ios'; token: string };

/** Um aviso no aparelho do aluno. */
export type PushMessage = {
  title: string;
  body: string;
  /** Agrupa os avisos no aparelho (`thread-id`). */
  thread: string;
  /** O aviso novo com a mesma chave fica no lugar do anterior. */
  collapseId: string;
  /** Para onde o toque leva no app (`home`: o Início, o portal de volta). */
  target: 'companion' | 'campus' | 'home';
  /** Depois disso, quem estava sem sinal já não recebe. */
  expiresAt: Date;
};

/**
 * O push silencioso: sem alerta nem som, só acorda o app por alguns
 * segundos, e o app decide o que mostrar. `wake` vai fora do `aps`.
 */
export type WakeMessage = {
  wake: Record<string, string>;
  /** Depois disso, acordar já não serve. */
  expiresAt: Date;
};

/**
 * `sent`: a Apple aceitou. `gone`: o aparelho não recebe mais por esse token
 * (o app saiu, o token mudou). `failed`: não deu agora (rede, a Apple, a
 * chave), e outro envio pode dar.
 */
export type PushResult = 'sent' | 'gone' | 'failed';

/** Porta de saída: o push para o aparelho (o APNs, no iPhone). */
export interface PushSender {
  send(device: PushDevice, message: PushMessage): Promise<PushResult>;
  /** O push silencioso; sem ele, ninguém é acordado. */
  wake?(device: PushDevice, message: WakeMessage): Promise<PushResult>;
  /** Fecha a conexão no desligamento. */
  close?(): Promise<void>;
}
