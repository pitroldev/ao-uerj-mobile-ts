## O que muda

<!-- Em poucas linhas: o que este PR faz, para quem usa o app ou para quem mexe no código. -->

## Por quê

<!-- O problema que ele resolve. Se houver issue, use "Closes #123". -->

## Como testei

<!-- Emulador ou aparelho (qual Android), workflow ios.yml, só os testes... -->

## Checklist

- [ ] `pnpm lint`, `pnpm format:check`, `pnpm type-check`, `pnpm knip`, `pnpm test:ci` e `pnpm test:tooling` passam (e `pnpm test:server`, se mexi em `server/`).
- [ ] O que mudou tem teste novo ou atualizado.
- [ ] Os textos novos da interface estão em português simples, para calouros (nunca "chamada"; ver "Textos do app" no CONTRIBUTING.md).
- [ ] Nenhum dado pessoal real (matrícula, nome, notas, HTML do portal, PDFs, capturas) no código, nos testes ou neste PR.
- [ ] Se muda o que o app guarda ou envia: atualizei `docs/dados-e-armazenamento.md` e `docs/privacidade.md` (com a data do topo).
- [ ] Se muda a API do servidor: o `contract.ts` e o teste de contrato acompanham, e os apps já publicados continuam funcionando.
- [ ] A documentação em `docs/` acompanha a mudança.
- [ ] Os commits seguem Conventional Commits, com o assunto em inglês.

## Capturas de tela

<!-- Opcional. Só com os dados pessoais escondidos (nome, matrícula, notas). -->
