import { testCrypto } from '@root/modules/trust/__tests__/testCrypto';
import { fromBase64, toBase64, toHex } from '@root/modules/trust/domain/bytes';
import type { Spec } from '@root/specs/NativeAppAttest';
import { createNativeAppAttest } from '../NativeAppAttest';

jest.mock('@root/specs/NativeAppAttest', () => ({
  __esModule: true,
  default: null,
}));

const HASH = Uint8Array.from({ length: 32 }, (_, index) => 255 - index);

/** O módulo nativo com o crypto do Node no lugar do CommonCrypto e do SecRandomCopyBytes. */
function fakeModule({ supported = true } = {}): jest.Mocked<Spec> {
  return {
    isSupported: jest.fn(() => supported),
    attest: jest.fn(async () => ({
      keyId: 'a2V5LWlk+/8=',
      attestation: 'o2NmbXRvYXBwbGUtYXBwYXR0ZXN0',
    })),
    randomBytes: jest.fn(length => toBase64(testCrypto.randomBytes(length))),
    digest: jest.fn((algorithm, data) => {
      const bytes = fromBase64(data)!;
      if (algorithm !== 'SHA-256') throw new Error(`unexpected ${algorithm}`);
      return toBase64(testCrypto.sha256(bytes));
    }),
  } as unknown as jest.Mocked<Spec>;
}

it('is null on Android and where App Attest does not work (the simulator)', () => {
  expect(createNativeAppAttest()).toBeNull();
  expect(createNativeAppAttest(fakeModule({ supported: false }))).toBeNull();
  const broken = fakeModule();
  broken.isSupported.mockImplementation(() => {
    throw new Error('module gone');
  });
  expect(createNativeAppAttest(broken)).toBeNull();
  expect(createNativeAppAttest(fakeModule())).not.toBeNull();
});

it('attests a new key over the raw bytes of the request hash, in standard base64', async () => {
  const module = fakeModule();
  const device = createNativeAppAttest(module)!;
  await expect(device.attest(toHex(HASH))).resolves.toEqual({
    appAttest: {
      keyId: 'a2V5LWlk+/8=',
      attestation: 'o2NmbXRvYXBwbGUtYXBwYXR0ZXN0',
    },
  });
  // os 32 bytes, não o texto em hex; base64 padrão, com + e /
  expect(module.attest).toHaveBeenCalledTimes(1);
  const [clientDataHash] = module.attest.mock.calls[0];
  expect(clientDataHash).toBe(toBase64(HASH));
  expect(clientDataHash).toMatch(/^[A-Za-z0-9+/]{43}=$/);
  expect(fromBase64(clientDataHash)).toEqual(HASH);
});

it('never asks Apple for a hash that is not 32 bytes of hex', async () => {
  const module = fakeModule();
  const device = createNativeAppAttest(module)!;
  for (const invalid of ['', 'ab'.repeat(31), 'ab'.repeat(33), 'zz'.repeat(32)])
    await expect(device.attest(invalid)).resolves.toEqual({
      failure: 'unavailable',
    });
  expect(module.attest).not.toHaveBeenCalled();
});

it('tells the failures apart: network or Apple busy, and the rest', async () => {
  const module = fakeModule();
  const device = createNativeAppAttest(module)!;
  const hash = toHex(HASH);
  module.attest.mockRejectedValueOnce(
    Object.assign(new Error('server unavailable'), {
      code: 'E_APP_ATTEST_TRANSIENT',
    }),
  );
  await expect(device.attest(hash)).resolves.toEqual({ failure: 'transient' });
  module.attest.mockRejectedValueOnce(
    Object.assign(new Error('invalid key'), {
      code: 'E_APP_ATTEST_UNAVAILABLE',
    }),
  );
  await expect(device.attest(hash)).resolves.toEqual({
    failure: 'unavailable',
  });
  module.attest.mockRejectedValueOnce(new Error('other'));
  await expect(device.attest(hash)).resolves.toEqual({
    failure: 'unavailable',
  });
  // uma resposta sem a chave ou sem a atestação não serve ao servidor
  module.attest.mockResolvedValueOnce({ keyId: '', attestation: 'x' });
  await expect(device.attest(hash)).resolves.toEqual({
    failure: 'unavailable',
  });
  module.attest.mockResolvedValueOnce(
    null as unknown as { keyId: string; attestation: string },
  );
  await expect(device.attest(hash)).resolves.toEqual({
    failure: 'unavailable',
  });
});

it('hashes and draws bytes through the platform, in base64', () => {
  const module = fakeModule();
  const device = createNativeAppAttest(module)!;
  const abc = Uint8Array.of(0x61, 0x62, 0x63);
  expect(toHex(device.crypto.sha256(abc))).toBe(
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  );
  expect(module.digest).toHaveBeenCalledWith('SHA-256', 'YWJj');
  expect(device.crypto.randomBytes(32)).toHaveLength(32);
  expect(module.randomBytes).toHaveBeenCalledWith(32);
  module.randomBytes.mockReturnValueOnce('não é base64');
  expect(() => device.crypto.randomBytes(4)).toThrow('invalid base64');
});
