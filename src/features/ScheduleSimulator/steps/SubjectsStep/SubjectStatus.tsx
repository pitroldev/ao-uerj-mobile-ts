import React from 'react';

import { SHIFT_LABEL, StatusLabel, Text } from '@components/ui';
import type { SubjectAvailability } from '@root/modules/planning/domain/availability';

import { classShifts, plural } from '../../format';

/** Uma disciplina escolhida que não vai entrar em grade nenhuma. */
export function hasProblem(state: SubjectAvailability | undefined): boolean {
  if (!state || state.status === 'loading') return false;
  if (state.status === 'ready') return !state.details.classes?.length;
  return true;
}

/** A situação em texto corrido, para o leitor de tela. */
export function statusText(state: SubjectAvailability | undefined): string {
  if (!state) return '';
  switch (state.status) {
    case 'loading':
      return 'Buscando turmas…';
    case 'failed':
      return 'Não deu para buscar as turmas';
    case 'refused':
      return state.reason;
    case 'ready': {
      const classes = state.details.classes ?? [];
      if (!classes.length) return 'Sem turmas neste período';
      const shifts = classShifts(classes).map(shift => SHIFT_LABEL[shift]);
      return [plural(classes.length, 'turma', 'turmas'), ...shifts].join(', ');
    }
  }
}

/**
 * O que o Aluno Online disse de uma disciplina escolhida: quantas turmas e
 * em que turnos, ou por que ela não pode entrar (nunca só pela cor).
 */
export function SubjectStatus({ state }: { state: SubjectAvailability }) {
  switch (state.status) {
    case 'loading':
      return <StatusLabel tone="neutral" label="Buscando turmas…" muted />;
    case 'failed':
      return (
        <StatusLabel
          tone="bad"
          icon="sync_problem"
          label="Não deu para buscar as turmas"
        />
      );
    case 'refused':
      return (
        <StatusLabel tone="bad" icon="block" label={state.reason} lines={3} />
      );
    case 'ready': {
      const classes = state.details.classes ?? [];
      if (!classes.length)
        return (
          <StatusLabel
            tone="bad"
            icon="event_busy"
            label="Sem turmas neste período"
          />
        );
      return (
        <>
          <Text variant="meta" tone="muted">
            {plural(classes.length, 'turma', 'turmas')}
          </Text>
          {classShifts(classes).map(shift => (
            <StatusLabel key={shift} tone={shift} label={SHIFT_LABEL[shift]} />
          ))}
        </>
      );
    }
  }
}
