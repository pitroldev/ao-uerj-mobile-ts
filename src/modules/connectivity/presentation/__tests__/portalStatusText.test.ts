import { clockText, portalDownText } from '../portalStatusText';

const at = (day: number, hour: number, minute: number) =>
  new Date(2026, 9, day, hour, minute).getTime();
const NOW = at(22, 14, 7);

it('writes the time, and the day when it is another one', () => {
  expect(clockText(at(22, 9, 5), NOW)).toBe('9:05');
  expect(clockText(at(21, 23, 40), NOW)).toBe('21/10 às 23:40');
});

it('says when the portal stopped answering and the next attempt', () => {
  expect(
    portalDownText(
      { since: at(22, 14, 5), retryAt: at(22, 14, 12), shared: null },
      NOW,
    ),
  ).toBe(
    'O Aluno Online não está respondendo desde 14:05. Nova tentativa às 14:12.',
  );
  // tentativa vencida (o app esteve fora da tela): sem horário
  expect(
    portalDownText(
      { since: at(22, 14, 5), retryAt: at(22, 14, 6), shared: null },
      NOW,
    ),
  ).toBe('O Aluno Online não está respondendo desde 14:05.');
});

it('tells an outage for everyone from one on the student side', () => {
  const down = portalDownText(
    {
      since: at(22, 14, 5),
      retryAt: null,
      shared: {
        state: 'down',
        since: at(22, 13, 50),
        checkedAt: at(22, 14, 5),
      },
    },
    NOW,
  );
  expect(down).toBe('O Aluno Online está fora do ar para todos desde 13:50.');
  const up = portalDownText(
    {
      since: at(22, 14, 5),
      retryAt: null,
      shared: { state: 'up', since: null, checkedAt: at(22, 14, 5) },
    },
    NOW,
  );
  expect(up).toBe(
    'O Aluno Online não está respondendo para você, mas está no ar para outros alunos. Pode ser a sua rede.',
  );
});

it('ignores a shared status too old to tell anything', () => {
  expect(
    portalDownText(
      {
        since: at(22, 14, 5),
        retryAt: null,
        shared: { state: 'down', since: null, checkedAt: at(22, 13, 0) },
      },
      NOW,
    ),
  ).toBe('O Aluno Online não está respondendo desde 14:05.');
});
