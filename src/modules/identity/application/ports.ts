import type {
  Credentials,
  SavedAccount,
  StudentProfile,
} from '../domain/types';

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
