import mongoose, { type Connection } from 'mongoose';

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

/** Os modelos registrados numa conexão. */
export function defineModels(connection: Connection) {
  return {
    teachers: connection.model('Docentes', teacherSchema),
    errorReports: connection.model('ErrorReport', errorReportSchema),
    muralMessages: connection.model('MuralMessages', muralMessageSchema),
    suggestions: connection.model('Suggestions', suggestionSchema),
  };
}

export type Models = ReturnType<typeof defineModels>;
