import { isSavedAccount } from '@root/adapters/outbound/persistence/credential-store';
import { createDemoBackend, demoCredentials, DEMO_SCENARIOS } from '../index';

jest.mock('react-native-keychain', () => ({}));

it.each(DEMO_SCENARIOS)(
  'the %s demo account passes the real credential vault validation',
  async scenario => {
    const credentials = demoCredentials(scenario);
    const profile = await createDemoBackend({ latencyMs: 0 })
      .ports(scenario)
      .authentication.signIn(credentials);
    expect(
      isSavedAccount({ credentials, account: { ...profile, scope: 'demo' } }),
    ).toBe(true);
  },
);
