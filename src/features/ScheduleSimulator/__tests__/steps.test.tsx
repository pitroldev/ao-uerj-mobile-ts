import React from 'react';
import {
  screen,
  userEvent,
  waitFor,
  within,
} from '@testing-library/react-native';
import { FormProvider, useForm, type UseFormReturn } from 'react-hook-form';

import { renderWithProviders } from '@root/test-utils/render';
import { StepsProvider } from '@hooks/useSteps';
import {
  assembleGeneration,
  type SubjectAvailability,
} from '@root/modules/planning/domain/availability';
import {
  GOALS,
  createGeneratorDraft,
  type GeneratedClassWithSubject,
  type GeneratedSchedule,
  type GeneratorDraft,
  type Schedule,
  type ScheduleCreationParams,
} from '@root/modules/planning/domain/models';
import {
  SubjectShortfall,
  TooManyClasses,
} from '@root/modules/planning/domain/rules';
import type {
  CurriculumSubject,
  SubjectClassesSchedule,
  SubjectInfo,
  UniversalSubject,
} from '@root/modules/academics/domain/models';
import { AppError } from '@root/shared/errors/AppError';

import { SubjectsStep } from '../steps/SubjectsStep';
import { RoutineStep } from '../steps/RoutineStep';
import { ResultsStep } from '../steps/ResultsStep';
import { GeneratorRunRecorder } from '../GeneratorRunRecorder';
import {
  acronym,
  classMeetings,
  classShifts,
  scheduleMeetings,
} from '../format';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

/* ------------------------------------------------------------ query mocks */

const query = <T,>(data: T | undefined) => ({
  data,
  error: null as unknown,
  isLoading: false,
  isSuccess: true,
  isPaused: false,
  isFetching: false,
  dataUpdatedAt: 0,
  refetch: jest.fn(),
});
const mockCurriculum = query<CurriculumSubject[]>(undefined);
const mockHistory = query<unknown[]>([]);
const mockUniversal = query<UniversalSubject[]>(undefined);
const mockUniversalEnabled = jest.fn();
jest.mock('@root/modules/academics/presentation/queries', () => ({
  useCurriculum: () => mockCurriculum,
  useHistory: () => mockHistory,
  useUniversalSubjects: (enabled: boolean) => {
    mockUniversalEnabled(enabled);
    return enabled ? mockUniversal : { ...mockUniversal, data: undefined };
  },
}));

const mockCatalog = {
  availability: new Map<string, SubjectAvailability>(),
  loading: 0,
  failed: 0,
  retry: jest.fn(),
  history: mockHistory,
  curriculum: mockCurriculum,
};
jest.mock('@root/modules/planning/presentation/usePlanningCatalog', () => ({
  usePlanningCatalog: () => mockCatalog,
}));

const mockGeneration = {
  isPending: false,
  isSuccess: false,
  data: undefined as GeneratedSchedule[] | undefined,
  error: null as unknown,
  variables: undefined as ScheduleCreationParams | undefined,
  mutate: jest.fn(),
};
jest.mock('@root/modules/planning/presentation/useGenerateSchedules', () => ({
  useGenerateSchedules: () => mockGeneration,
}));

const mockNote = jest.fn();
const mockStart = jest.fn();
jest.mock('@root/modules/planning/presentation/useGeneratorRun', () => ({
  useGeneratorRunNote: () => mockNote,
  useGeneratorRunStart: () => mockStart,
}));

const mockShare = jest.fn(async (_uri: string, _caption?: string) => {});
jest.mock('@root/modules/academics/presentation/useScheduleSharing', () => ({
  useScheduleSharing: () => ({
    share: mockShare,
    exporting: false,
    SvgRenderer: () => null,
  }),
}));
jest.mock('@root/modules/delivery/presentation/DeliveryProvider', () => ({
  useCanInvite: () => true,
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
  subjectOfPeriod: true,
  ...extra,
});

const COMPILERS = subject('IME02-10871', 'Compiladores');
const GRAPHICS = subject('IME02-10880', 'Computação Gráfica');
const FINAL = subject('IME02-10950', 'Projeto Final I', {
  minimum_credits: 140,
});
const LEARNING = subject('IME02-11024', 'Aprendizado de Máquina', {
  type: 'RESTRICTED',
  branch: 'A',
  period: null,
});
const NOT_OFFERED = subject('IME02-11111', 'Tópicos Especiais', {
  subjectOfPeriod: false,
});
const CURRICULUM = [
  NOT_OFFERED,
  COMPILERS,
  GRAPHICS,
  FINAL,
  LEARNING,
  subject('IME01-00001', 'Cálculo I', { alreadyTaken: true }),
];

const UNIVERSALS: UniversalSubject[] = [
  {
    id: 'ILE01-10301',
    name: 'Cinema Brasileiro',
    type: 'UNIVERSAL',
    credits: 4,
    workload: 60,
    subjectOfPeriod: true,
  },
  {
    id: 'IFCH03-03283',
    name: 'Filosofia da Religião I',
    type: 'UNIVERSAL',
    credits: 4,
    workload: 60,
    subjectOfPeriod: true,
  },
  // já está no currículo do aluno: fica só na lista do curso
  {
    id: 'IME02-10880',
    name: 'Computação Gráfica',
    type: 'UNIVERSAL',
    credits: 4,
    workload: 60,
    subjectOfPeriod: true,
  },
];

const vacancies = { uerj: {}, freshman: {} };
const turma = (
  classNumber: number,
  schedule: SubjectClassesSchedule['schedule'],
  extra: Partial<SubjectClassesSchedule> = {},
): SubjectClassesSchedule => ({
  classNumber,
  schedule,
  vacancies,
  teachers: [],
  ...extra,
});
const info = (
  from: CurriculumSubject,
  classes: SubjectClassesSchedule[],
): SubjectInfo => ({ id: from.id, name: from.name, classes });

/** Compiladores: seg e qua M3–M4. Gráfica: turma 1 de manhã, turma 2 à noite. */
const COMPILERS_INFO = info(COMPILERS, [
  turma(1, [{ Segunda: [['M3', 'M4']] }, { Quarta: [['M3', 'M4']] }], {
    teachers: ['Marcos Teles'],
  }),
]);
const GRAPHICS_INFO = info(GRAPHICS, [
  turma(1, [{ Segunda: [['M3', 'M4']] }, { Sexta: [['M3', 'M4']] }], {
    teachers: ['Ana Beatriz Coelho'],
  }),
  turma(2, [{ Terça: [['N1', 'N2']] }], {
    hasPreference: true,
    teachers: ['Otávio Saldanha'],
  }),
]);

const ready = (details: SubjectInfo): SubjectAvailability => ({
  status: 'ready',
  details,
});
const BOTH = () =>
  new Map<string, SubjectAvailability>([
    [COMPILERS.id, ready(COMPILERS_INFO)],
    [GRAPHICS.id, ready(GRAPHICS_INFO)],
  ]);

const at = (week_day: number, start: number, end: number): Schedule => ({
  week_day,
  start_time_in_minutes: start,
  end_time_in_minutes: end,
});
const placed = (
  from: CurriculumSubject,
  id: string,
  schedules: Schedule[],
): GeneratedClassWithSubject => ({
  id,
  name: from.name,
  type: 'REGULAR',
  subject_id: from.id,
  teachers: [],
  vacancies_amount: 10,
  schedules,
  subject: {
    id: from.id,
    name: from.name,
    type: 'MANDATORY',
    credits: 4,
    total_workload: 60,
    prerequisites: [],
    allow_conflict: false,
  },
});
const generated = (
  hash: string,
  schedule: GeneratedClassWithSubject[],
): GeneratedSchedule => ({
  hash,
  total_credits: schedule.length * 4,
  total_workload: schedule.length * 60,
  total_week_days: 3,
  total_gaps_in_minutes: 0,
  schedule,
});
const COMPILERS_CLASS = placed(COMPILERS, '1', [
  at(0, 530, 630),
  at(2, 530, 630),
]);
const GRAPHICS_NIGHT = placed(GRAPHICS, '2', [at(1, 1080, 1180)]);

/* ---------------------------------------------------------------- harness */

const steps = { nextStep: jest.fn(), prevStep: jest.fn(), setStep: jest.fn() };
let form: UseFormReturn<GeneratorDraft>;

function StepForm({
  step,
  values,
  children,
}: {
  step: number;
  values: Partial<GeneratorDraft>;
  children: React.ReactNode;
}) {
  form = useForm<GeneratorDraft>({
    mode: 'all',
    defaultValues: { ...createGeneratorDraft(), ...values },
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
  values: Partial<GeneratorDraft> = {},
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

/** O pedido que o passo das grades monta com estas escolhas. */
const requestFor = (values: Partial<GeneratorDraft>) =>
  assembleGeneration({
    draft: { ...createGeneratorDraft(), ...values },
    availability: mockCatalog.availability,
    history: [],
    curriculum: CURRICULUM,
  });

// Os passos têm muitos toques; com timers falsos o `userEvent` não espera os
// 130 ms reais de cada um.
let user: ReturnType<typeof userEvent.setup>;
beforeEach(() => {
  jest.useFakeTimers();
  user = userEvent.setup();
  Object.assign(mockHistory, { data: [], error: null });
  Object.assign(mockCurriculum, {
    data: CURRICULUM,
    error: null,
    isLoading: false,
  });
  Object.assign(mockUniversal, {
    data: UNIVERSALS,
    error: null,
    isLoading: false,
  });
  Object.assign(mockCatalog, {
    availability: new Map(),
    loading: 0,
    failed: 0,
  });
  Object.assign(mockGeneration, {
    isPending: false,
    isSuccess: false,
    data: undefined,
    error: null,
    variables: undefined,
  });
});
afterEach(() => {
  jest.useRealTimers();
});

const button = (name: string | RegExp) => screen.getByRole('button', { name });
const checkRows = () => screen.getAllByRole('checkbox');
/** Linha de seleção pelo título (o nome acessível começa por ele). */
const checkRow = (title: string) =>
  screen.getByRole('checkbox', { name: new RegExp(`^${title},`) });
const isChecked = expect.objectContaining({ checked: true });
const chosen = () => form.getValues('selectedSubjects').map(item => item.id);

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
    expect(scheduleMeetings(COMPILERS_CLASS.schedules)).toBe(
      'Seg e Qua · M3–M4 · 8:50–10:30',
    );
  });

  it('tells the shifts of a subject by the first meeting of each class', () => {
    expect(classShifts(GRAPHICS_INFO.classes ?? [])).toEqual([
      'morning',
      'night',
    ]);
    // a turma da noite com um tempo no sábado de manhã é da noite
    expect(
      classShifts([
        turma(1, [{ Sábado: [['M2']] }, { Terça: [['N1', 'N2']] }]),
      ]),
    ).toEqual(['night']);
  });
});

describe('SubjectsStep', () => {
  it('lists what is left to take, the ones without classes last and locked', async () => {
    await renderStep(<SubjectsStep />, 0);
    expect(
      screen.getByRole('button', { name: /^Passo 1 de 3: / }),
    ).toBeSelected();
    const rows = checkRows();
    expect(rows).toHaveLength(5);
    expect(within(rows[0]).getByText('Compiladores')).toBeOnTheScreen();
    expect(within(rows[4]).getByText('Tópicos Especiais')).toBeOnTheScreen();
    expect(
      within(rows[4]).getByText('Sem turma neste período'),
    ).toBeOnTheScreen();
    expect(rows[4]).toBeDisabled();
    expect(screen.getByText('Trava de 140 créditos')).toBeOnTheScreen();
    // sem nada escolhido, não há o que seguir
    expect(screen.getByText('Nenhuma disciplina escolhida')).toBeOnTheScreen();
    expect(button('Próximo')).toBeDisabled();
  });

  it('marks subjects, counts them in the footer and moves on', async () => {
    await renderStep(<SubjectsStep />, 0);
    await user.press(checkRow('Compiladores'));
    await user.press(checkRow('Computação Gráfica'));
    expect(chosen()).toEqual([COMPILERS.id, GRAPHICS.id]);
    expect(
      button('2 escolhidas · 8 créditos. Ver as disciplinas escolhidas'),
    ).toBeOnTheScreen();

    await user.press(checkRow('Compiladores'));
    expect(chosen()).toEqual([GRAPHICS.id]);

    await user.press(button('Próximo'));
    expect(steps.nextStep).toHaveBeenCalled();
  });

  it('says what the portal answered for each chosen subject', async () => {
    mockCatalog.availability = new Map<string, SubjectAvailability>([
      [COMPILERS.id, { status: 'loading' }],
      [GRAPHICS.id, ready(GRAPHICS_INFO)],
      [
        FINAL.id,
        {
          status: 'refused',
          reason: 'Exige 140 créditos cursados',
          details: info(FINAL, []),
        },
      ],
      [LEARNING.id, ready(info(LEARNING, []))],
    ]);
    await renderStep(<SubjectsStep />, 0, {
      selectedSubjects: [COMPILERS, GRAPHICS, FINAL, LEARNING],
    });
    expect(
      within(checkRow('Compiladores')).getByText('Buscando turmas…'),
    ).toBeOnTheScreen();
    const graphics = within(checkRow('Computação Gráfica'));
    expect(graphics.getByText('2 turmas')).toBeOnTheScreen();
    expect(graphics.getByText('Manhã')).toBeOnTheScreen();
    expect(graphics.getByText('Noite')).toBeOnTheScreen();
    expect(
      within(checkRow('Projeto Final I')).getByText(
        'Exige 140 créditos cursados',
      ),
    ).toBeOnTheScreen();
    expect(
      within(checkRow('Aprendizado de Máquina')).getByText(
        'Sem turmas neste período',
      ),
    ).toBeOnTheScreen();
    // a recusada e a sem turmas não entram em grade nenhuma
    expect(
      button(
        '4 escolhidas · 16 créditos · 2 não podem entrar. Ver as disciplinas escolhidas',
      ),
    ).toBeOnTheScreen();
  });

  it('filters by type and by name or code', async () => {
    await renderStep(<SubjectsStep />, 0);
    await user.press(
      screen.getByRole('togglebutton', { name: 'Eletivas restritas' }),
    );
    expect(checkRows()).toHaveLength(1);
    expect(checkRow('Aprendizado de Máquina')).toBeOnTheScreen();

    await user.press(
      screen.getByRole('togglebutton', { name: 'Do meu curso' }),
    );
    await user.type(screen.getByLabelText('Pesquisar disciplina'), '10880');
    expect(checkRows()).toHaveLength(1);
    expect(checkRow('Computação Gráfica')).toBeOnTheScreen();

    await user.clear(screen.getByLabelText('Pesquisar disciplina'));
    await user.type(screen.getByLabelText('Pesquisar disciplina'), 'xyz');
    expect(screen.getByText('Nada com essa busca.')).toBeOnTheScreen();
    await user.press(button('Limpar filtros'));
    expect(checkRows()).toHaveLength(5);
  });

  it('hides the type chips when the curriculum has a single type', async () => {
    mockCurriculum.data = [COMPILERS, GRAPHICS];
    await renderStep(<SubjectsStep />, 0);
    expect(
      screen
        .getAllByRole('togglebutton')
        .map(chip => chip.props.accessibilityLabel),
    ).toEqual(['Do meu curso', 'Universais']);
  });

  it('reads the universal electives only when asked, and picks one from them', async () => {
    await renderStep(<SubjectsStep />, 0);
    expect(mockUniversalEnabled).not.toHaveBeenCalledWith(true);

    await user.press(screen.getByRole('togglebutton', { name: 'Universais' }));
    expect(mockUniversalEnabled).toHaveBeenLastCalledWith(true);
    // a que já é do currículo do aluno não se repete aqui
    expect(checkRows()).toHaveLength(2);
    expect(
      within(checkRow('Cinema Brasileiro')).getByText(
        'Instituto de Letras · 4 créditos',
      ),
    ).toBeOnTheScreen();

    await user.type(screen.getByLabelText('Pesquisar disciplina'), 'filo');
    expect(checkRows()).toHaveLength(1);
    await user.press(checkRow('Filosofia da Religião I'));
    expect(form.getValues('selectedSubjects')).toEqual([
      expect.objectContaining({
        id: 'IFCH03-03283',
        type: 'UNIVERSAL',
        credits: 4,
        minimum_credits: null,
      }),
    ]);

    // voltar para o curso começa sem a busca das universais
    await user.press(
      screen.getByRole('togglebutton', { name: 'Do meu curso' }),
    );
    expect(checkRows()).toHaveLength(5);
  });

  it('filters the universal electives by department', async () => {
    await renderStep(<SubjectsStep />, 0);
    await user.press(screen.getByRole('togglebutton', { name: 'Universais' }));
    await user.press(button('Departamento: Todos os departamentos. Trocar'));
    await user.press(
      within(screen.getByLabelText('Departamento')).getByRole('radio', {
        name: /^ILE/,
      }),
    );
    expect(checkRows()).toHaveLength(1);
    expect(checkRow('Cinema Brasileiro')).toBeOnTheScreen();
  });

  it('gathers the chosen ones in a sheet, where each can be taken out', async () => {
    mockCatalog.availability = BOTH();
    mockCatalog.failed = 1;
    await renderStep(<SubjectsStep />, 0, {
      selectedSubjects: [COMPILERS, GRAPHICS],
    });
    await user.press(
      button('2 escolhidas · 8 créditos. Ver as disciplinas escolhidas'),
    );
    const sheet = within(screen.getByLabelText('Disciplinas escolhidas'));
    expect(sheet.getByText('Compiladores')).toBeOnTheScreen();
    expect(sheet.getByText('2 turmas')).toBeOnTheScreen();

    await user.press(button('Tentar novamente'));
    expect(mockCatalog.retry).toHaveBeenCalled();

    await user.press(button('Tirar Compiladores'));
    expect(chosen()).toEqual([GRAPHICS.id]);
  });

  it('shows a skeleton while loading and an error with retry', async () => {
    Object.assign(mockCurriculum, { data: undefined, isLoading: true });
    await renderStep(<SubjectsStep />, 0);
    expect(screen.getByLabelText('Carregando disciplinas…')).toBeBusy();
    await screen.unmount();

    Object.assign(mockCurriculum, {
      isLoading: false,
      error: new Error('x'),
    });
    await renderStep(<SubjectsStep />, 0);
    await user.press(button('Tentar novamente'));
    expect(mockCurriculum.refetch).toHaveBeenCalled();
  });
});

describe('RoutineStep', () => {
  const busy = () => form.getValues('busy_schedules');
  /** Células da tabela de horários: "Segunda, M1, 7:00 às 7:50". */
  const cells = () =>
    screen.getAllByRole('togglebutton', { name: /, [MTN]\d, .+ às / });
  const cell = (day: string, alias: string) =>
    screen.getByRole('togglebutton', {
      name: new RegExp(`^${day}, ${alias}, `),
    });
  const shortcut = (name: string) => screen.getByRole('togglebutton', { name });

  it('shows the week as a grid of 17 times by 6 days, on step 2', async () => {
    await renderStep(<RoutineStep />, 1);
    expect(cells()).toHaveLength(17 * 6);
    expect(
      screen.getByRole('button', { name: /^Passo 2 de 3: / }),
    ).toBeSelected();
    expect(screen.getByText('toque para marcar')).toBeOnTheScreen();
  });

  it('toggles one time, the row from Monday to Friday on long press, a shift and clears', async () => {
    await renderStep(<RoutineStep />, 1);

    await user.press(cell('Segunda', 'M1'));
    expect(busy()).toEqual([at(0, 420, 470)]);
    expect(cell('Segunda', 'M1')).toHaveProp('accessibilityState', isChecked);
    expect(screen.getByText('1 tempo')).toBeOnTheScreen();

    await user.longPress(cell('Terça', 'T1'));
    expect(busy()).toHaveLength(6);
    expect(cell('Sábado', 'T1')).not.toHaveProp(
      'accessibilityState',
      isChecked,
    );

    const night = () => shortcut('Noite ocupada, de segunda a sexta');
    await user.press(night());
    expect(busy()).toHaveLength(6 + 5 * 5);
    expect(night()).toHaveProp('accessibilityState', isChecked);

    await user.press(button('Limpar tudo'));
    expect(busy()).toEqual([]);
  });

  it('keeps Saturday out of the shift shortcuts and gives it its own', async () => {
    await renderStep(<RoutineStep />, 1);
    const afternoon = () => shortcut('Tarde ocupada, de segunda a sexta');
    const saturday = () => shortcut('Sábado inteiro ocupado');
    const onSaturday = () => busy().filter(item => item.week_day === 5);

    await user.press(cell('Sábado', 'T1'));
    await user.press(shortcut('Manhã ocupada, de segunda a sexta'));
    await user.press(afternoon());
    // manhã (6 tempos) e tarde (6) de segunda a sexta, mais o tempo do sábado
    expect(busy()).toHaveLength(12 * 5 + 1);
    expect(onSaturday()).toHaveLength(1);

    // desmarcar o turno não apaga o que foi marcado no sábado
    await user.press(afternoon());
    expect(onSaturday()).toHaveLength(1);

    await user.press(saturday());
    expect(onSaturday()).toHaveLength(17);
    expect(saturday()).toHaveProp('accessibilityState', isChecked);
    await user.press(saturday());
    expect(onSaturday()).toEqual([]);
  });

  it('marks a whole day from its header', async () => {
    await renderStep(<RoutineStep />, 1);
    await user.press(button('Sexta: marcar o dia inteiro como ocupado'));
    expect(busy()).toHaveLength(17);
    expect(busy().every(item => item.week_day === 4)).toBe(true);
  });

  it('keeps a lunch break, of one slot or of two in a row', async () => {
    await renderStep(<RoutineStep />, 1);
    const lunch = () =>
      screen.getByRole('switch', { name: /^Horário de almoço/ });
    expect(lunch()).not.toBeChecked();
    expect(screen.queryByLabelText('Tamanho do almoço')).toBeNull();

    await user.press(lunch());
    expect(form.getValues('lunchMinutes')).toBe(50);
    expect(lunch()).toBeChecked();
    // a janela aparece na tabela: M6, T1 e T2, com o garfo na legenda
    expect(screen.getByText('Almoço')).toBeOnTheScreen();
    expect(cell('Quinta', 'T1')).toHaveAccessibleName(
      'Quinta, T1, 12:20 às 13:20, na janela do almoço',
    );
    expect(cell('Quinta', 'M5')).toHaveAccessibleName(
      'Quinta, M5, 10:40 às 11:30',
    );

    await user.press(
      within(screen.getByLabelText('Tamanho do almoço')).getByText('2 tempos'),
    );
    expect(form.getValues('lunchMinutes')).toBe(100);

    await user.press(lunch());
    expect(form.getValues('lunchMinutes')).toBeNull();
    expect(screen.queryByText('Almoço')).toBeNull();
  });

  it('shows where the chosen subjects have classes and what the routine leaves out', async () => {
    mockCatalog.availability = BOTH();
    await renderStep(<RoutineStep />, 1, {
      selectedSubjects: [COMPILERS, GRAPHICS],
    });
    // segunda M3: as duas têm turma; terça N1: só a Gráfica
    expect(cell('Segunda', 'M3')).toHaveAccessibleName(
      /com turma de 2 disciplinas escolhidas$/,
    );
    expect(cell('Terça', 'N1')).toHaveAccessibleName(
      /com turma de 1 disciplina escolhida$/,
    );
    expect(cell('Quinta', 'T1')).toHaveAccessibleName(
      'Quinta, T1, 12:20 às 13:20',
    );
    expect(screen.getByText('Tem turma')).toBeOnTheScreen();
    expect(screen.getByText('Todas com turma livre')).toBeOnTheScreen();

    // ocupar a segunda de manhã tira Compiladores e a turma 1 da Gráfica
    await user.press(cell('Segunda', 'M3'));
    expect(screen.getByText('Sem turma livre: Compiladores')).toBeOnTheScreen();
    expect(button('Ver grades')).toBeEnabled();

    await user.press(cell('Terça', 'N1'));
    expect(
      screen.getByText('Sem turma livre: Compiladores e Computação Gráfica'),
    ).toBeOnTheScreen();
    expect(button('Ver grades')).toBeDisabled();
  });

  it('counts the classes left out when every subject still has one', async () => {
    mockCatalog.availability = BOTH();
    await renderStep(<RoutineStep />, 1, {
      selectedSubjects: [COMPILERS, GRAPHICS],
      busy_schedules: [at(1, 1080, 1130)],
    });
    expect(
      screen.getByText('Todas com turma livre · 1 turma de fora'),
    ).toBeOnTheScreen();
    await user.press(button('Ver grades'));
    expect(steps.nextStep).toHaveBeenCalled();
  });

  it('waits for the classes still being read', async () => {
    mockCatalog.availability = new Map([[COMPILERS.id, { status: 'loading' }]]);
    mockCatalog.loading = 1;
    await renderStep(<RoutineStep />, 1, { selectedSubjects: [COMPILERS] });
    expect(screen.getByText('Buscando turmas…')).toBeOnTheScreen();
    expect(button('Ver grades')).toBeEnabled();
  });
});

describe('ResultsStep', () => {
  const values = { selectedSubjects: [COMPILERS, GRAPHICS] };
  const adjust = (name: RegExp) => screen.getByRole('button', { name });

  /** O gerador já respondeu a este pedido. */
  const answered = (
    data: GeneratedSchedule[],
    draft: Partial<GeneratorDraft> = values,
  ) =>
    Object.assign(mockGeneration, {
      isSuccess: true,
      data,
      variables: requestFor(draft),
    });

  beforeEach(() => {
    mockCatalog.availability = BOTH();
  });

  it('generates on arrival, with every subject that can enter', async () => {
    await renderStep(<ResultsStep />, 2, { ...values, lunchMinutes: 50 });
    expect(mockGeneration.mutate).toHaveBeenCalledTimes(1);
    expect(mockGeneration.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        min_subject_amount: 1,
        max_subject_amount: 2,
        lunch: { start: 690, end: 850, minutes: 50 },
        priority: [...GOALS.COMPACT],
        subjects: [COMPILERS_INFO, GRAPHICS_INFO],
      }),
    );
    expect(
      screen.getByRole('header', { name: 'Montando suas grades…' }),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Gerando grades…')).toBeBusy();
  });

  it('waits for the classes before generating', async () => {
    mockCatalog.loading = 1;
    await renderStep(<ResultsStep />, 2, values);
    expect(mockGeneration.mutate).not.toHaveBeenCalled();
    expect(
      screen.getByRole('header', { name: 'Buscando as turmas…' }),
    ).toBeOnTheScreen();
  });

  it('shows only the schedules with the most subjects, the grid first', async () => {
    answered([
      generated('g1', [COMPILERS_CLASS, GRAPHICS_NIGHT]),
      generated('g2', [COMPILERS_CLASS]),
    ]);
    await renderStep(<ResultsStep />, 2, values);
    expect(mockGeneration.mutate).not.toHaveBeenCalled();
    expect(screen.getByRole('header', { name: 'Sua grade' })).toBeOnTheScreen();
    expect(screen.queryByLabelText('Grades geradas')).toBeNull();
    expect(
      screen.getByLabelText(
        '2 disciplinas, 8 créditos, 120 horas, 3 dias com aula',
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/de fora/)).toBeNull();
    // a grade da semana vem primeiro; a lista fica na outra aba
    expect(screen.getByRole('image')).toHaveAccessibleName(
      /Compiladores, turma 1: Seg e Qua · M3–M4 · 8:50–10:30/,
    );
    await user.press(screen.getByRole('tab', { name: 'Disciplinas' }));
    expect(
      within(screen.getByLabelText('Disciplinas da grade')).getAllByText(
        /^(Compiladores|Computação Gráfica)$/,
      ),
    ).toHaveLength(2);
    expect(mockNote).toHaveBeenCalledWith({
      outcome: 'SCHEDULES',
      schedules: 2,
      largestSchedule: 2,
    });
  });

  it('lets the student compare the schedules that tie', async () => {
    answered([
      generated('g1', [COMPILERS_CLASS, GRAPHICS_NIGHT]),
      generated('g2', [
        COMPILERS_CLASS,
        placed(GRAPHICS, '1', [at(4, 530, 630)]),
      ]),
    ]);
    await renderStep(<ResultsStep />, 2, values);
    expect(
      screen.getByRole('header', { name: 'Suas grades' }),
    ).toBeOnTheScreen();
    const picker = within(screen.getByLabelText('Grades geradas'));
    await user.press(picker.getByText('Grade 2'));
    expect(screen.getByRole('image')).toHaveAccessibleName(
      /Computação Gráfica, turma 1: Sex · M3–M4/,
    );
  });

  it('says which chosen subjects are left out of the schedule, and why', async () => {
    const draft = {
      selectedSubjects: [COMPILERS, GRAPHICS, FINAL],
      // a turma 2 da Gráfica cai num horário ocupado: sobra a que bate
      busy_schedules: [at(1, 1080, 1130)],
    };
    mockCatalog.availability = new Map<string, SubjectAvailability>([
      ...BOTH(),
      [
        FINAL.id,
        {
          status: 'refused',
          reason: 'Exige 140 créditos cursados',
          details: info(FINAL, []),
        },
      ],
    ]);
    answered([generated('g1', [COMPILERS_CLASS])], draft);
    await renderStep(<ResultsStep />, 2, draft);
    expect(screen.getByText('Ficaram de fora')).toBeOnTheScreen();
    expect(
      screen.getByText('Computação Gráfica: bate com Compiladores'),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('Projeto Final I: exige 140 créditos cursados'),
    ).toBeOnTheScreen();
  });

  it('explains when no subject fits the routine and leads back to it', async () => {
    Object.assign(mockGeneration, {
      error: new SubjectShortfall('ROUTINE', 0, 2, 1),
      variables: requestFor(values),
    });
    await renderStep(<ResultsStep />, 2, values);
    expect(
      screen.getByRole('header', { name: 'Não deu para montar a grade' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Nenhuma das 2 disciplinas tem turma fora dos horários que você marcou como ocupados. Libere algum horário.',
      ),
    ).toBeOnTheScreen();
    expect(mockNote).toHaveBeenCalledWith({ outcome: 'SHORTFALL_ROUTINE' });
    await user.press(button('Rever horários'));
    expect(steps.setStep).toHaveBeenCalledWith(1);
    expect(mockGeneration.mutate).not.toHaveBeenCalled();
  });

  it('opens the classes when there are too many of them', async () => {
    Object.assign(mockGeneration, {
      error: new TooManyClasses(34),
      variables: requestFor(values),
    });
    await renderStep(<ResultsStep />, 2, values);
    await user.press(button('Escolher turmas'));
    // a folha das turmas: uma de Compiladores e duas da Gráfica
    expect(checkRows()).toHaveLength(3);
    expect(screen.queryByText(/turmas por vez/)).toBeNull();
    expect(mockNote).toHaveBeenCalledWith({ outcome: 'TOO_MANY_CLASSES' });
  });

  it('offers a retry on other errors and says when nothing was found', async () => {
    Object.assign(mockGeneration, {
      error: new AppError('NETWORK'),
      variables: requestFor(values),
    });
    await renderStep(<ResultsStep />, 2, values);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Verifique sua conexão e tente novamente. Toque aqui para tentar novamente.',
    );
    await user.press(button('Tentar novamente'));
    expect(mockGeneration.mutate).toHaveBeenCalledTimes(1);
    await screen.unmount();

    Object.assign(mockGeneration, { error: null });
    answered([]);
    await renderStep(<ResultsStep />, 2, values);
    expect(
      screen.getByRole('header', { name: 'Nenhuma grade com essas escolhas' }),
    ).toBeOnTheScreen();
    expect(mockNote).toHaveBeenCalledWith({
      outcome: 'EMPTY',
      schedules: 0,
      largestSchedule: 0,
    });
  });

  it('caps the number of subjects and generates again when the sheet closes', async () => {
    answered([generated('g1', [COMPILERS_CLASS, GRAPHICS_NIGHT])]);
    await renderStep(<ResultsStep />, 2, values);
    await user.press(adjust(/^Limite: até 2 disciplinas/));
    await user.press(button('Diminuir máximo de disciplinas na grade'));
    await user.press(button('Aplicar'));
    expect(form.getValues('maxSubjects')).toBe(1);
    expect(mockGeneration.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ max_subject_amount: 1 }),
    );
    expect(adjust(/^Limite: até 1 disciplina\./)).toBeOnTheScreen();
  });

  it('changes what matters most in the order of the schedules', async () => {
    answered([generated('g1', [COMPILERS_CLASS, GRAPHICS_NIGHT])]);
    await renderStep(<ResultsStep />, 2, values);
    await user.press(adjust(/^O que mais importa: Menos intervalos/));
    await user.press(
      screen.getByRole('radio', { name: /^Menos dias na UERJ/ }),
    );
    expect(form.getValues('priority')).toEqual([...GOALS.FEW_DAYS]);
    // só gera de novo com a folha fechada
    expect(mockGeneration.mutate).not.toHaveBeenCalled();
    await user.press(button('Pronto'));
    expect(mockGeneration.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ priority: [...GOALS.FEW_DAYS] }),
    );
  });

  it('takes classes out, and locks the ones that do not fit the routine', async () => {
    const draft = { ...values, busy_schedules: [at(1, 1080, 1130)] };
    answered([generated('g1', [COMPILERS_CLASS])], draft);
    await renderStep(<ResultsStep />, 2, draft);
    await user.press(adjust(/^2 turmas de 2\. Escolher turmas/));
    const rows = checkRows();
    expect(rows).toHaveLength(3);
    // a turma 2 da Gráfica bate com o horário ocupado
    expect(rows[2]).toBeDisabled();
    expect(
      within(rows[2]).getByText('Horário ocupado: Ter · N1 · 18:00–18:50'),
    ).toBeOnTheScreen();
    expect(within(rows[1]).getByText('Ana Beatriz Coelho')).toBeOnTheScreen();

    await user.press(rows[1]);
    expect(form.getValues('removedClasses')).toEqual(['IME02-10880#1']);
    await user.press(rows[1]);
    expect(form.getValues('removedClasses')).toEqual([]);
  });

  it('starts over from the first step', async () => {
    answered([generated('g1', [COMPILERS_CLASS, GRAPHICS_NIGHT])]);
    await renderStep(<ResultsStep />, 2, { ...values, lunchMinutes: 50 });
    await user.press(button('Começar de novo'));
    expect(mockStart).toHaveBeenCalled();
    expect(steps.setStep).toHaveBeenCalledWith(0);
    expect(form.getValues()).toEqual(createGeneratorDraft());
  });

  it('shares the schedule shown as an image, with the link to the app', async () => {
    answered([generated('g1', [COMPILERS_CLASS, GRAPHICS_NIGHT])]);
    await renderStep(<ResultsStep />, 2, values);
    await user.press(button('Compartilhar'));
    await waitFor(() => expect(mockShare).toHaveBeenCalledTimes(1));
    const [uri, caption] = mockShare.mock.calls[0];
    expect(uri).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(caption).toMatch(
      /^Minha grade planejada no gerador do app AO UERJ: https:\/\/play\.google\.com\/\S+utm_source%3Dgerador$/,
    );
  });

  it('has nothing to share while the schedules are being made', async () => {
    await renderStep(<ResultsStep />, 2, values);
    expect(button('Compartilhar')).toBeDisabled();
  });

  it('warns when the classes of a subject could not be read', async () => {
    mockCatalog.failed = 1;
    answered([generated('g1', [COMPILERS_CLASS, GRAPHICS_NIGHT])]);
    await renderStep(<ResultsStep />, 2, values);
    expect(
      screen.getByText(
        'Não deu para buscar as turmas de 1 disciplina. As grades saem sem ela.',
      ),
    ).toBeOnTheScreen();
    await user.press(button('Tentar novamente'));
    expect(mockCatalog.retry).toHaveBeenCalled();
  });
});

describe('GeneratorRunRecorder', () => {
  it('starts an attempt and notes the step and the choices, only as counts', async () => {
    mockCatalog.availability = BOTH();
    await renderStep(<GeneratorRunRecorder step={1} />, 1, {
      selectedSubjects: [
        COMPILERS,
        GRAPHICS,
        { ...LEARNING, type: 'UNIVERSAL' },
      ],
      busy_schedules: [at(0, 420, 470), at(5, 740, 800), at(1, 1080, 1130)],
      lunchMinutes: 50,
      maxSubjects: 2,
      removedClasses: ['IME02-10880#1'],
    });
    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(mockNote).toHaveBeenCalledWith({ step: 1, outcome: 'NOT_RUN' });
    expect(mockNote).toHaveBeenCalledWith({
      maximumSubjects: 2,
      busySlots: 3,
      saturdayBusySlots: 1,
      lunchMinutes: 50,
      goal: 'COMPACT',
      chosenSubjects: 3,
      universalSubjects: 1,
      removedClasses: 1,
    });
    expect(mockNote).toHaveBeenCalledWith({
      eligibleSubjects: 2,
      refusedSubjects: 0,
      failedSubjects: 0,
      classes: 3,
      freeClasses: 2,
      subjectsWithFreeClass: 2,
    });
  });
});
