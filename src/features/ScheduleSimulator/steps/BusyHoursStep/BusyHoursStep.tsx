import { academicWeekdayToPlanningDay } from '@root/modules/planning/domain/rules';
import React, { useCallback, useMemo } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { useTheme } from 'styled-components/native';

import { useStepsContext } from '@hooks/useSteps';
import { Button, Text } from '@components/ui';

import { WEEKDAY_DICTIONARY } from '@utils/constants/time';

import {
  Schedule,
  ScheduleCreationParams,
} from '@root/modules/planning/domain/models';

import { GeneratorStep, StepIntro } from '../../layout';
import { TIME_SLOTS, plural, slotRange, type TimeSlot } from '../../format';

import {
  BusyCell,
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
  ToolsLabel,
  Top,
  useTimeColumnWidth,
} from './BusyHoursStep.parts';

type WeekDayNumber = keyof typeof WEEKDAY_DICTIONARY;

const UERJ_WEEK_DAYS = [1, 2, 3, 4, 5, 6] as WeekDayNumber[];

const VALID_SCHEDULES = TIME_SLOTS;

const PERIOD_GROUPS = {
  M: VALID_SCHEDULES.filter(t => t.periodAlias.startsWith('M')),
  T: VALID_SCHEDULES.filter(t => t.periodAlias.startsWith('T')),
  N: VALID_SCHEDULES.filter(t => t.periodAlias.startsWith('N')),
} as const;

type PeriodGroup = keyof typeof PERIOD_GROUPS;

const SHIFT_GROUPS: { key: PeriodGroup; label: string; busyLabel: string }[] = [
  { key: 'M', label: 'Manhã', busyLabel: 'Manhã ocupada' },
  { key: 'T', label: 'Tarde', busyLabel: 'Tarde ocupada' },
  { key: 'N', label: 'Noite', busyLabel: 'Noite ocupada' },
];

const slotKey = (weekDay: number, start: number, end: number) =>
  `${weekDay}-${start}-${end}`;

/** O cabeçalho dos dias fica preso no topo ao rolar (".busy-head" sticky). */
const STICKY_HEAD = { stickyHeaderIndices: [1] };

export const BusyHoursStep = () => {
  const theme = useTheme();
  const timeColumn = useTimeColumnWidth();
  const { nextStep, prevStep } = useStepsContext();

  const { handleSubmit, setValue, getValues, control } =
    useFormContext<ScheduleCreationParams>();

  const watched = useWatch({ control, name: 'busy_schedules' });
  const busySchedules = useMemo(() => watched ?? [], [watched]);

  const busySet = useMemo(
    () =>
      new Set(
        busySchedules.map(b =>
          slotKey(b.week_day, b.start_time_in_minutes, b.end_time_in_minutes),
        ),
      ),
    [busySchedules],
  );

  const handleNextPress = handleSubmit(nextStep);

  /** Lê o valor atual do formulário (os callbacks ficam estáveis). */
  const current = useCallback(
    (): Schedule[] => getValues('busy_schedules') ?? [],
    [getValues],
  );

  const handleScheduleItemPress = useCallback(
    (weekDay: WeekDayNumber, time: TimeSlot) => {
      const busy_schedules = current();
      const isAlreadySelected = busy_schedules.some(
        busyHour =>
          busyHour.week_day === academicWeekdayToPlanningDay(weekDay) &&
          busyHour.start_time_in_minutes === time.start_time_in_minutes &&
          busyHour.end_time_in_minutes === time.end_time_in_minutes,
      );

      if (isAlreadySelected) {
        const newBusySchedules = busy_schedules.filter(
          busyHour =>
            busyHour.week_day !== academicWeekdayToPlanningDay(weekDay) ||
            busyHour.start_time_in_minutes !== time.start_time_in_minutes ||
            busyHour.end_time_in_minutes !== time.end_time_in_minutes,
        );

        setValue('busy_schedules', newBusySchedules);
        return;
      }

      const newBusySchedule = {
        week_day: academicWeekdayToPlanningDay(weekDay),
        start_time_in_minutes: time.start_time_in_minutes,
        end_time_in_minutes: time.end_time_in_minutes,
      };

      setValue('busy_schedules', [...busy_schedules, newBusySchedule]);
    },
    [current, setValue],
  );

  const handleLongPress = useCallback(
    (time: TimeSlot) => {
      const busy_schedules = current();
      const { start_time_in_minutes, end_time_in_minutes } = time;

      const filteredBusySchedules = busy_schedules.filter(
        busyHour =>
          busyHour.start_time_in_minutes !== start_time_in_minutes ||
          busyHour.end_time_in_minutes !== end_time_in_minutes,
      );

      const isAlreadySelected = busy_schedules.some(
        busyHour =>
          busyHour.start_time_in_minutes === start_time_in_minutes &&
          busyHour.end_time_in_minutes === end_time_in_minutes,
      );

      if (isAlreadySelected) {
        setValue('busy_schedules', filteredBusySchedules);
        return;
      }

      const busyRowTImes = UERJ_WEEK_DAYS.map(weekDay => ({
        week_day: academicWeekdayToPlanningDay(weekDay),
        start_time_in_minutes,
        end_time_in_minutes,
      }));

      setValue('busy_schedules', [...filteredBusySchedules, ...busyRowTImes]);
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

  const toggleWeekdayFull = (weekDay: WeekDayNumber, times: TimeSlot[]) => {
    const busy_schedules = current();
    const allSelected = times.every(t => isSlotSelected(weekDay, t));
    if (allSelected) {
      const filtered = busy_schedules.filter(
        b => b.week_day !== academicWeekdayToPlanningDay(weekDay),
      );
      setValue('busy_schedules', filtered);
      return;
    }
    const toAdd = times
      .filter(t => !isSlotSelected(weekDay, t))
      .map(t => ({
        week_day: academicWeekdayToPlanningDay(weekDay),
        start_time_in_minutes: t.start_time_in_minutes,
        end_time_in_minutes: t.end_time_in_minutes,
      }));
    setValue('busy_schedules', [...busy_schedules, ...toAdd]);
  };

  const isGroupFullySelected = (group: PeriodGroup) =>
    UERJ_WEEK_DAYS.every(weekDay =>
      PERIOD_GROUPS[group].every(t => isSlotSelected(weekDay, t)),
    );

  const toggleGroupAcrossWeek = (group: PeriodGroup) => {
    const busy_schedules = current();
    const times = PERIOD_GROUPS[group];
    const allSelected = UERJ_WEEK_DAYS.every(weekDay =>
      times.every(t => isSlotSelected(weekDay, t)),
    );
    if (allSelected) {
      const filtered = busy_schedules.filter(b => {
        const matches = times.some(
          t =>
            b.start_time_in_minutes === t.start_time_in_minutes &&
            b.end_time_in_minutes === t.end_time_in_minutes,
        );
        return !matches;
      });
      setValue('busy_schedules', filtered);
      return;
    }
    const toAdd = UERJ_WEEK_DAYS.flatMap(weekDay =>
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

  const clearAll = () => setValue('busy_schedules', []);

  const busyCount = busySchedules.length
    ? plural(busySchedules.length, 'tempo', 'tempos')
    : 'nenhum tempo';

  return (
    <GeneratorStep
      scrollProps={STICKY_HEAD}
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
      <Top>
        <StepIntro
          title="Quando você está ocupado?"
          description="Dica: toque para marcar, toque e segure para o período do dia. Você também pode usar os atalhos abaixo."
        />

        <Tools accessibilityRole="toolbar">
          <ToolsLabel variant="meta" tone="muted">
            Turno inteiro ocupado
          </ToolsLabel>
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
          </ToolsGroup>
        </Tools>

        <LegendBar>
          <Legend>
            <LegendItem>
              <LegendSquare $busy />
              <LegendLabel
                variant="meta"
                tone="muted"
                accessibilityLiveRegion="polite"
              >
                Ocupado: {busyCount}
              </LegendLabel>
            </LegendItem>
            <LegendItem>
              <LegendSquare $busy={false} />
              <LegendLabel variant="meta" tone="muted">
                Livre
              </LegendLabel>
            </LegendItem>
          </Legend>
          <ClearSlot>
            <Button
              variant="text"
              size="sm"
              icon="delete_sweep"
              label="Limpar tudo"
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
              onPress={() => toggleWeekdayFull(weekDay, VALID_SCHEDULES)}
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
                  />
                  {UERJ_WEEK_DAYS.map(weekDay => (
                    <BusyCell
                      key={weekDay}
                      weekDay={weekDay}
                      time={time}
                      selected={isSlotSelected(weekDay, time)}
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
