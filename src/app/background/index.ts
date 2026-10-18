import { AppRegistry } from 'react-native';

import { appServices } from '../appServices';
import { createPortalCheckTask, PORTAL_CHECK_TASK } from './portalCheckTask';

/** Tarefas sem tela iniciadas pelo Android (ver index.js). */
export function registerBackgroundTasks() {
  // a mesma tarefa em todas as execuções: ela sabe se já há uma em andamento
  const portalCheck = createPortalCheckTask(() => appServices);
  AppRegistry.registerHeadlessTask(PORTAL_CHECK_TASK, () => portalCheck);
}
