import { z } from 'zod';

import {
  GENERATION_LIMITS as LIMIT,
  isPriority,
  type GenerationRequest,
  type Interval,
} from '../../../../modules/schedules/domain/model.ts';
import {
  absentAs,
  body,
  required,
  requiredText,
  stringFor,
} from '../validation.ts';

/*
 * A camada anticorrupção do gerador: o pedido no formato do servidor antigo
 * (o que os apps de 2023 em diante mandam) vira o pedido do domínio. Só o
 * que a busca usa é conferido a fundo; o resto de cada turma e disciplina
 * volta na resposta como veio, e um campo que falta vale o vazio do tipo.
 */

/** Número qualquer; ausente vale 0. */
const quantity = (field: string) =>
  z.preprocess(absentAs(0), z.number({ error: `${field} must be a number` }));

/** Número de 0 em diante; ausente vale 0. */
const amount = (field: string) =>
  quantity(field).pipe(z.number().min(0, `${field} must not be negative`));

const optionalNumber = (field: string) =>
  z
    .preprocess(
      value => value ?? undefined,
      z.number({ error: `${field} must be a number` }).optional(),
    )
    .optional();

/** Texto curto; número vira texto; ausente vale "". */
const label = (field: string, max: number = LIMIT.text) =>
  z.preprocess(
    value => {
      if (value === null || value === undefined) return '';
      return typeof value === 'number' && Number.isFinite(value)
        ? String(value)
        : value;
    },
    stringFor(field).max(max, `${field} must be at most ${max} characters`),
  );

/** Lista de textos; ausente vale []. */
const labels = (field: string) =>
  z.preprocess(
    absentAs([]),
    z
      .array(
        z
          .string({ error: `each ${field} entry must be a string` })
          .max(LIMIT.text, `each ${field} entry is too long`),
        { error: `${field} must be an array` },
      )
      .max(
        LIMIT.listItems,
        `${field} must have at most ${LIMIT.listItems} entries`,
      ),
  );

const flag = (field: string) =>
  z.preprocess(
    absentAs(false),
    z.boolean({ error: `${field} must be true or false` }),
  );

const optionalFlag = (field: string) =>
  z
    .preprocess(
      value => value ?? undefined,
      z.boolean({ error: `${field} must be true or false` }).optional(),
    )
    .optional();

const WEEK_DAY = 'week_day must be an integer from 0 to 6';
const minute = (field: string) =>
  z
    .number({ error: `${field} must be a number of minutes` })
    .min(0, `${field} must be between 0 and 1440`)
    .max(1440, `${field} must be between 0 and 1440`);

const interval = z
  .looseObject(
    {
      week_day: z
        .number({ error: WEEK_DAY })
        .int(WEEK_DAY)
        .min(0, WEEK_DAY)
        .max(6, WEEK_DAY),
      start_time_in_minutes: minute('start_time_in_minutes'),
      end_time_in_minutes: minute('end_time_in_minutes'),
    },
    { error: 'each schedule must be an object' },
  )
  .refine(
    value => value.start_time_in_minutes < value.end_time_in_minutes,
    'a schedule must end after it starts',
  );

const intervals = (field: string, max: number) =>
  z.preprocess(
    absentAs([]),
    z
      .array(interval, { error: `${field} must be an array` })
      .max(max, `${field} must have at most ${max} entries`),
  );

/** Horário de almoço: ausente (ou nulo) sem restrição; os três números quando o objeto vem. */
const lunchBreak = z
  .preprocess(
    value => value ?? undefined,
    z
      .object(
        {
          start_time_in_minutes: minute('start_time_in_minutes'),
          end_time_in_minutes: minute('end_time_in_minutes'),
          minimum_minutes: z
            .number({ error: 'minimum_minutes must be a number of minutes' })
            .min(1, 'minimum_minutes must be at least 1'),
        },
        { error: 'lunch_break must be an object' },
      )
      .refine(
        value => value.start_time_in_minutes < value.end_time_in_minutes,
        'lunch_break must end after it starts',
      )
      .refine(
        value =>
          value.minimum_minutes <=
          value.end_time_in_minutes - value.start_time_in_minutes,
        'minimum_minutes must fit within the lunch break',
      )
      .optional(),
  )
  .optional();

const subject = z.looseObject(
  {
    id: requiredText('id', { max: LIMIT.id, numeric: true }),
    name: label('name'),
    type: label('type'),
    credits: amount('credits'),
    total_workload: amount('total_workload'),
    prerequisites: labels('prerequisites'),
    allow_conflict: flag('allow_conflict'),
    recomended_period: optionalNumber('recomended_period'),
    minimum_credits: optionalNumber('minimum_credits'),
    criticality: optionalNumber('criticality'),
    blocks: optionalNumber('blocks'),
  },
  { error: 'each subject must be an object' },
);

const classOption = z.looseObject(
  {
    id: label('id', LIMIT.id),
    name: label('name'),
    type: label('type'),
    teachers: labels('teachers'),
    vacancies_amount: quantity('vacancies_amount'),
    subject_id: requiredText('subject_id', { max: LIMIT.id, numeric: true }),
    schedules: intervals('schedules', LIMIT.intervalsPerClass),
    selected_by_user: optionalFlag('selected_by_user'),
  },
  { error: 'each class must be an object' },
);

/** A quantidade de disciplinas; texto com dígitos vale (`"3"`), como no `parseInt` antigo. */
const subjectAmount = (field: string) =>
  z.preprocess(
    value =>
      typeof value === 'string' && /^\s*\d+\s*$/.test(value)
        ? Number(value)
        : value,
    z
      .number({ error: required(field, 'an integer') })
      .int(`${field} must be an integer`)
      .min(0, `${field} must not be negative`)
      .max(
        LIMIT.subjectAmount,
        `${field} must be at most ${LIMIT.subjectAmount}`,
      ),
  );

const list = <Item extends z.ZodType>(field: string, item: Item, max: number) =>
  z
    .array(item, { error: required(field, 'an array') })
    .max(max, `${field} must have at most ${max} entries`);

const generationBody = body({
  preferences: z.object(
    {
      min_subject_amount: subjectAmount('min_subject_amount'),
      max_subject_amount: subjectAmount('max_subject_amount'),
      busy_schedules: intervals('busy_schedules', LIMIT.busyIntervals),
      lunch_break: lunchBreak,
      // uma prioridade desconhecida não muda a ordem, como antes
      priority: z
        .preprocess(
          absentAs([]),
          z
            .array(z.unknown(), { error: 'priority must be an array' })
            .max(
              LIMIT.priorities,
              `priority must have at most ${LIMIT.priorities} entries`,
            ),
        )
        .transform(values => values.filter(isPriority)),
    },
    { error: required('preferences', 'an object') },
  ),
  classes: list('classes', classOption, LIMIT.classes),
  subjects: list('subjects', subject, LIMIT.subjects),
});

/** O pedido conferido, no formato do contrato (o que volta na resposta). */
export type GenerationBody = z.output<typeof generationBody>;

const toInterval = (value: {
  week_day: number;
  start_time_in_minutes: number;
  end_time_in_minutes: number;
}): Interval => ({
  day: value.week_day,
  start: value.start_time_in_minutes,
  end: value.end_time_in_minutes,
});

function toGenerationRequest(wire: GenerationBody): GenerationRequest {
  return {
    subjects: wire.subjects.map(entry => ({
      id: entry.id,
      credits: entry.credits,
      workload: entry.total_workload,
      mandatory: entry.type === 'MANDATORY',
      allowsConflict: entry.allow_conflict,
      criticality: entry.criticality ?? 0,
      blocks: entry.blocks ?? 0,
    })),
    classes: wire.classes.map(option => ({
      subjectId: option.subject_id,
      intervals: option.schedules.map(toInterval),
    })),
    minSubjects: wire.preferences.min_subject_amount,
    maxSubjects: wire.preferences.max_subject_amount,
    busy: wire.preferences.busy_schedules.map(toInterval),
    priorities: wire.preferences.priority,
    lunch: wire.preferences.lunch_break && {
      start: wire.preferences.lunch_break.start_time_in_minutes,
      end: wire.preferences.lunch_break.end_time_in_minutes,
      minutes: wire.preferences.lunch_break.minimum_minutes,
    },
  };
}

/** `POST /schedules/generate`: o pedido do domínio e o original, para a resposta. */
export const generationSchema = generationBody.transform(wire => ({
  wire,
  request: toGenerationRequest(wire),
}));
