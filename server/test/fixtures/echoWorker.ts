// Uma thread de teste para o pool: devolve o próprio id, ou falha, ou nunca responde.
import { parentPort, threadId } from 'node:worker_threads';

parentPort?.on('message', ({ id, data }: { id: number; data: string }) => {
  if (data === 'hang') return;
  if (data === 'fail') {
    parentPort?.postMessage({ id, error: 'the task failed' });
    return;
  }
  parentPort?.postMessage({ id, result: { threadId, data } });
});
