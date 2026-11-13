import React, { useCallback, useMemo } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import styled, { useTheme } from 'styled-components/native';

import { useStepsContext } from '@hooks/useSteps';
import {
  Button,
  Icon,
  List,
  ListRow,
  SegmentedControl,
  Switch,
  Text,
} from '@components/ui';
import { WEEKDAY_DICTIONARY } from '@utils/constants/time';
import type { CurriculumSubject } from '@root/modules/academics/domain/models';
import { readySubjects } from '@root/modules/planning/domain/availability';
import {
  LUNCH_MINUTES,
  LUNCH_WINDOW,
  lunchBreak,
} from '@root/modules/planning/domain/lunch';
import type {
  GeneratorDraft,
  Schedule,
} from '@root/modules/planning/domain/models';
import {
  academicWeekdayToPlanningDay,
  routineFit,
  scheduleIntervals,
} from '@root/modules/planning/domain/rules';
import { usePlanningCatalog } from '@root/modules/planning/presentation/usePlanningCatalog';

import {
  FooterStatus,
  GeneratorStep,
  StepIntro,
  SubHeading,
} from '../../layout';
import {
  TIME_SLOTS,
  joinPt,
  plural,
  slotRange,
  type TimeSlot,
} from '../../format';

import {
  BusyCell,
  ClassDot,
  ClearSlot,
  DayHead,
  GridBody,
  GridHead,
  HeadSpacer,
  Legend,
  LegendBar,
  LegendItem,
  LegendLabel,
  LegendSquare,
  RowTime,
  ShiftBand,
  ShiftRow,
  Tools,
  ToolsGroup,
  Top,
  useTimeColumnWidth,
} from './RoutineStep.parts';

type WeekDayNumber = keyof typeof WEEKDAY_DICTIONARY;

const UERJ_WEEK_DAYS = [1, 2, 3, 4, 5, 6] as WeekDayNumber[];

/**
 * Os atalhos de turno e o toque longo valem de segunda a sexta. O sábado fica
 * à parte: na FFP, quase toda turma da noite tem um tempo no sábado, e marcar
 * "Manhã" e "Tarde" para o trabalho apagava essas turmas sem aviso.
 */
const WORK_DAYS = [1, 2, 3, 4, 5] as WeekDayNumber[];
const SATURDAY = 6 as WeekDayNumber;

const VALID_SCHEDULES = TIME_SLOTS;

const PERIOD_GROUPS = {
  M: VALID_SCHEDULES.filter(t => t.periodAlias.startsWith('M')),
  T: VALID_SCHEDULES.filter(t => t.periodAlias.startsWith('T')),
  N: VALID_SCHEDULES.filter(t => t.periodAlias.startsWith('N')),
} as const;

type PeriodGroup = keyof typeof PERIOD_GROUPS;

const SHIFT_GROUPS: { key: PeriodGroup; label: string; busyLabel: string }[] = [
  {
    key: 'M',
    label: 'Manhã',
    busyLabel: 'Manhã ocupada, de segunda a sexta',
  },
  {
    key: 'T',
    label: 'Tarde',
    busyLabel: 'Tarde ocupada, de segunda a sexta',
  },
  {
    key: 'N',
    label: 'Noite',
    busyLabel: 'Noite ocupada, de segunda a sexta',
  },
];

type LunchChoice = 'ONE' | 'TWO';

const LUNCH_OPTIONS: { value: LunchChoice; label: string }[] = [
  // curtos: a janela do almoço aparece pintada na tabela, com o garfo
  { value: 'ONE', label: '1 tempo' },
  { value: 'TWO', label: '2 tempos' },
];

const LUNCH_OF: Record<LunchChoice, number> = {
  ONE: LUNCH_MINUTES.oneSlot,
  TWO: LUNCH_MINUTES.twoSlots,
};

const NO_SUBJECTS: CurriculumSubject[] = [];

const slotKey = (weekDay: number, start: number, end: number) =>
  `${weekDay}-${start}-${end}`;

/** O cabeçalho dos dias fica preso no topo ao rolar (".busy-head" sticky). */
const STICKY_HEAD = { stickyHeaderIndices: [1] };

/** A linha do almoço e o seletor de duração, antes da tabela. */
const Lunch = styled.View`
  margin-top: 14px;
`;

const LunchLength = styled.View`
  margin-top: 4px;
`;

/** "A", "A e B", "A, B e mais 3". */
function someNames(names: string[]): string {
  return names.length <= 3
    ? joinPt(names)
    : `${names[0]}, ${names[1]} e mais ${names.length - 2}`;
}

/**
 * Passo 2: quando o aluno não pode ter aula e se quer guardar o almoço. Os
 * pontos da tabela mostram onde as disciplinas escolhidas têm turma, e o
 * rodapé diz, a cada toque, quais ficam sem turma.
 */
export const RoutineStep = () => {
  const theme = useTheme();
  const timeColumn = useTimeColumnWidth();
  const { nextStep, prevStep } = useStepsContext();

  const { setValue, getValues, control } = useFormContext<GeneratorDraft>();

  const [watched, lunchMinutes, selected] = useWatch({
    control,
    name: ['busy_schedules', 'lunchMinutes', 'selectedSubjects'],
  });
  const busySchedules = useMemo(() => watched ?? [], [watched]);
  const selectedSubjects = selected ?? NO_SUBJECTS;
  const catalog = usePlanningCatalog(selectedSubjects);
  const lunch = lunchBreak(lunchMinutes);

  const busySet = useMemo(
    () =>
      new Set(
        busySchedules.map(b =>
          slotKey(b.week_day, b.start_time_in_minutes, b.end_time_in_minutes),
        ),
      ),
    [busySchedules],
  );

  // as disciplinas que podem entrar e onde elas têm turma, tempo a tempo
  const ready = readySubjects({ selectedSubjects }, catalog.availability);
  const classSlots = new Map<string, Set<string>>();
  ready.forEach(subject => {
    (subject.classes ?? []).forEach(group => {
      scheduleIntervals(group.schedule ?? []).forEach(interval => {
        VALID_SCHEDULES.forEach(slot => {
          if (
            slot.start_time_in_minutes < interval.end_time_in_minutes &&
            interval.start_time_in_minutes < slot.end_time_in_minutes
          ) {
            const key = slotKey(
              interval.week_day,
              slot.start_time_in_minutes,
              slot.end_time_in_minutes,
            );
            const subjects = classSlots.get(key) ?? new Set<string>();
            subjects.add(subject.id ?? '');
            classSlots.set(key, subjects);
          }
        });
      });
    });
  });

  /** Lê o valor atual do formulário (os callbacks ficam estáveis). */
  const current = useCallback(
    (): Schedule[] => getValues('busy_schedules') ?? [],
    [getValues],
  );

  const handleScheduleItemPress = useCallback(
    (weekDay: WeekDayNumber, time: TimeSlot) => {
      const busy_schedules = current();
      const day = academicWeekdayToPlanningDay(weekDay);
      const same = (busyHour: Schedule) =>
        busyHour.week_day === day &&
        busyHour.start_time_in_minutes === time.start_time_in_minutes &&
        busyHour.end_time_in_minutes === time.end_time_in_minutes;

      setValue(
        'busy_schedules',
        busy_schedules.some(same)
          ? busy_schedules.filter(busyHour => !same(busyHour))
          : [
              ...busy_schedules,
              {
                week_day: day,
                start_time_in_minutes: time.start_time_in_minutes,
                end_time_in_minutes: time.end_time_in_minutes,
              },
            ],
      );
    },
    [current, setValue],
  );

  /** O mesmo tempo de segunda a sexta; o sábado não muda. */
  const handleLongPress = useCallback(
    (time: TimeSlot) => {
      const busy_schedules = current();
      const { start_time_in_minutes, end_time_in_minutes } = time;
      const workDays = new Set(WORK_DAYS.map(academicWeekdayToPlanningDay));
      const inRow = (busyHour: Schedule) =>
        workDays.has(busyHour.week_day) &&
        busyHour.start_time_in_minutes === start_time_in_minutes &&
        busyHour.end_time_in_minutes === end_time_in_minutes;

      const others = busy_schedules.filter(busyHour => !inRow(busyHour));
      if (busy_schedules.some(inRow)) {
        setValue('busy_schedules', others);
        return;
      }
      setValue('busy_schedules', [
        ...others,
        ...WORK_DAYS.map(weekDay => ({
          week_day: academicWeekdayToPlanningDay(weekDay),
          start_time_in_minutes,
          end_time_in_minutes,
        })),
      ]);
    },
    [current, setValue],
  );

  const isSlotSelected = (weekDay: WeekDayNumber, time: TimeSlot) =>
    busySet.has(
      slotKey(
        academicWeekdayToPlanningDay(weekDay),
        time.start_time_in_minutes,
        time.end_time_in_minutes,
      ),
    );

  const isWeekdayFull = (weekDay: WeekDayNumber) =>
    VALID_SCHEDULES.every(t => isSlotSelected(weekDay, t));

  const toggleWeekdayFull = (weekDay: WeekDayNumber) => {
    const busy_schedules = current();
    const day = academicWeekdayToPlanningDay(weekDay);
    if (isWeekdayFull(weekDay)) {
      setValue(
        'busy_schedules',
        busy_schedules.filter(b => b.week_day !== day),
      );
      return;
    }
    const toAdd = VALID_SCHEDULES.filter(t => !isSlotSelected(weekDay, t)).map(
      t => ({
        week_day: day,
        start_time_in_minutes: t.start_time_in_minutes,
        end_time_in_minutes: t.end_time_in_minutes,
      }),
    );
    setValue('busy_schedules', [...busy_schedules, ...toAdd]);
  };

  const isGroupFullySelected = (group: PeriodGroup) =>
    WORK_DAYS.every(weekDay =>
      PERIOD_GROUPS[group].every(t => isSlotSelected(weekDay, t)),
    );

  /** O turno de segunda a sexta; o que estiver marcado no sábado fica. */
  const toggleGroupAcrossWeek = (group: PeriodGroup) => {
    const busy_schedules = current();
    const times = PERIOD_GROUPS[group];
    if (isGroupFullySelected(group)) {
      const workDays = new Set(WORK_DAYS.map(academicWeekdayToPlanningDay));
      setValue(
        'busy_schedules',
        busy_schedules.filter(
          b =>
            !workDays.has(b.week_day) ||
            !times.some(
              t =>
                b.start_time_in_minutes === t.start_time_in_minutes &&
                b.end_time_in_minutes === t.end_time_in_minutes,
            ),
        ),
      );
      return;
    }
    const toAdd = WORK_DAYS.flatMap(weekDay =>
      times
        .filter(t => !isSlotSelected(weekDay, t))
        .map(t => ({
          week_day: academicWeekdayToPlanningDay(weekDay),
          start_time_in_minutes: t.start_time_in_minutes,
          end_time_in_minutes: t.end_time_in_minutes,
        })),
    );
    setValue('busy_schedules', [...busy_schedules, ...toAdd]);
  };

  const saturdayFull = isWeekdayFull(SATURDAY);
  const clearAll = () => setValue('busy_schedules', []);

  const lunchOn = lunch !== null;
  const lunchChoice: LunchChoice =
    (lunchMinutes ?? 0) >= LUNCH_MINUTES.twoSlots ? 'TWO' : 'ONE';

  // sem nada marcado, a nota ensina o gesto
  const busyCount = busySchedules.length
    ? plural(busySchedules.length, 'tempo', 'tempos')
    : 'toque para marcar';
  const inLunch = (time: TimeSlot) =>
    lunchOn &&
    time.start_time_in_minutes >= LUNCH_WINDOW.start &&
    time.end_time_in_minutes <= LUNCH_WINDOW.end;

  // o efeito da rotina nas disciplinas escolhidas, para o rodapé
  const fit = routineFit(ready, busySchedules, lunch);
  const withClass = fit.filter(subject => subject.free > 0).length;
  const without = fit.filter(subject => subject.free === 0);
  const left = fit.reduce(
    (sum, subject) => sum + subject.classes - subject.free,
    0,
  );
  let status: { text: string; tone: 'muted' | 'bad' | 'good' };
  if (catalog.loading) {
    status = { text: 'Buscando turmas…', tone: 'muted' };
  } else if (!fit.length) {
    status = { text: 'Nenhuma disciplina com turma', tone: 'bad' };
  } else if (without.length) {
    status = {
      text: `Sem turma livre: ${someNames(without.map(subject => subject.name))}`,
      tone: 'bad',
    };
  } else {
    status = {
      text: [
        fit.length === 1 ? 'Com turma livre' : 'Todas com turma livre',
        left ? plural(left, 'turma de fora', 'turmas de fora') : null,
      ]
        .filter(Boolean)
        .join(' · '),
      tone: 'muted',
    };
  }

  return (
    <GeneratorStep
      scrollProps={STICKY_HEAD}
      footer={{
        onPrev: prevStep,
        status: (
          <FooterStatus
            text={status.text}
            tone={status.tone}
            icon={
              status.tone === 'bad'
                ? 'event_busy'
                : catalog.loading
                  ? undefined
                  : 'check'
            }
          />
        ),
        next: {
          label: 'Ver grades',
          icon: 'arrow_forward',
          iconPosition: 'end',
          onPress: nextStep,
          disabled: withClass === 0 && !catalog.loading,
        },
      }}
    >
      <Top>
        <StepIntro title="Quando você não pode ter aula?" />

        <Lunch>
          <List>
            <ListRow
              title="Horário de almoço"
              titleWeight="regular"
              meta="Entre 11:30 e 14:10"
              leadingIcon="restaurant"
              trailing={<Switch value={lunchOn} />}
              accessibilityRole="switch"
              accessibilityState={{ checked: lunchOn }}
              onPress={() =>
                setValue('lunchMinutes', lunchOn ? null : LUNCH_OF.ONE)
              }
              divider={false}
            />
          </List>
          {lunchOn ? (
            <LunchLength>
              <SegmentedControl
                accessibilityLabel="Tamanho do almoço"
                options={LUNCH_OPTIONS}
                value={lunchChoice}
                onChange={choice => setValue('lunchMinutes', LUNCH_OF[choice])}
              />
            </LunchLength>
          ) : null}
        </Lunch>

        <SubHeading title="Horários ocupados" note={busyCount} />

        <Tools accessibilityRole="toolbar" accessibilityLabel="Atalhos">
          <ToolsGroup>
            {SHIFT_GROUPS.map(group => {
              const on = isGroupFullySelected(group.key);
              return (
                <Button
                  key={group.key}
                  variant="text"
                  size="sm"
                  label={group.label}
                  icon={on ? 'check' : undefined}
                  selected={on}
                  accessibilityRole="togglebutton"
                  accessibilityLabel={group.busyLabel}
                  accessibilityState={{ checked: on }}
                  onPress={() => toggleGroupAcrossWeek(group.key)}
                />
              );
            })}
            <Button
              variant="text"
              size="sm"
              label="Sábado"
              icon={saturdayFull ? 'check' : undefined}
              selected={saturdayFull}
              accessibilityRole="togglebutton"
              accessibilityLabel="Sábado inteiro ocupado"
              accessibilityState={{ checked: saturdayFull }}
              onPress={() => toggleWeekdayFull(SATURDAY)}
            />
          </ToolsGroup>
        </Tools>

        <LegendBar>
          <Legend>
            <LegendItem>
              <LegendSquare $busy />
              <LegendLabel variant="meta" tone="muted">
                Ocupado
              </LegendLabel>
            </LegendItem>
            {lunchOn ? (
              <LegendItem>
                <LegendSquare $lunch>
                  <Icon
                    name="restaurant"
                    size={11}
                    color={theme.status.warn.ink}
                  />
                </LegendSquare>
                <LegendLabel variant="meta" tone="muted">
                  Almoço
                </LegendLabel>
              </LegendItem>
            ) : null}
            {classSlots.size ? (
              <LegendItem>
                <ClassDot />
                <LegendLabel variant="meta" tone="muted">
                  Tem turma
                </LegendLabel>
              </LegendItem>
            ) : null}
          </Legend>
          <ClearSlot>
            <Button
              variant="text"
              size="sm"
              icon="delete_sweep"
              label="Limpar tudo"
              disabled={!busySchedules.length}
              onPress={clearAll}
            />
          </ClearSlot>
        </LegendBar>
      </Top>

      <GridHead>
        <HeadSpacer $width={timeColumn} />
        {UERJ_WEEK_DAYS.map(weekDay => {
          const { name, shortName } = WEEKDAY_DICTIONARY[weekDay];
          const full = isWeekdayFull(weekDay);
          return (
            <DayHead
              key={weekDay}
              onPress={() => toggleWeekdayFull(weekDay)}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={
                full
                  ? `${name}: desmarcar o dia inteiro`
                  : `${name}: marcar o dia inteiro como ocupado`
              }
              style={({ pressed }) =>
                pressed && { backgroundColor: theme.colors.surfaceMuted }
              }
            >
              <Text variant="caption" weight="semibold" tone="muted">
                {shortName}
              </Text>
            </DayHead>
          );
        })}
      </GridHead>

      <GridBody>
        {SHIFT_GROUPS.map((group, groupIndex) => {
          const times = PERIOD_GROUPS[group.key];
          return (
            <React.Fragment key={group.key}>
              <ShiftBand $first={groupIndex === 0}>
                <Text
                  variant="meta"
                  weight="semibold"
                  accessibilityRole="header"
                >
                  {group.label}
                </Text>
                <Text variant="meta" tone="muted">
                  {slotRange(
                    times[0].periodAlias,
                    times[times.length - 1].periodAlias,
                  )}
                </Text>
              </ShiftBand>
              {times.map(time => (
                <ShiftRow key={time.periodAlias}>
                  <RowTime
                    alias={time.periodAlias}
                    start={time.startTimeAlias}
                    width={timeColumn}
                    lunch={inLunch(time)}
                  />
                  {UERJ_WEEK_DAYS.map(weekDay => (
                    <BusyCell
                      key={weekDay}
                      weekDay={weekDay}
                      time={time}
                      selected={isSlotSelected(weekDay, time)}
                      lunch={inLunch(time)}
                      classes={
                        classSlots.get(
                          slotKey(
                            academicWeekdayToPlanningDay(weekDay),
                            time.start_time_in_minutes,
                            time.end_time_in_minutes,
                          ),
                        )?.size ?? 0
                      }
                      onToggle={handleScheduleItemPress}
                      onToggleRow={handleLongPress}
                    />
                  ))}
                </ShiftRow>
              ))}
            </React.Fragment>
          );
        })}
      </GridBody>
    </GeneratorStep>
  );
};
