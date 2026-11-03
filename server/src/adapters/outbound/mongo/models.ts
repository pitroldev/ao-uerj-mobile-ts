import mongoose, { type Connection } from 'mongoose';

import { COMPANION_LIMITS } from '../../../modules/companion/domain.ts';
import { MESSAGE_LIMITS } from '../../../modules/mural/domain.ts';
import { REPORT_LIMITS } from '../../../modules/reports/domain.ts';
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
  };
}

export type Models = ReturnType<typeof defineModels>;
