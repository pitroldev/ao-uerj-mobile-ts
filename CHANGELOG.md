# Changelog

## 2.5.0 (2026-10-18)

### Novidades

- Quanto preciso na PF, no quadro de notas do Início, pela regra do regime de créditos (art. 95 da Deliberação nº 33/1995):
  - cada disciplina diz o que falta: "Precisa de X na PF" (com a nota tracejada na coluna da PF), "Dispensado da PF", "Sem direito à PF" ou quanto a outra prova precisa;
  - com a PF lançada ou a média publicada, mostra a média final e se ela aprova.
- Simular PF e CR: ajuste a PF de 0,5 em 0,5 e veja a média final de cada disciplina e o CR aproximado com as notas do período.
- Controle de faltas: marque as aulas em que faltou na agenda da semana ou em Disciplinas em Curso e veja quantos tempos ainda pode faltar, pelo limite de 25% da carga horária. As faltas ficam só no aparelho.
- A agenda da semana marca "Encerrada" ou "Falta" nos dias anteriores, e Disciplinas em Curso mostra a barra de faltas de cada disciplina.

### Correções

- Notas com duas casas aparecem como o portal lança ("4,95"), sem arredondar para cima.
- O card "Próxima aula" ignora aulas sem horário informado pelo portal.
- Bibliotecas do app atualizadas (navegação, gestos, telas, SVG, Sentry e styled-components), com correções de segurança nas dependências de build.
- O atalho "Notas" só diz que o período não tem notas depois que elas carregam.
- Uma página que o Aluno Online não oferece à conta no momento mostra que ela não está disponível, em vez de "Sua sessão expirou".
- Notificações no Android:
  - a verificação em segundo plano faz um só login por rodada e pausa por 12 horas quando o portal recusa a entrada ou a senha;
  - de madrugada, não acessa a rede nem inicia o app;
  - uma leitura em branco do portal não gera mais avisos repetidos de nota, RID ou inscrição;
  - os lembretes de aula voltam sozinhos depois de retirar "Alarmes e lembretes", não chegam atrasados quando o app abre pouco antes da aula e não se repetem ao mudar a antecedência;
  - o desligamento remoto cancela lembretes e verificação também com o app fechado;
  - o logout automático por senha recusada também tira os avisos da barra.
- Widget e atalhos no Android:
  - os atalhos do ícone não reiniciam mais o app aberto;
  - o widget não pede login a quem já entrou: antes da primeira grade, pede para abrir o app;
  - o widget troca de aula no minuto certo quando o app pode agendar alarmes exatos e não acorda mais o aparelho a cada 3 horas;
  - o horário do bloco do dia não corta com fonte grande, e o dia fica mais legível no tema escuro.

## 2.4.0 (2026-10-18)

### Novidades

- Widget "Próxima aula" no Android, em uma linha na tela inicial, a partir da grade salva no aparelho e sem acessar o portal:
  - o dia ("Agora", "Hoje" ou o dia da semana), o horário, a disciplina, a sala e o local;
  - atualiza sozinho quando a aula começa ou termina, à meia-noite e quando o relógio muda;
  - sem conta, pede o login; sem disciplinas em curso com horário, avisa. O toque abre o Início.
- Atalhos no ícone do app no Android (tocar e segurar): Próxima aula, Notas, Mapa e Documentos. "Notas" abre o Início no quadro de notas ou avisa quando o período ainda não tem notas.

## [2.3.0](https://github.com/pitroldev/ao-uerj-mobile-ts/compare/v2.1.1...v2.3.0) (2026-10-18)

### Novidades

- Notificações no Android, ligadas uma a uma na nova tela Notificações, no menu:
  - lembrete 10, 15 ou 30 minutos antes de cada aula, com o horário e a sala, a partir da grade salva no aparelho;
  - avisos do Aluno Online, verificados a cada 4 horas entre 7h e 22h: nota nova, posição no RID, resultado da inscrição e documento perto de vencer.
- O valor da nota só aparece no aviso se você quiser. Quando o Android oculta conteúdo sensível na tela de bloqueio, os avisos mostram só um resumo.
- Convite no Início para ligar os lembretes de aula.

## 2.2.0 (2026-10-16)

### Novidades

- Emissão, consulta, download e compartilhamento de documentos do Aluno Online pelo app.
- Atualização manual do histórico e do progresso ao puxar a tela.

### Correções

- RID Parcial reconhece corretamente quando ainda não há resultado disponível.
- Disciplinas aprovadas e isentas são conciliadas entre histórico, currículo, progresso e Gerador de Grade.
- CR calculado pelo app é identificado como aproximado; histórico vazio não exibe um CR inventado.
- Gerador de Grade respeita horários indisponíveis e opções de conflito, inclusive quando encontra poucas combinações.
- Melhorias na recuperação da sessão e na estabilidade da conexão com o portal.
- Remoção do modo demo e dos dados simulados de execução do app.

## [2.1.1](https://github.com/pitroldev/ao-uerj-mobile-ts/compare/v2.1.0...v2.1.1) (2026-10-15)

### Novidades

- Melhorias nos gestos e na renderização do mapa.
- Tema escuro em marinho profundo, incluindo o menu e as bordas do app.
- Página Sobre revisada, com link para pitrol.dev e ícones oficiais em SVG.

## [2.1.0](https://github.com/pitroldev/ao-uerj-mobile-ts/compare/v2.0.0...v2.1.0) (2026-10-14)

### Novidades

- Mapa offline da UERJ, com busca de salas e plantas dos andares.
- Orientação pelos portões, blocos e corredores do campus.
- Acesso pelo botão "Explorar o mapa" antes do login, com melhorias de enquadramento e legibilidade.

## [2.0.0](https://github.com/pitroldev/ao-uerj-mobile-ts/compare/707f6ea...v2.0.0) (2026-10-13)

A maior atualização do AO UERJ desde o lançamento: visual novo em todas as telas, tema escuro, um app mais estável e acessível e uma base técnica renovada.

### Novidades

- **Visual novo, "Agenda limpa"**, em todas as telas:
  - Início com a próxima aula, as notas do período e a agenda da semana;
  - Meu Progresso com a evolução do CR e o caminho no currículo;
  - Gerador de Grade em 7 passos;
  - Mural da turma, pesquisa e detalhe de disciplinas, histórico, currículo e universais.
- **Tema escuro.** No rodapé do menu, escolha entre Padrão do sistema, Claro ou Escuro.
- **Folhas inferiores novas.** Fecham arrastando, tocando fora ou pelo voltar. Os avisos aparecem por cima delas e são lidos pelos leitores de tela.
- **Teclado que não atrapalha.** No login, no mural, no Gerador e nas folhas, o campo e o botão principal ficam sempre acima do teclado.
- **Tela inteira (edge-to-edge)** em todas as versões do Android, com as barras do sistema seguindo o tema.
- **Abertura mais rápida e sem piscar.** O logo do splash nativo fica na tela até a primeira tela estar pronta.
- **Avisos do app.** Recados no Início e telas desativadas temporariamente, com explicação, quando o Aluno Online mudar.
- **Atualizações pela Play dentro do app**, com aviso de "Reiniciar" quando a nova versão termina de baixar.
- **Pedido de avaliação na Play** depois de momentos positivos, como compartilhar a grade ou gerar grades. Nunca por botão, e no máximo uma vez a cada 120 dias.

### Correções

- O app não fecha mais ao voltar do segundo plano depois de o Android recriar a tela.
- **Android 7 a 13:** a conexão com o Aluno Online funciona nesses aparelhos, que não reconheciam a cadeia de certificados atual do portal (raiz GlobalSign R46).
- **Modo offline:** o app guardava só as telas abertas na última sessão. Agora mantém todos os dados por até 7 dias.
- **Matrícula inexistente ou portal em manutenção:** antes aparecia "formato inesperado". Agora há uma mensagem clara, e os dados salvos não são apagados.
- Aspas, travessões e outros símbolos das páginas do portal aparecem corretamente.
- Cabeçalho, menu e logo voltam a responder depois de mudar o tamanho da fonte ou a navegação do sistema.
- O título do cabeçalho não fica mais preso na tela anterior.
- Arrastar a folha pela alça ou pelo título agora fecha.
- O menu lateral recolhe o teclado ao abrir.
- O Mural mantém o teclado aberto depois de enviar e atualiza "Hoje" e "Ontem" na virada do dia.
- A confirmação de "Copiado" não aparece mais em dobro no Android 13 ou superior.
- Nos campos numéricos (créditos e Gerador), o valor é selecionado ao tocar, para digitar por cima.

### Privacidade e segurança

- Backups na nuvem e a transferência entre aparelhos não levam mais os dados do app.
- O compartilhamento da grade só expõe arquivos temporários.
- Registro de falhas opcional (Sentry), com coleta mínima e desligado até ser configurado. Não envia nome, matrícula, notas, endereços do portal nem textos da tela.
- Os links dos avisos do app só abrem endereços conhecidos (UERJ, pitrol.dev, o repositório e a página do app na Play).
- Páginas de exemplo com dados do portal foram removidas do repositório e do histórico.

### Desempenho

- O React Compiler otimiza todos os componentes e hooks, com menos renderizações desnecessárias.
- Cada página do portal é lida uma vez só, em vez de três a cinco vezes.
- APK mais leve: saíram as fontes de ícones (cerca de 2 MB) e bibliotecas sem uso.
- Bibliotecas nativas alinhadas a páginas de 16 KB, exigência da Play.

### Por dentro do app

- React Native 0.83 → 0.87.1 (React 19.2, Hermes, nova arquitetura), TypeScript 7, pnpm 12, Gradle 9.4 e Android SDK 37.
- Nova camada de erros (`AppError`) e acesso ao Aluno Online reorganizado; `react-native-cheerio` (2017) trocado por `cheerio` + `parse5`.
- Modo demonstração e links de desenvolvimento para testar sem uma conta real.
- Testes: 828 testes com a Testing Library, E2E com o Maestro no Android e no iOS, e build de release em todo PR.
- Ferramentas: Oxlint com regras por tipos (lint de 17,5 s para cerca de 1 s), Prettier, Knip, Renovate, lefthook + commitlint e release-please, com publicação na trilha interna da Play.
- `versionCode` passa a seguir a versão (2.0.0 → 20000000).

## [v1.2.5](https://github.com/pitroldev/ao-uerj-mobile-ts/compare/v1.2.3...v1.2.5)

### New Features

- :page_facing_up: add: Licença [`d3963c6`](https://github.com/pitroldev/ao-uerj-mobile-ts/commit/d3963c6d4d1046302e79a4db5f54778c739f11a1)

### Fixes

- :adhesive_bandage: fix: Correção de bug, código antigo gerando falha no app [`953dfdf`](https://github.com/pitroldev/ao-uerj-mobile-ts/commit/953dfdf139ab6af73915e1b52d2bae949306d5f7)

### Styles

### Performance

### Other Changes

- :triangular_flag_on_post: chore: Habilitando novamente feature de notas do período [`5b900e2`](https://github.com/pitroldev/ao-uerj-mobile-ts/commit/5b900e206eba3a40d8adba09ea5512bca67ad930)

## [v1.2.3](https://github.com/pitroldev/ao-uerj-mobile-ts/compare/v1.2.0...v1.2.3)

### New Features

### Fixes

### Styles

### Performance

### Other Changes

## [v1.2.0](https://github.com/pitroldev/ao-uerj-mobile-ts/compare/v1.1.9...v1.2.0)

### New Features

### Fixes

### Styles

### Performance

### Other Changes

- :memo: docs: Possível backend para integração com o sistema oficial (SAG) [`1ac35bc`](https://github.com/pitroldev/ao-uerj-mobile-ts/commit/1ac35bc920cdcee01e0bb9b63bcd36c44ffd907a)

## [v1.1.9](https://github.com/pitroldev/ao-uerj-mobile-ts/compare/v1.1.8...v1.1.9)

### New Features

### Fixes

### Styles

### Performance

### Other Changes

## [v1.1.8](https://github.com/pitroldev/ao-uerj-mobile-ts/compare/v1.1.7...v1.1.8)

### New Features

### Fixes

### Styles

### Performance

### Other Changes

## [v1.1.7](https://github.com/pitroldev/ao-uerj-mobile-ts/compare/v1.1.6...v1.1.7)

### New Features

### Fixes

### Styles

### Performance

### Other Changes

## [v1.1.6](https://github.com/pitroldev/ao-uerj-mobile-ts/compare/v1.1.5...v1.1.6)

### New Features

### Fixes

### Styles

### Performance

### Other Changes

## [v1.1.5](https://github.com/pitroldev/ao-uerj-mobile-ts/compare/v1.1.4...v1.1.5)

### New Features

### Fixes

### Styles

- :lipstick: Style: Ajustes visuais nas mensagens de erro e Notas [`15acac1`](https://github.com/pitroldev/ao-uerj-mobile-ts/commit/15acac14745d01589d96a22ef7ae29b4b8ba62bf)

### Performance

### Other Changes

## [v1.1.4](https://github.com/pitroldev/ao-uerj-mobile-ts/compare/v1.1.3...v1.1.4)

### New Features

### Fixes

- :bug: fix: Cache não permitindo nova busca a disciplina [`ff8b310`](https://github.com/pitroldev/ao-uerj-mobile-ts/commit/ff8b310f4e44398fe8dcd27b078c9babf450e9ae)

### Styles

### Performance

### Other Changes

## [v1.1.3](https://github.com/pitroldev/ao-uerj-mobile-ts/compare/v1.1.2...v1.1.3)

### New Features

### Fixes

- :bug: fix: Correção da identificação de pre-requisito no SubjectDataFetcher [`2881a80`](https://github.com/pitroldev/ao-uerj-mobile-ts/commit/2881a8003c4f3d603bf1a8a53dc36aacc4faeed3)

### Styles

### Performance

### Other Changes

## [v1.1.2](https://github.com/pitroldev/ao-uerj-mobile-ts/compare/v1.1.1...v1.1.2)

### New Features

### Fixes

- :adhesive_bandage: fix: Preso na etapa de FetchDataStep caso a disciplina não tenha turmas [`243744f`](https://github.com/pitroldev/ao-uerj-mobile-ts/commit/243744fa30e887fd90432c71fe1dade9d50f65a8)
- :adhesive_bandage: fix: Correção do bug onde é possível inserir letras no SubjectAmountStep [`9b23871`](https://github.com/pitroldev/ao-uerj-mobile-ts/commit/9b238715363e12c471e53264a94d4f34db3e2b9a)

### Styles

### Performance

### Other Changes

## [v1.1.1](https://github.com/pitroldev/ao-uerj-mobile-ts/compare/v1.1.0...v1.1.1)

### New Features

- :sparkles: feat: Modal de informação [`cc693e2`](https://github.com/pitroldev/ao-uerj-mobile-ts/commit/cc693e215c25dd7996f9154a10aa12f858aa8f69)
- :necktie: add: Gerador de Quadro ao report de erro [`113a48b`](https://github.com/pitroldev/ao-uerj-mobile-ts/commit/113a48b7fbedbe440f0400e1f8c80e0dd2bca70d)

### Fixes

### Styles

### Performance

### Other Changes

- :necktie: chore: Classes conflitantes não são automaticamente selecionadas [`1f36186`](https://github.com/pitroldev/ao-uerj-mobile-ts/commit/1f361865fe564d93450560bda164dbd70c754658)
- :truck: chore: Diminuição do tempo de hold no BusyHoursStep [`9614b76`](https://github.com/pitroldev/ao-uerj-mobile-ts/commit/9614b76c1c8b35fed5b70bab660df66d8aef215e)

## [v1.1.0](https://github.com/pitroldev/ao-uerj-mobile-ts/compare/v1.0.6...v1.1.0)

### New Features

- :sparkles: add: MVP do Gerador de grades [`0b5343b`](https://github.com/pitroldev/ao-uerj-mobile-ts/commit/0b5343b58904d3aeb676ddf1721c6bfc379e7120)
- :sparkles: add: Quantidade de disciplinas a cursar sendo mostrada [`60241f0`](https://github.com/pitroldev/ao-uerj-mobile-ts/commit/60241f0070d5928a1f79217949c8bb290bf9ed3b)

### Fixes

- :bug: fix: Estado isBlocked não estava atualizando após desbloqueio do site oficial [`242833e`](https://github.com/pitroldev/ao-uerj-mobile-ts/commit/242833e077ff25406399b98072fa333ec3db66d4)

### Styles

### Performance

### Other Changes

## [v1.0.6](https://github.com/pitroldev/ao-uerj-mobile-ts/compare/v1.0.5...v1.0.6)

### New Features

### Fixes

- :bug: fix: Auth Refresh [`ffb9192`](https://github.com/pitroldev/ao-uerj-mobile-ts/commit/ffb9192aa8c1be7ad4823b87d6500fbd1b89add4)

### Styles

### Performance

### Other Changes

## [v1.0.5](https://github.com/pitroldev/ao-uerj-mobile-ts/compare/v1.0.4...v1.0.5)

### New Features

### Fixes

- :bug: fix: Página de busca de professores não estava sendo carregada [`328c276`](https://github.com/pitroldev/ao-uerj-mobile-ts/commit/328c2766b421496b1c217b68dae391b548dc439a)

### Styles

### Performance

### Other Changes

## [v1.0.4](https://github.com/pitroldev/ao-uerj-mobile-ts/compare/v1.0.2...v1.0.4)

### New Features

### Fixes

- :bug: fix: Correção da lógica de re-autenticação && lógica de retry agora é resposabilidade do react-query [`082c934`](https://github.com/pitroldev/ao-uerj-mobile-ts/commit/082c9341ffa5af5a90b339f20ae0054a99a81838)

### Styles

### Performance

- :zap: perf: Implementação do react-query & refatoração [`2bae390`](https://github.com/pitroldev/ao-uerj-mobile-ts/commit/2bae39028b67a3497bbce90883c6102697eac5fc)

### Other Changes

## [v1.0.2](https://github.com/pitroldev/ao-uerj-mobile-ts/compare/v1.0.1...v1.0.2)

### New Features

### Fixes

- :bug: fix: react-native-screens crash [`be8269c`](https://github.com/pitroldev/ao-uerj-mobile-ts/commit/be8269c9555661bd066fdae9b3644d7c156bb0e6)

### Styles

### Performance

### Other Changes

## [v1.0.1](https://github.com/pitroldev/ao-uerj-mobile-ts/compare/v1.0.0...v1.0.1)

### New Features

### Fixes

- :lipstick: fix: Correção de estilos e horários não sendo mostrados de forma correta na visualização de disciplinas [`b531e72`](https://github.com/pitroldev/ao-uerj-mobile-ts/commit/b531e722b6bb42c599d7edb3d3b12105eb7870ea)
- :adhesive_bandage: fix: Mensagem de EMPTY sendo mostrada junto a mensagem de ERROR [`b26476f`](https://github.com/pitroldev/ao-uerj-mobile-ts/commit/b26476f9429750ccb2dd308a1b0fcfc1eb5bf9a3)

### Styles

### Performance

### Other Changes

- :children_crossing: chore: Fixando orientação em Portrait [`c3bd200`](https://github.com/pitroldev/ao-uerj-mobile-ts/commit/c3bd200a8bbef70ebdae82e6fa7df8880cd5a566)

## [v1.0.0]()

### New Features

- :sparkles: add: Quadro de notas [`8935f4b`](https://github.com/pitroldev/ao-uerj-mobile-ts/commit/8935f4b23a9fce95d75bec30864f2c720ba83776)
- :sparkles: add: Mural de mensagens [`13f5008`](https://github.com/pitroldev/ao-uerj-mobile-ts/commit/13f5008a3dd592dbe69b41b052ae6692fe2c2af7)
- :children_crossing: add: DummyMessages para informar o usuário [`328f51f`](https://github.com/pitroldev/ao-uerj-mobile-ts/commit/328f51f360b91120ab832aa76dd9257a42354c9e)
- :sparkles: add: Bloqueio do Aluno Online [`0b799cb`](https://github.com/pitroldev/ao-uerj-mobile-ts/commit/0b799cb158a74f0bf7348d7865600f3840c5f548)
- :sparkles: add: RID Parcial [`0ecfa60`](https://github.com/pitroldev/ao-uerj-mobile-ts/commit/0ecfa60b993402d29ba60b40f3d292436ede35e0)
- :sparkles: add: Report de erros [`536b236`](https://github.com/pitroldev/ao-uerj-mobile-ts/commit/536b236c88987f3174027d7a4ebf2c826da99cf8)
- :sparkles: feat: Pesquisa de professores [`c67fde7`](https://github.com/pitroldev/ao-uerj-mobile-ts/commit/c67fde728eda8f2939d412eb482ae6b69e8f6bc0)
- :sparkles: add: Modal de disciplinas em curso [`898c7d8`](https://github.com/pitroldev/ao-uerj-mobile-ts/commit/898c7d896a85ddc0024280ccafe5f61f9da50105)
- :technologist: add: RoundedButton Component [`39ffd00`](https://github.com/pitroldev/ao-uerj-mobile-ts/commit/39ffd00a31caf9b3e846420959afba52be273ef1)
- :sparkles: add: About Page [`2653eda`](https://github.com/pitroldev/ao-uerj-mobile-ts/commit/2653eda6c335f15e74ed654def6c22b49787cb85)
- :sparkles: feat: Toast Notification [`e0c2b64`](https://github.com/pitroldev/ao-uerj-mobile-ts/commit/e0c2b64e907ef1cf79e6dab5c30dd8326ac5b97c)
- :technologist: add: TextArea Component [`f1f88ea`](https://github.com/pitroldev/ao-uerj-mobile-ts/commit/f1f88eaffdaedb35a0b6b019a03c9492e84b3048)
- :children_crossing: feat: Lógica de retry para requisições ao AlunoOnline [`4f437f5`](https://github.com/pitroldev/ao-uerj-mobile-ts/commit/4f437f5149794a5ce6baf6ad77e458251e51e4b5)

### Fixes

- :adhesive_bandage: fix: Caso atípico de falta de nota no RID Parcial [`308bdfc`](https://github.com/pitroldev/ao-uerj-mobile-ts/commit/308bdfc554858501d01c8e417cdf3cb570deb5a9)
- :bug: fix: DefaultIndex na grade de horários [`79c58c6`](https://github.com/pitroldev/ao-uerj-mobile-ts/commit/79c58c6a3184068aa85843344274d8fffd55fd01)
- :bug: fix: Novamente consertando o defaultIndex do quadro de horários [`d0f8c79`](https://github.com/pitroldev/ao-uerj-mobile-ts/commit/d0f8c79b8f0ee652aaa0a220771067361583075c)
- :bug: fix: SubjectDetail onPress [`c24ceea`](https://github.com/pitroldev/ao-uerj-mobile-ts/commit/c24ceea0a6947b8b817fb893b072f855bb466460)
- :adhesive_bandage: fix: Voltando a utilizar TouchableOpacity padrão do RN [`d7de029`](https://github.com/pitroldev/ao-uerj-mobile-ts/commit/d7de029aefca5f029d54d5ef9b315d8b526f12b1)
- :bug: fix: Login não verificando sucesso [`aa821b8`](https://github.com/pitroldev/ao-uerj-mobile-ts/commit/aa821b8fe59349f8db6b44f48fe6858275a84de3)
- :adhesive_bandage: fix: Header aparecendo na tela de login [`ea8c19c`](https://github.com/pitroldev/ao-uerj-mobile-ts/commit/ea8c19c3edd78062b321c837edeabfbdb6b5728a)
- :bug: fix: Verificador de bloqueio [`c06b03e`](https://github.com/pitroldev/ao-uerj-mobile-ts/commit/c06b03e79544ecca98af21f546ad82d99d09e456)

### Styles

- :lipstick: style: Adição de ícone android [`1db757d`](https://github.com/pitroldev/ao-uerj-mobile-ts/commit/1db757dde58810df9b93bcdacac4383879436f9b)
- :lipstick: style: Correção de estilos na página de detalhes da disciplina [`cd1d1f0`](https://github.com/pitroldev/ao-uerj-mobile-ts/commit/cd1d1f06ff7a3c710015c2951ae89b99b16a7bf2)
- :lipstick: style: Correções em espaçamento e cores nativas do Android [`7ba742f`](https://github.com/pitroldev/ao-uerj-mobile-ts/commit/7ba742fa83eafd9cc5638ee76d0a961796e6f270)

### Performance

### Other Changes

- :arrow_up: chore: Upgrade de dependências [`95115c8`](https://github.com/pitroldev/ao-uerj-mobile-ts/commit/95115c836817d0567c36571323807ec6f05c8a9e)
- :art: chore: Prettier & Eslint format [`29c5210`](https://github.com/pitroldev/ao-uerj-mobile-ts/commit/29c5210745049bec35f442c9f3d67eac307e5e26)
