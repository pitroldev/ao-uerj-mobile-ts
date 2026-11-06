# Arquitetura

O app segue portas e adaptadores: os casos de uso dependem de portas (interfaces). Protocolos, HTML e bibliotecas de fornecedores ficam nos adaptadores, e a composição conecta as implementações.

## Camadas

```mermaid
flowchart LR
  telas["Telas<br/>src/pages e src/features"] --> presentation["presentation<br/>hooks e componentes do módulo"]
  presentation --> application["application<br/>casos de uso e portas"]
  application --> domain["domain<br/>modelos e regras"]
  adapters["Adaptadores<br/>src/adapters/outbound"] -.->|"implementam as portas"| application
  composition["Composição<br/>src/app/composition"] --> adapters
  composition --> application
```

Cada módulo de `src/modules/<nome>/` tem até três pastas:

- **`domain/`:** modelos e regras puras (a conta da PF, o plano até a formatura, a validação do aviso remoto). Não conhece React, rede nem armazenamento.
- **`application/`:** os casos de uso e as portas de que eles precisam (o portal, o cofre, o servidor).
- **`presentation/`:** hooks, provedores e textos que as telas usam.

## Mapa de pastas

| Pasta                                       | O que tem                                                                                                                                                                                                                   |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/`                                  | Composição (`composition/`), provedores, QueryClient e splash nativo (`splash.ts`)                                                                                                                                          |
| `src/app/background/`                       | Tarefa sem tela das verificações (WorkManager no Android, `BGTaskScheduler` no iPhone): os avisos do portal (`check`), "Avisar quando voltar" (`return`), a Companhia agora (`companion`) e o Agora no campus (`campus`)    |
| `src/app/observability/`                    | Registro de falhas no Sentry, desligado sem DSN; ver [Observabilidade](observabilidade.md)                                                                                                                                  |
| `src/app/dev/`                              | Deep links de debug (`aouerj-dev://`); ver [scripts/dev/README.md](../scripts/dev/README.md)                                                                                                                                |
| `src/modules/`                              | Os módulos, um por assunto (tabela abaixo)                                                                                                                                                                                  |
| `src/adapters/outbound/`                    | `aluno-online` (o portal), `private-api` (o servidor próprio), `schedule-generator`, `delivery` (aviso remoto e lojas), `persistence` (armazenamento), `native` (recursos nativos) e `campus-map` (o atlas do mapa offline) |
| `src/specs/`                                | Specs do codegen para os TurboModules locais: In-App Updates, avisos, widget, cofre, Play Integrity e App Attest                                                                                                            |
| `src/pages/`                                | Uma pasta por tela do menu                                                                                                                                                                                                  |
| `src/features/`                             | Componentes de apresentação usados pelas telas (quadro de notas, folhas, blocos do Início)                                                                                                                                  |
| `src/components/ui/`                        | O design system "Agenda limpa"; ver [o README dele](../src/components/ui/README.md)                                                                                                                                         |
| `src/components/templates/`                 | Cabeçalho, painel das telas e menu lateral                                                                                                                                                                                  |
| `src/themes/`                               | Tokens e os temas claro e escuro                                                                                                                                                                                            |
| `src/shared/`                               | Erros compartilhados (`AppError`)                                                                                                                                                                                           |
| `src/hooks/`, `src/utils/`, `src/services/` | Hooks de tela, formatação e constantes, navegação fora dos componentes (`rootNavigation`)                                                                                                                                   |
| `android/`, `ios/`                          | Os projetos nativos, com os módulos próprios (cofre, avisos, widget, atalhos)                                                                                                                                               |
| `server/`                                   | O backend próprio; ver [server/README.md](../server/README.md)                                                                                                                                                              |

### Módulos

| Módulo          | Assunto                                                                                                                                       |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `identity`      | Identidade pública, login, restauração e logout                                                                                               |
| `academics`     | Modelos, regras acadêmicas (PF, CR, progresso), consultas e compartilhamento                                                                  |
| `attendance`    | Faltas marcadas pelo aluno, só no aparelho                                                                                                    |
| `evaluations`   | Provas e trabalhos anotados pelo aluno, só no aparelho                                                                                        |
| `graduation`    | Plano até a formatura (pré-requisitos, carga e prazo)                                                                                         |
| `planning`      | Preparação e geração de grades                                                                                                                |
| `documents`     | Emissão de documentos; ver [Emissão de documentos](emissao-de-documentos.md)                                                                  |
| `home`          | O Início configurável ("Personalizar o Início")                                                                                               |
| `community`     | Mensagens do mural e consulta de professores                                                                                                  |
| `companion`     | Companhia agora                                                                                                                               |
| `campus-now`    | Agora no campus                                                                                                                               |
| `campus-map`    | O mapa offline do campus                                                                                                                      |
| `trust`         | A sessão de aluno no servidor próprio (`StudentSession`)                                                                                      |
| `connectivity`  | Internet e situação do portal (fora do ar, lento, de volta)                                                                                   |
| `notifications` | Lembretes de aula e de avaliações e avisos do portal (nota, RID, inscrição, documento), da volta do portal, da Companhia e do Agora no campus |
| `widget`        | Widgets "Próxima aula" e "Hoje" da tela inicial                                                                                               |
| `launch`        | Aberturas de fora do app (aviso, atalho do ícone, widget)                                                                                     |
| `delivery`      | Aviso remoto, atualização pela loja e pedido de avaliação                                                                                     |
| `appearance`    | Tema do app (Sistema, Claro ou Escuro)                                                                                                        |
| `support`       | Relatórios estruturados e sanitização                                                                                                         |

## Fronteiras que o Oxlint guarda

- **Domínio e aplicação** (`src/modules/**/domain/**/*.ts` e `application/**/*.ts`) não importam React, React Native, React Navigation, styled-components, TanStack Query, Redux, axios nem cheerio, nem as pastas `adapters`, `app`, `presentation`, `services`, `features` e `store`: "Domínio e aplicação dependem de portas; conecte implementações na composição."
- **Em todo o `src/`:** nada da raiz do `cheerio` (quebra no Metro; use `loadHtml()` de `src/adapters/outbound/aluno-online/html.ts`, com `cheerio/slim` e parse5), nada de `react-native-cheerio` e nada de `react-native-toast-message` direto (use a fachada `snackbar` de `@components/ui`).
- **`src/modules/**` e `src/app/**`:** `react/exhaustive-deps` como erro.
- **No servidor:** as regras hexagonais de [server/README.md](../server/README.md#arquitetura).

O `scripts/__tests__/architecture.test.cjs` (no `pnpm test:tooling`) confere que essas regras continuam valendo.

## Composição

`src/app/composition/createAppServices.ts` monta os serviços do app: liga cada porta a um adaptador (o portal, o cofre, o servidor, os módulos nativos) e entrega tudo às telas pelo `AppServicesProvider`. É o único lugar que conhece os dois lados. Os módulos que dependem de recursos de uma plataforma (a sessão de aluno, a Companhia agora, o Agora no campus, os avisos) dizem se estão disponíveis, e o menu esconde o que não está.

## Aluno Online

O app lê o portal real com a conta do aluno, como um navegador faria.

- **Coordenador:** o adaptador do Aluno Online (`src/adapters/outbound/aluno-online/createAlunoOnlineAdapter.ts`) centraliza login, token, códigos de requisição e renovação concorrente. Uma consulta expirada permite um único replay. Um `POST` nunca é repetido sozinho: uma resposta perdida pode já ter mudado o portal.
- **Parsers:** um por página, em `parsers/`. Eles diferenciam página vazia reconhecida de estrutura inesperada (`PORTAL_LAYOUT_CHANGED`). Os testes usam páginas sintéticas, em `__fixtures__/`.
- **Queries:** as consultas acadêmicas usam a conta e o contexto do portal na chave (`academicKeys`, em `src/modules/academics/presentation/queryKeys.ts`). Cookies e tokens não participam das chaves. Os erros transitórios têm repetição limitada (uma nova tentativa). Os componentes não copiam respostas para outro armazenamento de estado.
- **Cache:** o que fica guardado e por quanto tempo está em [Dados e armazenamento](dados-e-armazenamento.md).

Alterações no portal podem exigir a atualização dos parsers. O app preserva os dados já carregados e informa as falhas de atualização; o relato em "Sobre" serve para descrever problemas persistentes.

## Gerador de grades, mural e suporte

Mensagens, suporte, situação do portal e geração de grades usam APIs próprias, distintas do portal da UERJ: `https://pitrol.dev/aouerj` (`src/adapters/outbound/private-api`) e `https://pitrol.dev/schedules` (`src/adapters/outbound/schedule-generator`).

O gerador exige uma ação explícita para enviar a solicitação. Os detalhes das disciplinas são carregados com concorrência limitada e cancelamento.

## Servidor próprio (`server/`)

O backend de `https://pitrol.dev` fica em [`server/`](../server/README.md): em `/aouerj`, o mural, os docentes, os relatos de erro, as sugestões dos apps antigos, a situação do Aluno Online e, na v2, a sessão de aluno, a Companhia agora e o Agora no campus; em `/schedules`, o gerador de grades.

- **Hexagonal, com os nomes do app:** TypeScript rodado direto pelo Node 22.18+. Cada módulo tem domínio, portas e casos de uso sem framework; os adaptadores de entrada (HTTP, agendador) e de saída (MongoDB, arquivos, portal, atestação, threads) ficam nas bordas e só se encontram na raiz de composição. O gerador busca numa thread à parte, com fila e limite de tempo, e dá as mesmas grades que o serviço antigo.
- **Contrato:** os corpos e as respostas da API são tipos em `server/src/adapters/inbound/http/contract.ts`, que os adaptadores do app (`src/adapters/outbound/private-api` e `schedule-generator`) importam. Um campo trocado de um lado não passa no `pnpm type-check` (o `tsconfig.contract.json` cobre o teste de contrato).
- **Teste de contrato:** `src/adapters/outbound/__tests__/server.contract.test.ts` sobe o servidor de verdade (`server/test/fixtures/contractServer.ts`, com os repositórios em memória) e roda os adaptadores do app, com o mesmo cliente axios, contra ele: a situação do portal, o mural, os docentes, o relato de erro, o gerador, a Companhia agora e o Agora no campus, estes dois com dois alunos e a atestação de desenvolvimento. Ele roda no `pnpm test:ci` e antes de cada implantação.
- **Pacote à parte:** o servidor tem dependências e lockfile próprios, fora do workspace do app. O `postinstall` da raiz o instala; `pnpm server dev` sobe e `pnpm test:server` testa (alguns testes sobem um mongod próprio).
- Lint, formatação e tipos da raiz cobrem o servidor, e o CI roda os testes dele no mesmo job do app.

### Sessão de aluno

O mural, a busca de docentes, a Companhia agora, o Agora no campus e o relato de erro falam com `/aouerj/v2` como o aluno identificado. O lado do servidor está em [server/README.md](../server/README.md#identificação-do-aluno-v2); o que é enviado e guardado, em [Dados e armazenamento](dados-e-armazenamento.md#identificação-do-aluno).

```mermaid
sequenceDiagram
  participant App as App
  participant AO as Aluno Online
  participant Loja as Play Integrity ou App Attest
  participant S as pitrol.dev
  App->>AO: login com matrícula e senha
  AO-->>App: sessão do portal
  Note over App: de 5 a 30 segundos depois
  App->>S: GET /aouerj/v2/students/challenge
  S-->>App: desafio de uso único
  App->>Loja: atestação sobre o requestHash
  Loja-->>App: token ou atestação
  App->>S: POST /aouerj/v2/students/session
  S-->>App: sessão de 30 dias sem uso
  App->>S: pedidos com a sessão
```

- **No app:** `src/modules/trust` (`StudentSession`) e os módulos nativos `DeviceTrust` (Play Integrity, SHA-256 e SecureRandom do Android) e `AppAttest` (App Attest, CommonCrypto e `SecRandomCopyBytes` do iPhone). O `createDeviceTrust` (`src/app/composition/createStudentSession.ts`) escolhe pela plataforma.
- **Projeto do Google Cloud:** o número do projeto ligado ao app (`ao-uerj`, 377368074507) fica em `src/adapters/outbound/native/NativeDeviceTrust.ts`. Vazio, o app não entra.
- **No iPhone:** cada entrada gera uma chave nova do App Attest e a atesta com os 32 bytes do `requestHash` (o hex decodificado) como `clientDataHash`. O pedido leva `appAttest` (`keyId` e `attestation`, em base64 padrão) no lugar do `integrityToken`.
- **Recusas:** as esperas depois de uma recusa (`RETRY_AFTER_MS`) são as mesmas nas duas plataformas.
- **Pedidos:** os pedidos da `private-api` passam por `createSessionClient`, que manda a sessão, entra de novo uma vez num 401 e transforma o banimento em `STUDENT_BANNED`. O gerador de grades usa a sessão quando há, sem exigir: sem ela (simulador, sem rede para a atestação), gera como os apps antigos; com a sessão vencida, a esquece e gera sem ela; banido, não gera.
- **Apps antigos:** os tokens anônimos dos apps de 2.11.1 a 2.13 continuam só no servidor.
