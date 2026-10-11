export const academicKeys = {
  all: ['academics'] as const,
  account: (scope: string) => ['academics', scope] as const,
  resource: (scope: string, period: string, resource: string) =>
    ['academics', scope, period, resource] as const,
  details: (scope: string, period: string, subjectId: string) =>
    ['academics', scope, period, 'subject-details', subjectId] as const,
};
