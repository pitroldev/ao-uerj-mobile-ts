import type { QueryClient } from '@tanstack/react-query';

import { createNativeHomeWidget } from '@root/adapters/outbound/native/NativeHomeWidget';
import type { IdentityController } from '@root/modules/identity/application/IdentityController';
import type { WidgetDevicePort } from '@root/modules/widget/application/ports';
import { WidgetSync } from '@root/modules/widget/application/WidgetSync';
import { widgetText } from '@root/modules/widget/presentation/widgetText';
import {
  activeAccount,
  onSavedScheduleChange,
  readSavedSchedule,
} from './savedSchedule';

type Dependencies = {
  queryClient: QueryClient;
  identity: Pick<IdentityController, 'getSnapshot' | 'subscribe'>;
  device?: WidgetDevicePort | null;
};

/**
 * Widget "Próxima aula": recebe a grade salva da conta ativa (a mesma do
 * Início) sempre que ela muda, com o app aberto ou na verificação em segundo
 * plano. Não depende dos avisos nem da permissão de notificação.
 */
export function createWidget({
  queryClient,
  identity,
  device = createNativeHomeWidget(),
}: Dependencies) {
  const account = activeAccount(identity);
  const sync = new WidgetSync({
    device,
    account,
    subscribeAccount: identity.subscribe,
    schedule: owner => readSavedSchedule(queryClient, owner),
    text: widgetText,
  });
  if (device)
    onSavedScheduleChange(queryClient, account, () => {
      void sync.scheduleChanged();
    });
  sync.start();
  return { sync };
}
