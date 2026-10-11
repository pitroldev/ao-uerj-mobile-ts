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
};

export type SavedAccount = {
  credentials: Credentials;
  account: Account;
};
