import * as Keychain from 'react-native-keychain';
import { createCredentialStore } from '../credential-store';

jest.mock('react-native-keychain', () => ({
  getGenericPassword: jest.fn(),
  setGenericPassword: jest.fn(),
  resetGenericPassword: jest.fn(),
  ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WhenUnlockedThisDeviceOnly' },
  STORAGE_TYPE: { AES_GCM_NO_AUTH: 'AES_GCM_NO_AUTH' },
}));
const saved = {
  credentials: { matricula: 'test', password: 'synthetic-secret' },
  account: {
    matricula: 'test',
    name: 'Teste',
    period: 'current',
    scope: 'local',
  },
};

it('verifies the native persisted value before accepting a write', async () => {
  const vault = createCredentialStore();
  jest.mocked(Keychain.getGenericPassword).mockResolvedValueOnce({
    username: 'local',
    password: JSON.stringify(saved),
    service: 'test',
    storage: Keychain.STORAGE_TYPE.AES_GCM_NO_AUTH,
  });
  await vault.write(saved);
  expect(Keychain.setGenericPassword).toHaveBeenCalledWith(
    'local',
    JSON.stringify(saved),
    expect.objectContaining({ accessible: 'WhenUnlockedThisDeviceOnly' }),
  );
  jest.mocked(Keychain.getGenericPassword).mockResolvedValueOnce(false);
  await expect(vault.write(saved)).rejects.toMatchObject({
    code: 'STORAGE_FAILED',
  });
});

it('reports redacted storage errors and rejects corrupted credentials', async () => {
  const vault = createCredentialStore();
  jest
    .mocked(Keychain.getGenericPassword)
    .mockRejectedValueOnce(new Error('synthetic-secret'));
  await expect(vault.read()).rejects.toMatchObject({
    message: 'STORAGE_FAILED',
  });
  jest.mocked(Keychain.getGenericPassword).mockResolvedValueOnce({
    username: 'local',
    password: '{}',
    service: 'test',
    storage: Keychain.STORAGE_TYPE.AES_GCM_NO_AUTH,
  });
  await expect(vault.read()).rejects.toMatchObject({ code: 'STORAGE_FAILED' });
});

it('clears only the app credential service', async () => {
  await createCredentialStore().clear();
  expect(Keychain.resetGenericPassword).toHaveBeenCalledWith({
    service: 'br.uerj.ao.credentials.v2',
  });
});
