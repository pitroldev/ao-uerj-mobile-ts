import { AppRegistry, Platform } from 'react-native';

import { createNativeBackgroundRounds } from '@root/adapters/outbound/native/NativeBackgroundRounds';
import { appServices } from '../appServices';
import { runBackgroundRounds } from './backgroundRounds';
import { createPortalCheckTask, PORTAL_CHECK_TASK } from './portalCheckTask';

/**
 * Tarefas sem tela (ver index.js): no Android, a que o WorkManager inicia;
 * no iPhone, as rodadas do BGTaskScheduler, que o módulo dos avisos entrega
 * a este runtime (aberto sem janela quando o app estava fechado).
 */
export function registerBackgroundTasks() {
  // a mesma tarefa em todas as execuções: ela sabe se já há uma em andamento
  const portalCheck = createPortalCheckTask(() => appServices);
  if (Platform.OS === 'ios') {
    const rounds = createNativeBackgroundRounds();
    if (rounds) runBackgroundRounds(rounds, portalCheck);
    return;
  }
  AppRegistry.registerHeadlessTask(PORTAL_CHECK_TASK, () => portalCheck);
}
