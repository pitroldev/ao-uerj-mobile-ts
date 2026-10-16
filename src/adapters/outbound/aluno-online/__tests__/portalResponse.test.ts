import { decodePortalResponse, MAX_DOCUMENT_BYTES } from '../portalResponse';

// The independent oracle runs only in Node's Jest environment, never in the app.
const { Buffer } = require('node:buffer') as {
  Buffer: { from(bytes: Uint8Array): { toString(encoding: 'base64'): string } };
};

const pdf = new Uint8Array([
  0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0x00, 0x80, 0xff, 0x0a,
  0x25, 0x25, 0x45, 0x4f, 0x46, 0x0a,
]);
const pdfFooter = pdf.subarray(12);

it.each([
  'application/pdf',
  'application/octet-stream',
  'APPLICATION/PDF; charset=binary',
])('keeps binary PDF data intact with %s', contentType => {
  const result = decodePortalResponse(200, pdf, contentType, 'pdf');
  expect(result.pdfBase64).toBe('JVBERi0xLjcKAID/CiUlRU9GCg==');
  expect(result.body).toBe('');
});

describe('binary encoding without browser globals', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'btoa');
  beforeEach(() => {
    Object.defineProperty(globalThis, 'btoa', {
      configurable: true,
      value: undefined,
    });
  });
  afterEach(() => {
    if (original) Object.defineProperty(globalThis, 'btoa', original);
    else Reflect.deleteProperty(globalThis, 'btoa');
  });

  it.each([19, 20, 21, 24_575, 24_576, 24_577, 24_578, 49_153])(
    'encodes %i bytes with the right padding across chunk boundaries',
    length => {
      const bytes = Uint8Array.from({ length }, (_, index) => index % 256);
      bytes.set(pdf);
      bytes.set(pdfFooter, bytes.length - pdfFooter.length);
      const result = decodePortalResponse(200, bytes, 'application/pdf', 'pdf');
      expect(result.pdfBase64).toBe(Buffer.from(bytes).toString('base64'));
    },
  );

  it('preserves every byte of a PDF at the 20 MiB limit without btoa', () => {
    const bytes = new Uint8Array(MAX_DOCUMENT_BYTES);
    for (let index = 0; index < bytes.length; index += 1)
      bytes[index] = index % 256;
    bytes.set(pdf);
    bytes.set(pdfFooter, bytes.length - pdfFooter.length);

    const result = decodePortalResponse(200, bytes, 'application/pdf', 'pdf');

    expect(result.pdfBase64).toBe(Buffer.from(bytes).toString('base64'));
    expect(result.pdfBase64?.length).toBe(4 * Math.ceil(bytes.length / 3));
  });

  it('encodes only the visible bytes of a typed-array view', () => {
    const allocation = new Uint8Array(100);
    allocation.fill(0xff);
    allocation.set(pdf, 9);
    const bytes = allocation.subarray(9, 9 + pdf.length);
    expect(
      decodePortalResponse(200, bytes, 'application/pdf', 'pdf').pdfBase64,
    ).toBe('JVBERi0xLjcKAID/CiUlRU9GCg==');
  });
});

it('recognizes the HTML error response even with a misleading PDF content type', () => {
  expect(
    decodePortalResponse(
      200,
      new Uint8Array([0x61, 0xe7, 0xe3, 0x6f]),
      'application/pdf',
      'pdf',
    ),
  ).toEqual({
    status: 200,
    body: 'ação',
    contentType: 'application/pdf',
  });
});

it('rejects oversized downloads before encoding their body', () => {
  const oversized = new Uint8Array(MAX_DOCUMENT_BYTES + 1);
  oversized.set(pdf);
  expect(() =>
    decodePortalResponse(200, oversized, 'application/pdf', 'pdf'),
  ).toThrow('PORTAL_LAYOUT_CHANGED');
});

it('rejects a PDF served under an unexpected MIME type', () => {
  expect(() => decodePortalResponse(200, pdf, 'image/png', 'pdf')).toThrow(
    'PORTAL_LAYOUT_CHANGED',
  );
});

it.each([5, 12, 17])(
  'rejects a truncated PDF of %i bytes instead of offering a broken download',
  length => {
    expect(() =>
      decodePortalResponse(
        200,
        pdf.subarray(0, length),
        'application/pdf',
        'pdf',
      ),
    ).toThrow('PORTAL_LAYOUT_CHANGED');
  },
);

it('accepts a final EOF without newline and with permitted trailing PDF whitespace', () => {
  for (const bytes of [
    pdf.subarray(0, pdf.length - 1),
    new Uint8Array([...pdf, 0, 9, 10, 12, 13, 32]),
  ]) {
    expect(
      decodePortalResponse(200, bytes, 'application/pdf', 'pdf').pdfBase64,
    ).toBe(Buffer.from(bytes).toString('base64'));
  }
});

it('accepts completed incremental PDF updates and rejects an interrupted update', () => {
  const complete = new Uint8Array([...pdf, 0x31, 0x32, 0x33, ...pdfFooter]);
  expect(
    decodePortalResponse(200, complete, 'application/pdf', 'pdf').pdfBase64,
  ).toBe(Buffer.from(complete).toString('base64'));
  expect(() =>
    decodePortalResponse(
      200,
      complete.subarray(0, complete.length - pdfFooter.length),
      'application/pdf',
      'pdf',
    ),
  ).toThrow('PORTAL_LAYOUT_CHANGED');
});
