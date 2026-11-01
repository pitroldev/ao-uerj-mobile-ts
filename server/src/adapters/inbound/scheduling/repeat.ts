/**
 * Um agendador (adaptador de entrada, como o HTTP): chama `task` agora e
 * depois a cada `intervalMs`, sem segurar o processo aberto. Uma falha vai
 * para `onError` e não interrompe as próximas.
 */
export function repeatEvery(
  intervalMs: number,
  task: () => Promise<unknown>,
  onError: (err: unknown) => void,
) {
  let timer: NodeJS.Timeout | null = null;
  const run = () => {
    task().catch(onError);
  };

  return {
    start(): void {
      if (timer) return;
      run();
      timer = setInterval(run, intervalMs);
      timer.unref();
    },
    stop(): void {
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
}

export type Repetition = ReturnType<typeof repeatEvery>;
