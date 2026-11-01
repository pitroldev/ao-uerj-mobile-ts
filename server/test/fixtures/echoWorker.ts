// Uma thread de teste para o pool: devolve o próprio id, ou falha, ou nunca
// responde, ou estoura o heap, ou sai no meio da tarefa.
import { parentPort, threadId } from 'node:worker_threads';

parentPort?.on('message', ({ id, data }: { id: number; data: string }) => {
  if (data === 'hang') return;
  if (data === 'fail') {
    parentPort?.postMessage({ id, error: 'the task failed' });
    return;
  }
  if (data === 'hog') {
    const kept: number[][] = [];
    for (;;) kept.push(Array.from({ length: 1e6 }, () => threadId));
  }
  if (data === 'exit') process.exit(3);
  parentPort?.postMessage({ id, result: { threadId, data } });
});
