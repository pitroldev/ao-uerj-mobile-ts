import type { ErrorCode } from '@root/shared/errors/AppError';

export type Credentials = { matricula: string; password: string };

export type StudentProfile = {
  matricula: string;
  name: string;
  period: string;
};

export type Account = StudentProfile & { scope: string };

export type IdentityState = {
  status: 'restoring' | 'signedIn' | 'refreshing' | 'signedOut';
  account: Account | null;
  error: string | null;
  /** Code of the failure described by `error`, when it was an `AppError`. */
  errorCode?: ErrorCode;
};

export type SavedAccount = {
  credentials: Credentials;
  account: Account;
};
