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
  const get = jest.fn(async () => ({
    status: 200,
    data: new Uint8Array([0x61]),
  }));
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
  const get = jest
    .fn()
    .mockRejectedValueOnce(new Error('unsafe-url-with-password'))
    .mockResolvedValueOnce({
      status: 200,
      data: new Uint8Array([0x61, 0xe7, 0xe3, 0x6f]),
    });
  jest.mocked(axios.create).mockReturnValue({
    get,
  } as unknown as ReturnType<typeof axios.create>);
  const transport = createNativePortalTransport();
  await expect(transport.request({ path: '/' })).rejects.toMatchObject({
    message: 'NETWORK',
  });
  await expect(transport.request({ path: '/' })).resolves.toMatchObject({
    body: 'ação',
  });
});

it('posts document parameters in the form body without putting them in the URL', async () => {
  const post = jest.fn(async () => ({ status: 200, data: new Uint8Array() }));
  jest
    .mocked(axios.create)
    .mockReturnValue({ post } as unknown as ReturnType<typeof axios.create>);
  await createNativePortalTransport().request({
    path: '/requisicaoaluno/',
    method: 'POST',
    params: {
      requisicao: 'synthetic token',
      identificacaoDocumento: 'A+B/=',
      ignored: undefined,
    },
  });
  expect(post).toHaveBeenCalledWith(
    'https://www.alunoonline.uerj.br/requisicaoaluno/',
    'requisicao=synthetic%20token&identificacaoDocumento=A%2BB%2F%3D',
    {},
  );
});

it('preserves PDF bytes and lets an HTML session error reach the session adapter', async () => {
  const bytes = new Uint8Array([
    0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0x00, 0x80, 0xff,
    0x0a, 0x25, 0x25, 0x45, 0x4f, 0x46, 0x0a,
  ]);
  const get = jest
    .fn()
    .mockResolvedValueOnce({
      status: 200,
      data: bytes,
      headers: { 'content-type': 'application/pdf' },
    })
    .mockResolvedValueOnce({
      status: 200,
      data: new Uint8Array([0x3c, 0x70, 0x3e, 0x61, 0xe7, 0xe3, 0x6f]),
      headers: { 'content-type': 'text/html' },
    });
  jest
    .mocked(axios.create)
    .mockReturnValue({ get } as unknown as ReturnType<typeof axios.create>);
  const transport = createNativePortalTransport();
  await expect(
    transport.request({ path: '/documento.pdf', responseType: 'pdf' }),
  ).resolves.toEqual({
    status: 200,
    body: '',
    pdfBase64: 'JVBERi0xLjcKAID/CiUlRU9GCg==',
    contentType: 'application/pdf',
  });
  await expect(
    transport.request({ path: '/documento.pdf', responseType: 'pdf' }),
  ).resolves.toEqual({
    status: 200,
    body: '<p>ação',
    contentType: 'text/html',
  });
});

it.each([
  'https://other.example/document.pdf',
  '//other.example/document.pdf',
  'https://www.alunoonline.uerj.br@other.example/file',
  'https://user:secret@www.alunoonline.uerj.br/file',
  ' https://other.example/file',
  '/\\other.example/file',
  'data:text/plain,untrusted',
  'https://www.alunoonline.uerj.br.other.example/file',
])('rejects a document URL outside the trusted origin: %s', async path => {
  const get = jest.fn();
  jest
    .mocked(axios.create)
    .mockReturnValue({ get } as unknown as ReturnType<typeof axios.create>);
  await expect(
    createNativePortalTransport().request({ path, responseType: 'pdf' }),
  ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  expect(get).not.toHaveBeenCalled();
});
