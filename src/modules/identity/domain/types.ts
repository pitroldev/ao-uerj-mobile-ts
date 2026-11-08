import type { ErrorCode } from '@root/shared/errors/AppError';

export type Credentials = { matricula: string; password: string };

export type StudentProfile = {
  matricula: string;
  name: string;
  period: string;
};

export type Account = StudentProfile & { scope: string };

type IdentityFailure = {
  error: string | null;
  /** Code of the failure described by `error`, when it was an `AppError`. */
  errorCode?: ErrorCode;
};

/**
 * `restoring` com `account`: a conta salva já aparece (com o cache) e o
 * login da abertura ainda corre; sem `account`, ainda nem foi lida.
 */
export type IdentityState = IdentityFailure &
  (
    | { status: 'restoring'; account: Account | null }
    | { status: 'signedIn' | 'refreshing'; account: Account }
    | { status: 'signedOut'; account: null }
  );

export type SavedAccount = {
  credentials: Credentials;
  account: Account;
};
