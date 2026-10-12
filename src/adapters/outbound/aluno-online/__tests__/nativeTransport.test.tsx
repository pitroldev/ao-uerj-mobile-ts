import axios from 'axios';
import CookieManager from '@preeternal/react-native-cookie-manager';
import {
  createNativePortalTransport,
  createNativeCookieJar,
} from '../nativeTransport';

jest.mock('axios', () => ({ create: jest.fn() }));
jest.mock('@preeternal/react-native-cookie-manager', () => ({
  clearAll: jest.fn(async () => true),
}));

it('prevents native HTTP caching for login and academic requests', async () => {
  const get = jest.fn(async () => ({ status: 200, data: 'page' }));
  jest.mocked(axios.create).mockReturnValue({
    get,
  } as unknown as ReturnType<typeof axios.create>);
  const transport = createNativePortalTransport();
  await transport.request({ path: '/' });
  await transport.request({
    path: '/requisicaoaluno/',
    params: { matricula: 'synthetic-student', senha: 'synthetic-secret' },
  });
  await transport.request({
    path: '/requisicaoaluno/',
    params: { requisicao: 'synthetic-grades-request' },
  });
  expect(axios.create).toHaveBeenCalledWith(
    expect.objectContaining({
      headers: expect.objectContaining({
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      }),
    }),
  );
  // Every request inherits these defaults, including the credential-bearing GET.
  expect(get.mock.calls).toHaveLength(3);
  get.mock.calls.forEach(call => expect(call).toHaveLength(2));
});

it('drains the native response before allowing a cookie clear and rejects its late result', async () => {
  let finish!: (value: { status: number; data: string }) => void;
  jest.mocked(axios.create).mockReturnValue({
    get: jest.fn(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    ),
  } as unknown as ReturnType<typeof axios.create>);
  const transport = createNativePortalTransport();
  const request = transport.request({ path: '/' }).catch(error => error);
  let drained = false;
  const drain = transport.cancelAndDrain().then(() => {
    drained = true;
  });
  await Promise.resolve();
  expect(drained).toBe(false);
  finish({ status: 200, data: 'anonymous cookie already processed' });
  await drain;
  expect(await request).toMatchObject({ code: 'CANCELLED' });
  await createNativeCookieJar().clear();
  expect(CookieManager.clearAll).toHaveBeenCalled();
});

it('redacts transport errors and decodes the Latin-1 response', async () => {
  jest.mocked(axios.create).mockReturnValue({
    get: jest.fn(async () => {
      throw new Error('unsafe-url-with-password');
    }),
  } as unknown as ReturnType<typeof axios.create>);
  const transport = createNativePortalTransport();
  await expect(transport.request({ path: '/' })).rejects.toMatchObject({
    message: 'NETWORK',
  });
  const options = jest.mocked(axios.create).mock.calls[0][0]!;
  const transforms = options.transformResponse as Array<
    (input: Uint8Array) => string
  >;
  expect(transforms[0](new Uint8Array([0x61, 0xe7, 0xe3, 0x6f]))).toBe('ação');
});
