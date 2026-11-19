import { AppError } from '@root/shared/errors/AppError';
import { IdeaError, type MyIdea } from '../../domain/ideas';
import {
  fieldErrorText,
  ideaLabel,
  ideaMeta,
  ideasErrorMessage,
} from '../ideasText';

const IDEA: MyIdea = {
  id: 'i',
  kind: 'sent',
  title: 'Pontos de ônibus no Mapa',
  area: 'map',
  createdAt: 0,
  status: 'open',
  issue: { number: 28, url: 'https://github.com/o/r/issues/28' },
  requests: 3,
};

it('says the state of an idea in a line, and in full for the screen reader', () => {
  expect(ideaMeta(IDEA)).toBe('#28 · 3 pedidos');
  expect(ideaMeta({ ...IDEA, requests: 1 })).toBe('#28 · 1 pedido');
  expect(ideaMeta({ ...IDEA, status: 'received', issue: null })).toBe(
    'Vai para o GitHub depois de uma olhada',
  );
  expect(
    ideaMeta({ ...IDEA, status: 'not_published', issue: null }),
  ).toBeNull();
  expect(ideaLabel({ ...IDEA, kind: 'joined', status: 'done' })).toBe(
    'Pontos de ônibus no Mapa. Pedido somado. Feita. #28 · 3 pedidos',
  );
});

it('asks to take out the contact it found, or to write a bit more', () => {
  expect(fieldErrorText('problem', 'at')).toBe(
    'Tire o @: a sugestão fica pública.',
  );
  expect(fieldErrorText('title', 'phone')).toBe(
    'Tire o telefone: a sugestão fica pública.',
  );
  expect(fieldErrorText('title', 'short')).toBe(
    'Escreva a ideia em uma frase.',
  );
  expect(fieldErrorText('title', 'long')).toBe('Até 80 letras.');
  expect(fieldErrorText('problem', 'long')).toBe('Até 1.000 letras.');
  expect(fieldErrorText('area', 'short')).toBe('Escolha onde no app.');
});

it('explains every refusal of the server', () => {
  expect(ideasErrorMessage(new IdeaError('contact', 'title'))).toBe(
    'Tire telefone, e-mail, @ ou link do título: a sugestão fica pública.',
  );
  expect(ideasErrorMessage(new IdeaError('contact'))).toBe(
    'Tire telefone, e-mail, @ ou link: a sugestão fica pública.',
  );
  expect(ideasErrorMessage(new IdeaError('limit'))).toBe(
    'Você já mandou 3 hoje. Amanhã dá para mandar mais.',
  );
  expect(ideasErrorMessage(new IdeaError('gone'))).toMatch(/já fechou/);
  expect(ideasErrorMessage(new IdeaError('github'))).toMatch(
    /GitHub não respondeu/,
  );
  expect(ideasErrorMessage(new AppError('STUDENT_PROOF_UNAVAILABLE'))).toMatch(
    /confirmar que você é aluno/,
  );
  // o banimento traz o prazo e o motivo na própria mensagem
  expect(
    ideasErrorMessage(new AppError('STUDENT_BANNED', 'Suspensa até 20/11.')),
  ).toBe('Suspensa até 20/11.');
  expect(ideasErrorMessage(new AppError('NETWORK'))).toBe(
    'Verifique sua conexão e tente novamente.',
  );
});
