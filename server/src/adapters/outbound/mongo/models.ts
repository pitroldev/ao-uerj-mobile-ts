import mongoose, { type Connection } from 'mongoose';

import { COMPANION_LIMITS } from '../../../modules/companion/domain.ts';
import { MESSAGE_LIMITS } from '../../../modules/mural/domain.ts';
import { REPORT_LIMITS } from '../../../modules/reports/domain.ts';
import { STUDENT_LIMITS } from '../../../modules/students/domain.ts';
import { SUGGESTION_LIMITS } from '../../../modules/suggestions/domain.ts';

/*
 * Os esquemas do banco. Os nomes dos modelos ('Docentes', 'ErrorReport',
 * 'MuralMessages', 'Suggestions') e dos campos (em português) são os do
 * servidor antigo: decidem as coleções que já têm os dados de produção.
 */

const OPTIONS = {
  timestamps: true,
  versionKey: false,
  bufferCommands: false,
} as const;

const text = (maxlength: number, required = true) => ({
  maxlength,
  required,
  trim: true,
  type: String,
});

const email = { lowercase: true, maxlength: 254, trim: true, type: String };

const teacherSchema = new mongoose.Schema(
  {
    docente: { required: true, trim: true, type: String },
    disciplinas: { type: mongoose.Schema.Types.Mixed },
  },
  OPTIONS,
);
teacherSchema.index({ docente: 1 });

const errorReportSchema = new mongoose.Schema(
  {
    page: text(REPORT_LIMITS.page),
    description: text(REPORT_LIMITS.description, false),
    /** Os anexos gravados em arquivo (`<página>-<id>.html`). */
    filesID: { default: [], type: [String] },
    email,
    /** Resolvido na triagem (`/aouerj/admin`); os antigos não têm o campo. */
    resolvedAt: { default: null, type: Date },
    /** O aluno que relatou (v2); os da rota antiga ficam sem. */
    studentId: { default: null, type: String },
  },
  OPTIONS,
);
errorReportSchema.index({ createdAt: -1 });

const muralMessageSchema = new mongoose.Schema(
  {
    fullName: text(MESSAGE_LIMITS.authorName),
    disciplina: text(MESSAGE_LIMITS.subjectId),
    periodo: text(MESSAGE_LIMITS.period),
    turma: text(MESSAGE_LIMITS.classNumber),
    message: text(MESSAGE_LIMITS.text),
    /** O aluno que escreveu (v2); as da rota antiga ficam sem. */
    studentId: { default: null, type: String },
  },
  OPTIONS,
);
muralMessageSchema.index({
  disciplina: 1,
  periodo: 1,
  turma: 1,
  createdAt: -1,
});

const suggestionSchema = new mongoose.Schema(
  {
    name: text(SUGGESTION_LIMITS.name),
    content: text(SUGGESTION_LIMITS.content),
    email,
  },
  OPTIONS,
);
suggestionSchema.index({ createdAt: -1 });

/**
 * O que só vale uma vez (API v2): o hash e até quando guardar, nada mais.
 * Sem `timestamps`: a hora do uso ajudaria a ligá-lo à emissão. O índice TTL
 * apaga cada um quando o prazo passa.
 */
function singleUseSchema() {
  const schema = new mongoose.Schema(
    {
      _id: { required: true, type: String },
      expiresAt: { required: true, type: Date },
    },
    { versionKey: false, bufferCommands: false },
  );
  schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  return schema;
}

/**
 * Os lotes de tokens que cada instalação recebeu no dia (API v2): o HMAC da
 * instalação com o dia, a contagem e até quando guardar. Sem a hora.
 */
const issuanceCounterSchema = new mongoose.Schema(
  {
    _id: { required: true, type: String },
    count: { required: true, type: Number },
    expiresAt: { required: true, type: Date },
  },
  { versionKey: false, bufferCommands: false },
);
issuanceCounterSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/**
 * As chamadas da Companhia agora. Ficam só até `expiresAt` (o índice TTL
 * apaga; as consultas também filtram, porque o MongoDB passa a cada minuto).
 * Dos membros, só o hash da chave e o primeiro nome. Sem `timestamps`.
 */
const companionMemberSchema = new mongoose.Schema(
  {
    key: { required: true, type: String },
    // o apelido que os membros veem (as chamadas de antes ficam sem)
    ref: { default: '', type: String },
    name: text(COMPANION_LIMITS.name),
    host: { default: false, type: Boolean },
    joinedAt: { required: true, type: Date },
    /** O aluno (v2, com a sessão); quem entrou com token fica sem. */
    student: { default: null, type: String },
  },
  { _id: false },
);
const companionFeedSchema = new mongoose.Schema(
  {
    key: { required: true, type: String },
    name: text(COMPANION_LIMITS.name),
    phrase: { required: true, type: String },
    at: { required: true, type: Date },
  },
  { _id: false },
);
const companionCallSchema = new mongoose.Schema(
  {
    _id: { required: true, type: String },
    kind: { required: true, type: String },
    at: { required: true, type: Date },
    spot: { required: true, type: String },
    destination: { default: null, type: String },
    note: { default: '', maxlength: COMPANION_LIMITS.note, type: String },
    capacity: { required: true, type: Number },
    members: { default: [], type: [companionMemberSchema] },
    feed: { default: [], type: [companionFeedSchema] },
    reporters: { default: [], type: [String] },
    removed: { default: [], type: [String] },
    endedAt: { default: null, type: Date },
    hiddenAt: { default: null, type: Date },
    filledAt: { default: null, type: Date },
    arrivedAt: { default: null, type: Date },
    visibleFrom: { required: true, type: Date },
    listedUntil: { required: true, type: Date },
    expiresAt: { required: true, type: Date },
  },
  { versionKey: false, bufferCommands: false },
);
companionCallSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
companionCallSchema.index({ listedUntil: 1 });
companionCallSchema.index({ 'members.student': 1 });

/** As denúncias da Companhia agora, para a moderação, por 30 dias. */
const companionReportSchema = new mongoose.Schema(
  {
    callId: { required: true, type: String },
    kind: { required: true, type: String },
    at: { required: true, type: Date },
    spot: { required: true, type: String },
    destination: { default: null, type: String },
    note: { default: '', type: String },
    names: { default: [], type: [String] },
    /** Quem estava na chamada e, com a sessão, o aluno de cada um. */
    people: {
      default: [],
      type: [
        new mongoose.Schema(
          {
            name: { required: true, type: String },
            host: { default: false, type: Boolean },
            student: { default: null, type: String },
          },
          { _id: false },
        ),
      ],
    },
    /** O aluno que denunciou (com a sessão). */
    reporterStudent: { default: null, type: String },
    reason: { required: true, type: String },
    source: { default: null, type: String },
    count: { required: true, type: Number },
    hidden: { default: false, type: Boolean },
    callExpiresAt: { default: null, type: Date },
    createdAt: { required: true, type: Date },
    expiresAt: { required: true, type: Date },
  },
  { versionKey: false, bufferCommands: false },
);
companionReportSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
companionReportSchema.index({ createdAt: -1 });
companionReportSchema.index({ callId: 1 });

/**
 * Os números do dia da Companhia agora: o dia de São Paulo e as contagens,
 * nada mais. Ficam meio ano (o índice TTL apaga).
 */
const companionStatsSchema = new mongoose.Schema(
  {
    _id: { required: true, type: String },
    counts: { default: {}, type: mongoose.Schema.Types.Mixed },
    expiresAt: { required: true, type: Date },
  },
  { versionKey: false, bufferCommands: false, minimize: false },
);
companionStatsSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/**
 * Quem olhou a lista nos últimos 15 minutos: o hash do passe (que vale uma
 * hora e não se liga a ninguém) e até quando conta. O índice TTL apaga.
 */
const companionWatcherSchema = new mongoose.Schema(
  {
    _id: { required: true, type: String },
    expiresAt: { required: true, type: Date },
  },
  { versionKey: false, bufferCommands: false },
);
companionWatcherSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/**
 * Os alunos identificados (v2): matrícula e nome cifrados (AES-GCM), o HMAC
 * da matrícula para achar, os aparelhos (HMAC da instalação) e o banimento.
 */
const studentDeviceSchema = new mongoose.Schema(
  {
    id: { required: true, type: String },
    firstSeenAt: { required: true, type: Date },
    lastSeenAt: { required: true, type: Date },
  },
  { _id: false },
);
const studentSchema = new mongoose.Schema(
  {
    _id: { required: true, type: String },
    lookup: { required: true, type: String },
    matricula: { required: true, type: String },
    name: { required: true, type: String },
    createdAt: { required: true, type: Date },
    lastSeenAt: { required: true, type: Date },
    devices: { default: [], type: [studentDeviceSchema] },
    ban: {
      default: null,
      type: new mongoose.Schema(
        {
          until: { default: null, type: Date },
          reason: {
            required: true,
            maxlength: STUDENT_LIMITS.banReason,
            type: String,
          },
          at: { required: true, type: Date },
        },
        { _id: false },
      ),
    },
  },
  { versionKey: false, bufferCommands: false },
);
studentSchema.index({ lookup: 1 }, { unique: true });
studentSchema.index({ lastSeenAt: -1 });
studentSchema.index({ 'ban.at': -1 });

/** As sessões dos alunos: o hash do token; o índice TTL apaga as vencidas. */
const studentSessionSchema = new mongoose.Schema(
  {
    _id: { required: true, type: String },
    student: { required: true, type: String },
    device: { required: true, type: String },
    createdAt: { required: true, type: Date },
    lastUsedAt: { required: true, type: Date },
    expiresAt: { required: true, type: Date },
  },
  { versionKey: false, bufferCommands: false },
);
studentSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
studentSessionSchema.index({ student: 1 });

/**
 * Os avisos de Agora no campus. O lugar fica achatado (`placeType`, bloco,
 * andar, sala, portão). Ficam 70 dias, para o resumo do mês anterior (o
 * índice TTL apaga em `purgeAt`); as consultas de "agora" filtram por
 * `expiresAt`.
 */
const campusNoticeSchema = new mongoose.Schema(
  {
    _id: { required: true, type: String },
    kind: { required: true, type: String },
    status: { required: true, type: String },
    placeType: { required: true, type: String },
    block: { default: null, type: String },
    floor: { default: null, type: String },
    room: { default: null, type: String },
    gate: { default: null, type: String },
    placeKey: { required: true, type: String },
    reporter: { required: true, type: String },
    level: { default: 1, type: Number },
    trusted: { default: false, type: Boolean },
    confirmations: { default: 0, type: Number },
    ends: { default: 0, type: Number },
    flags: { default: 0, type: Number },
    views: { default: 0, type: Number },
    thanks: { default: 0, type: Number },
    createdAt: { required: true, type: Date },
    expiresAt: { required: true, type: Date },
    firstConfirmedAt: { default: null, type: Date },
    endedAt: { default: null, type: Date },
    endedBy: { default: null, type: String },
    removedAt: { default: null, type: Date },
    removedBy: { default: null, type: String },
    penalized: { default: false, type: Boolean },
    reviewedAt: { default: null, type: Date },
    purgeAt: { required: true, type: Date },
  },
  { versionKey: false, bufferCommands: false },
);
campusNoticeSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });
// os que valem agora: a lista e o mesmo lugar (juntar e trocar), que são
// poucos (o teto do campus) e não pedem um índice próprio
campusNoticeSchema.index({ endedAt: 1, removedAt: 1, expiresAt: 1 });
// os do aluno (a semana, hoje, o banimento)
campusNoticeSchema.index({ reporter: 1, createdAt: -1 });
// o resumo do campus e a moderação (os recentes e os denunciados dos últimos
// 7 dias, que só o admin pede)
campusNoticeSchema.index({ createdAt: -1 });

/**
 * O que cada aluno fez com cada aviso (`<aviso>:<aluno>`): a resposta, o
 * "Valeu", a denúncia e se viu. Uma linha por par faz cada coisa contar uma
 * vez só, mesmo com dois pedidos juntos. Some 2 dias depois do aviso.
 */
const campusAnswerSchema = new mongoose.Schema(
  {
    _id: { required: true, type: String },
    notice: { required: true, type: String },
    student: { required: true, type: String },
    answer: { default: null, type: String },
    thanked: { default: false, type: Boolean },
    flagged: { default: false, type: Boolean },
    seen: { default: false, type: Boolean },
    purgeAt: { required: true, type: Date },
  },
  { versionKey: false, bufferCommands: false },
);
campusAnswerSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });

/** Os pontos e as contagens de sempre de cada aluno (o id é o do aluno). */
const campusPersonSchema = new mongoose.Schema(
  {
    _id: { required: true, type: String },
    points: { default: 0, type: Number },
    notices: { default: 0, type: Number },
    answers: { default: 0, type: Number },
    confirmedNotices: { default: 0, type: Number },
    thanksReceived: { default: 0, type: Number },
    viewsReceived: { default: 0, type: Number },
  },
  { versionKey: false, bufferCommands: false, timestamps: true },
);

/**
 * As contagens do dia de cada aluno (`<aluno>:<AAAA-MM-DD>`), para o limite
 * de avisos, o teto de pontos e "quantos ajudaram hoje". Ficam 3 dias.
 */
const campusDaySchema = new mongoose.Schema(
  {
    _id: { required: true, type: String },
    day: { required: true, type: String },
    notices: { default: 0, type: Number },
    answers: { default: 0, type: Number },
    thanks: { default: 0, type: Number },
    purgeAt: { required: true, type: Date },
  },
  { versionKey: false, bufferCommands: false },
);
campusDaySchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });
campusDaySchema.index({ day: 1 });

/**
 * As publicações das atualizações pelo ar: cada manifesto ou diretiva como o
 * CI assinou (o texto exato e a assinatura), sem prazo. Os arquivos ficam em
 * disco (`OTA_DIR`); aqui só os hashes, para a limpeza saber quais guardar.
 */
const otaEntrySchema = new mongoose.Schema(
  {
    platform: { required: true, type: String },
    runtimeVersion: { required: true, type: String },
    kind: { required: true, type: String },
    body: { required: true, type: String },
    signature: { required: true, type: String },
    bodyHash: { required: true, type: String },
    updateId: { default: null, type: String },
    commitTime: { required: true, type: Date },
    launchAsset: { default: null, type: String },
    assets: { default: [], type: [String] },
    publishedAt: { required: true, type: Date },
  },
  { versionKey: false, bufferCommands: false },
);
// a mais recente de cada plataforma e runtime: a pergunta de todo app
otaEntrySchema.index({ platform: 1, runtimeVersion: 1, publishedAt: -1 });
// o mesmo texto e o mesmo update entram uma vez só, mesmo com dois envios juntos
otaEntrySchema.index(
  { platform: 1, runtimeVersion: 1, bodyHash: 1 },
  { unique: true },
);
otaEntrySchema.index(
  { platform: 1, runtimeVersion: 1, updateId: 1 },
  { unique: true, partialFilterExpression: { updateId: { $type: 'string' } } },
);
// o bundle de uma plataforma não vira o de outra
otaEntrySchema.index(
  { launchAsset: 1 },
  { partialFilterExpression: { launchAsset: { $type: 'string' } } },
);

/** Os modelos registrados numa conexão. */
export function defineModels(connection: Connection) {
  return {
    teachers: connection.model('Docentes', teacherSchema),
    errorReports: connection.model('ErrorReport', errorReportSchema),
    muralMessages: connection.model('MuralMessages', muralMessageSchema),
    suggestions: connection.model('Suggestions', suggestionSchema),
    // os tokens de aluno gastos, até um dia depois de vencer a chave
    spentTokens: connection.model('SpentTokens', singleUseSchema()),
    // os desafios de emissão usados, até vencerem (cinco minutos)
    usedChallenges: connection.model('UsedChallenges', singleUseSchema()),
    issuanceCounters: connection.model(
      'IssuanceCounters',
      issuanceCounterSchema,
    ),
    companionCalls: connection.model('CompanionCalls', companionCallSchema),
    companionReports: connection.model(
      'CompanionReports',
      companionReportSchema,
    ),
    companionStats: connection.model('CompanionStats', companionStatsSchema),
    companionWatchers: connection.model(
      'CompanionWatchers',
      companionWatcherSchema,
    ),
    students: connection.model('Students', studentSchema),
    studentSessions: connection.model('StudentSessions', studentSessionSchema),
    // Agora no campus, com os nomes das coleções escritos (o Mongoose faria
    // "campuspeoples")
    campusNotices: connection.model(
      'CampusNotices',
      campusNoticeSchema,
      'campusnotices',
    ),
    campusAnswers: connection.model(
      'CampusAnswers',
      campusAnswerSchema,
      'campusanswers',
    ),
    campusPeople: connection.model(
      'CampusPeople',
      campusPersonSchema,
      'campuspeople',
    ),
    campusDays: connection.model('CampusDays', campusDaySchema, 'campusdays'),
    otaEntries: connection.model('OtaEntries', otaEntrySchema, 'otaentries'),
  };
}

export type Models = ReturnType<typeof defineModels>;
