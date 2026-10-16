import { act, renderHook, waitFor } from '@testing-library/react-native';
import { onlineManager } from '@tanstack/react-query';
import { createTestQueryClient, createWrapper } from '@root/test-utils/render';
import type { IdentityState } from '@root/modules/identity/domain/types';
import type { DocumentPdf, StudentDocument } from '../../domain/models';
import { useDocuments } from '../useDocuments';

const mockDocuments = { list: jest.fn(), issue: jest.fn(), remove: jest.fn() };
const mockSharing = { share: jest.fn() };
let mockIdentity: IdentityState;
jest.mock('@root/app/providers/AppServicesProvider', () => ({
  useIdentity: () => mockIdentity,
  useAppServices: () => ({
    documents: mockDocuments,
    documentSharing: mockSharing,
  }),
}));

const DOCUMENT: StudentDocument = {
  id: 'regular',
  title: 'Declaração de aluno regular',
  validUntil: '16/11/2026',
  hasExistingDocument: true,
  canIssue: true,
  canDelete: true,
  revision: 'revision-1',
};
const PDF: DocumentPdf = {
  base64: 'JVBERi0=',
  filename: 'documento.pdf',
  mimeType: 'application/pdf',
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => {
    resolve = done;
  });
  return { promise, resolve };
}
function setup() {
  const client = createTestQueryClient();
  return renderHook(() => useDocuments(), {
    wrapper: createWrapper({ queryClient: client }),
  }).then(hook => ({ ...hook, client }));
}
beforeEach(() => {
  onlineManager.setOnline(true);
  mockIdentity = {
    status: 'signedIn',
    error: null,
    account: { scope: 'a', period: '2026.2', matricula: '1', name: 'Marina' },
  };
  mockDocuments.list.mockReset().mockResolvedValue([DOCUMENT]);
  mockDocuments.issue.mockReset().mockResolvedValue(PDF);
  mockDocuments.remove.mockReset().mockResolvedValue(undefined);
  mockSharing.share.mockReset().mockResolvedValue(undefined);
});
afterEach(() => {
  onlineManager.setOnline(true);
});

it('scopes the catalogue to the account and keeps issued PDFs out of both caches', async () => {
  const { result, client } = await setup();
  await waitFor(() => expect(result.current.query.data).toEqual([DOCUMENT]));
  expect(client.getQueryData(['documents', 'a', '2026.2', 'catalog'])).toEqual([
    DOCUMENT,
  ]);
  await act(() => result.current.issue(DOCUMENT));
  expect(result.current.result?.pdf).toEqual(PDF);
  expect(
    JSON.stringify(
      client
        .getQueryCache()
        .getAll()
        .map(q => q.state.data),
    ),
  ).not.toContain(PDF.base64);
  expect(client.getMutationCache().getAll()).toHaveLength(0);
});

it('locks duplicate taps synchronously and shares the same PDF again after cancel', async () => {
  const request = deferred<DocumentPdf>();
  mockDocuments.issue.mockReturnValue(request.promise);
  const { result } = await setup();
  let first!: Promise<boolean>;
  await act(() => {
    first = result.current.issue(DOCUMENT);
    void result.current.issue(DOCUMENT);
  });
  expect(mockDocuments.issue).toHaveBeenCalledTimes(1);
  await act(async () => {
    request.resolve(PDF);
    await first;
  });
  await act(() => result.current.share());
  await act(() => result.current.share());
  expect(mockSharing.share).toHaveBeenCalledTimes(2);
  expect(mockSharing.share).toHaveBeenLastCalledWith(PDF);
  expect(mockDocuments.issue).toHaveBeenCalledTimes(1);
});

it('aborts in-flight work and drops its result when the account changes', async () => {
  const request = deferred<DocumentPdf>();
  mockDocuments.issue.mockReturnValue(request.promise);
  const { result, rerender } = await setup();
  let first!: Promise<boolean>;
  await act(() => {
    first = result.current.issue(DOCUMENT);
  });
  const signal = mockDocuments.issue.mock.calls[0][1].signal as AbortSignal;
  mockIdentity = {
    ...mockIdentity,
    account: { ...mockIdentity.account!, scope: 'b' },
  };
  await rerender({});
  expect(signal.aborted).toBe(true);
  await act(async () => {
    request.resolve(PDF);
    await first;
  });
  expect(result.current.result).toBeNull();
  expect(result.current.operation).toBeNull();
  expect(mockSharing.share).not.toHaveBeenCalled();
});

it('aborts pending work on unmount and never shares after leaving', async () => {
  const request = deferred<DocumentPdf>();
  mockDocuments.issue.mockReturnValue(request.promise);
  const { result, unmount } = await setup();
  let first!: Promise<boolean>;
  await act(() => {
    first = result.current.issue(DOCUMENT);
  });
  const signal = mockDocuments.issue.mock.calls[0][1].signal as AbortSignal;
  await unmount();
  expect(signal.aborted).toBe(true);
  request.resolve(PDF);
  expect(await first).toBe(false);
  expect(mockSharing.share).not.toHaveBeenCalled();
});

it('forgets the previous PDF even when returning to the same account', async () => {
  const { result, rerender } = await setup();
  await act(() => result.current.issue(DOCUMENT));
  expect(result.current.result?.pdf).toEqual(PDF);
  const signedIn = mockIdentity;
  mockIdentity = { status: 'signedOut', account: null, error: null };
  await rerender({});
  expect(result.current.result).toBeNull();
  mockIdentity = signedIn;
  await rerender({});
  expect(result.current.result).toBeNull();
  await act(() => result.current.share());
  expect(mockSharing.share).not.toHaveBeenCalled();
});

it('refreshes the catalogue after a lost mutation response without repeating the mutation', async () => {
  mockDocuments.remove.mockRejectedValue(new Error('connection lost'));
  const { result } = await setup();
  await waitFor(() => expect(result.current.query.data).toHaveLength(1));
  mockDocuments.list.mockResolvedValue([
    {
      ...DOCUMENT,
      hasExistingDocument: false,
      canDelete: false,
      revision: null,
    },
  ]);
  await act(() => result.current.remove(DOCUMENT));
  await waitFor(() =>
    expect(result.current.query.data?.[0].hasExistingDocument).toBe(false),
  );
  expect(mockDocuments.remove).toHaveBeenCalledTimes(1);
});

it('deletes only the selected revision and refreshes the catalogue', async () => {
  const { result } = await setup();
  await waitFor(() => expect(result.current.query.data).toHaveLength(1));
  await act(() => result.current.remove(DOCUMENT));
  expect(mockDocuments.remove).toHaveBeenCalledWith(
    { id: 'regular', revision: 'revision-1' },
    { signal: expect.any(AbortSignal) },
  );
  await waitFor(() => expect(mockDocuments.list).toHaveBeenCalledTimes(2));
});

it('does not retry issuing errors or queue issue/delete work while offline', async () => {
  mockDocuments.issue.mockRejectedValue(new Error('offline'));
  const { result } = await setup();
  await act(() => result.current.issue(DOCUMENT));
  expect(mockDocuments.issue).toHaveBeenCalledTimes(1);
  expect(result.current.error).toEqual(new Error('offline'));
  await act(() => {
    onlineManager.setOnline(false);
  });
  await act(() => result.current.issue(DOCUMENT));
  await act(() => result.current.remove(DOCUMENT));
  expect(mockDocuments.issue).toHaveBeenCalledTimes(1);
  expect(mockDocuments.remove).not.toHaveBeenCalled();
});

it('can share an already prepared PDF offline without contacting the portal again', async () => {
  const { result } = await setup();
  await act(() => result.current.issue(DOCUMENT));
  await act(() => onlineManager.setOnline(false));
  await act(() => result.current.share());
  expect(mockSharing.share).toHaveBeenCalledWith(PDF);
  expect(mockDocuments.issue).toHaveBeenCalledTimes(1);
  expect(result.current.error).toBeNull();
  expect(result.current.result?.pdf).toEqual(PDF);
});

it("does not let a stale share completion unlock another account's pending request", async () => {
  const sharing = deferred<void>();
  const issuing = deferred<DocumentPdf>();
  mockSharing.share.mockReturnValue(sharing.promise);
  const { result, rerender } = await setup();
  await act(() => result.current.issue(DOCUMENT));
  let oldShare!: Promise<boolean>;
  await act(() => {
    oldShare = result.current.share();
  });

  mockIdentity = {
    ...mockIdentity,
    account: { ...mockIdentity.account!, scope: 'b' },
  };
  await rerender({});
  mockDocuments.issue.mockReturnValue(issuing.promise);
  let newIssue!: Promise<boolean>;
  await act(() => {
    newIssue = result.current.issue(DOCUMENT);
  });
  await act(async () => {
    sharing.resolve();
    expect(await oldShare).toBe(false);
  });
  expect(result.current.operation).toEqual({ kind: 'issue', id: DOCUMENT.id });
  expect(result.current.result).toBeNull();
  await act(async () => {
    issuing.resolve(PDF);
    expect(await newIssue).toBe(true);
  });
  expect(result.current.result?.pdf).toEqual(PDF);
});
