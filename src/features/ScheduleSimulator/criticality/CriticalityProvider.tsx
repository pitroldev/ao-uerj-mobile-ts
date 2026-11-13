import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';

import { subjectKey } from '@root/modules/academics/domain/rules/subjectId';
import { useOnlineStatus } from '@root/modules/academics/presentation/useOnlineStatus';
import { usePortalStatus } from '@root/modules/connectivity/presentation/PortalStatusContext';
import { useDisabledRoutes } from '@root/modules/delivery/presentation/FeatureGate';
import { blocksOf } from '@root/modules/graduation/domain/plan';
import { useGraduationPlan } from '@root/modules/graduation/presentation/useGraduationPlan';
import type { GeneratorDraft } from '@root/modules/planning/domain/models';

import {
  CriticalityContext,
  noCount,
  OFF,
  type Criticality,
  type CriticalityStatus,
} from './context';

const CHECKING: Criticality = { ...OFF, status: 'checking' };
const UNAVAILABLE: Criticality = { ...OFF, status: 'unavailable' };

type SourceProps = {
  load: boolean;
  onRead: () => void;
  report: (value: Criticality | null) => void;
};

/**
 * Os pré-requisitos do Plano até a formatura: os guardados e, com `load`, a
 * leitura dos que faltam. Só monta com a prioridade ligada, para o gerador
 * não consultar a grade e a Síntese à toa.
 */
function CriticalitySource({ load, onRead, report }: SourceProps) {
  const view = useGraduationPlan({ load });
  const online = useOnlineStatus();
  const portal = usePortalStatus();
  const canRead = online && !portal.down;
  const { graph } = view.plan;
  const pending = view.subjects.filter(item => !item.placeholder).length;
  const unread = view.unread.length;
  const { done, total, stoppedBy, retry } = view.catalog;

  let status: CriticalityStatus;
  if (view.status === 'loading') status = 'checking';
  else if (view.status === 'error') status = 'unavailable';
  else if (view.status === 'reading') status = 'reading';
  // "done": nenhuma obrigatória falta, e nenhuma disciplina trava outra
  else status = unread ? 'missing' : 'ready';
  const counted = status !== 'checking' && status !== 'unavailable';

  const value = useMemo<Criticality>(
    () => ({
      status,
      done,
      total,
      unread,
      pending,
      stoppedBy,
      canRead,
      read: load ? retry : onRead,
      criticalityFor: counted
        ? subjectIds =>
            Object.fromEntries(
              subjectIds.map(id => [id, blocksOf(graph, subjectKey(id))]),
            )
        : noCount,
    }),
    [
      canRead,
      counted,
      done,
      graph,
      load,
      onRead,
      pending,
      retry,
      status,
      stoppedBy,
      total,
      unread,
    ],
  );
  useEffect(() => report(value), [report, value]);
  // desligada, a página volta a não saber nada
  useEffect(() => () => report(null), [report]);
  return null;
}

/**
 * Para a página do gerador, que fica montada de um passo ao outro: a leitura
 * pedida nas prioridades continua enquanto o aluno escolhe as disciplinas e
 * as turmas.
 */
export function CriticalityProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { control } = useFormContext<GeneratorDraft>();
  const priority = useWatch({ control, name: 'priority' });
  const on = Boolean(priority?.includes('CRITICAL_FIRST'));
  // o aviso remoto que desliga o plano também para a leitura aqui
  const disabled = useDisabledRoutes().has('Plano até a formatura');
  const [load, setLoad] = useState(false);
  const [reported, setReported] = useState<Criticality | null>(null);
  const read = useCallback(() => setLoad(true), []);

  let value = OFF;
  if (on) value = disabled ? UNAVAILABLE : (reported ?? CHECKING);
  return (
    <CriticalityContext.Provider value={value}>
      {on && !disabled ? (
        <CriticalitySource load={load} onRead={read} report={setReported} />
      ) : null}
      {children}
    </CriticalityContext.Provider>
  );
}
