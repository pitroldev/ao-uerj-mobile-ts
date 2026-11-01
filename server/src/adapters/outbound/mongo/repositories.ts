import type { MessageRepository } from '../../../modules/mural/ports.ts';
import type { ErrorReportRepository } from '../../../modules/reports/ports.ts';
import type { SuggestionRepository } from '../../../modules/suggestions/ports.ts';
import type { TeacherRepository } from '../../../modules/teachers/ports.ts';
import { createErrorReportRepository } from './errorReportRepository.ts';
import { createMessageRepository } from './messageRepository.ts';
import type { Models } from './models.ts';
import { createSuggestionRepository } from './suggestionRepository.ts';
import { createTeacherRepository } from './teacherRepository.ts';

/** As portas de saída de dados, sobre os modelos do Mongoose. */
export type Repositories = {
  messages: MessageRepository;
  teachers: TeacherRepository;
  reports: ErrorReportRepository;
  suggestions: SuggestionRepository;
};

export function createMongoRepositories(models: Models): Repositories {
  return {
    messages: createMessageRepository(models.muralMessages),
    teachers: createTeacherRepository(models.teachers),
    reports: createErrorReportRepository(models.errorReports),
    suggestions: createSuggestionRepository(models.suggestions),
  };
}
