import React from 'react';
import { act, screen, userEvent, waitFor } from '@testing-library/react-native';
import { onlineManager } from '@tanstack/react-query';
import { AppError } from '@root/shared/errors/AppError';
import {
  createTestQueryClient,
  renderWithProviders,
} from '@root/test-utils/render';
import type {
  DocumentPdf,
  StudentDocument,
} from '@root/modules/documents/domain/models';
import type { SavedDocumentsPort } from '@root/modules/documents/application/ports';
import { PortalMonitor } from '@root/modules/connectivity/application/PortalMonitor';
import { PortalStatusProvider } from '@root/modules/connectivity/presentation/PortalStatusContext';
import { DocumentsPage } from '../Documents';

const mockDocuments = { list: jest.fn(), issue: jest.fn(), remove: jest.fn() };
const mockSharing = { share: jest.fn() };
/** PDFs guardados no aparelho (o cofre do Android); `null` como no iOS. */
let mockSaved: SavedDocumentsPort | null = null;
let mockFocused = true;
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => mockFocused,
}));
jest.mock('@root/app/providers/AppServicesProvider', () => ({
  useIdentity: () => ({
    status: 'signedIn',
    account: { scope: 'a', period: '2026.2', name: 'Marina' },
  }),
  useAppServices: () => ({
    documents: mockDocuments,
    documentSharing: mockSharing,
    savedDocuments: mockSaved,
  }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const REGULAR: StudentDocument = {
  id: 'regular',
  title: 'Declaração de aluno regular',
  validUntil: '16/11/2026',
  hasExistingDocument: true,
  canIssue: true,
  canDelete: true,
  revision: 'revision-1',
};
const HISTORY: StudentDocument = {
  id: 'history',
  title: 'Histórico escolar',
  validUntil: null,
  hasExistingDocument: false,
  canIssue: true,
  canDelete: false,
  revision: null,
};
const PDF: DocumentPdf = {
  base64: 'JVBERi0=',
  filename: 'documento.pdf',
  mimeType: 'application/pdf',
};
function mount(theme: 'light' | 'dark' = 'light') {
  return renderWithProviders(<DocumentsPage />, {
    theme,
    queryClient: createTestQueryClient(),
  });
}
beforeEach(() => {
  mockFocused = true;
  mockSaved = null;
  onlineManager.setOnline(true);
  mockDocuments.list.mockReset().mockResolvedValue([REGULAR, HISTORY]);
  mockDocuments.issue.mockReset().mockResolvedValue(PDF);
  mockDocuments.remove.mockReset().mockResolvedValue(undefined);
  mockSharing.share.mockReset().mockResolvedValue(undefined);
});
afterEach(() => {
  onlineManager.setOnline(true);
});

it.each(['light', 'dark'] as const)(
  'shows the official catalogue and only available actions in %s theme',
  async theme => {
    await mount(theme);
    expect(await screen.findByText(REGULAR.title)).toBeOnTheScreen();
    expect(screen.getByText('Válido até 16/11/2026')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: `Obter PDF: ${REGULAR.title}` }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: `Emitir PDF: ${HISTORY.title}` }),
    ).toBeOnTheScreen();
    expect(
      screen.queryByRole('button', {
        name: `Excluir documento: ${HISTORY.title}`,
      }),
    ).not.toBeOnTheScreen();
  },
);

it('shows a skeleton, an empty catalogue and an unavailable type', async () => {
  mockDocuments.list.mockReturnValue(new Promise(() => undefined));
  const first = await mount();
  expect(screen.getByLabelText('Carregando documentos…')).toBeBusy();
  await first.unmount();
  mockDocuments.list.mockResolvedValue([]);
  const second = await mount();
  expect(
    await screen.findByText('Nenhum documento disponível'),
  ).toBeOnTheScreen();
  await second.unmount();
  mockDocuments.list.mockResolvedValue([{ ...HISTORY, canIssue: false }]);
  await mount();
  expect(
    await screen.findByText('Indisponível para emissão no momento.'),
  ).toBeOnTheScreen();
  expect(
    screen.queryByRole('button', { name: `Emitir PDF: ${HISTORY.title}` }),
  ).not.toBeOnTheScreen();
});

it('retries a failed catalogue load', async () => {
  mockDocuments.list.mockRejectedValueOnce(
    new AppError('PORTAL_LAYOUT_CHANGED'),
  );
  await mount();
  expect(
    await screen.findByText('Não foi possível consultar os documentos'),
  ).toBeOnTheScreen();
  await userEvent
    .setup()
    .press(screen.getByRole('button', { name: 'Tentar novamente' }));
  expect(await screen.findByText(REGULAR.title)).toBeOnTheScreen();
  expect(mockDocuments.list).toHaveBeenCalledTimes(2);
});

it('prepares a PDF, shares it again without reissuing, and retains it on share failure', async () => {
  await mount();
  const user = userEvent.setup();
  await user.press(
    await screen.findByRole('button', { name: `Obter PDF: ${REGULAR.title}` }),
  );
  expect(
    await screen.findByRole('header', { name: 'PDF pronto' }),
  ).toBeOnTheScreen();
  mockSharing.share.mockRejectedValueOnce(new AppError('SERVICE_UNAVAILABLE'));
  await user.press(screen.getByRole('button', { name: 'Compartilhar PDF' }));
  expect(
    await screen.findByText(
      'O serviço está indisponível. Tente novamente mais tarde.',
    ),
  ).toBeOnTheScreen();
  await user.press(screen.getByRole('button', { name: 'Compartilhar PDF' }));
  expect(mockSharing.share).toHaveBeenCalledTimes(2);
  expect(mockSharing.share).toHaveBeenLastCalledWith(PDF);
  expect(mockDocuments.issue).toHaveBeenCalledTimes(1);
});

it('requires explicit confirmation to delete the selected document and supports cancellation', async () => {
  await mount();
  const user = userEvent.setup();
  await user.press(
    await screen.findByRole('button', {
      name: `Excluir documento: ${REGULAR.title}`,
    }),
  );
  expect(
    await screen.findByRole('header', { name: 'Excluir documento?' }),
  ).toBeOnTheScreen();
  expect(screen.getByText(/não pode ser desfeita/)).toBeOnTheScreen();
  expect(mockDocuments.remove).not.toHaveBeenCalled();
  await user.press(screen.getByRole('button', { name: 'Cancelar' }));
  expect(mockDocuments.remove).not.toHaveBeenCalled();
  await user.press(
    screen.getByRole('button', { name: `Excluir documento: ${REGULAR.title}` }),
  );
  await user.press(
    screen.getByRole('button', { name: 'Confirmar exclusão do documento' }),
  );
  await waitFor(() =>
    expect(mockDocuments.remove).toHaveBeenCalledWith(
      { id: REGULAR.id, revision: REGULAR.revision },
      { signal: expect.any(AbortSignal) },
    ),
  );
});

it('keeps the confirmation open when deletion fails', async () => {
  mockDocuments.remove.mockRejectedValue(new AppError('NETWORK'));
  await mount();
  const user = userEvent.setup();
  await user.press(
    await screen.findByRole('button', {
      name: `Excluir documento: ${REGULAR.title}`,
    }),
  );
  await user.press(
    screen.getByRole('button', { name: 'Confirmar exclusão do documento' }),
  );
  expect(
    await screen.findByText('Verifique sua conexão e tente novamente.'),
  ).toBeOnTheScreen();
  expect(
    screen.getByRole('header', { name: 'Excluir documento?' }),
  ).toBeOnTheScreen();
  expect(mockDocuments.remove).toHaveBeenCalledTimes(1);
});

it('disables portal actions offline and while a PDF is being prepared', async () => {
  mockDocuments.issue.mockReturnValue(new Promise(() => undefined));
  await mount();
  await screen.findByText(REGULAR.title);
  await act(() => {
    onlineManager.setOnline(false);
  });
  expect(
    screen.getByRole('button', { name: `Obter PDF: ${REGULAR.title}` }),
  ).toBeDisabled();
  await act(() => {
    onlineManager.setOnline(true);
  });
  await userEvent
    .setup()
    .press(screen.getByRole('button', { name: `Obter PDF: ${REGULAR.title}` }));
  expect(
    screen.getByRole('button', { name: `Obter PDF: ${REGULAR.title}` }),
  ).toBeBusy();
  expect(
    screen.getByRole('button', { name: `Emitir PDF: ${HISTORY.title}` }),
  ).toBeDisabled();
  expect(
    screen.getByRole('button', { name: `Excluir documento: ${REGULAR.title}` }),
  ).toBeDisabled();
});

it('aborts a pending PDF on navigation away and ignores its late response', async () => {
  let resolvePdf!: (pdf: DocumentPdf) => void;
  mockDocuments.issue.mockReturnValue(
    new Promise<DocumentPdf>(resolve => {
      resolvePdf = resolve;
    }),
  );
  await mount();
  await userEvent.setup().press(
    await screen.findByRole('button', {
      name: `Obter PDF: ${REGULAR.title}`,
    }),
  );
  const signal = mockDocuments.issue.mock.calls[0][1].signal as AbortSignal;
  mockFocused = false;
  await screen.rerender(<DocumentsPage />);
  expect(signal.aborted).toBe(true);
  await act(() => resolvePdf(PDF));
  expect(screen.queryByRole('header', { name: 'PDF pronto' })).toBeNull();

  mockFocused = true;
  await screen.rerender(<DocumentsPage />);
  await screen.findByText(REGULAR.title);
  expect(screen.queryByRole('header', { name: 'PDF pronto' })).toBeNull();
  expect(mockSharing.share).not.toHaveBeenCalled();
});

it.each(['pdf', 'deletion'] as const)(
  'forgets the %s sheet when leaving the retained drawer route',
  async kind => {
    await mount();
    const label = kind === 'pdf' ? 'Obter PDF' : 'Excluir documento';
    const title = kind === 'pdf' ? 'PDF pronto' : 'Excluir documento?';
    await userEvent.setup().press(
      await screen.findByRole('button', {
        name: `${label}: ${REGULAR.title}`,
      }),
    );
    expect(
      await screen.findByRole('header', { name: title }),
    ).toBeOnTheScreen();

    mockFocused = false;
    await screen.rerender(<DocumentsPage />);
    expect(screen.queryByRole('header', { name: title })).toBeNull();
    mockFocused = true;
    await screen.rerender(<DocumentsPage />);
    await screen.findByText(REGULAR.title);
    expect(screen.queryByRole('header', { name: title })).toBeNull();
    expect(mockDocuments.remove).not.toHaveBeenCalled();
  },
);

function memorySaved(): SavedDocumentsPort {
  let items: Awaited<ReturnType<SavedDocumentsPort['list']>> = [];
  return {
    list: async () => items,
    save: async (_scope, document) => {
      items = [document, ...items.filter(item => item.id !== document.id)];
    },
    remove: async (_scope, id) => {
      items = items.filter(item => item.id !== id);
    },
    clear: async () => {
      items = [];
    },
  };
}

it('keeps a PDF on the device and shares it without internet', async () => {
  mockSaved = memorySaved();
  const user = userEvent.setup();
  await mount();
  await user.press(
    await screen.findByRole('button', { name: `Obter PDF: ${REGULAR.title}` }),
  );
  await user.press(
    await screen.findByRole('button', {
      name: `Guardar no aparelho para usar sem internet: ${REGULAR.title}`,
    }),
  );
  expect(
    await screen.findByText(/^Guardado no aparelho: abre mesmo sem internet/),
  ).toBeOnTheScreen();
  await user.press(screen.getByRole('button', { name: 'Fechar documento' }));
  expect(await screen.findByText('Guardados no aparelho')).toBeOnTheScreen();
  expect(
    screen.getByText(/^Guardado em .* · válido até 16\/11\/2026$/),
  ).toBeOnTheScreen();

  await act(() => onlineManager.setOnline(false));
  await user.press(
    screen.getByRole('button', {
      name: `Compartilhar PDF guardado: ${REGULAR.title}`,
    }),
  );
  expect(mockSharing.share).toHaveBeenCalledWith(PDF);
  await user.press(
    screen.getByRole('button', {
      name: `Apagar do aparelho: ${REGULAR.title}`,
    }),
  );
  await waitFor(() =>
    expect(screen.queryByText('Guardados no aparelho')).not.toBeOnTheScreen(),
  );
});

it('offers to keep PDFs only where the device can encrypt them', async () => {
  const user = userEvent.setup();
  await mount();
  await user.press(
    await screen.findByRole('button', { name: `Obter PDF: ${REGULAR.title}` }),
  );
  expect(await screen.findByText('PDF pronto')).toBeOnTheScreen();
  expect(
    screen.queryByRole('button', {
      name: `Guardar no aparelho para usar sem internet: ${REGULAR.title}`,
    }),
  ).not.toBeOnTheScreen();
});

const SIGNED_IN = { status: 'signedIn' as const, account: null, error: null };

it('holds issuing and deleting while the portal is down', async () => {
  const monitor = new PortalMonitor({
    now: Date.now,
    online: () => true,
    active: () => false,
    probe: async () => 503,
    setTimer: () => null,
    clearTimer: () => undefined,
  });
  await renderWithProviders(
    <PortalStatusProvider
      monitor={monitor}
      identity={{
        subscribe: () => () => undefined,
        getSnapshot: () => SIGNED_IN,
      }}
      alert={null}
    >
      <DocumentsPage />
    </PortalStatusProvider>,
    { queryClient: createTestQueryClient() },
  );
  const issue = await screen.findByRole('button', {
    name: `Obter PDF: ${REGULAR.title}`,
  });
  expect(issue).toBeEnabled();
  await act(() => monitor.failed('unavailable'));
  expect(issue).toBeDisabled();
  expect(
    screen.getByRole('button', { name: `Excluir documento: ${REGULAR.title}` }),
  ).toBeDisabled();
  expect(
    screen.getByText(/^O Aluno Online não está respondendo/),
  ).toBeOnTheScreen();
});
