import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import styled from 'styled-components/native';

import {
  BottomSheet,
  Button,
  Checkbox,
  Divider,
  FieldError,
  List,
  ListRow,
  NumberStepper,
  Radio,
  StatusLabel,
  Text,
} from '@components/ui';
import type { SubjectInfo } from '@root/modules/academics/domain/models';
import type { LunchBreak } from '@root/modules/planning/domain/lunch';
import {
  classKey,
  type Goal,
  type Schedule,
} from '@root/modules/planning/domain/models';
import {
  MAX_CLASSES_AMOUNT,
  classBlock,
} from '@root/modules/planning/domain/rules';

import { CriticalityNotice } from '../../criticality/CriticalityNotice';
import { GoalGlyph } from './GoalGlyph';
import {
  classMeetings,
  joinPt,
  planningDay,
  plural,
  scheduleMeetings,
} from '../../format';

/* ------------------------------------------------------------------- limite */

/**
 * Quantas disciplinas a grade pode ter. O gerador sempre tenta a grade com
 * mais disciplinas; o teto serve a quem marcou mais do que pretende cursar.
 */
export function LimitSheet({
  visible,
  onClose,
  value,
  max,
  onApply,
}: {
  visible: boolean;
  onClose: () => void;
  /** O teto de agora. */
  value: number;
  /** Quantas disciplinas podem entrar. */
  max: number;
  onApply: (limit: number | null) => void;
}) {
  const [text, setText] = useState(String(value));
  const [shownFor, setShownFor] = useState(visible);
  // cada abertura começa do teto atual
  if (visible !== shownFor) {
    setShownFor(visible);
    if (visible) setText(String(value));
  }
  const parsed = Number.parseInt(text, 10);
  const valid = Number.isInteger(parsed) && parsed >= 1 && parsed <= max;
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Quantas disciplinas?"
      footer={[
        <Button
          key="apply"
          label="Aplicar"
          disabled={!valid}
          onPress={() => {
            // no teto, a grade volta a acompanhar o que for escolhido
            onApply(parsed >= max ? null : parsed);
            onClose();
          }}
        />,
      ]}
    >
      <NumberStepper
        value={text}
        onChangeText={setText}
        min={1}
        max={max}
        maxLength={2}
        unit={parsed === 1 ? 'disciplina' : 'disciplinas'}
        accessibilityLabel="máximo de disciplinas na grade"
        invalid={!valid}
      />
      {valid ? null : (
        <FieldError
          message={
            max === 1
              ? 'Só uma disciplina pode entrar.'
              : `Use um número de 1 a ${max}.`
          }
        />
      )}
    </BottomSheet>
  );
}

/* ----------------------------------------------------------- o que importa */

/**
 * O objetivo como o aluno lê: no chip e na folha. A frase é curta; o
 * desenho ao lado (`GoalGlyph`) mostra a semana que ele produz.
 */
export const GOAL_COPY: Record<
  Goal,
  { chip: string; label: string; description: string }
> = {
  COMPACT: {
    chip: 'Menos intervalos',
    label: 'Menos intervalos',
    description: 'Aulas coladas',
  },
  FEW_DAYS: {
    chip: 'Menos dias na UERJ',
    label: 'Menos dias na UERJ',
    description: 'Tudo em poucos dias',
  },
  LIGHT_DAYS: {
    chip: 'Dias mais leves',
    label: 'Dias mais leves',
    description: 'Pouca aula por dia',
  },
  ADVANCE: {
    chip: 'Adiantar o curso',
    label: 'Adiantar o curso',
    description: 'Primeiro o que trava outras',
  },
};

const GOAL_ORDER: Goal[] = ['COMPACT', 'FEW_DAYS', 'LIGHT_DAYS', 'ADVANCE'];

const GoalNotice = styled.View`
  margin-top: 12px;
`;

/**
 * O que mais importa na ordem das grades: uma escolha só. A grade com mais
 * disciplinas vem sempre na frente; isto decide entre as empatadas. Cada
 * opção traz a semana em miniatura que ela produz.
 */
export function GoalSheet({
  visible,
  onClose,
  value,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  value: Goal | null;
  onSelect: (goal: Goal) => void;
}) {
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="O que mais importa?"
      footer={[<Button key="done" label="Pronto" onPress={onClose} />]}
    >
      <List
        accessibilityRole="radiogroup"
        accessibilityLabel="O que mais importa"
      >
        {GOAL_ORDER.map(goal => {
          const checked = goal === value;
          return (
            <ListRow
              key={goal}
              title={GOAL_COPY[goal].label}
              titleWeight="regular"
              subtitle={GOAL_COPY[goal].description}
              leading={<GoalGlyph goal={goal} active={checked} />}
              trailing={<Radio selected={checked} />}
              onPress={() => onSelect(goal)}
              accessibilityRole="radio"
              accessibilityState={{ checked }}
            />
          );
        })}
      </List>
      {value === 'ADVANCE' ? (
        <GoalNotice>
          <CriticalityNotice />
        </GoalNotice>
      ) : null}
    </BottomSheet>
  );
}

/* ------------------------------------------------------------------- turmas */

/** A caixa desce 2 para alinhar com a primeira linha da turma. */
const CHECK_OFFSET = StyleSheet.create({ box: { marginTop: 2 } }).box;

const SubjectHead = styled.View`
  margin: 18px 0px 2px;
`;

const Count = styled(Text)`
  margin-bottom: 4px;
`;

/**
 * As turmas de cada disciplina, para tirar as que o aluno não quer (um
 * docente, um horário). A turma que não cabe na rotina aparece travada, com
 * o motivo.
 */
export function ClassesSheet({
  visible,
  onClose,
  subjects,
  busy,
  lunch,
  removed,
  onToggle,
}: {
  visible: boolean;
  onClose: () => void;
  /** As disciplinas que podem entrar, com as turmas lidas. */
  subjects: readonly SubjectInfo[];
  busy: readonly Schedule[];
  lunch: LunchBreak | null;
  /** As turmas que o aluno tirou (`classKey`). */
  removed: ReadonlySet<string>;
  onToggle: (key: string) => void;
}) {
  const all = subjects.flatMap(subject =>
    (subject.classes ?? []).map(group => ({
      subject,
      group,
      key: classKey({
        subject_id: subject.id!,
        classNumber: group.classNumber,
      }),
      block: classBlock(group, busy, lunch),
    })),
  );
  const usable = all.filter(item => !item.block);
  const marked = usable.filter(item => !removed.has(item.key)).length;
  const over = marked > MAX_CLASSES_AMOUNT;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Turmas"
      meta={`${marked} de ${usable.length}`}
      footer={[<Button key="done" label="Pronto" onPress={onClose} />]}
    >
      {over ? (
        <Count tone="bad" accessibilityLiveRegion="polite">
          {`Até ${MAX_CLASSES_AMOUNT} turmas por vez. Tire ${plural(marked - MAX_CLASSES_AMOUNT, 'turma', 'turmas')}.`}
        </Count>
      ) : null}
      {subjects.map((subject, index) => (
        <React.Fragment key={subject.id}>
          {index > 0 ? <Divider /> : null}
          <SubjectHead>
            <Text variant="body" weight="semibold" accessibilityRole="header">
              {subject.name}
            </Text>
            <Text variant="meta" tone="muted">
              {subject.id}
            </Text>
          </SubjectHead>
          <List>
            {all
              .filter(item => item.subject === subject)
              .map(({ group, key, block }) => {
                const on = !block && !removed.has(key);
                const teachers = (group.teachers ?? []).join(', ');
                const reason = !block
                  ? null
                  : block.kind === 'BUSY'
                    ? `Horário ocupado: ${scheduleMeetings(block.clashes)}`
                    : `Sem almoço: ${joinPt(
                        block.days.map(
                          day => planningDay(day)?.shortName ?? '?',
                        ),
                      )}`;
                return (
                  <ListRow
                    key={key}
                    title={`Turma ${group.classNumber}`}
                    titleWeight="regular"
                    meta={[classMeetings(group.schedule), teachers].filter(
                      Boolean,
                    )}
                    facts={
                      reason ? (
                        <StatusLabel
                          tone="bad"
                          icon="event_busy"
                          label={reason}
                          lines={2}
                        />
                      ) : group.hasPreference ? (
                        <StatusLabel
                          tone="info"
                          icon="star"
                          label="Preferencial"
                        />
                      ) : undefined
                    }
                    leading={<Checkbox checked={on} style={CHECK_OFFSET} />}
                    leadingAlign="start"
                    accessibilityRole="checkbox"
                    accessibilityState={{
                      checked: on,
                      disabled: Boolean(block),
                    }}
                    disabled={Boolean(block)}
                    onPress={() => onToggle(key)}
                    dense
                    divider={false}
                  />
                );
              })}
          </List>
        </React.Fragment>
      ))}
    </BottomSheet>
  );
}
