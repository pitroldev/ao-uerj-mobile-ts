import React, { useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { useTheme } from 'styled-components/native';

import {
  BottomSheet,
  Button,
  ChipGroup,
  FilterChip,
  formatGrade,
  Icon,
  Notice,
  OptionList,
  SelectField,
  snackbar,
  Text,
  TextField,
  TimeField,
} from '@components/ui';
import type {
  AttendedClassesSchedule,
  ClassGrade,
} from '@root/modules/academics/domain/models';
import { subjectKey } from '@root/modules/academics/domain/rules/subjectId';
import {
  fromIsoDate,
  toIsoDate,
} from '@root/modules/attendance/domain/attendance';
import {
  comingReminders,
  defaultType,
  duplicateOf,
  EARLY_REMINDERS,
  EVALUATION_TYPES,
  examGrade,
  isExam,
  meetingOn,
  NOTE_MAX,
  REMINDER_KEYS,
  reminderAt,
  remindsBeforeStart,
  remindsLater,
  sortedReminders,
  upcomingClassDates,
  WORK_DEADLINE,
  type Evaluation,
  type EvaluationType,
  type ReminderKey,
} from '@root/modules/evaluations/domain/evaluations';
import {
  dateTimeText,
  longDate,
  REMINDER_LABEL,
  reminderCount,
  shortDate,
  TYPE_LABEL,
} from '@root/modules/evaluations/presentation/evaluationText';
import {
  courseSubjects,
  gradesBySubject,
  meetingsOf,
} from '@root/modules/evaluations/presentation/scheduleLookup';
import { useEvaluations } from '@root/modules/evaluations/presentation/useEvaluations';
import { systemTexts } from '@root/modules/notifications/presentation/systemTexts';
import { useNotificationSettings } from '@root/modules/notifications/presentation/useNotificationSettings';
import {
  findNextClass,
  hasClassTime,
  isCanceled,
  WEEKDAY_NAMES,
  weekdayOf,
} from '@features/AttendedClassesSchedule/scheduleFormat';

import {
  Below,
  Field,
  FieldLabel,
  FirstField,
  Half,
  Notes,
  Pair,
  Plan,
  PlanRow,
  PlanWhen,
  TimeSlot,
} from './EvaluationSheet.styles';
import { MonthCalendar } from './MonthCalendar';

/** O que abriu a folha: "Adicionar", um dia da semana, uma célula de nota ou uma avaliação. */
export type EvaluationRequest =
  | {
      kind: 'new';
      subjectId?: string;
      type?: EvaluationType;
      date?: string;
    }
  | { kind: 'edit'; id: string };

type Props = {
  visible: boolean;
  request: EvaluationRequest;
  onClose: () => void;
  /** A grade do período: disciplinas, dias de aula, horários. */
  schedule: readonly AttendedClassesSchedule[];
  /** O quadro de notas: prova com nota não se anota de novo. */
  grades: readonly ClassGrade[];
  now: Date;
  /** Depois de salvar (a semana passa a mostrar o dia). */
  onSaved?: (evaluation: Evaluation) => void;
};

type Draft = Omit<Evaluation, 'id' | 'subjectName'> & { id: string | null };

/** Até um ano à frente no calendário de "Outra data". */
const MAX_DAYS_AHEAD = 365;
/** Sem aula naquele dia, a prova começa às 8h até o aluno ajustar. */
const FALLBACK_TIME = 8 * 60;

function createId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** A primeira aula do dia na grade, para "+ Avaliação" num dia da semana. */
function firstSubjectOn(
  schedule: readonly AttendedClassesSchedule[],
  date: string,
): string | null {
  const weekday = fromIsoDate(date).getDay();
  const item = schedule
    .filter(
      entry =>
        weekdayOf(entry) === weekday &&
        !isCanceled(entry) &&
        hasClassTime(entry),
    )
    .sort((a, b) => a.start_time_in_minutes - b.start_time_in_minutes)[0];
  return item ? subjectKey(item.class?.id ?? item.subject_id) : null;
}

function timeFor(
  type: EvaluationType,
  schedule: readonly AttendedClassesSchedule[],
  subjectId: string,
  date: string,
  fallback: number,
): number {
  if (type === 'work') return WORK_DEADLINE;
  return meetingOn(meetingsOf(schedule, subjectId), date)?.start ?? fallback;
}

/**
 * Anotar ou editar uma prova ou trabalho: disciplina, tipo, data (as
 * próximas aulas da disciplina ou o calendário), horário (o da aula daquele
 * dia; num trabalho, o prazo às 23:59), observação e os lembretes, com a
 * lista de quando cada um chega. Uma P1 (P2, PF) por disciplina: anotar de
 * novo troca a data, com o aviso antes de salvar.
 */
export function EvaluationSheet({
  visible,
  request,
  onClose,
  schedule,
  grades,
  now,
  onSaved,
}: Props) {
  const theme = useTheme();
  const c = theme.colors;
  const texts = systemTexts();
  const { evaluations, save, remove } = useEvaluations();
  const { snapshot, settings } = useNotificationSettings();
  const defaults = snapshot.preferences.evaluationDefaults;
  const subjects = useMemo(
    () => courseSubjects(schedule, grades),
    [schedule, grades],
  );
  const gradeMap = useMemo(() => gradesBySubject(grades), [grades]);
  const today = toIsoDate(now);
  const editing =
    request.kind === 'edit'
      ? (evaluations.find(item => item.id === request.id) ?? null)
      : null;

  const [draft, setDraft] = useState<Draft>(() => {
    if (editing) return { ...editing, reminders: [...editing.reminders] };
    const asked = request.kind === 'new' ? request : { kind: 'new' as const };
    const next = findNextClass([...schedule], now)?.item;
    const subjectId =
      asked.subjectId ??
      (asked.date ? firstSubjectOn(schedule, asked.date) : null) ??
      (next ? subjectKey(next.class?.id ?? next.subject_id) : null) ??
      subjects[0]?.id ??
      '';
    const type = asked.type ?? defaultType(evaluations, subjectId, gradeMap);
    const date =
      asked.date && asked.date >= today
        ? asked.date
        : (upcomingClassDates(meetingsOf(schedule, subjectId), now)[0] ??
          today);
    const fresh: Draft = {
      id: null,
      subjectId,
      type,
      date,
      time: timeFor(type, schedule, subjectId, date, FALLBACK_TIME),
      note: '',
      reminders: [],
      earlyTime: defaults.earlyTime,
      dayTime: defaults.dayTime,
      done: false,
    };
    // os padrões que ainda vão chegar: a véspera de uma prova hoje já passou
    return {
      ...fresh,
      reminders: defaults.reminders.filter(key =>
        remindsLater(fresh, key, now),
      ),
    };
  });
  // Numa avaliação nova, enquanto o aluno não mexe nos lembretes, valem os
  // padrões que ainda vão chegar na data e no horário escolhidos.
  const [touched, setTouched] = useState(Boolean(editing));
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);

  const meetings = meetingsOf(schedule, draft.subjectId);
  const classDates = upcomingClassDates(meetings, now);
  const [custom, setCustom] = useState(() => !classDates.includes(draft.date));

  const change = (patch: Partial<Draft>) => {
    setDraft(current => {
      const next = { ...current, ...patch };
      if (touched || patch.reminders) return next;
      return {
        ...next,
        reminders: defaults.reminders.filter(key =>
          remindsLater(next, key, now),
        ),
      };
    });
  };

  const subject = subjects.find(item => item.id === draft.subjectId);
  const subjectName =
    subject?.name ?? editing?.subjectName ?? 'Escolha a disciplina';
  const duplicate = duplicateOf(evaluations, draft);
  const meeting = meetingOn(meetings, draft.date);
  const maxDate = toIsoDate(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + MAX_DAYS_AHEAD),
  );

  let timeHelp = 'Sem aula nesse dia: confira o horário.';
  if (draft.type === 'work')
    timeHelp = 'Prazo de entrega; ajuste se for outro.';
  else if (meeting)
    timeHelp = `Horário da aula de ${WEEKDAY_NAMES[meeting.weekday].toLowerCase()}.`;

  const pickSubject = (subjectId: string) => {
    setPicking(false);
    const dates = upcomingClassDates(meetingsOf(schedule, subjectId), now);
    const type = draft.id
      ? draft.type
      : defaultType(evaluations, subjectId, gradeMap);
    const date = dates[0] ?? today;
    setCustom(!dates.length);
    change({
      subjectId,
      type,
      date,
      time: timeFor(type, schedule, subjectId, date, draft.time),
    });
  };

  const pickType = (type: EvaluationType) => {
    let time = draft.time;
    if (type === 'work') time = WORK_DEADLINE;
    else if (draft.type === 'work')
      time = timeFor(type, schedule, draft.subjectId, draft.date, draft.time);
    change({ type, time });
  };

  const pickDate = (date: string) => {
    change({
      date,
      time:
        draft.type === 'work'
          ? draft.time
          : timeFor(draft.type, schedule, draft.subjectId, date, draft.time),
    });
  };

  const toggleReminder = (key: ReminderKey) => {
    setTouched(true);
    const on = draft.reminders.includes(key);
    change({
      reminders: REMINDER_KEYS.filter(item =>
        item === key ? !on : draft.reminders.includes(item),
      ),
    });
  };

  const turnOnReminders = () => {
    void settings.update({ evaluationReminders: true }).then(result => {
      if (result === 'denied')
        snackbar.info('Aviso não ligado', texts.deniedHint);
      if (result === 'blocked')
        snackbar.info(texts.blockedTitle, texts.blockedHint);
    });
  };

  const submit = async () => {
    if (saving || !draft.subjectId) return;
    setSaving(true);
    const evaluation: Evaluation = {
      ...draft,
      id: draft.id ?? createId(),
      subjectName: subject?.name ?? editing?.subjectName ?? draft.subjectId,
      note: draft.note.trim(),
    };
    const saved = await save(evaluation);
    setSaving(false);
    if (!saved) {
      snackbar.error('Não foi possível salvar a avaliação.', 'Tente de novo.');
      return;
    }
    onClose();
    onSaved?.(evaluation);
    // o relógio da tela (o mesmo da lista de lembretes da folha)
    const coming = comingReminders(evaluation, now);
    let detail = 'Sem lembretes.';
    if (coming.length)
      detail = `${reminderCount(coming.length)}; o primeiro chega ${dateTimeText(
        reminderAt(evaluation, coming[0]),
      )}.`;
    if (coming.length && !snapshot.preferences.evaluationReminders)
      detail = 'Os lembretes de avaliações estão desligados em Notificações.';
    else if (
      coming.length &&
      snapshot.supported &&
      snapshot.permission !== 'granted'
    ) {
      const permission = await settings.requestPermission();
      if (permission !== 'granted')
        detail = `Sem a sua permissão, os lembretes não chegam. ${texts.deniedHint}`;
    }
    snackbar.success(
      editing ? 'Avaliação atualizada' : 'Avaliação anotada',
      detail,
    );
  };

  const erase = async () => {
    if (!editing) return;
    if (!(await remove(editing.id))) {
      snackbar.error('Não foi possível excluir a avaliação.', 'Tente de novo.');
      return;
    }
    onClose();
    snackbar.success('Avaliação excluída', 'Os lembretes dela também saíram.');
  };

  const planned = sortedReminders(draft);
  const early = draft.reminders.some(key => EARLY_REMINDERS.includes(key));
  const sameDay = draft.reminders.includes('day');
  let reminderNotice: React.ReactNode = null;
  if (!snapshot.supported) {
    reminderNotice = (
      <Notice
        tone="neutral"
        icon="notifications"
        text="Os lembretes ainda não estão disponíveis neste aparelho."
      />
    );
  } else if (snapshot.ready && !snapshot.preferences.evaluationReminders) {
    reminderNotice = (
      <Notice
        tone="info"
        icon="notifications"
        text="Os lembretes de avaliações estão desligados em Notificações."
        action={{
          label: 'Ligar',
          accessibilityLabel: 'Ligar os lembretes de avaliações',
          onPress: turnOnReminders,
        }}
      />
    );
  } else if (snapshot.permission === 'blocked' && draft.reminders.length) {
    reminderNotice = (
      <Notice
        tone="warn"
        icon="notifications"
        text={texts.blockedNotice}
        action={{
          label: texts.openSettings,
          accessibilityLabel: texts.openSettingsLabel,
          onPress: () => {
            void settings.openSettings();
          },
        }}
      />
    );
  }

  const footer = editing
    ? [
        <Button
          key="delete"
          variant="text"
          label="Excluir"
          color={theme.status.bad.ink}
          onPress={() => {
            void erase();
          }}
        />,
        <Button
          key="cancel"
          variant="outline"
          label="Cancelar"
          onPress={onClose}
        />,
        <Button
          key="save"
          label="Salvar"
          loading={saving}
          onPress={() => {
            void submit();
          }}
        />,
      ]
    : [
        <Button
          key="cancel"
          variant="outline"
          label="Cancelar"
          onPress={onClose}
        />,
        <Button
          key="save"
          label="Salvar"
          loading={saving}
          disabled={!draft.subjectId}
          onPress={() => {
            void submit();
          }}
        />,
      ];

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={editing ? 'Editar avaliação' : 'Nova avaliação'}
      footer={footer}
    >
      {draft.done ? (
        <FirstField>
          <Notice
            tone="neutral"
            icon="task_alt"
            text="Marcada como feita pelo aviso: saiu das próximas avaliações e os lembretes pararam."
            action={{
              label: 'Desfazer',
              accessibilityLabel: 'Desfazer: voltar a lembrar desta avaliação',
              onPress: () => change({ done: false }),
            }}
          />
        </FirstField>
      ) : null}
      <FirstField>
        <SelectField
          label="Disciplina"
          valueLabel={subjectName}
          onPress={() => setPicking(open => !open)}
          accessibilityLabel={`Disciplina: ${subjectName}. ${
            picking ? 'Fechar a lista' : 'Trocar'
          }`}
        />
        {picking ? (
          <OptionList
            options={subjects.map(item => ({
              value: item.id,
              label: item.name,
            }))}
            value={draft.subjectId}
            onSelect={pickSubject}
            accessibilityLabel="Disciplinas em curso"
          />
        ) : null}
      </FirstField>

      <Field>
        <FieldLabel variant="meta" weight="medium">
          Tipo
        </FieldLabel>
        <ChipGroup accessibilityLabel="Tipo da avaliação">
          {EVALUATION_TYPES.map(type => {
            const selected = draft.type === type;
            const grade = isExam(type)
              ? examGrade(type, gradeMap.get(draft.subjectId))
              : null;
            if (grade !== null && !selected) {
              const value = formatGrade(grade);
              return (
                <FilterChip
                  key={type}
                  label={`${type} · saiu ${value}`}
                  disabled
                  accessibilityLabel={`${type}: a nota já saiu, ${value}`}
                />
              );
            }
            return (
              <FilterChip
                key={type}
                label={TYPE_LABEL[type]}
                selected={selected}
                onPress={() => pickType(type)}
              />
            );
          })}
        </ChipGroup>
        {duplicate ? (
          <Below>
            <Notice
              tone="warn"
              icon="warning"
              text={`Já há ${TYPE_LABEL[draft.type]} de ${subjectName} anotada para ${shortDate(
                duplicate.date,
              )}. Salvar troca a data.`}
            />
          </Below>
        ) : null}
      </Field>

      <Field>
        <FieldLabel variant="meta" weight="medium">
          Data
        </FieldLabel>
        <ChipGroup accessibilityLabel="Data da avaliação">
          {classDates.map(date => (
            <FilterChip
              key={date}
              label={shortDate(date)}
              selected={!custom && draft.date === date}
              accessibilityLabel={`${longDate(date)}, dia de aula`}
              onPress={() => {
                setCustom(false);
                pickDate(date);
              }}
            />
          ))}
          <FilterChip
            label="Outra data"
            icon="calendar_today"
            selected={custom}
            onPress={() => setCustom(true)}
          />
        </ChipGroup>
        {custom ? (
          <Below>
            <MonthCalendar
              value={draft.date}
              min={today}
              max={maxDate}
              isClassDay={date => meetingOn(meetings, date) !== null}
              onChange={pickDate}
            />
          </Below>
        ) : null}
        <Below>
          <TimeSlot>
            <TimeField
              label={draft.type === 'work' ? 'Prazo' : 'Horário'}
              value={draft.time}
              onChange={time => change({ time })}
            />
          </TimeSlot>
          <Text variant="meta" tone="muted" style={styles.help}>
            {`${longDate(draft.date)}. ${timeHelp}`}
          </Text>
        </Below>
      </Field>

      <Field>
        <TextField
          label="Observação"
          multiline
          maxLength={NOTE_MAX}
          value={draft.note}
          onChangeText={note => change({ note })}
          placeholder="Matéria, capítulos, material permitido, sala diferente, com quem é o trabalho…"
          helper={`${draft.note.length}/${NOTE_MAX}`}
        />
      </Field>

      <Field>
        <FieldLabel variant="meta" weight="medium">
          Lembretes
        </FieldLabel>
        <ChipGroup accessibilityLabel="Lembretes">
          {REMINDER_KEYS.map(key => {
            const on = draft.reminders.includes(key);
            if (!on && !remindsLater(draft, key, now)) {
              const why = remindsBeforeStart(draft, key)
                ? 'já passou'
                : 'depois do início';
              return (
                <FilterChip
                  key={key}
                  label={`${REMINDER_LABEL[key]} · ${why}`}
                  disabled
                  accessibilityLabel={`${REMINDER_LABEL[key]}: ${why}`}
                />
              );
            }
            return (
              <FilterChip
                key={key}
                label={REMINDER_LABEL[key]}
                selected={on}
                onPress={() => toggleReminder(key)}
              />
            );
          })}
        </ChipGroup>
        {early || sameDay ? (
          <Pair>
            {early ? (
              <Half>
                <TimeField
                  label="Dias antes, às"
                  accessibilityLabel="Horário dos lembretes de dias antes"
                  value={draft.earlyTime}
                  onChange={earlyTime => change({ earlyTime })}
                />
              </Half>
            ) : null}
            {sameDay ? (
              <Half>
                <TimeField
                  label="No dia, às"
                  accessibilityLabel="Horário do lembrete no dia"
                  value={draft.dayTime}
                  onChange={dayTime => change({ dayTime })}
                />
              </Half>
            ) : null}
          </Pair>
        ) : null}
        {planned.length ? (
          <Plan accessibilityLabel="Quando os lembretes chegam">
            {planned.map((key, index) => {
              const later = remindsLater(draft, key, now);
              let state = '';
              if (!later)
                state = remindsBeforeStart(draft, key)
                  ? ' · já passou'
                  : ' · depois do início';
              const when = dateTimeText(reminderAt(draft, key));
              return (
                <PlanRow
                  key={key}
                  $divider={index < planned.length - 1}
                  accessible
                  accessibilityLabel={`${REMINDER_LABEL[key]}: ${when}${state}`}
                >
                  <Icon
                    name="notifications"
                    size={theme.sizes.icon.md}
                    color={later ? c.inkMuted : c.inkSubtle}
                  />
                  <PlanWhen
                    tabular
                    tone={later ? 'ink' : 'muted'}
                    style={later ? undefined : styles.past}
                  >
                    {when}
                  </PlanWhen>
                  <Text variant="meta" tone="muted">
                    {`${REMINDER_LABEL[key]}${state}`}
                  </Text>
                </PlanRow>
              );
            })}
          </Plan>
        ) : (
          <Below>
            <Text variant="meta" tone="muted">
              Sem lembretes: a avaliação só aparece no Início, na semana e no
              quadro de notas.
            </Text>
          </Below>
        )}
        {reminderNotice ? <Notes>{reminderNotice}</Notes> : null}
      </Field>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  help: { marginTop: 6 },
  past: { textDecorationLine: 'line-through' },
});
