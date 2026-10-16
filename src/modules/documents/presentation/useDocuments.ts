import { useLayoutEffect, useRef, useState } from 'react';
import { onlineManager, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  useAppServices,
  useIdentity,
} from '@root/app/providers/AppServicesProvider';
import { AppError, isTransientError } from '@root/shared/errors/AppError';
import type { DocumentPdf, StudentDocument } from '../domain/models';

type Operation = { kind: 'issue' | 'remove' | 'share'; id: string };
type Result = { document: StudentDocument; pdf: DocumentPdf };
type ActionState = {
  owner: string;
  operation: Operation | null;
  result: Result | null;
  error: unknown;
};

/** PDFs live only in this screen's memory, never in the query/mutation cache. */
export function useDocuments() {
  const { documents, documentSharing } = useAppServices();
  const { account, status } = useIdentity();
  const client = useQueryClient();
  const enabled =
    Boolean(account) && (status === 'signedIn' || status === 'refreshing');
  const owner = enabled ? `${account!.scope}:${account!.period}` : 'signed-out';
  const key = [
    'documents',
    account?.scope ?? 'signed-out',
    account?.period ?? '',
    'catalog',
  ];
  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => {
      if (!enabled) throw new AppError('NOT_LOGGED_IN');
      return documents.list({ signal });
    },
    enabled,
    staleTime: 0,
    gcTime: 0,
    retry: (count, error) => count < 1 && isTransientError(error),
  });
  const [state, setState] = useState<ActionState>({
    owner,
    operation: null,
    result: null,
    error: null,
  });
  const lifecycle = useRef({ owner, generation: 0, alive: true });
  const pending = useRef<AbortController | null>(null);

  if (state.owner !== owner) {
    setState({ owner, operation: null, result: null, error: null });
  }

  useLayoutEffect(() => {
    lifecycle.current = {
      owner,
      generation: lifecycle.current.generation + 1,
      alive: true,
    };
    pending.current?.abort();
    pending.current = null;
    return () => {
      lifecycle.current.alive = false;
      pending.current?.abort();
      pending.current = null;
    };
  }, [owner]);

  const current =
    state.owner === owner
      ? state
      : {
          owner,
          operation: null,
          result: null,
          error: null,
        };

  async function perform(
    operation: Operation,
    action: (signal: AbortSignal, isCurrent: () => boolean) => Promise<void>,
  ): Promise<boolean> {
    if (
      pending.current ||
      !enabled ||
      !lifecycle.current.alive ||
      lifecycle.current.owner !== owner
    )
      return false;
    if (!onlineManager.isOnline() && operation.kind !== 'share') {
      setState(previous => ({
        ...previous,
        owner,
        error: new AppError('NETWORK'),
      }));
      return false;
    }
    const request = new AbortController();
    const generation = lifecycle.current.generation;
    pending.current = request;
    const isCurrent = () =>
      lifecycle.current.alive &&
      lifecycle.current.owner === owner &&
      lifecycle.current.generation === generation &&
      !request.signal.aborted;
    setState(previous => ({ ...previous, owner, operation, error: null }));
    let successful = false;
    await action(request.signal, isCurrent).then(
      () => {
        successful = isCurrent();
      },
      error => {
        if (isCurrent()) setState(previous => ({ ...previous, error }));
      },
    );
    if (isCurrent()) {
      pending.current = null;
      setState(previous => ({ ...previous, operation: null }));
      // A lost response may follow a successful change on the portal.
      if (operation.kind !== 'share')
        void client.invalidateQueries({ queryKey: key, exact: true });
    }
    return successful;
  }

  const issue = (document: StudentDocument) => {
    if (!document.canIssue) return Promise.resolve(false);
    return perform(
      { kind: 'issue', id: document.id },
      async (signal, isCurrent) => {
        const pdf = await documents.issue(document.id, { signal });
        if (!isCurrent()) return;
        setState(previous => ({ ...previous, result: { document, pdf } }));
      },
    );
  };

  const remove = (document: StudentDocument) => {
    if (!document.canDelete) return Promise.resolve(false);
    return perform(
      { kind: 'remove', id: document.id },
      async (signal, isCurrent) => {
        await documents.remove(
          { id: document.id, revision: document.revision },
          { signal },
        );
        if (!isCurrent()) return;
        setState(previous => ({
          ...previous,
          result: null,
        }));
      },
    );
  };

  const share = () => {
    if (!current.result) return Promise.resolve(false);
    const { document, pdf } = current.result;
    return perform(
      { kind: 'share', id: document.id },
      async (_signal, isCurrent) => {
        if (isCurrent()) await documentSharing.share(pdf);
      },
    );
  };

  const clearResult = () => {
    if (!pending.current)
      setState(previous => ({ ...previous, result: null, error: null }));
  };
  const clearError = () => setState(previous => ({ ...previous, error: null }));

  return { query, ...current, issue, remove, share, clearResult, clearError };
}
