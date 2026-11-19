import type {
  IssuanceCounter,
  SingleUse,
} from '../../../modules/access/ports.ts';
import type {
  AnswerRepository,
  CampusPushDeviceRepository,
  ContributorRepository,
  DayRepository,
  NoticeRepository,
} from '../../../modules/campus-now/ports.ts';
import type {
  CallReportRepository,
  CallRepository,
  CallWatchRepository,
  CompanionStatsRepository,
  WatcherRepository,
} from '../../../modules/companion/ports.ts';
import type { MessageRepository } from '../../../modules/mural/ports.ts';
import type { OtaEntryRepository } from '../../../modules/ota/ports.ts';
import type {
  PortalPushDeviceRepository,
  ReturnAlertRepository,
} from '../../../modules/portal/ports.ts';
import type {
  StudentRepository,
  StudentSessionRepository,
} from '../../../modules/students/ports.ts';
import type { ErrorReportRepository } from '../../../modules/reports/ports.ts';
import type {
  IdeaRepository,
  IdeaVoteRepository,
  TrackedIssueRepository,
} from '../../../modules/ideas/ports.ts';
import type { SuggestionRepository } from '../../../modules/suggestions/ports.ts';
import type { TeacherRepository } from '../../../modules/teachers/ports.ts';
import {
  createAnswerRepository,
  createCampusPushDeviceRepository,
  createContributorRepository,
  createDayRepository,
  createNoticeRepository,
} from './campusNowRepository.ts';
import {
  createCallReportRepository,
  createCallRepository,
  createCallWatchRepository,
  createCompanionStatsRepository,
  createWatcherRepository,
} from './companionRepository.ts';
import { createErrorReportRepository } from './errorReportRepository.ts';
import {
  createIdeaRepository,
  createIdeaVoteRepository,
  createTrackedIssueRepository,
} from './ideaRepository.ts';
import { createIssuanceCounterRepository } from './issuanceCounterRepository.ts';
import { createMessageRepository } from './messageRepository.ts';
import type { Models } from './models.ts';
import { createOtaEntryRepository } from './otaEntryRepository.ts';
import {
  createPortalPushDeviceRepository,
  createReturnAlertRepository,
} from './portalRepository.ts';
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
  companionCallWatches: CallWatchRepository;
  students: StudentRepository;
  studentSessions: StudentSessionRepository;
  campusNotices: NoticeRepository;
  campusAnswers: AnswerRepository;
  campusPeople: ContributorRepository;
  campusDays: DayRepository;
  campusPushDevices: CampusPushDeviceRepository;
  portalReturnAlerts: ReturnAlertRepository;
  portalPushDevices: PortalPushDeviceRepository;
  otaEntries: OtaEntryRepository;
  ideas: IdeaRepository;
  ideaVotes: IdeaVoteRepository;
  trackedIssues: TrackedIssueRepository;
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
    companionCallWatches: createCallWatchRepository(
      models.companionCallWatches,
    ),
    students: createStudentRepository(models.students),
    studentSessions: createStudentSessionRepository(models.studentSessions),
    campusNotices: createNoticeRepository(models.campusNotices),
    campusAnswers: createAnswerRepository(models.campusAnswers),
    campusPeople: createContributorRepository(models.campusPeople),
    campusDays: createDayRepository(models.campusDays),
    campusPushDevices: createCampusPushDeviceRepository(
      models.campusPushDevices,
    ),
    portalReturnAlerts: createReturnAlertRepository(models.portalReturnAlerts),
    portalPushDevices: createPortalPushDeviceRepository(
      models.portalPushDevices,
    ),
    otaEntries: createOtaEntryRepository(models.otaEntries),
    ideas: createIdeaRepository(models.ideas),
    ideaVotes: createIdeaVoteRepository(models.ideaVotes),
    trackedIssues: createTrackedIssueRepository(models.trackedIssues),
  };
}
