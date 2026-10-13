import React from 'react';

import { ScreenPanel } from '@templates/ScreenPanel';
import { EmptyState } from '@components/ui';
import { isFeatureDisabled, type FeatureId } from '../domain/appStatus';
import { useRemoteStatus } from './DeliveryProvider';

/** Telas do menu que o aviso remoto pode desativar (`disabledFeatures`). */
const ROUTE_FEATURES: Readonly<Record<string, FeatureId>> = {
  'Meu Progresso': 'progress',
  'Gerador de Grade': 'schedule-generator',
  'Mural de Mensagens': 'message-board',
  'Disciplinas Realizadas': 'subjects-taken',
  'Disciplinas do Currículo': 'curriculum-subjects',
  'Disciplinas Universais': 'universal-subjects',
  'Pesquisa de Disciplinas': 'subject-search',
  'Pesquisa de Professores': 'teacher-search',
};

export const UNAVAILABLE_TEXT =
  'Desativamos esta tela por um tempo enquanto corrigimos um problema. Tente de novo mais tarde.';

/** Rotas desativadas agora (o menu as marca como indisponíveis). */
export function useDisabledRoutes(): ReadonlySet<string> {
  const { status } = useRemoteStatus();
  return new Set(
    Object.keys(ROUTE_FEATURES).filter(route =>
      isFeatureDisabled(status, ROUTE_FEATURES[route]),
    ),
  );
}

/**
 * `screenLayout` do navegador: a tela de um recurso desativado vira um
 * estado explicando o motivo, sem montar a tela (nem as consultas dela).
 */
export function FeatureGate({
  routeName,
  children,
}: React.PropsWithChildren<{ routeName: string }>) {
  const disabled = useDisabledRoutes().has(routeName);
  if (!disabled) return <>{children}</>;
  return (
    <ScreenPanel>
      <EmptyState
        icon="block"
        title="Indisponível no momento"
        text={UNAVAILABLE_TEXT}
      />
    </ScreenPanel>
  );
}
