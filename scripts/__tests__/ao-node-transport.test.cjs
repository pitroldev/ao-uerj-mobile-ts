const assert = require('node:assert/strict');
const { test, mock } = require('node:test');
const axios = require('axios');
const { createNodePortalTransport } = require('../lib/ao-node-transport.cjs');

test('POST uses a form body, preserves cookies, and disables caching and redirects', async () => {
  const get = mock.method(axios, 'get', async () => ({
    status: 200,
    data: Buffer.from('hello'),
    headers: { 'set-cookie': ['PHPSESSID=synthetic; Secure; HttpOnly'] },
  }));
  const post = mock.method(axios, 'post', async () => ({
    status: 200,
    data: Buffer.from([0x61, 0xe7, 0xe3, 0x6f]),
    headers: { 'content-type': 'text/html; charset=ISO-8859-1' },
  }));
  try {
    const { transport, cookies } = createNodePortalTransport();
    await transport.request({ path: '/' });
    const result = await transport.request({
      path: '/requisicaoaluno/',
      method: 'POST',
      params: { requisicao: 'synthetic token', opcao: '8', absent: undefined },
    });
    assert.equal(result.body, 'ação');
    const [url, body, options] = post.mock.calls[0].arguments;
    assert.equal(url, 'https://www.alunoonline.uerj.br/requisicaoaluno/');
    assert.equal(body, 'requisicao=synthetic+token&opcao=8');
    assert.equal(options.headers.Cookie, 'PHPSESSID=synthetic');
    assert.equal(options.headers['Cache-Control'], 'no-store');
    assert.equal(options.maxRedirects, 0);
    assert.equal(options.params, undefined);
    await cookies.clear();
    await transport.request({ path: '/' });
    assert.equal(get.mock.calls[1].arguments[1].headers.Cookie, '');
  } finally {
    mock.restoreAll();
  }
});

test('PDF bytes stay binary, while an HTML error remains available to session recovery', async () => {
  const pdf = Buffer.concat([
    Buffer.from('%PDF-1.7\n'),
    Buffer.from([0, 0x80, 0xff]),
    Buffer.from('\n%%EOF\n'),
  ]);
  let call = 0;
  mock.method(axios, 'get', async () =>
    ++call === 1
      ? {
          status: 200,
          data: pdf,
          headers: { 'content-type': 'application/pdf' },
        }
      : {
          status: 200,
          data: Buffer.from('<html>expired</html>'),
          headers: { 'content-type': 'text/html' },
        },
  );
  try {
    const { transport } = createNodePortalTransport();
    const result = await transport.request({
      path: '/file.pdf',
      responseType: 'pdf',
    });
    assert.equal(result.body, '');
    assert.deepEqual(Buffer.from(result.pdfBase64, 'base64'), pdf);
    assert.equal(result.contentType, 'application/pdf');
    assert.equal(
      (await transport.request({ path: '/file.pdf', responseType: 'pdf' }))
        .body,
      '<html>expired</html>',
    );
  } finally {
    mock.restoreAll();
  }
});

test('untrusted origins never receive a request', async () => {
  const get = mock.method(axios, 'get', async () => {
    throw new Error('should not send');
  });
  try {
    const { transport } = createNodePortalTransport();
    for (const path of [
      'https://other.example/file.pdf',
      '//other.example/file.pdf',
      'https://user:password@www.alunoonline.uerj.br/file.pdf',
    ])
      await assert.rejects(
        transport.request({ path, responseType: 'pdf' }),
        /UNEXPECTED_ORIGIN/,
      );
    assert.equal(get.mock.callCount(), 0);
  } finally {
    mock.restoreAll();
  }
});

test('oversized PDFs and unsupported PDF MIME types are rejected', async () => {
  let call = 0;
  const oversized = Buffer.alloc(20 * 1024 * 1024 + 1);
  oversized.write('%PDF-');
  mock.method(axios, 'get', async () =>
    ++call === 1
      ? {
          status: 200,
          data: oversized,
          headers: { 'content-type': 'application/pdf' },
        }
      : {
          status: 200,
          data: Buffer.from('%PDF-1.7\n%%EOF\n'),
          headers: { 'content-type': 'image/png' },
        },
  );
  try {
    const { transport } = createNodePortalTransport();
    await assert.rejects(
      transport.request({ path: '/large.pdf', responseType: 'pdf' }),
      /PORTAL_LAYOUT_CHANGED/,
    );
    await assert.rejects(
      transport.request({ path: '/wrong.pdf', responseType: 'pdf' }),
      /PORTAL_LAYOUT_CHANGED/,
    );
  } finally {
    mock.restoreAll();
  }
});

test('truncated PDFs never become ready even when an earlier revision had an EOF', async () => {
  const bodies = [
    '%PDF-1.7\nunfinished stream',
    '%PDF-1.7\n%%EO',
    '%PDF-1.7\n%%EOF\nupdated object without a final marker',
    '%PDF-1.7\n%%EOF\v',
  ];
  mock.method(axios, 'get', async () => ({
    status: 200,
    data: Buffer.from(bodies.shift()),
    headers: { 'content-type': 'application/pdf' },
  }));
  try {
    const { transport } = createNodePortalTransport();
    while (bodies.length)
      await assert.rejects(
        transport.request({ path: '/truncated.pdf', responseType: 'pdf' }),
        /PORTAL_LAYOUT_CHANGED/,
      );
  } finally {
    mock.restoreAll();
  }
});

test('complete incremental PDFs and all permitted trailing whitespace preserve exact bytes', async () => {
  const pdf = Buffer.concat([
    Buffer.from('%PDF-1.7\n%%EOF\nupdated object\n%%EOF'),
    Buffer.from([0, 9, 10, 12, 13, 32]),
  ]);
  mock.method(axios, 'get', async () => ({
    status: 200,
    data: pdf,
    headers: { 'content-type': 'application/octet-stream' },
  }));
  try {
    const { transport } = createNodePortalTransport();
    const result = await transport.request({
      path: '/incremental.pdf',
      responseType: 'pdf',
    });
    assert.deepEqual(Buffer.from(result.pdfBase64, 'base64'), pdf);
  } finally {
    mock.restoreAll();
  }
});

test('a high-bit prefix cannot be mistaken for the binary PDF signature', async () => {
  mock.method(axios, 'get', async () => ({
    status: 200,
    data: Buffer.concat([
      Buffer.from([0xa5, 0xd0, 0xc4, 0xc6, 0xad]),
      Buffer.from('1.7\n%%EOF'),
    ]),
    headers: { 'content-type': 'application/pdf' },
  }));
  try {
    const { transport } = createNodePortalTransport();
    const result = await transport.request({
      path: '/invalid.pdf',
      responseType: 'pdf',
    });
    assert.equal(result.pdfBase64, undefined);
  } finally {
    mock.restoreAll();
  }
});
