import type {
  Gate,
  NoticeKind,
  NoticeStatus,
  Place,
} from '../../../../../modules/campus-now/domain.ts';
import type {
  CallKind,
  CallReport,
  DestinationId,
  SpotId,
} from '../../../../../modules/companion/domain.ts';
import type { GeneratorRun } from '../../../../../modules/reports/domain.ts';
import type { ReportGroup } from '../../../../../modules/reports/ports.ts';
import { capitalize, excerpt, hour } from './format.ts';
import type { IconName } from './icons.ts';

/* As palavras do app para o que a administração mostra. */

/* --------------------------------------------------------- Companhia agora */

export const REASON_LABEL: Record<CallReport['reason'], string> = {
  harassment: 'Assédio ou ofensa',
  strange: 'Comportamento estranho',
  spam: 'Spam ou propaganda',
  other: 'Outro motivo',
};

export const SOURCE_LABEL: Record<NonNullable<CallReport['source']>, string> = {
  member: 'De quem foi junto',
  host: 'De quem abriu',
  outsider: 'De fora',
};

/** O ponto de encontro com a preposição ("no RU", "na Concha Acústica"). */
const SPOT_LABEL: Record<SpotId, string> = {
  ru: 'no RU',
  lago: 'no Lago dos Peixinhos',
  concha: 'na Concha Acústica',
  'portao-1': 'no Portão 1',
  'portao-5': 'no Portão 5',
};
const DESTINATION_LABEL: Record<DestinationId, string> = {
  metro: 'metrô',
  trem: 'trem',
  onibus: 'ponto de ônibus',
};

type CallLike = {
  kind: CallKind;
  at: Date;
  spot: SpotId;
  destination: DestinationId | null;
};

/** "Mesa no RU, 12:15" ou "Grupo para o metrô, 22:15" (as palavras do app). */
export function callTitle(call: CallLike) {
  const time = hour(call.at);
  return call.kind === 'home' && call.destination
    ? `Grupo para o ${DESTINATION_LABEL[call.destination]}, ${time}`
    : `Mesa ${SPOT_LABEL[call.spot]}, ${time}`;
}

/** Mesa (feminino) ou grupo (masculino), para as frases. */
export const callWord = (call: Pick<CallLike, 'kind'>) =>
  call.kind === 'home'
    ? { noun: 'grupo', the: 'o', a: 'um', open: 'aberto' }
    : { noun: 'mesa', the: 'a', a: 'uma', open: 'aberta' };

export const CALL_ICON = (call: CallLike): IconName =>
  call.kind === 'lunch'
    ? 'restaurant'
    : call.destination === 'metro'
      ? 'subway'
      : call.destination === 'trem'
        ? 'train'
        : 'directions_bus';

/* --------------------------------------------------------- Agora no campus */

/** O aviso nas palavras do app ("Fila grande no bandejão"). */
const NOTICE_TITLE: Record<
  NoticeKind,
  Partial<Record<NoticeStatus, string>>
> = {
  elevators: {
    short_queue: 'Elevadores: fila pequena',
    long_queue: 'Elevadores: fila de 10 min ou mais',
    stopped: 'Elevadores: todos parados',
  },
  ru: {
    short_queue: 'Fila pequena no bandejão',
    long_queue: 'Fila grande no bandejão',
    closed: 'Bandejão fechado',
  },
  power: {
    no_power: 'Sem luz',
    no_ac: 'Sem ar-condicionado',
    no_outlets: 'Tomadas sem energia',
  },
  internet: { wifi_down: 'Wi-Fi fora', wifi_slow: 'Wi-Fi lento' },
  restroom: {
    no_water: 'Banheiro sem água',
    closed: 'Banheiro interditado',
    no_paper: 'Banheiro sem papel',
  },
  access: {
    gate_closed: 'Portão fechado',
    ramp_closed: 'Rampa interditada',
    room_locked: 'Sala trancada',
  },
};

export const noticeTitle = (notice: {
  kind: NoticeKind;
  status: NoticeStatus;
}) => NOTICE_TITLE[notice.kind][notice.status] ?? notice.status;

export const NOTICE_ICON: Record<NoticeKind, IconName> = {
  elevators: 'elevator',
  ru: 'restaurant',
  power: 'bolt',
  internet: 'wifi_off',
  restroom: 'water_drop',
  access: 'door_front',
};

/** Os portões como o Mapa do app os chama. */
const GATE_LABEL: Record<Gate, string> = {
  'portao-metro': 'Portão 1',
  'portao-leste': 'Portão 3',
  'portao-sudeste': 'Portão 4',
  'portao-sfx': 'Portão 5',
  'portao-oeste': 'Portão 6',
  'portao-radial': 'Portão 7',
};

const floorText = (floor: string) =>
  floor === 'T' ? 'térreo' : floor === 'SE' ? 'subsolo' : `${floor}º andar`;

export function placeText(place: Place) {
  switch (place.type) {
    case 'elevators':
      return 'Hall dos elevadores, bloco C';
    case 'ru':
      return 'Bandejão (Restaurante Universitário)';
    case 'gate':
      return GATE_LABEL[place.gate];
    case 'floor':
      return `Bloco ${place.block}, ${floorText(place.floor)}`;
    case 'room':
      return `Sala ${place.room}, bloco ${place.block}`;
  }
}

/* ---------------------------------------------------------------- relatos */

const GENERATOR_OUTCOMES: Record<string, string> = {
  NOT_RUN: 'não chegou a gerar',
  SCHEDULES: 'gerou grades',
  EMPTY: 'nenhuma grade',
  SHORTFALL_ROUTINE: 'nenhuma disciplina cabe na rotina (ocupados e almoço)',
  SHORTFALL_SUBJECTS: 'nenhuma disciplina escolhida pode entrar',
  SHORTFALL_SELECTION: 'o aluno tirou todas as turmas',
  TOO_MANY_CLASSES: 'turmas demais para combinar',
};

const GENERATOR_GOALS: Record<string, string> = {
  COMPACT: 'menos intervalos',
  FEW_DAYS: 'menos dias na UERJ',
  LIGHT_DAYS: 'dias mais leves',
  ADVANCE: 'adiantar o curso',
};

/** Os passos do gerador do app (2.17 em diante). */
export const GENERATOR_STEPS = ['Disciplinas', 'Horários', 'Grades'];

export const generatorOutcome = (outcome: string) =>
  GENERATOR_OUTCOMES[outcome] ?? outcome;

const amount = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

/**
 * "Passo 3 de 3 (Grades) · 7 escolhidas, 7 podem entrar, 1 com turma livre ·
 * 77 tempos ocupados (17 no sábado) · almoço de 50 min · menos intervalos ·
 * nenhuma disciplina cabe na rotina (ocupados e almoço)"
 */
export function generatorSummary(run: GeneratorRun): string {
  const stepName = GENERATOR_STEPS[run.step];
  const step = stepName
    ? `Passo ${run.step + 1} de ${GENERATOR_STEPS.length} (${stepName})`
    : `Passo ${run.step + 1}`;
  const subjects = [
    run.chosenSubjects === undefined
      ? null
      : `${amount(run.chosenSubjects, 'escolhida', 'escolhidas')}${run.universalSubjects ? ` (${amount(run.universalSubjects, 'universal', 'universais')})` : ''}`,
    run.eligibleSubjects === undefined
      ? null
      : amount(run.eligibleSubjects, 'pode entrar', 'podem entrar'),
    run.subjectsWithFreeClass === undefined
      ? null
      : `${run.subjectsWithFreeClass} com turma livre`,
    run.maximumSubjects === undefined ? null : `até ${run.maximumSubjects}`,
  ]
    .filter(Boolean)
    .join(', ');
  const classes =
    run.classes === undefined
      ? null
      : `${run.freeClasses ?? '?'} de ${amount(run.classes, 'turma livre', 'turmas livres')}${run.removedClasses ? `, ${amount(run.removedClasses, 'tirada', 'tiradas')}` : ''}`;
  const busy =
    run.busySlots === undefined
      ? null
      : `${amount(run.busySlots, 'tempo ocupado', 'tempos ocupados')}${run.saturdayBusySlots ? ` (${run.saturdayBusySlots} no sábado)` : ''}`;
  const lunch = run.lunchMinutes ? `almoço de ${run.lunchMinutes} min` : null;
  const goal = run.goal ? (GENERATOR_GOALS[run.goal] ?? run.goal) : null;
  const outcome =
    run.outcome === 'SCHEDULES' && run.schedules !== undefined
      ? `gerou ${amount(run.schedules, 'grade', 'grades')} (a maior com ${run.largestSchedule ?? '?'})`
      : generatorOutcome(run.outcome);
  return [step, subjects || null, classes, busy, lunch, goal, outcome]
    .filter(Boolean)
    .join(' · ');
}

/** O começo do id da OTA ("0195f2a1…"), que já a distingue das outras. */
export const shortId = (id: string) =>
  id.length > 12 ? `${id.slice(0, 8)}…` : id;

/** As leituras do portal com erro, com o código ("schedule: PORTAL_LAYOUT_CHANGED"). */
export const portalErrorsSummary = (errors: Record<string, string>) =>
  Object.entries(errors)
    .map(([resource, code]) => `${resource}: ${code}`)
    .join(' · ');

export const kib = (bytes: number) =>
  `${Math.max(1, Math.round(bytes / 1024)).toLocaleString('pt-BR')} KB`;

/** As leituras do portal que o app faz, como o aluno as conhece. */
const READ_LABEL: Record<string, string> = {
  schedule: 'a grade',
  grades: 'as notas',
  'partial-rid': 'o RID',
  history: 'o histórico',
  'complementary-activities': 'as atividades complementares',
  curriculum: 'o currículo',
  'universal-subjects': 'as universais',
  synthesis: 'a síntese da formação',
  'subject-details': 'a disciplina',
};

/** Os códigos de erro do app, numa frase curta. */
const CODE_LABEL: Record<string, string> = {
  PORTAL_LAYOUT_CHANGED: 'o portal mudou a página',
  PORTAL_UNSTABLE: 'o portal está instável',
  SESSION_EXPIRED: 'a sessão expira',
  SESSION_CHANGED: 'a sessão troca sozinha',
  LOGIN_FAILED: 'o login falha',
  ACCOUNT_UNAVAILABLE: 'a conta não abre',
  NOT_LOGGED_IN: 'pede o login de novo',
  POSSIBLY_BLOCKED: 'o portal pode estar bloqueado',
  NETWORK: 'sem rede',
  CAPTIVE_PORTAL: 'a rede pede login',
  SERVICE_UNAVAILABLE: 'o portal está fora do ar',
  RATE_LIMITED: 'pedidos demais ao portal',
  STORAGE_FAILED: 'o celular não guardou',
  DOCUMENT_UNAVAILABLE: 'o documento não vem',
  DOCUMENT_CHANGED: 'o documento mudou',
  PAGE_UNAVAILABLE: 'a página não vem',
  INVALID_INPUT: 'dado inválido',
  STUDENT_PROOF_UNAVAILABLE: 'a identificação não sai',
  STUDENT_BANNED: 'o aluno está banido',
};

const codeLabel = (code: string) => CODE_LABEL[code] ?? code;

/**
 * O título de um grupo de relatos: o que o diagnóstico diz ("A grade: o
 * portal mudou a página") ou, num relato do aluno, o começo do mais novo.
 */
export function groupTitle(group: ReportGroup): string {
  const diagnostic = group.diagnostic;
  if (diagnostic?.generator)
    return `Gerador: ${generatorOutcome(diagnostic.generator.outcome)}`;
  const errors = Object.entries(diagnostic?.portalErrors ?? {});
  if (errors.length === 1) {
    const [read, code] = errors[0];
    return capitalize(`${READ_LABEL[read] ?? read}: ${codeLabel(code)}`);
  }
  if (errors.length > 1)
    return `Leituras com erro: ${errors.map(([read]) => READ_LABEL[read] ?? read).join(', ')}`;
  if (diagnostic && diagnostic.category !== 'USER_REPORT')
    return capitalize(codeLabel(diagnostic.category));
  const described = group.reports.find(report => report.description?.trim());
  return described?.description
    ? excerpt(described.description, 80)
    : `Relato sem descrição (${group.page})`;
}

/** A assinatura técnica, em código ("schedule · PORTAL_LAYOUT_CHANGED"). */
export function groupCode(group: ReportGroup): string {
  const diagnostic = group.diagnostic;
  if (!diagnostic) return 'sem diagnóstico (app 1.x)';
  if (diagnostic.generator) return `gerador · ${diagnostic.generator.outcome}`;
  const errors = Object.entries(diagnostic.portalErrors ?? {});
  if (errors.length)
    return errors.map(([read, code]) => `${read} · ${code}`).join(', ');
  return diagnostic.category === 'USER_REPORT'
    ? 'relato do aluno, sem erro de leitura'
    : diagnostic.category;
}
