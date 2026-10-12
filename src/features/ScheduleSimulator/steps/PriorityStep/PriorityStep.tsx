import React from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import styled, { useTheme } from 'styled-components/native';

import { useStepsContext } from '@hooks/useSteps';
import {
  ChipGroup,
  FilterChip,
  Icon,
  List,
  ListRow,
  Switch,
  Text,
} from '@components/ui';

import {
  Priority,
  ScheduleCreationParams,
} from '@root/modules/planning/domain/models';

import { GeneratorStep, StepIntro, SubHeading } from '../../layout';
import { plural } from '../../format';

const orderedPriorities = [
  'MIN_GAPS',
  'LIVES_FAR_AWAY',
  'CRITICAL_FIRST',
  'MAX_DAY_WORKLOAD',
  'MIN_DAY_WORKLOAD',
  'MAX_WORKLOAD',
  'MIN_WORKLOAD',
  'MANDATORY_CLASSES',
  'MOST_SUBJECTS_POSSIBLE',
  'MAX_CREDITS',
] as const;

const priorities = [
  [
    {
      key: 'LIVES_FAR_AWAY',
      label: 'Evitar muito deslocamento, moro longe da UERJ',
    },
  ],
  [{ key: 'MIN_GAPS', label: 'Evitar intervalos grandes entre matérias' }],
  [{ key: 'MANDATORY_CLASSES', label: 'Matérias obrigatórias' }],
  [{ key: 'MOST_SUBJECTS_POSSIBLE', label: 'Mais disciplinas possíveis' }],
  [
    {
      key: 'CRITICAL_FIRST',
      label: 'Matérias críticas (que travam outras matérias)',
    },
  ],
  [{ key: 'MAX_CREDITS', label: 'Máximo de créditos possíveis' }],
  [
    { key: 'MIN_DAY_WORKLOAD', label: 'Pouca carga horária diária' },
    { key: 'MAX_DAY_WORKLOAD', label: 'Muita carga horária diária' },
  ],
  [
    { key: 'MIN_WORKLOAD', label: 'Pouca carga horária semanal' },
    { key: 'MAX_WORKLOAD', label: 'Muita carga horária semanal' },
  ],
] as const;

type Preset = { label: string; keys: Priority[] };
const presets: Preset[] = [
  {
    label: 'Poucas lacunas (recomendado)',
    keys: ['MIN_GAPS', 'MANDATORY_CLASSES', 'MOST_SUBJECTS_POSSIBLE'],
  },
  {
    label: 'Moro longe',
    keys: ['LIVES_FAR_AWAY', 'MIN_GAPS', 'MIN_DAY_WORKLOAD'],
  },
  {
    label: 'Acelerar curso',
    keys: ['CRITICAL_FIRST', 'MAX_CREDITS', 'MAX_WORKLOAD'],
  },
  {
    label: 'Carga leve no dia',
    keys: ['MIN_DAY_WORKLOAD', 'MIN_WORKLOAD', 'MIN_GAPS'],
  },
];

/** Par de opções excludentes (".pair"): caixa com fio e a nota acima. */
const Pair = styled.View`
  margin: 8px ${({ theme }) => theme.layout.gutter}px 0px;
  border-width: ${({ theme }) => theme.borders.hairline}px;
  border-color: ${({ theme }) => theme.colors.rule};
  border-radius: ${({ theme }) => theme.radii.xl}px;
  border-top-right-radius: 0px;
  overflow: hidden;
`;

const PairNote = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 6px;
  padding: 10px 14px 2px;
`;

const PAIR_INSET = 14;

const PriorityStep = () => {
  const theme = useTheme();
  const { nextStep, prevStep } = useStepsContext();

  const { control, handleSubmit, setValue } =
    useFormContext<ScheduleCreationParams>();

  const priority = useWatch({ control, name: 'priority' }) ?? [];

  const handleNextPress = handleSubmit(data => {
    const orderedPriority = orderedPriorities.filter(key =>
      data.priority.includes(key),
    );

    setValue('priority', orderedPriority);
    nextStep();
  });

  const handleCheckBoxChange = (checked: boolean, key: Priority) => {
    if (!checked) {
      setValue(
        'priority',
        priority.filter((p: string) => p !== key),
      );
      return;
    }

    const filteredPriorities = priority.filter(name => {
      const group = priorities.find(g => g.some(p => p.key === name));

      return group && !group.some(p => p.key === key);
    });
    const newPriority = [...filteredPriorities, key];
    setValue('priority', newPriority);
  };

  const applyPreset = (keys: Priority[]) => {
    const ordered = orderedPriorities.filter(k => keys.includes(k));
    setValue('priority', ordered);
  };

  const renderRow = (
    { key, label }: { key: Priority; label: string },
    inPair = false,
  ) => {
    const on = priority.includes(key);
    return (
      <ListRow
        key={key}
        title={label}
        titleWeight="regular"
        trailing={<Switch value={on} />}
        accessibilityRole="switch"
        accessibilityState={{ checked: on }}
        onPress={() => handleCheckBoxChange(!on, key)}
        inset={inPair ? PAIR_INSET : undefined}
        dense={inPair}
      />
    );
  };

  return (
    <GeneratorStep
      footer={{
        onPrev: prevStep,
        next: {
          label: 'Próximo',
          icon: 'arrow_forward',
          iconPosition: 'end',
          onPress: handleNextPress,
        },
      }}
    >
      <StepIntro
        title="Quais são suas prioridades?"
        description="Ligue o que mais importa para você. Os atalhos ligam um conjunto pronto."
      />

      <SubHeading title="Sugestões rápidas" />
      <ChipGroup layout="wrap" accessibilityLabel="Sugestões rápidas">
        {presets.map(p => (
          <FilterChip
            key={p.label}
            label={p.label}
            selected={
              p.keys.every(k => priority.includes(k)) &&
              priority.length === p.keys.length
            }
            onPress={() => applyPreset(p.keys)}
          />
        ))}
      </ChipGroup>

      <SubHeading
        title="Prioridades"
        note={plural(priority.length, 'ligada', 'ligadas')}
      />
      <List>
        {priorities.map(group =>
          group.length === 1 ? (
            renderRow(group[0])
          ) : (
            <Pair key={group.map(o => o.key).join('|')}>
              <PairNote>
                <Icon
                  name="swap_vert"
                  size={theme.sizes.icon.sm}
                  color={theme.colors.inkMuted}
                />
                <Text variant="caption" tone="muted">
                  Só uma destas pode ficar ligada
                </Text>
              </PairNote>
              <List bleed={false}>{group.map(o => renderRow(o, true))}</List>
            </Pair>
          ),
        )}
      </List>
    </GeneratorStep>
  );
};

export default PriorityStep;
