import { AppError } from '@root/shared/errors/AppError';
import type {
  Credentials,
  SavedAccount,
  StudentProfile,
} from '../domain/types';

/**
 * Authentication failure: explicit sign-in, restore, refresh or the new login
 * a portal read starts by itself. It keeps the original code and message.
 * Callers that read several pages in a row (the notification check) stop at
 * the first one, since every following page would sign in again.
 */
export class SignInError extends AppError {}

export interface AuthenticationPort {
  signIn(credentials: Credentials): Promise<StudentProfile>;
  refresh(): Promise<StudentProfile>;
  signOut(): Promise<void>;
}

export interface CredentialStore {
  read(): Promise<SavedAccount | null>;
  write(account: SavedAccount): Promise<void>;
  clear(): Promise<void>;
}

export interface AccountDataLifecycle {
  activate(scope: string): Promise<void>;
  clear(scope: string | null): Promise<void>;
}
