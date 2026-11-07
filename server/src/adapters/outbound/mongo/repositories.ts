import type {
  IssuanceCounter,
  SingleUse,
} from '../../../modules/access/ports.ts';
import type {
  AnswerRepository,
  ContributorRepository,
  DayRepository,
  NoticeRepository,
} from '../../../modules/campus-now/ports.ts';
import type {
  CallReportRepository,
  CallRepository,
  CompanionStatsRepository,
  WatcherRepository,
} from '../../../modules/companion/ports.ts';
import type { MessageRepository } from '../../../modules/mural/ports.ts';
import type { OtaEntryRepository } from '../../../modules/ota/ports.ts';
import type {
  StudentRepository,
  StudentSessionRepository,
} from '../../../modules/students/ports.ts';
import type { ErrorReportRepository } from '../../../modules/reports/ports.ts';
import type { SuggestionRepository } from '../../../modules/suggestions/ports.ts';
import type { TeacherRepository } from '../../../modules/teachers/ports.ts';
import {
  createAnswerRepository,
  createContributorRepository,
  createDayRepository,
  createNoticeRepository,
} from './campusNowRepository.ts';
import {
  createCallReportRepository,
  createCallRepository,
  createCompanionStatsRepository,
  createWatcherRepository,
} from './companionRepository.ts';
import { createErrorReportRepository } from './errorReportRepository.ts';
import { createIssuanceCounterRepository } from './issuanceCounterRepository.ts';
import { createMessageRepository } from './messageRepository.ts';
import type { Models } from './models.ts';
import { createOtaEntryRepository } from './otaEntryRepository.ts';
import { createSingleUseRepository } from './singleUseRepository.ts';
import {
  createStudentRepository,
  createStudentSessionRepository,
} from './studentRepository.ts';
import { createSuggestionRepository } from './suggestionRepository.ts';
import { createTeacherRepository } from './teacherRepository.ts';

/** As portas de saída de dados, sobre os modelos do Mongoose. */
export type Repositories = {
  messages: MessageRepository;
  teachers: TeacherRepository;
  reports: ErrorReportRepository;
  suggestions: SuggestionRepository;
  spentTokens: SingleUse;
  usedChallenges: SingleUse;
  issuanceCounters: IssuanceCounter;
  companionCalls: CallRepository;
  companionReports: CallReportRepository;
  companionStats: CompanionStatsRepository;
  companionWatchers: WatcherRepository;
  students: StudentRepository;
  studentSessions: StudentSessionRepository;
  campusNotices: NoticeRepository;
  campusAnswers: AnswerRepository;
  campusPeople: ContributorRepository;
  campusDays: DayRepository;
  otaEntries: OtaEntryRepository;
};

export function createMongoRepositories(models: Models): Repositories {
  return {
    messages: createMessageRepository(models.muralMessages),
    teachers: createTeacherRepository(models.teachers),
    reports: createErrorReportRepository(models.errorReports),
    suggestions: createSuggestionRepository(models.suggestions),
    spentTokens: createSingleUseRepository(models.spentTokens),
    usedChallenges: createSingleUseRepository(models.usedChallenges),
    issuanceCounters: createIssuanceCounterRepository(models.issuanceCounters),
    companionCalls: createCallRepository(models.companionCalls),
    companionReports: createCallReportRepository(models.companionReports),
    companionStats: createCompanionStatsRepository(models.companionStats),
    companionWatchers: createWatcherRepository(models.companionWatchers),
    students: createStudentRepository(models.students),
    studentSessions: createStudentSessionRepository(models.studentSessions),
    campusNotices: createNoticeRepository(models.campusNotices),
    campusAnswers: createAnswerRepository(models.campusAnswers),
    campusPeople: createContributorRepository(models.campusPeople),
    campusDays: createDayRepository(models.campusDays),
    otaEntries: createOtaEntryRepository(models.otaEntries),
  };
}
