import React from 'react';
import { Text as RNText } from 'react-native';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { FormProvider, useForm, type UseFormReturn } from 'react-hook-form';
import { ThemeProvider } from 'styled-components/native';

import { LIGHT } from '@root/themes';
import StepsProvider from '@hooks/useSteps';
import {
  Button,
  EmptyState,
  ErrorState,
  FilterChip,
  ListRow,
  Notice,
  SegmentedControl,
  SelectField,
  SkeletonList,
  Stepper,
  Tabs,
} from '@components/ui';
import {
  createScheduleDraft,
  type GeneratedSchedule,
  type ScheduleCreationParams,
} from '@root/modules/planning/domain/models';
import type {
  CurriculumSubject,
  SubjectInfo,
} from '@root/modules/academics/domain/models';
import { AppError } from '@root/shared/errors/AppError';

import BusyHoursStep from '../steps/BusyHoursStep';
import PriorityStep from '../steps/PriorityStep';
import SubjectsStep from '../steps/SubjectsStep';
import FetchDataStep from '../steps/FetchDataStep';
import ClassesStep from '../steps/ClassesStep';
import GenerationStep from '../steps/GenerationStep';
import { acronym, classMeetings, scheduleMeetings } from '../format';

jest.mock('react-native-modal', () => 'Modal');
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

/* ------------------------------------------------------------ query mocks */

const mockCurriculum = {
  data: undefined as CurriculumSubject[] | undefined,
  error: null as unknown,
  isLoading: false,
  isPaused: false,
  isFetching: false,
  dataUpdatedAt: 0,
  refetch: jest.fn(),
};
const mockHistory = {
  data: [] as unknown[] | undefined,
  error: null as unknown,
  isLoading: false,
  isSuccess: true,
  isPaused: false,
  isFetching: false,
  dataUpdatedAt: 0,
  refetch: jest.fn(),
};
jest.mock('@root/modules/academics/presentation/queries', () => ({
  useCurriculum: () => mockCurriculum,
  useHistory: () => mockHistory,
}));

const mockPlanning = {
  completed: 0,
  total: 0,
  results: [] as unknown[],
  loading: false,
  retry: jest.fn(),
};
jest.mock('@root/modules/planning/presentation/usePlanningSubjects', () => ({
  usePlanningSubjects: () => mockPlanning,
}));

const mockGeneration = {
  isIdle: true,
  isPending: false,
  isSuccess: false,
  data: undefined as GeneratedSchedule[] | undefined,
  error: null as unknown,
  mutate: jest.fn(),
};
jest.mock('@root/modules/planning/presentation/useGenerateSchedules', () => ({
  useGenerateSchedules: () => mockGeneration,
}));

/* --------------------------------------------------------------- fixtures */

const subject = (
  id: string,
  name: string,
  extra: Partial<CurriculumSubject> = {},
): CurriculumSubject => ({
  id,
  name,
  type: 'MANDATORY',
  period: 6,
  credits: 4,
  workload: 60,
  minimum_credits: null,
  ...extra,
});

const CURRICULUM = [
  subject('IME02-10871', 'Compiladores'),
  subject('IME02-10880', 'Computação Gráfica'),
  subject('IME02-10950', 'Projeto Final I', { minimum_credits: 140 }),
  subject('IME02-11024', 'Aprendizado de Máquina', {
    type: 'RESTRICTED',
    branch: 'A',
    period: null,
  }),
  subject('IME01-00001', 'Cálculo I', { alreadyTaken: true }),
];

const DETAILS: SubjectInfo[] = [
  {
    id: 'IME02-10880',
    name: 'Computação Gráfica',
    classes: [
      {
        classNumber: 1,
        teachers: ['Ana Beatriz Coelho'],
        schedule: [{ Segunda: [['M3', 'M4']] }, { Quarta: [['M3', 'M4']] }],
        vacancies: { uerj: {}, freshman: {} },
      },
      {
        classNumber: 2,
        hasPreference: true,
        teachers: ['Ana Beatriz Coelho', 'Otávio Saldanha'],
        schedule: [{ Terça: [['N1', 'N2']] }],
        vacancies: { uerj: {}, freshman: {} },
      },
    ],
  },
];

const RESULTS: GeneratedSchedule[] = [
  {
    hash: 'g1',
    total_credits: 8,
    total_workload: 120,
    total_week_days: 3,
    total_gaps_in_minutes: 0,
    schedule: [
      {
        id: '1',
        name: 'Computação Gráfica',
        type: 'REGULAR',
        subject_id: 'IME02-10880',
        teachers: ['Ana Beatriz Coelho'],
        vacancies_amount: 10,
        subject: {
          id: 'IME02-10880',
          name: 'Computação Gráfica',
          type: 'MANDATORY',
          credits: 4,
          total_workload: 60,
          prerequisites: [],
          allow_conflict: false,
        },
        schedules: [
          { week_day: 0, start_time_in_minutes: 530, end_time_in_minutes: 630 },
          { week_day: 2, start_time_in_minutes: 530, end_time_in_minutes: 630 },
        ],
      },
      {
        id: '2',
        name: 'Inferência Estatística',
        type: 'REGULAR',
        subject_id: 'IME03-10260',
        teachers: ['Marcos Teles'],
        vacancies_amount: 10,
        subject: {
          id: 'IME03-10260',
          name: 'Inferência Estatística',
          type: 'MANDATORY',
          credits: 4,
          total_workload: 60,
          prerequisites: [],
          allow_conflict: false,
        },
        schedules: [
          { week_day: 5, start_time_in_minutes: 740, end_time_in_minutes: 850 },
        ],
      },
    ],
  },
  {
    hash: 'g2',
    total_credits: 4,
    total_workload: 60,
    total_week_days: 1,
    total_gaps_in_minutes: 0,
    schedule: [],
  },
];

/* ---------------------------------------------------------------- harness */

const steps = { nextStep: jest.fn(), prevStep: jest.fn(), setStep: jest.fn() };
let form: UseFormReturn<ScheduleCreationParams>;
let renderer: ReactTestRenderer;

function Harness({
  step,
  values,
  children,
}: {
  step: number;
  values: Partial<ScheduleCreationParams>;
  children: React.ReactNode;
}) {
  form = useForm<ScheduleCreationParams>({
    mode: 'all',
    defaultValues: { ...createScheduleDraft(), ...values },
  });
  return (
    <ThemeProvider theme={LIGHT}>
      <FormProvider {...form}>
        <StepsProvider values={{ step, ...steps }}>{children}</StepsProvider>
      </FormProvider>
    </ThemeProvider>
  );
}

const render = async (
  node: React.ReactElement,
  step: number,
  values: Partial<ScheduleCreationParams> = {},
) => {
  await act(async () => {
    renderer = create(
      <Harness step={step} values={values}>
        {node}
      </Harness>,
    );
  });
};

afterEach(async () => {
  await act(async () => renderer?.unmount());
});

const texts = () =>
  renderer.root
    .findAllByType(RNText)
    .map(t =>
      React.Children.toArray(t.props.children)
        .filter(c => typeof c === 'string' || typeof c === 'number')
        .join(''),
    )
    .filter(Boolean);
const hasText = (needle: string) => texts().some(t => t.includes(needle));
const button = (label: string) =>
  renderer.root.find(
    n =>
      n.type === Button &&
      (n.props.label === label || n.props.accessibilityLabel === label),
  );
const rows = () => renderer.root.findAllByType(ListRow);
/** Células da tabela de horários (o `memo` esconde o tipo do componente). */
const cells = () => renderer.root.findAll(n => Boolean(n.props.onToggleRow));
/** Linhas de turma (a folha do seletor de docente também tem linhas). */
const classRows = () =>
  rows().filter(r => r.props.accessibilityRole === 'checkbox');
const row = (title: string) => rows().find(r => r.props.title === title)!;
const press = async (fn: () => unknown) => {
  await act(async () => {
    await fn();
  });
};

/* ------------------------------------------------------------------ tests */

describe('format', () => {
  it('builds acronyms keeping numerals', () => {
    expect(acronym('Desenvolvimento para Dispositivos Móveis')).toBe('DDM');
    expect(acronym('Projeto Final II')).toBe('PFII');
  });

  it('summarizes portal and generated meetings', () => {
    expect(
      classMeetings([{ Segunda: [['M3', 'M4']] }, { Quarta: [['M3', 'M4']] }]),
    ).toBe('Seg e Qua · M3–M4');
    expect(scheduleMeetings(RESULTS[0].schedule[0].schedules)).toBe(
      'Seg e Qua · M3–M4 · 8:50–10:30',
    );
  });
});

describe('BusyHoursStep', () => {
  const busy = () => form.getValues('busy_schedules');

  it('shows the week as a grid of 17 times by 6 days, with the stepper on step 2', async () => {
    await render(<BusyHoursStep />, 1);
    expect(cells()).toHaveLength(17 * 6);
    expect(renderer.root.findByType(Stepper).props.current).toBe(2);
    expect(hasText('nenhum tempo')).toBe(true);
  });

  it('toggles one time, the whole row on long press, a shift and clears', async () => {
    await render(<BusyHoursStep />, 1);
    const cell = (day: number, alias: string) =>
      cells().find(
        c => c.props.weekDay === day && c.props.time.periodAlias === alias,
      )!;

    await press(() =>
      cell(1, 'M1').props.onToggle(1, cell(1, 'M1').props.time),
    );
    expect(busy()).toEqual([
      { week_day: 0, start_time_in_minutes: 420, end_time_in_minutes: 470 },
    ]);
    expect(cell(1, 'M1').props.selected).toBe(true);
    expect(hasText('1 tempo')).toBe(true);

    await press(() =>
      cell(2, 'T1').props.onToggleRow(cell(2, 'T1').props.time),
    );
    expect(busy()).toHaveLength(7);

    await press(() => button('Noite ocupada').props.onPress());
    expect(busy()).toHaveLength(7 + 5 * 6);
    expect(button('Noite ocupada').props.accessibilityState.checked).toBe(true);

    await press(() => button('Limpar tudo').props.onPress());
    expect(busy()).toEqual([]);
  });

  it('marks a whole day from its header', async () => {
    await render(<BusyHoursStep />, 1);
    const header = renderer.root.find(
      n =>
        n.props.accessibilityLabel ===
          'Sexta: marcar o dia inteiro como ocupado' && n.props.onPress,
    );
    await press(() => header.props.onPress());
    expect(busy()).toHaveLength(17);
    expect(busy().every(b => b.week_day === 4)).toBe(true);
  });
});

describe('PriorityStep', () => {
  const priority = () => form.getValues('priority');

  it('applies a preset and keeps paired options exclusive', async () => {
    await render(<PriorityStep />, 2);
    expect(hasText('1 ligada')).toBe(true);

    const chip = renderer.root
      .findAllByType(FilterChip)
      .find(c => c.props.label === 'Moro longe')!;
    await press(() => chip.props.onPress());
    expect(priority()).toEqual([
      'MIN_GAPS',
      'LIVES_FAR_AWAY',
      'MIN_DAY_WORKLOAD',
    ]);
    expect(hasText('3 ligadas')).toBe(true);

    await press(() => row('Muita carga horária diária').props.onPress());
    expect(priority()).toContain('MAX_DAY_WORKLOAD');
    expect(priority()).not.toContain('MIN_DAY_WORKLOAD');
    expect(
      row('Muita carga horária diária').props.accessibilityState.checked,
    ).toBe(true);
  });

  it('orders the priorities before advancing', async () => {
    await render(<PriorityStep />, 2, {
      priority: ['MOST_SUBJECTS_POSSIBLE', 'MIN_GAPS'],
    });
    await press(() => button('Próximo').props.onPress());
    expect(priority()).toEqual(['MIN_GAPS', 'MOST_SUBJECTS_POSSIBLE']);
    expect(steps.nextStep).toHaveBeenCalled();
  });
});

describe('SubjectsStep', () => {
  beforeEach(() => {
    Object.assign(mockCurriculum, {
      data: CURRICULUM,
      error: null,
      isLoading: false,
    });
  });

  it('lists subjects not taken yet and enables "Próximo" at the minimum', async () => {
    await render(<SubjectsStep />, 3, { min_subject_amount: 2 });
    expect(rows().map(r => r.props.title)).toEqual([
      'Compiladores',
      'Computação Gráfica',
      'Projeto Final I',
      'Aprendizado de Máquina',
    ]);
    expect(hasText('Escolha 2 ou mais disciplinas')).toBe(true);
    expect(hasText('Trava de 140 créditos')).toBe(true);
    expect(button('Próximo').props.disabled).toBe(true);

    await press(() => row('Compiladores').props.onPress());
    await press(() => row('Projeto Final I').props.onPress());
    expect(form.getValues('selectedSubjects').map(s => s.id)).toEqual([
      'IME02-10871',
      'IME02-10950',
    ]);
    expect(row('Compiladores').props.accessibilityState.checked).toBe(true);
    expect(button('Próximo').props.disabled).toBe(false);

    await press(() => row('Compiladores').props.onPress());
    expect(form.getValues('selectedSubjects')).toHaveLength(1);
  });

  it('filters by type and by name or code', async () => {
    await render(<SubjectsStep />, 3);
    const chip = renderer.root
      .findAllByType(FilterChip)
      .find(c => c.props.label === 'Eletivas Restritas')!;
    await press(() => chip.props.onPress());
    expect(rows().map(r => r.props.title)).toEqual(['Aprendizado de Máquina']);

    const all = renderer.root
      .findAllByType(FilterChip)
      .find(c => c.props.label === 'Todas')!;
    await press(() => all.props.onPress());
    const search = renderer.root.find(
      n => n.props.placeholder === 'Pesquise pelo nome da disciplina',
    );
    await press(() => search.props.onChangeText('10880'));
    expect(rows().map(r => r.props.title)).toEqual(['Computação Gráfica']);

    await press(() => search.props.onChangeText('inexistente'));
    expect(renderer.root.findAllByType(EmptyState)).toHaveLength(1);
  });

  it('shows a skeleton while loading and an error with retry', async () => {
    Object.assign(mockCurriculum, { data: undefined, isLoading: true });
    await render(<SubjectsStep />, 3);
    expect(renderer.root.findAllByType(SkeletonList)).toHaveLength(1);
    expect(button('Anterior').props.disabled).toBe(true);
    await act(async () => renderer.unmount());

    Object.assign(mockCurriculum, {
      data: undefined,
      isLoading: false,
      error: new AppError('NETWORK'),
    });
    await render(<SubjectsStep />, 3);
    const error = renderer.root.findByType(ErrorState);
    error.props.onRetry();
    expect(mockCurriculum.refetch).toHaveBeenCalled();
  });

  it('explains when the portal is blocked and nothing is saved', async () => {
    Object.assign(mockCurriculum, {
      data: undefined,
      isLoading: false,
      error: new AppError('POSSIBLY_BLOCKED'),
    });
    await render(<SubjectsStep />, 3);
    const blocked = renderer.root.findByType(EmptyState);
    expect(blocked.props.icon).toBe('lock');
    expect(blocked.props.tone).toBe('bad');
    blocked.props.action.onPress();
    expect(mockCurriculum.refetch).toHaveBeenCalled();
  });
});

describe('FetchDataStep', () => {
  const selected = [CURRICULUM[1], CURRICULUM[2]];

  it('shows each subject status and moves eligible classes forward', async () => {
    Object.assign(mockPlanning, {
      completed: 2,
      total: 2,
      loading: false,
      results: [
        {
          subject: CURRICULUM[2],
          eligible: false,
          reason: 'Você não possui créditos suficientes.',
        },
        {
          subject: CURRICULUM[1],
          details: DETAILS[0],
          eligible: true,
          reason: null,
        },
      ],
    });
    await render(<FetchDataStep />, 4, { selectedSubjects: selected });
    expect(hasText('Dados carregados com sucesso!')).toBe(true);
    expect(
      hasText('2 de 2 disciplinas processadas · 1 disponível, 1 recusada'),
    ).toBe(true);
    expect(row('Projeto Final I').props.accessibilityLabel).toBe(
      'Projeto Final I, Recusada: você não possui créditos suficientes.',
    );
    expect(row('Computação Gráfica').props.accessibilityLabel).toBe(
      'Computação Gráfica, IME02-10880 · dados carregados',
    );

    await press(() => button('Próximo').props.onPress());
    expect(form.getValues('subjects')).toEqual([DETAILS[0]]);
    expect(form.getValues('selectedClasses')).toHaveLength(2);
    expect(steps.nextStep).toHaveBeenCalled();
  });

  it('offers a retry when a subject failed to load', async () => {
    Object.assign(mockPlanning, {
      completed: 1,
      total: 2,
      loading: false,
      results: [
        { subject: CURRICULUM[1], error: new Error('x'), eligible: false },
      ],
    });
    await render(<FetchDataStep />, 4, { selectedSubjects: selected });
    expect(row('Projeto Final I').props.accessibilityLabel).toBe(
      'Projeto Final I, Aguardando…',
    );
    const notice = renderer.root
      .findAllByType(Notice)
      .find(n => n.props.onRetry === mockPlanning.retry)!;
    expect(notice).toBeTruthy();
    expect(button('Próximo').props.disabled).toBe(true);
  });
});

describe('ClassesStep', () => {
  const classes = () =>
    (DETAILS[0].classes ?? []).map(c => ({
      ...c,
      subject_id: 'IME02-10880',
    }));

  it('lists the classes with teachers and meetings and toggles them', async () => {
    await render(<ClassesStep />, 5, {
      subjects: DETAILS,
      selectedClasses: classes(),
    });
    const first = classRows()[0];
    expect(first.props.subtitle).toBe('Turma 1');
    expect(first.props.meta).toEqual([
      'Ana Beatriz Coelho',
      'Seg e Qua · M3–M4',
    ]);
    expect(hasText('Preferencial')).toBe(true);
    expect(button('Próximo').props.disabled).toBe(false);

    await press(() => classRows()[0].props.onPress());
    await press(() => classRows()[1].props.onPress());
    expect(form.getValues('selectedClasses')).toEqual([]);
    expect(button('Próximo').props.disabled).toBe(true);
  });

  it('filters by teacher', async () => {
    await render(<ClassesStep />, 5, {
      subjects: DETAILS,
      selectedClasses: classes(),
    });
    const select = renderer.root.findByType(SelectField);
    expect(select.props.options.map((o: { label: string }) => o.label)).toEqual(
      ['Todos os Professores', 'Ana Beatriz Coelho', 'Otávio Saldanha'],
    );
    await press(() => select.props.onChange('Otávio Saldanha'));
    expect(classRows().map(r => r.props.subtitle)).toEqual(['Turma 2']);
  });
});

describe('GenerationStep', () => {
  const values = {
    min_subject_amount: 2,
    max_subject_amount: 4,
    priority: ['MIN_GAPS' as const],
  };

  beforeEach(() => {
    Object.assign(mockGeneration, {
      isIdle: true,
      isPending: false,
      isSuccess: false,
      data: undefined,
      error: null,
    });
  });

  it('summarizes the choices and generates from the footer', async () => {
    await render(<GenerationStep />, 6, values);
    expect(hasText('Tudo pronto para gerar sua grade')).toBe(true);
    expect(hasText('2 a 4')).toBe(true);
    await press(() => button('Gerar grades').props.onPress());
    expect(mockGeneration.mutate).toHaveBeenCalled();
  });

  it('shows progress while generating', async () => {
    Object.assign(mockGeneration, { isIdle: false, isPending: true });
    await render(<GenerationStep />, 6, values);
    expect(button('Gerar grades').props.loading).toBe(true);
    expect(hasText('Combinando turmas e horários…')).toBe(true);
    expect(renderer.root.findAllByType(SkeletonList)).toHaveLength(1);
  });

  it('shows the generated schedules with info and the weekly grid', async () => {
    Object.assign(mockGeneration, {
      isIdle: false,
      isSuccess: true,
      data: RESULTS,
    });
    await render(<GenerationStep />, 6, values);
    const picker = renderer.root.findByType(SegmentedControl);
    expect(picker.props.options.map((o: { label: string }) => o.label)).toEqual(
      ['Grade 1', 'Grade 2'],
    );
    expect(hasText('créditos')).toBe(true);
    expect(rows().map(r => r.props.title)).toEqual([
      'Computação Gráfica',
      'Inferência Estatística',
    ]);

    await press(() =>
      renderer.root.findByType(Tabs).props.onChange('SCHEDULE'),
    );
    expect(hasText('CG')).toBe(true);
    expect(hasText('Sáb')).toBe(true);
    const grid = renderer.root.find(n => n.props.accessibilityRole === 'image');
    expect(grid.props.accessibilityLabel).toContain(
      'Computação Gráfica, turma 1: Seg e Qua · M3–M4 · 8:50–10:30',
    );

    await press(() => button('Gerar outra grade').props.onPress());
    expect(steps.setStep).toHaveBeenCalledWith(0);
    expect(form.getValues('min_subject_amount')).toBeNull();
  });

  it('shows the empty and error states', async () => {
    Object.assign(mockGeneration, {
      isIdle: false,
      isSuccess: true,
      data: [],
    });
    await render(<GenerationStep />, 6, values);
    expect(renderer.root.findAllByType(EmptyState)).toHaveLength(1);
    await act(async () => renderer.unmount());

    Object.assign(mockGeneration, {
      isSuccess: false,
      data: undefined,
      error: new AppError('INVALID_INPUT', 'Selecione entre 1 e 30 turmas.'),
    });
    await render(<GenerationStep />, 6, values);
    const error = renderer.root.findByType(ErrorState);
    expect(error.props.message).toBe(
      'Selecione entre 1 e 30 turmas. Toque aqui para tentar novamente.',
    );
    await press(() => error.props.onRetry());
    expect(mockGeneration.mutate).toHaveBeenCalled();
  });
});
