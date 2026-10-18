import type { AcademicRecordsPort } from '@root/modules/academics/application/ports';
import type { DocumentsPort } from '@root/modules/documents/application/ports';
import type { AuthenticationPort } from '@root/modules/identity/application/ports';
import { AppError } from '@root/shared/errors/AppError';
import { reportPortalLayoutChanges } from '../portalLayout';

const profile = {
  matricula: '209912345678',
  name: 'Estudante',
  period: '2026.2',
};
const credentials = { matricula: '209912345678', password: 'segredo' };

function setup() {
  const authentication: jest.Mocked<AuthenticationPort> = {
    signIn: jest.fn().mockResolvedValue(profile),
    refresh: jest.fn().mockResolvedValue(profile),
    signOut: jest.fn().mockResolvedValue(undefined),
  };
  const records = {
    getGrades: jest.fn().mockResolvedValue([]),
    getHistory: jest.fn().mockResolvedValue([]),
    getCurriculum: jest.fn().mockResolvedValue([]),
    getSchedule: jest.fn().mockResolvedValue([]),
    getPartialRid: jest.fn(),
    getEnrollmentResult: jest.fn(),
    getSubjectDetails: jest.fn(),
    getUniversalSubjects: jest.fn().mockResolvedValue([]),
  } as jest.Mocked<AcademicRecordsPort>;
  const documents: jest.Mocked<DocumentsPort> = {
    list: jest.fn().mockResolvedValue([]),
    issue: jest.fn(),
    remove: jest.fn().mockResolvedValue(undefined),
  };
  const diagnostics = { snapshot: jest.fn() };
  const report = jest.fn();
  const ports = reportPortalLayoutChanges(
    { authentication, records, documents, diagnostics },
    report,
  );
  return { authentication, records, documents, diagnostics, report, ports };
}

it('reports a layout change once per operation and still rejects every call', async () => {
  const { records, report, ports } = setup();
  const changed = new AppError('PORTAL_LAYOUT_CHANGED');
  records.getGrades.mockRejectedValue(changed);
  records.getSubjectDetails.mockRejectedValue(changed);
  records.getEnrollmentResult.mockRejectedValue(changed);

  await expect(ports.records.getGrades()).rejects.toBe(changed);
  await expect(ports.records.getGrades()).rejects.toBe(changed);
  await expect(ports.records.getSubjectDetails('IME02-01388', {})).rejects.toBe(
    changed,
  );

  await expect(ports.records.getEnrollmentResult()).rejects.toBe(changed);

  expect(records.getSubjectDetails).toHaveBeenCalledWith('IME02-01388', {});
  expect(report.mock.calls).toEqual([
    [changed, 'grades'],
    [changed, 'subject-details'],
    [changed, 'enrollment-result'],
  ]);
});

it('reports document layout failures by operation without including document data', async () => {
  const { documents, report, ports } = setup();
  const changed = new AppError('PORTAL_LAYOUT_CHANGED');
  documents.list.mockRejectedValue(changed);
  documents.issue.mockRejectedValue(changed);
  documents.remove.mockRejectedValue(changed);
  const selected = { id: 'matricula', revision: 'sensitive-revision' };
  await expect(ports.documents.list()).rejects.toBe(changed);
  await expect(ports.documents.list()).rejects.toBe(changed);
  await expect(ports.documents.issue(selected.id)).rejects.toBe(changed);
  await expect(ports.documents.remove(selected)).rejects.toBe(changed);
  expect(documents.remove).toHaveBeenCalledWith(selected);
  expect(report.mock.calls).toEqual([
    [changed, 'documents-list'],
    [changed, 'documents-issue'],
    [changed, 'documents-remove'],
  ]);
});

it('covers sign-in and session refresh as the login operation', async () => {
  const { authentication, report, ports } = setup();
  const changed = new AppError('PORTAL_LAYOUT_CHANGED');
  authentication.signIn.mockRejectedValue(changed);
  authentication.refresh.mockRejectedValue(changed);

  await expect(ports.authentication.signIn(credentials)).rejects.toBe(changed);
  await expect(ports.authentication.refresh()).rejects.toBe(changed);

  expect(authentication.signIn).toHaveBeenCalledWith(credentials);
  expect(report).toHaveBeenCalledTimes(1);
  expect(report).toHaveBeenCalledWith(changed, 'login');
});

it('ignores other failures and passes results through untouched', async () => {
  const { authentication, records, diagnostics, report, ports } = setup();
  records.getHistory.mockRejectedValue(new AppError('NETWORK'));
  records.getCurriculum.mockRejectedValue(new TypeError('bug'));

  await expect(ports.records.getHistory()).rejects.toMatchObject({
    code: 'NETWORK',
  });
  await expect(ports.records.getCurriculum()).rejects.toThrow('bug');
  await expect(ports.records.getSchedule()).resolves.toEqual([]);
  await expect(ports.authentication.signIn(credentials)).resolves.toBe(profile);
  await ports.authentication.signOut();

  expect(authentication.signOut).toHaveBeenCalledTimes(1);
  expect(ports.diagnostics).toBe(diagnostics);
  expect(report).not.toHaveBeenCalled();
});
