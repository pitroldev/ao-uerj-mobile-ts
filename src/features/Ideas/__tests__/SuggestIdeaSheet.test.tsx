import React from 'react';
import { fireEvent, screen, userEvent } from '@testing-library/react-native';

import { snackbar } from '@components/ui';
import { Ideas } from '@root/modules/ideas/application/Ideas';
import type { IdeasServerPort } from '@root/modules/ideas/application/ports';
import {
  IdeaError,
  type MyIdea,
  type NewIdea,
  type SimilarIdea,
} from '@root/modules/ideas/domain/ideas';
import { AppError } from '@root/shared/errors/AppError';
import {
  createTestQueryClient,
  renderWithProviders,
} from '@root/test-utils/render';
import { PUBLIC_TEXT, SuggestIdeaSheet } from '../SuggestIdeaSheet';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

let mockServices: { ideas: Ideas };
jest.mock('@root/app/providers/AppServicesProvider', () => ({
  useAppServices: () => mockServices,
  useIdentity: () => ({ account: { scope: 'conta-1' } }),
}));

const TITLE = 'Avisar quando abrir vaga no RID';
const PROBLEM = 'Pedi Cálculo II e fiquei na fila. Abro o portal toda hora.';
const SIMILAR: SimilarIdea = {
  number: 31,
  title: 'Aviso de vaga nas turmas pedidas',
  url: 'https://github.com/o/r/issues/31',
  status: 'planned',
  requests: 4,
};
const SENT: MyIdea = {
  id: 'i1',
  kind: 'sent',
  title: TITLE,
  area: 'rid',
  createdAt: 1,
  status: 'received',
  issue: null,
  requests: 1,
};

let server: jest.Mocked<IdeasServerPort>;
let user: ReturnType<typeof userEvent.setup>;
const onClose = jest.fn();
const onShowMine = jest.fn();

const button = (name: string | RegExp) => screen.getByRole('button', { name });

async function open() {
  await renderWithProviders(
    <SuggestIdeaSheet visible onClose={onClose} onShowMine={onShowMine} />,
    { queryClient: createTestQueryClient() },
  );
}

/** O passo 1 preenchido como o aluno faria. */
async function write() {
  await fireEvent.changeText(
    screen.getByLabelText('Sua ideia em uma frase'),
    TITLE,
  );
  await user.press(screen.getByRole('togglebutton', { name: 'RID' }));
  await fireEvent.changeText(
    screen.getByLabelText('Que problema ela resolve?'),
    PROBLEM,
  );
  await user.press(screen.getByRole('tab', { name: 'Não' }));
}

beforeEach(() => {
  jest.useFakeTimers();
  server = {
    mine: jest.fn(async () => ({ ideas: [], remainingToday: 3 })),
    similar: jest.fn(async (_text: string) => [SIMILAR]),
    submit: jest.fn(async (_idea: NewIdea) => SENT),
    vote: jest.fn(async (issue: number) => ({
      ...SENT,
      id: `issue-${issue}`,
      kind: 'joined' as const,
      title: SIMILAR.title,
      area: null,
      status: 'planned' as const,
      issue: { number: issue, url: SIMILAR.url },
      requests: 5,
    })),
  };
  mockServices = {
    ideas: new Ideas({
      server,
      store: { read: async () => null, write: async () => undefined },
      account: () => ({ scope: 'conta-1' }),
      app: { version: '2.20.0', platform: 'android' },
    }),
  };
  user = userEvent.setup();
});

afterEach(() => {
  jest.useRealTimers();
});

it('asks for what is missing only after "Próximo", and for the contact at once', async () => {
  await open();
  expect(screen.getByText('Passo 1 de 3')).toBeOnTheScreen();
  await fireEvent.changeText(
    screen.getByLabelText('Que problema ela resolve?'),
    'Me chama no @duda',
  );
  expect(
    screen.getByText('Tire o @: a sugestão fica pública.'),
  ).toBeOnTheScreen();
  expect(screen.queryByText('Escolha onde no app.')).toBeNull();
  await user.press(button('Próximo'));
  expect(screen.getByText('Escreva a ideia em uma frase.')).toBeOnTheScreen();
  expect(screen.getByText('Escolha onde no app.')).toBeOnTheScreen();
  expect(server.similar).not.toHaveBeenCalled();
});

it('shows the similar ones, sends "a minha é outra" with them and offers Minhas sugestões', async () => {
  await open();
  await write();
  await user.press(button('Como você imagina (opcional)'));
  await fireEvent.changeText(
    screen.getByLabelText('Como você imagina (opcional)'),
    'Um sino na turma pedida',
  );
  await user.press(button('Próximo'));
  expect(server.similar).toHaveBeenCalledWith(`${TITLE} ${PROBLEM}`, undefined);
  expect(
    await screen.findByText('Já sugeriram algo parecido?'),
  ).toBeOnTheScreen();
  expect(screen.getByText(SIMILAR.title)).toBeOnTheScreen();
  expect(screen.getByText('4 pedidos')).toBeOnTheScreen();
  expect(screen.getByText('Planejada')).toBeOnTheScreen();

  await user.press(button('A minha é outra'));
  // a prévia mostra o que vai ficar público, e o aviso vem antes de enviar
  expect(screen.getByText('Vai ficar pública assim')).toBeOnTheScreen();
  expect(screen.getByText(`[Sugestão] ${TITLE}`)).toBeOnTheScreen();
  expect(screen.getByText('Um sino na turma pedida')).toBeOnTheScreen();
  expect(screen.getByText('RID')).toBeOnTheScreen();
  expect(screen.getByText(PUBLIC_TEXT)).toBeOnTheScreen();

  await user.press(button('Enviar sugestão'));
  expect(server.submit).toHaveBeenCalledWith({
    title: TITLE,
    area: 'rid',
    problem: PROBLEM,
    idea: 'Um sino na turma pedida',
    portal: 'no',
    appVersion: '2.20.0',
    platform: 'android',
    seenSimilar: [31],
  });
  expect(await screen.findByText('Sugestão enviada')).toBeOnTheScreen();
  await user.press(button('Minhas sugestões'));
  expect(onShowMine).toHaveBeenCalledTimes(1);
});

it('joins the similar issue instead of sending another', async () => {
  await open();
  await write();
  await user.press(button('Próximo'));
  await user.press(
    await screen.findByRole('button', {
      name: `É essa: somar meu pedido em ${SIMILAR.title}`,
    }),
  );
  expect(server.vote).toHaveBeenCalledWith(31);
  expect(server.submit).not.toHaveBeenCalled();
  expect(await screen.findByText('Pedido somado')).toBeOnTheScreen();
  expect(screen.getByText('Agora são 5 pedidos.')).toBeOnTheScreen();
});

it('drops a similar issue that closed and goes to the preview', async () => {
  const showError = jest.spyOn(snackbar, 'error');
  server.vote.mockRejectedValueOnce(new IdeaError('gone'));
  await open();
  await write();
  await user.press(button('Próximo'));
  await user.press(
    await screen.findByRole('button', { name: /^É essa: somar meu pedido/ }),
  );
  expect(showError).toHaveBeenCalledWith(
    'Essa sugestão já fechou no GitHub. Se a sua é outra, mande a sua.',
  );
  expect(await screen.findByText('Vai ficar pública assim')).toBeOnTheScreen();
});

it('goes straight to the preview without GitHub on the server', async () => {
  server.similar.mockRejectedValueOnce(new IdeaError('github'));
  await open();
  await write();
  await user.press(button('Próximo'));
  expect(await screen.findByText('Vai ficar pública assim')).toBeOnTheScreen();
  expect(screen.getByText('Passo 3 de 3')).toBeOnTheScreen();
  await user.press(button('Enviar sugestão'));
  expect(server.submit).toHaveBeenCalledWith(
    expect.objectContaining({ seenSimilar: [] }),
  );
});

it('stays on the text when the session fails, with the reason', async () => {
  const showError = jest.spyOn(snackbar, 'error');
  // o banimento chega do cliente com a sessão, com o prazo na mensagem
  server.similar.mockRejectedValueOnce(
    new AppError('STUDENT_BANNED', 'Sua conta está suspensa até 20/11.'),
  );
  await open();
  await write();
  await user.press(button('Próximo'));
  expect(showError).toHaveBeenCalledWith('Sua conta está suspensa até 20/11.');
  expect(screen.getByText('Passo 1 de 3')).toBeOnTheScreen();
});

it('brings back the text with the field the server refused, and the daily limit', async () => {
  const showError = jest.spyOn(snackbar, 'error');
  server.similar.mockResolvedValue([]);
  server.submit
    .mockRejectedValueOnce(new IdeaError('contact', 'title'))
    .mockRejectedValueOnce(new IdeaError('limit'));
  await open();
  await write();
  await user.press(button('Próximo'));
  await user.press(
    await screen.findByRole('button', { name: 'Enviar sugestão' }),
  );
  expect(showError).toHaveBeenLastCalledWith(
    'Tire telefone, e-mail, @ ou link do título: a sugestão fica pública.',
  );
  expect(await screen.findByText('Passo 1 de 3')).toBeOnTheScreen();
  expect(
    screen.getByText(
      'Tire telefone, e-mail, @ ou link: a sugestão fica pública.',
    ),
  ).toBeOnTheScreen();

  await fireEvent.changeText(
    screen.getByLabelText('Sua ideia em uma frase'),
    'Aviso de vaga no RID',
  );
  await user.press(button('Próximo'));
  await user.press(
    await screen.findByRole('button', { name: 'Enviar sugestão' }),
  );
  expect(showError).toHaveBeenLastCalledWith(
    'Você já mandou 3 hoje. Amanhã dá para mandar mais.',
  );
  // o rascunho fica: dá para tentar amanhã sem escrever de novo
  expect(screen.getByText('Vai ficar pública assim')).toBeOnTheScreen();
});
