import React from 'react';
import { screen, userEvent, within } from '@testing-library/react-native';
import type { TestInstance } from 'test-renderer';
import { FormProvider, useForm, type UseFormReturn } from 'react-hook-form';

import { renderWithProviders } from '@root/test-utils/render';
import { StepsProvider } from '@hooks/useSteps';
import { OUTLINED_GLYPHS } from '@components/ui';
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

import { BusyHoursStep } from '../steps/BusyHoursStep';
import { PriorityStep } from '../steps/PriorityStep';
import { SubjectsStep } from '../steps/SubjectsStep';
import { FetchDataStep } from '../steps/FetchDataStep';
import { ClassesStep } from '../steps/ClassesStep';
import { GenerationStep } from '../steps/GenerationStep';
import {
  acronym,
  BLOCKED_TEXT,
  classMeetings,
  scheduleMeetings,
} from '../format';

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

function StepForm({
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
    <FormProvider {...form}>
      <StepsProvider values={{ step, ...steps }}>{children}</StepsProvider>
    </FormProvider>
  );
}

const renderStep = (
  node: React.ReactElement,
  step: number,
  values: Partial<ScheduleCreationParams> = {},
) => {
  function Providers({ children }: { children: React.ReactNode }) {
    return (
      <StepForm step={step} values={values}>
        {children}
      </StepForm>
    );
  }
  return renderWithProviders(node, { wrapper: Providers });
};

// Os passos têm muitos toques; com timers falsos o `userEvent` não espera os
// 130 ms reais de cada um.
let user: ReturnType<typeof userEvent.setup>;
beforeEach(() => {
  jest.useFakeTimers();
  user = userEvent.setup();
});
afterEach(() => {
  jest.useRealTimers();
});

const button = (name: string) => screen.getByRole('button', { name });
/** Linhas de seleção (disciplinas e turmas); as opções da folha são `radio`. */
const checkRows = () => screen.getAllByRole('checkbox');
/** Linha de seleção pelo título (o nome acessível começa por ele). */
const checkRow = (title: string) =>
  screen.getByRole('checkbox', { name: new RegExp(`^${title} `) });
/** Confere, na ordem da tela, o texto que identifica cada elemento. */
const expectEachToShow = (elements: TestInstance[], texts: string[]) => {
  expect(elements).toHaveLength(texts.length);
  elements.forEach((element, i) =>
    expect(within(element).getByText(texts[i])).toBeOnTheScreen(),
  );
};
const isChecked = expect.objectContaining({ checked: true });

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
  /** Células da tabela de horários: "Segunda, M1, 7:00 às 7:50". */
  const cells = () =>
    screen.getAllByRole('togglebutton', { name: /, [MTN]\d, .+ às / });
  const cell = (day: string, alias: string) =>
    screen.getByRole('togglebutton', {
      name: new RegExp(`^${day}, ${alias}, `),
    });

  it('shows the week as a grid of 17 times by 6 days, with the stepper on step 2', async () => {
    await renderStep(<BusyHoursStep />, 1);
    expect(cells()).toHaveLength(17 * 6);
    expect(
      screen.getByRole('button', { name: /^Passo 2 de 7: / }),
    ).toBeSelected();
    expect(screen.getByText('Ocupado: nenhum tempo')).toBeOnTheScreen();
  });

  it('toggles one time, the whole row on long press, a shift and clears', async () => {
    await renderStep(<BusyHoursStep />, 1);

    await user.press(cell('Segunda', 'M1'));
    expect(busy()).toEqual([
      { week_day: 0, start_time_in_minutes: 420, end_time_in_minutes: 470 },
    ]);
    expect(cell('Segunda', 'M1')).toHaveProp('accessibilityState', isChecked);
    expect(screen.getByText('Ocupado: 1 tempo')).toBeOnTheScreen();

    await user.longPress(cell('Terça', 'T1'));
    expect(busy()).toHaveLength(7);

    const night = () =>
      screen.getByRole('togglebutton', { name: 'Noite ocupada' });
    await user.press(night());
    expect(busy()).toHaveLength(7 + 5 * 6);
    expect(night()).toHaveProp('accessibilityState', isChecked);

    await user.press(button('Limpar tudo'));
    expect(busy()).toEqual([]);
  });

  it('marks a whole day from its header', async () => {
    await renderStep(<BusyHoursStep />, 1);
    await user.press(button('Sexta: marcar o dia inteiro como ocupado'));
    expect(busy()).toHaveLength(17);
    expect(busy().every(b => b.week_day === 4)).toBe(true);
  });
});

describe('PriorityStep', () => {
  const priority = () => form.getValues('priority');

  it('applies a preset and keeps paired options exclusive', async () => {
    await renderStep(<PriorityStep />, 2);
    expect(screen.getByText('1 ligada')).toBeOnTheScreen();

    await user.press(screen.getByRole('togglebutton', { name: 'Moro longe' }));
    expect(priority()).toEqual([
      'MIN_GAPS',
      'LIVES_FAR_AWAY',
      'MIN_DAY_WORKLOAD',
    ]);
    expect(screen.getByText('3 ligadas')).toBeOnTheScreen();

    const heavyDay = () =>
      screen.getByRole('switch', { name: 'Muita carga horária diária' });
    await user.press(heavyDay());
    expect(priority()).toContain('MAX_DAY_WORKLOAD');
    expect(priority()).not.toContain('MIN_DAY_WORKLOAD');
    expect(heavyDay()).toBeChecked();
  });

  it('orders the priorities before advancing', async () => {
    await renderStep(<PriorityStep />, 2, {
      priority: ['MOST_SUBJECTS_POSSIBLE', 'MIN_GAPS'],
    });
    await user.press(button('Próximo'));
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
    await renderStep(<SubjectsStep />, 3, { min_subject_amount: 2 });
    expectEachToShow(checkRows(), [
      'Compiladores',
      'Computação Gráfica',
      'Projeto Final I',
      'Aprendizado de Máquina',
    ]);
    expect(
      screen.getByRole('header', { name: 'Escolha 2 ou mais disciplinas' }),
    ).toBeOnTheScreen();
    expect(screen.getByText('Trava de 140 créditos')).toBeOnTheScreen();
    expect(button('Próximo')).toBeDisabled();

    await user.press(checkRow('Compiladores'));
    await user.press(checkRow('Projeto Final I'));
    expect(form.getValues('selectedSubjects').map(s => s.id)).toEqual([
      'IME02-10871',
      'IME02-10950',
    ]);
    expect(checkRow('Compiladores')).toBeChecked();
    expect(button('Próximo')).toBeEnabled();

    await user.press(checkRow('Compiladores'));
    expect(form.getValues('selectedSubjects')).toHaveLength(1);
  });

  it('filters by type and by name or code', async () => {
    await renderStep(<SubjectsStep />, 3);
    await user.press(
      screen.getByRole('togglebutton', { name: 'Eletivas Restritas' }),
    );
    expectEachToShow(checkRows(), ['Aprendizado de Máquina']);

    await user.press(screen.getByRole('togglebutton', { name: 'Todas' }));
    const search = screen.getByLabelText('Pesquisar disciplina');
    await user.type(search, '10880');
    expectEachToShow(checkRows(), ['Computação Gráfica']);

    await user.clear(search);
    await user.type(search, 'inexistente');
    expect(
      screen.getByText(
        'Parece que não há disciplinas a cursar nessa categoria.',
      ),
    ).toBeOnTheScreen();
  });

  it('shows a skeleton while loading and an error with retry', async () => {
    Object.assign(mockCurriculum, { data: undefined, isLoading: true });
    await renderStep(<SubjectsStep />, 3);
    expect(screen.getByLabelText('Carregando disciplinas…')).toBeBusy();
    expect(button('Anterior')).toBeDisabled();
    await screen.unmount();

    Object.assign(mockCurriculum, {
      data: undefined,
      isLoading: false,
      error: new AppError('NETWORK'),
    });
    await renderStep(<SubjectsStep />, 3);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Ops, ocorreu um erro ao buscar as disciplinas. Toque aqui para tentar novamente.',
    );
    await user.press(button('Tentar novamente'));
    expect(mockCurriculum.refetch).toHaveBeenCalled();
  });

  it('explains when the portal is blocked and nothing is saved', async () => {
    Object.assign(mockCurriculum, {
      data: undefined,
      isLoading: false,
      error: new AppError('POSSIBLY_BLOCKED'),
    });
    await renderStep(<SubjectsStep />, 3);
    // o tom crítico anuncia a mensagem como alerta
    expect(screen.getByRole('alert')).toHaveTextContent(BLOCKED_TEXT);
    // o cadeado é decorativo (fora da acessibilidade): confere o glifo desenhado
    expect(
      screen.container.queryAll(node => node.props.d === OUTLINED_GLYPHS.lock),
    ).toHaveLength(1);
    await user.press(button('Tentar novamente'));
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
    await renderStep(<FetchDataStep />, 4, { selectedSubjects: selected });
    expect(
      screen.getByRole('header', { name: 'Dados carregados com sucesso!' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(
        '2 de 2 disciplinas processadas · 1 disponível, 1 recusada',
      ),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText(
        'Projeto Final I, Recusada: você não possui créditos suficientes.',
      ),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText(
        'Computação Gráfica, IME02-10880 · dados carregados',
      ),
    ).toBeOnTheScreen();

    await user.press(button('Próximo'));
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
    await renderStep(<FetchDataStep />, 4, { selectedSubjects: selected });
    expect(
      screen.getByLabelText('Projeto Final I, Aguardando…'),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('alert', {
        name: 'Não foi possível carregar algumas disciplinas.',
      }),
    ).toBeOnTheScreen();
    await user.press(button('Tentar novamente'));
    expect(mockPlanning.retry).toHaveBeenCalled();
    expect(button('Próximo')).toBeDisabled();
  });
});

describe('ClassesStep', () => {
  const classes = () =>
    (DETAILS[0].classes ?? []).map(c => ({
      ...c,
      subject_id: 'IME02-10880',
    }));

  it('lists the classes with teachers and meetings and toggles them', async () => {
    await renderStep(<ClassesStep />, 5, {
      subjects: DETAILS,
      selectedClasses: classes(),
    });
    const first = within(checkRows()[0]);
    expect(first.getByText('IME02-10880 · Turma 1')).toBeOnTheScreen();
    expect(first.getByText('Ana Beatriz Coelho')).toBeOnTheScreen();
    expect(first.getByText('Seg e Qua · M3–M4')).toBeOnTheScreen();
    expect(screen.getByText('Preferencial')).toBeOnTheScreen();
    expect(button('Próximo')).toBeEnabled();

    await user.press(checkRows()[0]);
    await user.press(checkRows()[1]);
    expect(form.getValues('selectedClasses')).toEqual([]);
    expect(button('Próximo')).toBeDisabled();
  });

  it('filters by teacher', async () => {
    await renderStep(<ClassesStep />, 5, {
      subjects: DETAILS,
      selectedClasses: classes(),
    });
    await user.press(button('Docente: Todos os Professores. Trocar'));
    const options = within(screen.getByLabelText('Docente')).getAllByRole(
      'radio',
    );
    expectEachToShow(options, [
      'Todos os Professores',
      'Ana Beatriz Coelho',
      'Otávio Saldanha',
    ]);
    await user.press(options[2]);
    expectEachToShow(checkRows(), ['IME02-10880 · Turma 2']);
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
    await renderStep(<GenerationStep />, 6, values);
    expect(
      screen.getByRole('header', { name: 'Tudo pronto para gerar sua grade' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Disciplinas por período: 2 a 4'),
    ).toBeOnTheScreen();
    await user.press(button('Gerar grades'));
    expect(mockGeneration.mutate).toHaveBeenCalled();
  });

  it('shows progress while generating', async () => {
    Object.assign(mockGeneration, { isIdle: false, isPending: true });
    await renderStep(<GenerationStep />, 6, values);
    // carregando, "Gerar grades" troca o rótulo por "Gerando…"
    expect(button('Gerando…')).toBeBusy();
    expect(
      screen.getByRole('progressbar', {
        name: 'Combinando turmas e horários…',
      }),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Gerando grades…')).toBeBusy();
  });

  it('shows the generated schedules with info and the weekly grid', async () => {
    Object.assign(mockGeneration, {
      isIdle: false,
      isSuccess: true,
      data: RESULTS,
    });
    await renderStep(<GenerationStep />, 6, values);
    expectEachToShow(
      within(screen.getByLabelText('Grades geradas')).getAllByRole('tab'),
      ['Grade 1', 'Grade 2'],
    );
    expect(
      screen.getByLabelText('2 disciplinas, 8 créditos, 120 horas'),
    ).toBeOnTheScreen();
    // aba "Informações": uma linha por disciplina, em ordem alfabética
    const titles = within(
      screen.getByLabelText('Disciplinas da grade'),
    ).getAllByText(/^(Computação Gráfica|Inferência Estatística)$/);
    expect(titles).toHaveLength(2);
    expect(titles[0]).toHaveTextContent('Computação Gráfica');
    expect(titles[1]).toHaveTextContent('Inferência Estatística');

    await user.press(screen.getByRole('tab', { name: 'Horários' }));
    // os dois encontros na grade e a legenda
    expect(screen.getAllByText('CG')).toHaveLength(3);
    expect(screen.getByText('Sáb')).toBeOnTheScreen();
    expect(screen.getByRole('image')).toHaveAccessibleName(
      /Computação Gráfica, turma 1: Seg e Qua · M3–M4 · 8:50–10:30/,
    );

    await user.press(button('Gerar outra grade'));
    expect(steps.setStep).toHaveBeenCalledWith(0);
    expect(form.getValues('min_subject_amount')).toBeNull();
  });

  it('shows the empty and error states', async () => {
    Object.assign(mockGeneration, {
      isIdle: false,
      isSuccess: true,
      data: [],
    });
    await renderStep(<GenerationStep />, 6, values);
    expect(
      screen.getByText(
        'Não foi possível gerar nenhuma grade com os dados informados, clique aqui para gerar outra grade',
      ),
    ).toBeOnTheScreen();
    await screen.unmount();

    Object.assign(mockGeneration, {
      isSuccess: false,
      data: undefined,
      error: new AppError('INVALID_INPUT', 'Selecione entre 1 e 30 turmas.'),
    });
    await renderStep(<GenerationStep />, 6, values);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Selecione entre 1 e 30 turmas. Toque aqui para tentar novamente.',
    );
    await user.press(button('Tentar novamente'));
    expect(mockGeneration.mutate).toHaveBeenCalled();
  });
});
