import { isSessionExpiredResponse } from '../lib/isSessionExpiredResponse';

it('recognizes a returned login form regardless of response size', () => {
  expect(
    isSessionExpiredResponse(`<!doctype html><html><body>
      <h1>Aluno Online</h1><p>Entre com seus dados de acesso.</p>
      <form><input name="matricula"><input name="senha" type="password">
      <input name="requisicao" value="login-id"></form></body></html>`),
  ).toBe(true);
});

it.each(['', ' \n\t ', undefined, null])(
  'treats the empty response %j as an invalid session response',
  body => {
    expect(isSessionExpiredResponse(body)).toBe(true);
  },
);

it('does not classify an authenticated page containing similar text as expired', () => {
  expect(
    isSessionExpiredResponse(`<div id="divCabecalhoAplicacao">Aluno</div>
      <div class="topo">ALUNO ONLINE</div>
      <div class="conteudo">Página não encontrada!</div>`),
  ).toBe(false);
});

it('does not classify an unrelated missing page as the portal session error', () => {
  expect(isSessionExpiredResponse('<h1>Página não encontrada!</h1>')).toBe(
    false,
  );
});
