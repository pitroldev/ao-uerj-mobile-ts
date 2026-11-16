import { fromBase64 } from '@root/modules/trust/domain/bytes';
import { createDemoClock } from '../clock';
import { createDemoDocuments } from '../ports/documents';

const NOW = new Date(2026, 11, 25, 10, 0);

function documents(now = NOW) {
  return createDemoDocuments(createDemoClock(() => now.getTime(), 0));
}

function decode(base64: string) {
  const bytes = fromBase64(base64);
  if (!bytes) throw new Error('base64 inválido');
  return String.fromCharCode(...bytes);
}

describe('demo documents', () => {
  it('lists four documents, two already issued, with dates from the clock', async () => {
    const list = await documents().list();
    expect(list).toHaveLength(4);
    list.forEach(item => {
      // o formato de id que o adaptador real aceita
      expect(item.id).toMatch(/^\d+:\d+:[\w.-]+$/);
      expect(item.canIssue).toBe(true);
      expect(item.hasExistingDocument).toBe(item.revision !== null);
      expect(item.canDelete).toBe(item.hasExistingDocument);
    });
    const issued = list.filter(item => item.hasExistingDocument);
    expect(issued).toHaveLength(2);
    issued.forEach(item => expect(item.validUntil).toMatch(/\/2027$/));
  });

  it('issues a valid one-page PDF saying it is a demonstration', async () => {
    const port = documents();
    const [first] = await port.list();
    const pdf = await port.issue(first.id);
    expect(pdf.mimeType).toBe('application/pdf');
    expect(pdf.filename).toMatch(/^documento-demo-\d+-\d+\.pdf$/);
    const text = decode(pdf.base64);
    expect(text.startsWith('%PDF-')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(text).toContain('Conta de demonstra\\347\\343o');
    expect(text).toContain('Documento fict\\355cio, sem valor');
    expect(text).toContain('/Count 1');
    // só ASCII: os acentos vão em octal
    expect(fromBase64(pdf.base64)?.every(byte => byte < 128)).toBe(true);

    // a xref aponta para cada objeto e o startxref para a xref
    const start = Number(/startxref\n(\d+)\n%%EOF/.exec(text)?.[1]);
    expect(text.slice(start, start + 4)).toBe('xref');
    const [, count] = /^xref\n0 (\d+)\n/.exec(text.slice(start)) ?? [];
    const entries = text
      .slice(start)
      .split('\n')
      .slice(2, 2 + Number(count));
    expect(entries[0]).toBe('0000000000 65535 f ');
    entries.slice(1).forEach((entry, index) => {
      expect(entry).toMatch(/^\d{10} 00000 n $/);
      const offset = Number(entry.slice(0, 10));
      expect(text.slice(offset).startsWith(`${index + 1} 0 obj`)).toBe(true);
    });
    // o tamanho do conteúdo confere com o /Length
    const length = Number(/\/Length (\d+)/.exec(text)?.[1]);
    const body = text.slice(text.indexOf('stream\n') + 7);
    expect(body.indexOf('\nendstream')).toBe(length);
  });

  it('marks the issued document with a new revision and validity', async () => {
    const port = documents();
    const [first] = await port.list();
    expect(first.hasExistingDocument).toBe(false);
    await port.issue(first.id);
    const [after] = await port.list();
    expect(after).toMatchObject({
      title: first.title,
      hasExistingDocument: true,
      canDelete: true,
      validUntil: '24/01/2027',
    });
    await expect(port.issue('1:0:0')).rejects.toMatchObject({
      code: 'DOCUMENT_UNAVAILABLE',
    });
  });

  it('removes only the revision the student saw', async () => {
    const port = documents();
    const issued = (await port.list()).find(item => item.hasExistingDocument)!;
    await expect(
      port.remove({ id: issued.id, revision: 'outra' }),
    ).rejects.toMatchObject({ code: 'DOCUMENT_CHANGED' });
    await port.remove(issued);
    const list = await port.list();
    expect(list.some(item => item.id === issued.id)).toBe(false);
    expect(list.find(item => item.title === issued.title)).toMatchObject({
      hasExistingDocument: false,
      validUntil: null,
    });
    await expect(port.remove(issued)).rejects.toMatchObject({
      code: 'DOCUMENT_CHANGED',
    });
  });

  it('cancels and returns copies', async () => {
    const port = documents();
    const controller = new AbortController();
    controller.abort();
    await expect(
      port.list({ signal: controller.signal }),
    ).rejects.toMatchObject({ code: 'CANCELLED' });
    await expect(
      port.issue('5:0:0', { signal: controller.signal }),
    ).rejects.toMatchObject({ code: 'CANCELLED' });
    // o cancelado não emitiu nada
    expect((await port.list())[0].hasExistingDocument).toBe(false);
    const list = await port.list();
    list[0].title = 'mudado';
    expect((await port.list())[0].title).not.toBe('mudado');
  });
});
