import { AcademicRecordsPort } from '@root/modules/academics/application/ports';
import {
  CurriculumSubject,
  SubjectInfo,
  SubjectsTaken,
} from '@root/modules/academics/domain/models';
import { AppError } from '@root/shared/errors/AppError';
import { subjectEligibility } from '../domain/rules';

export type PlanningSubjectResult = {
  subject: CurriculumSubject;
  details?: SubjectInfo;
  error?: Error;
  eligible: boolean;
  reason: string | null;
};
export type PlanningLoadProgress = {
  completed: number;
  total: number;
  results: PlanningSubjectResult[];
};

export class LoadPlanningSubjects {
  constructor(
    private readonly records: Pick<AcademicRecordsPort, 'getSubjectDetails'>,
    private readonly concurrency = 3,
  ) {}
  async execute(
    subjects: readonly CurriculumSubject[],
    history: readonly SubjectsTaken[],
    signal: AbortSignal,
    onProgress: (progress: PlanningLoadProgress) => void,
    completedCurriculum: readonly CurriculumSubject[] = [],
  ): Promise<PlanningSubjectResult[]> {
    const unique = [
      ...new Map(subjects.map(subject => [subject.id, subject])).values(),
    ];
    const results: PlanningSubjectResult[] = [];
    let next = 0;
    const assertActive = () => {
      if (signal.aborted) throw new AppError('CANCELLED');
    };
    const worker = async () => {
      while (next < unique.length) {
        assertActive();
        const subject = unique[next++];
        let result: PlanningSubjectResult;
        try {
          const details = await this.records.getSubjectDetails(subject.id, {
            signal,
          });
          assertActive();
          result = {
            subject,
            details,
            ...subjectEligibility(
              subject,
              details,
              history,
              completedCurriculum,
            ),
          };
        } catch (error) {
          assertActive();
          result = {
            subject,
            error:
              error instanceof Error
                ? error
                : new Error('Falha ao carregar disciplina.'),
            eligible: false,
            reason: null,
          };
        }
        results.push(result);
        onProgress({
          completed: results.length,
          total: unique.length,
          results: [...results],
        });
      }
    };
    await Promise.all(
      Array.from(
        { length: Math.min(Math.max(1, this.concurrency), unique.length) },
        worker,
      ),
    );
    return unique.map(subject =>
      results.find(result => result.subject.id === subject.id)!,
    );
  }
}
