import {
  focusManager,
  onlineManager,
  QueryObserver,
} from '@tanstack/react-query';
import { createQueryClient } from '../queryClient';

const settle = () => new Promise<void>(resolve => setTimeout(resolve, 0));

/** Uma consulta da tela, já carregada e vencida. */
async function observe() {
  const client = createQueryClient();
  client.mount();
  const queryFn = jest.fn(async () => 'nota');
  const observer = new QueryObserver(client, {
    queryKey: ['academics', 'account-1', '2026.2', 'grades'],
    queryFn,
    staleTime: 0,
  });
  const unsubscribe = observer.subscribe(() => undefined);
  await settle();
  return {
    queryFn,
    stop() {
      unsubscribe();
      client.unmount();
      // a consulta sem tela ficaria 7 dias no cache (o timer prende o Jest)
      client.clear();
    },
  };
}

async function reconnect() {
  onlineManager.setOnline(false);
  onlineManager.setOnline(true);
  await settle();
}

afterEach(() => {
  focusManager.setFocused(undefined);
  onlineManager.setOnline(true);
});

it('does not refetch when the network returns with the app in the background', async () => {
  // a leitura sem a tela consumiria a mudança antes da verificação de avisos
  const { queryFn, stop } = await observe();
  focusManager.setFocused(false);
  await reconnect();
  expect(queryFn).toHaveBeenCalledTimes(1);
  stop();
});

it('refetches when the network returns with the app on screen', async () => {
  const { queryFn, stop } = await observe();
  await reconnect();
  expect(queryFn).toHaveBeenCalledTimes(2);
  stop();
});
