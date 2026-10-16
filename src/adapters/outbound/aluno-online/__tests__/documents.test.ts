import { AppError } from '@root/shared/errors/AppError';
import { createAlunoOnlineAdapter } from '../createAlunoOnlineAdapter';
import type {
  PortalRequest,
  PortalResponse,
  PortalTransport,
} from '../contracts';
import { loadHtml } from '../html';
import {
  parseDocumentCatalog,
  parseDocumentPdfPath,
} from '../parsers/Documents';
import { documentCatalog, documentViewer } from '../__fixtures__/documentPages';
import { loginPage, studentHeader } from '../__fixtures__/loginPages';

const credentials = {
  matricula: 'synthetic-account',
  password: 'synthetic-password',
};
const expired =
  '<div class="topo">ALUNO ONLINE</div><div class="conteudo">Página não encontrada!</div>';
const html = (body: string): PortalResponse => ({ status: 200, body });
const pdf = {
  status: 200,
  body: '',
  pdfBase64: 'JVBERi0xLjQKJSBzeW50aGV0aWMK',
  contentType: 'application/pdf',
};

function setup() {
  let generation = 0;
  let revision = 'synthetic-document';
  let handler:
    | ((
        request: PortalRequest,
      ) => PortalResponse | Promise<PortalResponse> | undefined)
    | undefined;
  const transport: PortalTransport = {
    cancelAndDrain: jest.fn(async () => undefined),
    request: jest.fn(async request => {
      if (request.path === '/') return html('Portal');
      if (request.params?.senha) {
        generation += 1;
        return html(
          `${studentHeader}<div id="menu_linha_item"><a onclick="go('synthetic_documents_menu_${generation}')">Emissão de Documentos</a></div>`,
        );
      }
      if (request.path === '/requisicaoaluno/' && !request.params)
        return html(loginPage);
      const intercepted = await handler?.(request);
      if (intercepted) return intercepted;
      if (request.responseType === 'pdf' && request.path.startsWith('/tmp/'))
        return pdf;
      if (request.method === 'POST') {
        if (request.params?.requisicao?.includes('action_2')) {
          revision = '';
          return html('<p>Solicitação processada</p>');
        }
        return html(documentViewer);
      }
      return html(documentCatalog({ generation, revision }));
    }),
  };
  const adapter = createAlunoOnlineAdapter({
    transport,
    cookies: { clear: jest.fn(async () => undefined) },
    readCredentials: async () => credentials,
  });
  return {
    ...adapter,
    transport,
    setHandler(value: typeof handler) {
      handler = value;
    },
    changeRevision(value: string) {
      revision = value;
    },
    posts: () =>
      jest
        .mocked(transport.request)
        .mock.calls.map(([r]) => r)
        .filter(r => r.method === 'POST'),
  };
}

it('reads available types, existing validity and actions without leaking form secrets', () => {
  const catalog = parseDocumentCatalog(loadHtml(documentCatalog()));
  expect(catalog.entries.map(item => item.document)).toEqual([
    {
      id: '5:0:0',
      title: 'Declaração de Matrícula',
      validUntil: null,
      hasExistingDocument: false,
      canIssue: true,
      canDelete: false,
      revision: null,
    },
    {
      id: '8:0:synthetic-document',
      title: 'Histórico Escolar',
      validUntil: '31/12/2030',
      hasExistingDocument: true,
      canIssue: true,
      canDelete: true,
      revision: 'synthetic-document',
    },
  ]);
});

it('distinguishes an empty catalog from an unrelated or malformed portal page', () => {
  expect(
    parseDocumentCatalog(loadHtml(documentCatalog({ empty: true }))).entries,
  ).toEqual([]);
  expect(() => parseDocumentCatalog(loadHtml('<p>Manutenção</p>'))).toThrow(
    'PORTAL_LAYOUT_CHANGED',
  );
  expect(() =>
    parseDocumentCatalog(
      loadHtml(documentCatalog().replace('enviarRequisicao', 'changedForm')),
    ),
  ).toThrow('PORTAL_LAYOUT_CHANGED');
});

it('keeps separate versions under a rowspan and gives them session-independent identities', () => {
  const revisions = ['synthetic-document', 'synthetic-older-document'];
  const first = parseDocumentCatalog(loadHtml(documentCatalog({ revisions })));
  const refreshed = parseDocumentCatalog(
    loadHtml(documentCatalog({ revisions, generation: 2 })),
  );
  expect(first.entries.slice(1).map(entry => entry.document)).toEqual([
    expect.objectContaining({
      id: '8:0:synthetic-document',
      title: 'Histórico Escolar',
      revision: 'synthetic-document',
      canIssue: true,
      canDelete: true,
    }),
    expect.objectContaining({
      id: '8:0:synthetic-older-document',
      title: 'Histórico Escolar',
      revision: 'synthetic-older-document',
      canIssue: true,
      canDelete: true,
    }),
  ]);
  expect(refreshed.entries.map(entry => entry.document.id)).toEqual(
    first.entries.map(entry => entry.document.id),
  );
});

it('rejects two action rows for the same version instead of choosing an arbitrary action', () => {
  expect(() =>
    parseDocumentCatalog(
      loadHtml(
        documentCatalog({
          revisions: ['synthetic-document', 'synthetic-document'],
        }),
      ),
    ),
  ).toThrow('PORTAL_LAYOUT_CHANGED');
});

it('does not silently hide a document when its action link changes structure', () => {
  expect(() =>
    parseDocumentCatalog(
      loadHtml(documentCatalog().replace('onclick=', 'data-onclick=')),
    ),
  ).toThrow('PORTAL_LAYOUT_CHANGED');
});

it('allows cosmetic helper links outside document action rows', () => {
  const catalog = documentCatalog();
  const withHelp = catalog.replace(
    '</form>',
    '<table><tr><td><a href="/ajuda">Ajuda</a></td></tr></table></form>',
  );
  expect(parseDocumentCatalog(loadHtml(withHelp))).toEqual(
    parseDocumentCatalog(loadHtml(catalog)),
  );
});

it('does not attach an action to the previous title without an active rowspan', () => {
  expect(() =>
    parseDocumentCatalog(
      loadHtml(
        documentCatalog().replace('<td rowspan="1">Histórico Escolar</td>', ''),
      ),
    ),
  ).toThrow('PORTAL_LAYOUT_CHANGED');
});

it('does not attach later versions to a title after its rowspan ends', () => {
  expect(() =>
    parseDocumentCatalog(
      loadHtml(
        documentCatalog({
          revisions: ['first-version', 'second-version', 'third-version'],
        }).replace('rowspan="3"', 'rowspan="2"'),
      ),
    ),
  ).toThrow('PORTAL_LAYOUT_CHANGED');
});

it('rejects an incomplete group of document versions', () => {
  expect(() =>
    parseDocumentCatalog(
      loadHtml(documentCatalog().replace('rowspan="1"', 'rowspan="2"')),
    ),
  ).toThrow('PORTAL_LAYOUT_CHANGED');
});

it.each([
  'https://attacker.example/tmp/doc.pdf',
  '//attacker.example/tmp/doc.pdf',
  '../tmp/../../secret.pdf',
  '../tmp/doc.pdf?token=private',
  // oxlint-disable-next-line no-script-url -- malicious portal fixture must be rejected
  'javascript:alert(1)',
  '/different/doc.pdf',
])('rejects an unsafe PDF destination: %s', path => {
  expect(() =>
    parseDocumentPdfPath(loadHtml(`<iframe src="${path}"></iframe>`)),
  ).toThrow('PORTAL_LAYOUT_CHANGED');
});

it('resolves session form tokens, POSTs exactly once, then downloads the official PDF', async () => {
  const app = setup();
  const result = await app.documents.issue('8:0:synthetic-document');
  expect(result).toEqual({
    base64: pdf.pdfBase64,
    filename: 'documento-uerj-8-0.pdf',
    mimeType: 'application/pdf',
  });
  expect(app.posts()).toHaveLength(1);
  expect(app.posts()[0].params).toEqual({
    requisicao: 'synthetic_action_1_1',
    identificacaoDocumento: 'synthetic-document',
    opcao: '8',
    subOpcaoDocumento: '0',
    _token: 'document-token-1',
  });
  expect(app.transport.request).toHaveBeenLastCalledWith(
    expect.objectContaining({
      path: '/tmp/synthetic-document.pdf',
      responseType: 'pdf',
    }),
  );
});

it('refreshes an expired catalog and derives new action tokens before issuing', async () => {
  const app = setup();
  app.setHandler(request =>
    request.params?.requisicao === 'synthetic_documents_menu_1'
      ? html(expired)
      : undefined,
  );
  await app.documents.issue('5:0:0');
  expect(app.posts()[0].params).toMatchObject({
    requisicao: 'synthetic_action_1_2',
    _token: 'document-token-2',
  });
  expect(app.posts()).toHaveLength(1);
});

it('issues the selected version when multiple rows have the same document type', async () => {
  const app = setup();
  app.setHandler(request =>
    request.params?.requisicao?.startsWith('synthetic_documents_menu_')
      ? html(
          documentCatalog({
            revisions: ['synthetic-document', 'synthetic-older-document'],
          }),
        )
      : undefined,
  );
  await app.documents.issue('8:0:synthetic-older-document');
  expect(app.posts()).toHaveLength(1);
  expect(app.posts()[0].params).toMatchObject({
    identificacaoDocumento: 'synthetic-older-document',
    opcao: '8',
    subOpcaoDocumento: '0',
  });
});

it('does not start a PDF request while a refresh triggered during the POST is replacing cookies', async () => {
  const app = setup();
  let finishPost!: (response: PortalResponse) => void;
  let started!: () => void;
  const posting = new Promise<void>(resolve => {
    started = resolve;
  });
  app.setHandler(request => {
    if (request.method !== 'POST') return;
    started();
    return new Promise<PortalResponse>(resolve => {
      finishPost = resolve;
    });
  });
  const issuing = app.documents.issue('8:0:synthetic-document');
  const outcome = issuing.catch(error => error);
  await posting;
  const refreshing = app.authentication.refresh();
  finishPost(html(documentViewer));
  await refreshing;
  expect(await outcome).toMatchObject({ code: 'SESSION_CHANGED' });
  expect(app.posts()).toHaveLength(1);
  expect(
    jest
      .mocked(app.transport.request)
      .mock.calls.some(([request]) => request.path.startsWith('/tmp/')),
  ).toBe(false);
  expect(app.diagnostics.snapshot().sessionGeneration).toBe(2);
});

it.each(['NETWORK', 'SESSION_EXPIRED'] as const)(
  'never replays an emission after %s',
  async code => {
    const app = setup();
    app.setHandler(request => {
      if (request.method !== 'POST') return;
      if (code === 'NETWORK') throw new AppError(code);
      return html(expired);
    });
    await expect(app.documents.issue('5:0:0')).rejects.toMatchObject({ code });
    expect(app.posts()).toHaveLength(1);
  },
);

it('does not return an HTML login page as a PDF', async () => {
  const app = setup();
  app.setHandler(request =>
    request.path.startsWith('/tmp/') ? html(expired) : undefined,
  );
  await expect(
    app.documents.issue('8:0:synthetic-document'),
  ).rejects.toMatchObject({
    code: 'SESSION_EXPIRED',
  });
  expect(app.posts()).toHaveLength(1);
});

it('checks the selected revision before deleting and confirms removal with a new read', async () => {
  const app = setup();
  await app.documents.remove({
    id: '8:0:synthetic-document',
    revision: 'synthetic-document',
  });
  expect(app.posts()).toHaveLength(1);
  expect(app.posts()[0].params?.requisicao).toBe('synthetic_action_2_1');
  expect(app.transport.request).toHaveBeenLastCalledWith(
    expect.objectContaining({
      params: expect.objectContaining({
        requisicao: 'synthetic_documents_menu_1',
      }),
    }),
  );
  await expect(app.documents.list()).resolves.toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: '8:0:0', hasExistingDocument: false }),
    ]),
  );
});

it('refuses to delete a newer revision that the user did not confirm', async () => {
  const app = setup();
  app.changeRevision('synthetic-newer-document');
  await expect(
    app.documents.remove({
      id: '8:0:synthetic-document',
      revision: 'synthetic-document',
    }),
  ).rejects.toMatchObject({ code: 'DOCUMENT_CHANGED' });
  expect(app.posts()).toHaveLength(0);
});

it('confirms removal of one revision while preserving another revision of the same type', async () => {
  const app = setup();
  let revisions = ['synthetic-document', 'synthetic-older-document'];
  app.setHandler(request => {
    if (request.params?.requisicao?.startsWith('synthetic_documents_menu_'))
      return html(documentCatalog({ revisions }));
    if (request.method === 'POST') {
      revisions = revisions.filter(
        revision => revision !== request.params?.identificacaoDocumento,
      );
      return html('<p>Solicitação processada</p>');
    }
  });
  await app.documents.remove({
    id: '8:0:synthetic-document',
    revision: 'synthetic-document',
  });
  expect(app.posts()).toHaveLength(1);
  const catalog = await app.documents.list();
  expect(catalog.map(document => document.id)).toEqual([
    '5:0:0',
    '8:0:synthetic-older-document',
  ]);
  expect(catalog[1]).toMatchObject({
    title: 'Histórico Escolar',
    hasExistingDocument: true,
    revision: 'synthetic-older-document',
  });
});

it('does not treat a successful HTTP status as proof of deletion', async () => {
  const app = setup();
  app.setHandler(request =>
    request.method === 'POST' ? html('<p>Processado</p>') : undefined,
  );
  await expect(
    app.documents.remove({
      id: '8:0:synthetic-document',
      revision: 'synthetic-document',
    }),
  ).rejects.toMatchObject({ code: 'DOCUMENT_NOT_REMOVED' });
  expect(app.posts()).toHaveLength(1);
});

it.each(['onclick', 'href'])(
  'does not confirm deletion when a malformed row with %s actions hid the unchanged document',
  async attribute => {
    const app = setup();
    let attempted = false;
    app.setHandler(request => {
      if (request.method === 'POST') {
        attempted = true;
        return html('<p>Solicitação não concluída</p>');
      }
      if (
        attempted &&
        request.params?.requisicao?.startsWith('synthetic_documents_menu_')
      ) {
        const catalog = documentCatalog().replace(
          '<td rowspan="1">Histórico Escolar</td>',
          '<td rowspan="1">Histórico Escolar</td><td>Coluna nova</td>',
        );
        const historyStart = catalog.indexOf('<td rowspan="1">Histórico');
        return html(
          catalog.slice(0, historyStart) +
            catalog.slice(historyStart).replaceAll('onclick=', `${attribute}=`),
        );
      }
    });
    await expect(
      app.documents.remove({
        id: '8:0:synthetic-document',
        revision: 'synthetic-document',
      }),
    ).rejects.toMatchObject({ code: 'PORTAL_LAYOUT_CHANGED' });
    expect(app.posts()).toHaveLength(1);
  },
);

it.each(['button', 'input', 'span', 'nested table'])(
  'does not confirm deletion when an unchanged document uses unsupported %s controls',
  async control => {
    const app = setup();
    let attempted = false;
    app.setHandler(request => {
      if (request.method === 'POST') {
        attempted = true;
        return html('<p>Solicitação não concluída</p>');
      }
      if (
        attempted &&
        request.params?.requisicao?.startsWith('synthetic_documents_menu_')
      ) {
        const catalog = documentCatalog();
        const historyStart = catalog.indexOf('<td rowspan="1">Histórico');
        const history = catalog
          .slice(historyStart)
          .replace(
            /<a href="#" onclick="([^"]+)"><img src="([^"]+)"><\/a>/g,
            (link, onclick: string, source: string) => {
              if (control === 'nested table')
                return `<table><tr><td>${link}</td></tr></table>`;
              if (control === 'input')
                return `<input type="button" onclick="${onclick}">`;
              return `<${control} onclick="${onclick}"><img src="${source}"></${control}>`;
            },
          );
        return html(catalog.slice(0, historyStart) + history);
      }
    });
    await expect(
      app.documents.remove({
        id: '8:0:synthetic-document',
        revision: 'synthetic-document',
      }),
    ).rejects.toMatchObject({ code: 'PORTAL_LAYOUT_CHANGED' });
    expect(app.posts()).toHaveLength(1);
  },
);

it('does not confirm deletion when the identifier remains but every action disappears', async () => {
  const app = setup();
  let attempted = false;
  app.setHandler(request => {
    if (request.method === 'POST') {
      attempted = true;
      return html('<p>Solicitação não concluída</p>');
    }
    if (
      attempted &&
      request.params?.requisicao?.startsWith('synthetic_documents_menu_')
    ) {
      const catalog = documentCatalog();
      const historyStart = catalog.indexOf('<td rowspan="1">Histórico');
      return html(
        catalog.slice(0, historyStart) +
          catalog.slice(historyStart).replace(/<a [^>]+>.*?<\/a>/g, ''),
      );
    }
  });
  await expect(
    app.documents.remove({
      id: '8:0:synthetic-document',
      revision: 'synthetic-document',
    }),
  ).rejects.toMatchObject({ code: 'DOCUMENT_NOT_REMOVED' });
  expect(app.posts()).toHaveLength(1);
  await expect(app.documents.list()).resolves.toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        title: 'Histórico Escolar',
        revision: 'synthetic-document',
        hasExistingDocument: true,
        canIssue: false,
        canDelete: false,
      }),
    ]),
  );
});

it('rejects an ambiguous textual identifier instead of guessing an absent document', () => {
  const catalog = documentCatalog({ revision: 'identifier changed format' });
  const historyStart = catalog.indexOf('<td rowspan="1">Histórico');
  expect(() =>
    parseDocumentCatalog(
      loadHtml(
        catalog.slice(0, historyStart) +
          catalog.slice(historyStart).replace(/<a [^>]+>.*?<\/a>/g, ''),
      ),
    ),
  ).toThrow('PORTAL_LAYOUT_CHANGED');
});

it('rejects duplicate actions and discards a late PDF after logout', async () => {
  const app = setup();
  let finish!: (response: PortalResponse) => void;
  let started!: () => void;
  const downloading = new Promise<void>(resolve => {
    started = resolve;
  });
  app.setHandler(request => {
    if (!request.path.startsWith('/tmp/')) return;
    started();
    return new Promise<PortalResponse>(resolve => {
      finish = resolve;
    });
  });
  const first = app.documents.issue('8:0:synthetic-document');
  const outcome = first.catch(error => error);
  await downloading;
  await expect(
    app.documents.issue('8:0:synthetic-document'),
  ).rejects.toMatchObject({
    code: 'CANCELLED',
  });
  await app.authentication.signOut();
  finish(pdf);
  expect(await outcome).toMatchObject({ code: 'CANCELLED' });
  expect(app.posts()).toHaveLength(1);
});
