import { testCrypto } from '@root/modules/trust/__tests__/testCrypto';
import { fromBase64, toBase64, toHex } from '@root/modules/trust/domain/bytes';
import type { Spec } from '@root/specs/NativeDeviceTrust';
import { createNativeDeviceTrust } from '../NativeDeviceTrust';

jest.mock('@root/specs/NativeDeviceTrust', () => ({
  __esModule: true,
  default: null,
}));

/** O módulo nativo com o crypto do Node no lugar do MessageDigest e do SecureRandom. */
function fakeModule(): jest.Mocked<Spec> {
  return {
    requestToken: jest.fn(async () => 'integrity-token'),
    randomBytes: jest.fn(length => toBase64(testCrypto.randomBytes(length))),
    digest: jest.fn((algorithm, data) => {
      const bytes = fromBase64(data)!;
      return toBase64(
        algorithm === 'SHA-256'
          ? testCrypto.sha256(bytes)
          : testCrypto.sha384(bytes),
      );
    }),
  } as unknown as jest.Mocked<Spec>;
}

it('is null on iOS and without a project number', () => {
  expect(createNativeDeviceTrust()).toBeNull();
  expect(createNativeDeviceTrust(fakeModule(), '')).toBeNull();
  // o id do projeto não serve: a Play quer o número
  expect(createNativeDeviceTrust(fakeModule(), 'ao-uerj')).toBeNull();
});

it('uses the number of the ao-uerj project linked to the app', async () => {
  const module = fakeModule();
  await createNativeDeviceTrust(module)!.attest('hash');
  expect(module.requestToken).toHaveBeenCalledWith('377368074507', 'hash');
});

it('hashes and draws bytes through the platform, in base64', () => {
  const module = fakeModule();
  const device = createNativeDeviceTrust(module, '123456789012')!;
  const abc = Uint8Array.of(0x61, 0x62, 0x63);
  expect(toHex(device.crypto.sha256(abc))).toBe(
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  );
  expect(device.crypto.sha384(abc)).toHaveLength(48);
  expect(module.digest).toHaveBeenCalledWith('SHA-384', 'YWJj');
  expect(device.crypto.randomBytes(32)).toHaveLength(32);
  expect(module.randomBytes).toHaveBeenCalledWith(32);
});

it('asks Play for the token with the project number, and tells the failures apart', async () => {
  const module = fakeModule();
  const device = createNativeDeviceTrust(module, '123456789012')!;
  await expect(device.attest('ab'.repeat(32))).resolves.toEqual({
    token: 'integrity-token',
  });
  expect(module.requestToken).toHaveBeenCalledWith(
    '123456789012',
    'ab'.repeat(32),
  );

  module.requestToken.mockRejectedValueOnce(
    Object.assign(new Error('rede'), { code: 'E_INTEGRITY_TRANSIENT' }),
  );
  await expect(device.attest('x')).resolves.toEqual({ failure: 'transient' });
  module.requestToken.mockRejectedValueOnce(
    Object.assign(new Error('sem Play'), { code: 'E_INTEGRITY_UNAVAILABLE' }),
  );
  await expect(device.attest('x')).resolves.toEqual({ failure: 'unavailable' });
  module.requestToken.mockRejectedValueOnce(new Error('outro'));
  await expect(device.attest('x')).resolves.toEqual({ failure: 'unavailable' });
});

it('fails loudly on bytes the module should never return', () => {
  const module = fakeModule();
  module.randomBytes.mockReturnValueOnce('não é base64');
  const device = createNativeDeviceTrust(module, '1')!;
  expect(() => device.crypto.randomBytes(4)).toThrow('invalid base64');
});
