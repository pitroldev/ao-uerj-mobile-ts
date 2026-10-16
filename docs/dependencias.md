# Dependências: substituições, adições e remoções

Levantamento de outubro de 2026, feito logo depois do upgrade para React Native 0.87.1. Cada item foi comparado com o estado da arte (SOTA) do ecossistema React Native e avaliado pelo ganho real **para este app**: um cliente Android (e iOS no repositório) mantido por uma pessoa, que faz scraping do Aluno Online e guarda matrícula e senha.

Legenda de esforço: **P** (horas), **M** (1 a 3 dias), **G** (uma semana ou mais).

## Status da implementação (12/10/2026)

**Atualização de 16/10/2026:** o modo de demonstração e seus cenários foram removidos. Os fluxos Android atuais usam a conta real do `.env` e executam somente leitura; o smoke de documentos consulta exclusivamente o catálogo. A execução em CI passou a ser manual e não publica artefatos da conta. As referências a demonstração, execução noturna e E2E iOS abaixo são registro histórico da implementação de 12/10, não instruções vigentes. Consulte [as ferramentas de desenvolvimento](../scripts/dev/README.md) para o fluxo atual.

Todos os itens abaixo foram implementados e verificados com lint (Oxlint com tipos), type-check (TS 7), Prettier, Knip, Jest, build de debug e de release do Android (as 4 ABIs) e QA nos emuladores API 35 e API 33. No CI do GitHub (PR #9) passaram o Quality (JavaScript, Android debug e release), o E2E com os 8 fluxos do Maestro e o build do iOS no simulador. O resto deste documento continua como registro do porquê de cada decisão.

| Item                                  | Como ficou                                                                                                                                                                                                                    |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gcTime` do cache offline             | `gcTime` de 7 dias no `QueryClient` de produção e no `hydrate()`, com teste que falhava antes da correção                                                                                                                     |
| Raiz GlobalSign R46                   | Confirmado: falta na loja de CAs do Android 11 e 13 (emuladores API 30 e 33). `network_security_config.xml` só para `www.alunoonline.uerj.br`; o login no Android 13 chega ao portal                                          |
| Pacotes sem uso                       | Saíram picker, 4 vector-icons, carousel, native-stack, svg-transformer e gitmoji, além dos substituídos abaixo e dos drawables do splash antigo                                                                               |
| `react-native-modal`                  | `BottomSheet` com `Modal` do core + `Animated` (driver nativo) + responder; patch e `patchedDependencies` removidos                                                                                                           |
| Sentry                                | `@sentry/react-native` com coleta mínima em `src/app/observability`, **desligado até o DSN ser preenchido**; source maps só com `SENTRY_AUTH_TOKEN`                                                                           |
| Renovate + Knip                       | `.github/renovate.json5` e `knip.jsonc`; `pnpm knip` no CI, saindo com 0 (projeto passou a usar só exports nomeados)                                                                                                          |
| cheerio                               | `cheerio/slim` + parse5 atrás de `loadHtml()`, uma leitura por página; saída idêntica à da lib antiga nas páginas de teste. A fase 2 (htmlparser2 puro) não foi feita, porque depende de fixtures reais                       |
| iconv-lite + buffer                   | `decodeWindows1252` local (tabela WHATWG) e base64 do SVG com `TextEncoder` + `btoa`                                                                                                                                          |
| Edge-to-edge                          | `edgeToEdgeEnabled=true`; o painel encolhe com o teclado em todas as versões                                                                                                                                                  |
| React Compiler                        | `babel-plugin-react-compiler` 1.0.0 como primeiro plugin; 176 de 176 componentes e hooks compilados; regras do Compiler nativas do Oxlint                                                                                     |
| keyboard-controller                   | 1.22.7 (exceção de idade mínima no `pnpm-workspace.yaml`) no Login, no Mural, nas folhas e no painel                                                                                                                          |
| Maestro                               | Fluxos em `.maestro/` sobre o modo demo, `pnpm e2e` e `.github/workflows/e2e.yml` (manual e noturno)                                                                                                                          |
| Release no CI + In-App Updates        | release-please com job de publicação na trilha interna (environment `play`), build de release em todo PR, versão só no `package.json`. In-App Updates por um **módulo nativo local** (ver nota abaixo)                        |
| Regras de extração de dados           | `data_extraction_rules.xml` excluindo tudo de `cloud-backup` e `device-transfer`; `filepaths.xml` só com caches                                                                                                               |
| Testing Library                       | 26 arquivos migrados; `useKeyboardInset.test.tsx` saiu junto com o hook, trocado pelo keyboard-controller; `react-test-renderer` removido                                                                                     |
| async-storage                         | De volta à 2.2.0 (nenhuma versão com a 3 foi publicada); o código de migração saiu                                                                                                                                            |
| lefthook + commitlint, release-please | Hooks de pre-commit, commit-msg e pre-push; `auto-changelog` e arquivos dele removidos                                                                                                                                        |
| Oxlint                                | `.oxlintrc.json` com lint por tipos (tsgolint); ESLint e 11 pacotes removidos; Prettier roda à parte (`format:check`). Lint de 17,5 s para cerca de 1 s                                                                       |
| bootsplash, In-App Review             | Splash nativo que sai no primeiro layout de tela; pedido de avaliação depois de momentos positivos, com limites                                                                                                               |
| Sem nova dependência                  | `initialMetrics` no `SafeAreaProvider`, toast de "Copiado" só abaixo da API 33, tema escuro (Sistema/Claro/Escuro, botão no rodapé do menu), aviso remoto em `config/app-status.json`, `useAnimatedValue`, fachada `snackbar` |

Diferenças em relação ao texto original:

- **In-App Updates:** em vez do `sp-react-native-in-app-updates`, um TurboModule local (`src/specs/NativeInAppUpdates.ts` e `android/.../updates/`) sobre `com.google.android.play:app-update` 2.1.0. A 2.0.0 da lib traz `react-native-device-info` 10.3 (2022), `underscore` e o peer `react-native-siren`.
- **Sentry:** sem `Sentry.wrap`, que grava rótulos e textos tocados; sem o plugin Gradle do Sentry, que instrumentaria o OkHttp (o mapping do R8 não vai ao Sentry).
- **Aviso remoto:** em vez de um backend próprio, o JSON fica neste repositório (`config/app-status.json`) e o app o busca em `raw.githubusercontent.com`. A busca não leva dados do aluno, mas o GitHub vê o IP do aparelho (ver "Persistência e privacidade" no README).
- **Imagem compartilhada da grade:** sempre no tema claro, mesmo com o app no escuro.
- **Login:** a resposta do portal "a matrícula informada não existe, ou não está habilitada…, ou existe alguma manutenção…" aparecia como "formato inesperado". Agora vira o código `ACCOUNT_UNAVAILABLE`, com mensagem própria. Ele não conta como senha errada: ao reabrir o app, credenciais e cache offline continuam salvos.

Pendências que dependem do dono do projeto:

- **Sentry:** criar a organização na região UE e o projeto, preencher `SENTRY_DSN` em `src/app/observability/config.ts`, ligar "Prevent Storing of IP Addresses" e o Data Scrubber, e cadastrar `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` e `SENTRY_PROJECT` no environment `play`. Atualizar a política de privacidade, o Data safety e a base legal da LGPD (ver README).
- **Aviso remoto:** já ativo, sem depender de configuração. Incluir na política de privacidade a busca do `config/app-status.json` no GitHub (o IP e o horário chegam ao GitHub, da Microsoft, nos EUA) e considerá-la na transferência internacional da LGPD (ver README).
- **GitHub:** instalar o app do Renovate; permitir que o Actions crie PRs; criar o environment `play` com revisor; cadastrar os secrets de assinatura e da conta de serviço da Play (lista no README).
- **Play:** o próximo `versionCode` sai na casa de 10 milhões (fórmula no `android/app/build.gradle`); testar In-App Updates e In-App Review pela trilha interna.
- **iOS:** o build do simulador passa no CI (`pod install` e Xcode, com o bootsplash e as fases do Sentry). Falta testar num iPhone ou simulador interativo (splash, tema escuro, folhas, teclado), o que exige um Mac.
- **Histórico do git:** `src/examples/` e o antigo `src/services/UerjApi/lib/examples.ts` foram removidos de todo o histórico (git filter-repo, em 13/10/2026), com push forçado da `main`, da `chore/upgrade-rn-to-83` e das tags. O GitHub ainda guarda as referências dos PRs antigos (#2 e #4 a #8), que só o suporte do GitHub consegue apagar ("remoção de dados sensíveis"); forks e clones antigos mantêm o histórico velho. O `html/grades.html`, que não é usado pelo app, tem outro número nesse formato e não foi mexido.

## Resumo

| Prioridade | Ação                                                                                             | Tipo         | Esforço |
| ---------- | ------------------------------------------------------------------------------------------------ | ------------ | ------- |
| Alta       | Corrigir o `gcTime` das queries reidratadas (cache offline perde dados)                          | correção     | P       |
| Alta       | Confiar na raiz GlobalSign R46 para `alunoonline.uerj.br` no Android 7 a 13 (verificar antes)    | adição       | P       |
| Alta       | Remover pacotes sem uso (picker, vector-icons, carousel, native-stack, svg-transformer, gitmoji) | remoção      | P       |
| Alta       | `react-native-modal` → motor próprio no `BottomSheet`                                            | substituição | P       |
| Alta       | Sentry com coleta mínima (região UE, sem rede nem PII)                                           | adição       | M       |
| Alta       | Renovate + Knip (atualizações agrupadas e detecção de código morto)                              | adição       | P       |
| Média      | `react-native-cheerio` → `cheerio/slim` + parse5                                                 | substituição | M       |
| Média      | `iconv-lite` + `buffer` → decodificador windows-1252 local                                       | substituição | P       |
| Média      | `edgeToEdgeEnabled=true` (um único modo de layout em todas as versões)                           | ajuste       | P       |
| Média      | React Compiler + regras do Compiler no lint                                                      | adição       | P       |
| Média      | `react-native-keyboard-controller`                                                               | adição       | M       |
| Média      | Maestro (E2E sobre o modo demo)                                                                  | adição       | M       |
| Média      | Release automatizado no GitHub Actions + In-App Updates                                          | adição       | M       |
| Média      | Regras de extração de dados (backup e transferência entre aparelhos)                             | adição       | P       |
| Média      | `react-test-renderer` → Testing Library (gradual)                                                | substituição | G       |
| Média      | Reavaliar o async-storage 3 (volta para 2.2.0)                                                   | decisão      | P       |
| Baixa      | lefthook + commitlint; release-please no lugar do auto-changelog parado                          | adição       | P       |
| Baixa      | Oxlint com lint por tipos no lugar do ESLint adaptado                                            | substituição | M       |
| Baixa      | `react-native-bootsplash`, In-App Review                                                         | adição       | P       |

## Achados que não são troca de dependência

### Cache offline perde as telas não visitadas (bug)

`src/app/queryClient.ts` não define `gcTime`, e `query-account-cache.ts` chama `hydrate()` sem `defaultOptions`. Queries reidratadas ficam com o `gcTime` padrão de 5 minutos até alguma tela observá-las; o `gcTime` de 7 dias de `useAcademicQuery` só vale com observador. Depois de 5 minutos a query é coletada, o `subscribe` recebe `removed` e o `flush()` regrava o blob **sem ela**. Na prática, o cache offline fica só com as telas abertas na última sessão. O teste atual usa `gcTime: Infinity` e não pega o caso.

Correção: `gcTime` padrão maior ou igual a `MAX_CACHE_AGE` (7 dias) no `QueryClient`, ou passar `defaultOptions` ao `hydrate()`, mais um teste com o `QueryClient` de produção. A documentação do TanStack pede `gcTime >= maxAge` ao persistir.

### Cadeia de certificados do portal no Android 13 ou anterior (verificar)

Pelo `openssl`, a cadeia do portal é `leaf → RNP ICPEdu GR46 OV TLS CA 2025 → GlobalSign Root R46`, sem certificado cruzado. A R46 só entrou na loja de CAs do Android no 14. O app Moodle documentou a mesma intermediária da RNP falhando com "Trust anchor for certification path not found" no Android 13 e anteriores ([moodleapp#4914](https://github.com/moodlehq/moodleapp/pull/4914)). Como o transporte converte falhas em `AppError('NETWORK')`, isso apareceria como "sem conexão", não como crash.

O emulador usado nos testes é API 35, então **não foi verificado aqui**. Teste num AVD API 33 (a página de login é pequena e não sofre do problema de TLS do emulador) e confira a distribuição de versões no Play Console. Se confirmar, a correção é um `network_security_config.xml` com `<domain-config>` só para `alunoonline.uerj.br`, confiando no sistema mais a raiz R46 (PEM oficial da GlobalSign, conferido pelo fingerprint). Não é pinning: vale até 2046 e sobrevive às renovações do certificado.

### Páginas de 16 KB: conferido, sem pendência

A pesquisa levantou a [issue #818](https://github.com/oblador/react-native-keychain/issues/818) do keychain, sobre o `libdatastore_shared_counter.so` do DataStore 1.1.1, e o `libsqliteJni.so` do async-storage 3. No APK de release gerado depois do upgrade (12/10/2026):

- todas as 21 bibliotecas têm os segmentos `LOAD` alinhados em `0x4000` (16 KB);
- `zipalign -c -P 16` passa.

O critério da issue (fim do `GNU_RELRO` fora do limite de 16 KB) também reprovaria a `libreactnative.so` e a `libc++_shared.so` do próprio RN, então não é o que a Play exige. Se o Play Console reclamar mesmo assim, a saída é forçar `androidx.datastore:datastore-preferences:1.2.1` no `android/app/build.gradle`.

### Possível dado pessoal versionado

`src/examples/*.ts` (4 arquivos, cerca de 150 KB de HTML salvo do portal, sem nenhum import) contém um número no formato de matrícula. Vale conferir se é dado real; se for, apagar os arquivos e considerar limpar o histórico.

## Substituições

### `react-native-modal` → motor próprio no `BottomSheet` (alta, P)

- **Por quê:** a lib está parada em `14.0.0-rc.1` (mar/2025) e só funciona no RN 0.87 com o patch em `patches/`, que remove o `InteractionManager`. O PR oficial está aberto desde maio. Ela também traz `react-native-animatable`.
- **Escopo:** o único consumidor é `src/components/ui/BottomSheet/BottomSheet.tsx`. Os outros 17 usos são `jest.mock` herdados.
- **Proposta:** `Modal` do core (`transparent`, `animationType="none"`) + `Animated` com `useNativeDriver` + `PanResponder`, mantendo `BottomSheetProps`. Um protótipo passou nos 461 testes. Alternativa equivalente: Reanimated 4 + Gesture Handler 3, que já estão no projeto.
- **Descartados:** `@gorhom/bottom-sheet` (provider próprio e tratamento de teclado que brigaria com o do app, para 5 folhas simples) e o fork `@ajaybhatia/react-native-modal`, que troca uma lib parada por outra de um mantenedor só.
- **Depois:** apagar o patch, o `patchedDependencies` e os `jest.mock`. Validar em aparelho: teclado no Android 15+ e anteriores, arraste, véu e botão voltar.

### `react-native-cheerio` → `cheerio/slim` + parse5 (média, M)

- **Por quê:** a versão `1.0.0-rc.4` é de **2017**, com `css-select` 1.2, um fork do parse5 2.x, lodash e `buffer@5`. Não tem tipos: os 13 parsers usam `require` e `any`.
- **Atenção:** a lib atual monta a árvore com **parse5** (`lib/parse.js` só usa htmlparser2 com `xmlMode`). Por isso existem `<tbody>` implícito e foster-parenting, e os parsers dependem disso, por exemplo `subjectClasses.ts:237` com `> table > tbody > tr`. Trocar direto por htmlparser2, `node-html-parser` ou `linkedom` faria a lista de turmas voltar **vazia, sem erro**.
- **Fase 1:**
  - `cheerio@^1.2` importado sempre de `cheerio/slim`. A raiz `cheerio` puxa `undici` e `node:stream` e quebra no Metro; vale uma regra de lint proibindo esse import.
  - `parse5@^7.3` + `parse5-htmlparser2-tree-adapter@^7.1`, atrás de um `loadHtml()` único. A árvore fica idêntica.
  - Os 85 testes dos parsers passam com a troca.
- **Ganho maior, independente da lib:** parsear cada página uma vez. Hoje são 3 ou 4 parses por resposta.
- **Fase 2 (opcional):** htmlparser2 puro, cerca de 2x mais rápido e 200 KB a menos. Só com fixtures reais, porque `SubjectInfo.ts` e `subjectClasses.ts` têm 19% e 3% de cobertura.

### `iconv-lite` + `buffer` → decodificador local (média, P)

- **Contexto:** o portal responde `text/html` sem charset, então a decodificação no JS é necessária.
- **Por quê trocar:** o `iconv-lite` faz o Metro empacotar cerca de 228 KB de tabelas CJK para decodificar um único charset.
- **Proposta:** `decodeWindows1252(bytes)` em cerca de 15 linhas, com a tabela WHATWG de 0x80 a 0x9F e identidade no resto. O base64 do SVG passa a usar `TextEncoder` + `btoa`, que o Hermes já tem.
- **Comportamento:** só mudam os bytes 0x80 a 0x9F, que hoje viram caracteres de controle invisíveis e passariam a ser `“ ” – —`. Para manter a saída idêntica à atual, use ISO-8859-1 puro (`String.fromCharCode`).
- **Futuro:** no RN 0.88 entra `TextDecoder('windows-1252')` nativo.

### `react-test-renderer` → `@testing-library/react-native` 14 (média, G)

- **Por quê:** depreciado pelo React 19, com aviso a cada `create()` e remoção prevista. O próprio time do React indica a Testing Library.
- **Versões:** `@testing-library/react-native@^14.1` + `test-renderer@~1.2`, a linha casada com o React 19.2. A 1.3 exige React 19.3. Não usar o codemod `rntl-v14-update-deps`, que remove o renderer de uma vez.
- **Migração gradual:**
  - helper de render com tema;
  - `no-restricted-imports` congelando o legado, para que todo teste novo já nasça em RNTL;
  - hooks com `renderHook`;
  - depois as telas, de 4 a 6 dias no total.
- **Custo real:** reescrever as 158 consultas a props de componentes compostos (`findByProps`, `findByType`) como consultas ao que é visível ou acessível.

### Edge-to-edge nativo: `edgeToEdgeEnabled=true` (média, P)

- **Hoje:** o app roda em dois modos. Até o Android 14 a barra é pintada pelo tema; no 15+ o RN liga o edge-to-edge à força, por causa do targetSdk 36. Daí os ramos por versão em `BottomSheet.tsx` (com o hack `NAV_BAR_PROPS`), em `useKeyboardInset.ts` e no `Header`.
- **Com a flag ligada:** o layout fica igual do API 24 ao 36, e as correções do RN 0.86 (KeyboardAvoidingView, `Dimensions`, `StatusBar` em `Modal`) passam a valer em todas as versões. O template 0.87 já vem com `true`.
- **Para ligar:**
  - testar nos API 24, 29, 34, 35 e 36, com navegação por gestos e por 3 botões;
  - dar `bottomOffset` ao toast;
  - tirar o `statusBarColor` do `styles.xml`;
  - forçar o modo claro dos botões da barra até o tema escuro existir.
- **Descartado:** a lib `react-native-edge-to-edge`, que o próprio README dispensa a partir do RN 0.86.

### Async-storage 3 → voltar para 2.2.0? (média, P)

O upgrade para a 3.1.1 foi feito e testado: a migração do banco antigo funciona, inclusive com gravações pendentes no WAL, graças ao checkpoint adicionado no `MainApplication`. Mas o app só usa o export padrão, que na v3 mantém a semântica da v2. Por isso a v3 não traz ganho funcional e adiciona três custos:

- Room + KSP, com `AsyncStorage_kspVersion` fixado e acompanhando o Kotlin a cada upgrade;
- cerca de 1,1 MB de `libsqliteJni.so` por ABI;
- o passo de migração.

O Expo SDK 57 e o 58 (RN 0.88) ainda fixam a 2.2.0. Enquanto a versão com a v3 não for publicada, voltar para a 2.2.0 não exige migração, porque os aparelhos dos usuários continuam com o `RKStorage`. Depois da publicação, a volta perde cache e preferências: o `MainApplication` apaga o `RKStorage` assim que a migração termina, porque até a 1.3.4 ele guardava matrícula e senha em texto puro, e na v3 o `removeItem` da migração só limparia a cópia. As credenciais ficam no keychain e não são afetadas. Decidir antes do próximo release.

### `useRef(new Animated.Value(x)).current` → `useAnimatedValue` (média, P)

API oficial do RN. Afeta `LoadingBar`, `Skeleton`, `Spinner`, `Switch`, `ClassScheduleBoard` e `CustomDrawerNavigator`. É a maior causa de componentes que o React Compiler pula (8 de 15).

### Lint: ESLint adaptado → Oxlint com tipos (baixa, M)

- **Situação atual:** o `eslint.config.js` só roda no ESLint 10 com adaptações permanentes: `@eslint/compat`, troca de parser, fork do plugin de comentários e peers liberados. O preset do RN não declara suporte ao 10 nem na 0.88-rc.
- **Proposta:** `oxlint` 1.87 + `oxlint-tsgolint` 7, que roda sobre o TypeScript 7 que o repo já usa.
  - Tem regras com tipos que hoje não existem: `no-floating-promises`, `no-misused-promises` e `switch-exhaustiveness-check`.
  - Tem `no-restricted-imports` para a fronteira de domínio.
  - Remove cerca de 11 devDependencies.
- **O que se perde:** `react-native/no-inline-styles`, irrelevante com styled-components, e `no-deep-imports`, coberta pela API estrita de tipos.
- **Custo:** reescrever `scripts/__tests__/architecture.test.cjs`.
- **Meio-termo, se não migrar:** uma flat config própria com typescript-eslint, react-hooks e jest, sem o preset do RN. Não rodar os dois linters juntos.
- **Relacionado:** tirar o `eslint-plugin-prettier` e rodar `prettier --check` à parte. O próprio Prettier desaconselha a formatação como regra de lint.

### Changelog: auto-changelog → release-please (baixa, M)

O fluxo atual parou: o `auto-changelog` nem está nas dependências, o template filtra prefixos gitmoji e o `CHANGELOG.md` termina na 1.2.5. O release-please lê Conventional Commits, que é o padrão do histórico recente, e abre o PR de versão com changelog. Remove `.auto-changelog`, `changelog-template.hbs` e `setup.js`.

## Adições

### Observabilidade: Sentry (alta, M)

- **Por quê:** hoje não há visibilidade de erros em produção. O `ErrorBoundary` só registra em `__DEV__`, e o `AppError('PORTAL_LAYOUT_CHANGED')`, sinal de que o portal mudou o HTML, é um erro tratado que ninguém vê.
- **Escolha:** `@sentry/react-native` (8.30, com suporte ao RN 0.87) simboliza o Hermes e mostra a taxa de sessões sem crash por versão. O Crashlytics foi descartado porque não aceita source maps, e o JS do Hermes chegaria ilegível.
- **Configuração obrigatória para este app:**
  - região UE;
  - `sendDefaultPii: false`, sem `setUser` e sem IP;
  - `breadcrumbsIntegration({ xhr: false, console: false })`, porque a URL de login do portal leva a senha;
  - sem tracing nem Session Replay, porque as telas mostram nome e notas;
  - no plugin Gradle, `tracingInstrumentation` desligado, porque ele instrumentaria o OkHttp;
  - filtrar os erros transitórios (`NETWORK`, `CANCELLED`…).
- **Integração:** o Sentry não substitui o `ErrorReport`, que pega o que não vira exceção (nota faltando, turma errada). Integre os dois. O plano gratuito atende.
- **Pendências:** atualizar a política de privacidade, o formulário Data safety e a base da LGPD para a transferência internacional.

### Automação de dependências: Renovate + Knip (alta, P)

- **Renovate**, com:
  - grupos para o núcleo do RN (sob aprovação, porque exige o Upgrade Helper), React Navigation, TanStack e o tooling de lint/teste;
  - 3 dias de idade mínima nas versões que ele propõe (o `pnpm-workspace.yaml` não define `minimumReleaseAge`, então o próprio pnpm 12 fica no padrão de 1 dia nas instalações locais e nas dependências transitivas);
  - actions fixadas por digest;
  - `abandonments:recommended` para sinalizar libs paradas;
  - atualização também de `.node-version`, `packageManager` e do wrapper do Gradle.
    O Dependabot com grupos é a alternativa sem app de terceiros, mais limitada.
- **Knip** no CI: acha dependências, exports e arquivos sem uso. Hoje ele pegaria os 7 pacotes sem uso e o `src/examples`.

### React Compiler (média, P)

- **Instalação:** `babel-plugin-react-compiler@1.0.0`, com versão exata e como **primeiro** plugin do `babel.config.js` (o worklets continua por último). Ligar antes o preset de regras do Compiler no `eslint-plugin-react-hooks` 7, que já está instalado.
- **Cobertura:** num teste fora do repo, o Compiler compilou 152 de 167 componentes e hooks (91%). Os 15 pulados são leitura de ref no render (resolvida com `useAnimatedValue`), uma mutação e `try/finally`.
- **Ganhos:** navegação (o `App` recria `MainRoutes` a cada mudança de rota), listas (`TeacherSearch`) e formulários do Gerador.
- **Cuidado:** não remover a memoização existente em massa.
- **Rollout:** publicar primeiro no teste interno da Play.

### Teclado: `react-native-keyboard-controller` (média, M)

- **Hoje:** cada uma das três superfícies com teclado resolve de um jeito: hook com `LayoutAnimation` no mural, hook na folha e `KeyboardAvoidingView` sem `behavior` no Android no Login. No Android o RN só emite `keyboardDidShow`, então tudo salta depois que o teclado abre.
- **Possível bug atual:** no Login com edge-to-edge (Android 15+), o botão Entrar pode ficar sob o teclado.
- **Proposta:** a lib cobre os três casos (`KeyboardStickyView` no mural, `KeyboardAwareScrollView` no Login e nos formulários) e funciona dentro de `Modal`. Usar a versão 1.22.7 ou mais nova, que corrige um crash com o Reanimated 4.7.
- **Alternativa sem dependência:** edge-to-edge + `KeyboardAvoidingView` do core com `padding`. Corrige o posicionamento, mas sem acompanhar a animação do teclado.

### Testes E2E: Maestro (média, M)

- **Por que encaixa:** o modo demo (6 cenários, sem rede e determinístico) e os deep links `aouerj-dev://` já são a infraestrutura ideal, e `scripts/dev/screenshots.cjs` já faz à mão o que um fluxo do Maestro faz.
- **Cobertura:** o que o Jest não pega, como crash nativo, recriação da activity (o bug corrigido em `fe88f27`), folhas e teclado.
- **Proposta:** de 5 a 10 fluxos YAML em `.maestro/` e um workflow manual ou noturno com `android-emulator-runner`.
- **Descartado:** o Detox, que exige instrumentação nativa e dá mais manutenção.

### Entrega: release no CI + In-App Updates (média, M)

- **Hoje:** o release é feito à mão, com `pnpm bundle` local, a keystore no notebook e upload manual. A versão fica repetida em `package.json`, `versionName` e `versionCode`.
- **Proposta:**
  - workflow disparado por tag, num `environment` protegido, com `r0adkll/upload-google-play`;
  - um job que compila o release a cada PR com uma keystore descartável, porque problemas do R8 hoje só aparecem na hora de publicar;
  - `sp-react-native-in-app-updates`, para que as correções de parser cheguem em dias quando o portal mudar.
- **Avaliar depois:** OTA auto-hospedado (`hot-updater`), se o Sentry mostrar quebras frequentes.
- **Descartados:** CodePush (aposentado) e os OTAs pagos.

### Privacidade: regras de extração de dados (média, P)

`android:allowBackup="false"` não cobre a transferência entre aparelhos no Android 12+ em alguns fabricantes. Adicione `data_extraction_rules.xml`, excluindo `cloud-backup` e `device-transfer`. Assim o cache acadêmico não vai em texto puro para outro aparelho, e o aparelho novo não recebe o DataStore do keychain sem a chave do Keystore, o que causaria `STORAGE_FAILED`.

### Fluxo de commits: lefthook + commitlint (baixa, P)

- **lefthook:** um binário só faz os hooks de git (lint e Prettier nos arquivos staged, type-check no pre-push). Substitui husky + lint-staged.
- **commitlint:** com `config-conventional`, formaliza a convenção do histórico recente e alimenta o release-please.

### Abertura e loja: `react-native-bootsplash` e In-App Review (baixa, P)

- **`react-native-bootsplash`:** hoje a abertura passa por três etapas (ícone, azul vazio e o logo da tela de Loading). Com a lib, o logo nativo fica na tela até a navegação estar pronta. No iOS, substitui o `LaunchScreen.storyboard` do template, que ainda mostra o texto "aouerjmobile".
- **In-App Review:** pedir a avaliação depois de um momento positivo, nunca por botão.

### Sem nova dependência

- **`SafeAreaProvider`:** passar `initialMetrics={initialWindowMetrics}`, para evitar o primeiro quadro sem insets.
- **`filepaths.xml` do compartilhamento:** expõe `external-path` com `path="."`, mas o app só compartilha o PNG temporário do view-shot, que fica no cache. Basta `cache-path` e `external-cache-path`.
- **Toast de "Copiado":** a partir do Android 13 o próprio sistema confirma a cópia, então o toast aparece em duplicidade. Mostrar só abaixo da API 33.
- **Tema escuro:** `ThemeProvider` + `useColorScheme` + `src/themes/dark.ts`. A base tipada já existe, e não precisa de outra lib.
- **Aviso remoto:** um JSON estático no backend próprio, com `{ minSupportedVersionCode, avisos, recursosDesativados }`, para avisar quando o portal mudar.

## Remoções

| Pacote ou arquivo                                                                     | Motivo                                                                                                           |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `@react-native-vector-icons/*` (4)                                                    | Sem import; os ícones são SVG gerados. Tiram fontes `.ttf` do APK (só a MaterialDesignIcons tem cerca de 1,3 MB) |
| `@react-native-picker/picker`                                                         | Sem import; tira um módulo nativo do autolinking                                                                 |
| `react-native-reanimated-carousel`, `@react-navigation/native-stack`                  | Sem import (JS puro, só peso no lockfile)                                                                        |
| `react-native-svg-transformer`                                                        | Nenhum import de `.svg` sobrou; sai também do `metro.config.js` e do `declarations.d.ts`                         |
| `gitmoji-cli` (script `commit` e chave `gitmoji`)                                     | O histórico recente usa Conventional Commits puros                                                               |
| `react-native-modal` + patch, `react-native-animatable`                               | Depois da substituição acima                                                                                     |
| `iconv-lite`, `buffer`                                                                | Depois da substituição acima                                                                                     |
| `eslint-plugin-prettier`, `eslint-config-prettier`                                    | Se o Prettier passar a rodar à parte                                                                             |
| `.auto-changelog`, `changelog-template.hbs`, `setup.js`                               | Se adotar o release-please                                                                                       |
| `android/app/src/main/res/drawable*/screen.png`, `background_splash.xml`, `icon*.png` | Sem referência (sobras de um splash antigo, cerca de 324 KB)                                                     |
| `src/examples/*.ts`                                                                   | Sem import; conferir antes o possível dado pessoal                                                               |

## Manter (e por quê)

| Pacote                                         | Motivo                                                                                                                                                                                                                                                           |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `styled-components` 6.5                        | Voltou a ter desenvolvimento ativo; a 6.4 cortou o custo de runtime no RN. O tema tipado já está pronto para o modo escuro. Reavaliar na v7 estável                                                                                                              |
| `axios`                                        | No RN, fetch e axios usam o mesmo XHR nativo; trocar só arrisca a codificação dos parâmetros do login                                                                                                                                                            |
| `react-native-keychain` 10                     | Correto: Keystore + AES-GCM, `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, verificação após gravar. Migrar de lib arrisca deslogar todos os usuários                                                                                                                         |
| Clipboard, netinfo, share, view-shot, svg      | Ativas e com codegen. As alternativas Expo exigem o pacote `expo` (nenhum SDK mira o RN 0.87), e as versões Nitro só ganham com chamadas nativas de alta frequência, o que não é o caso aqui. Skia para o gráfico do CR custaria cerca de 4 MB sem ganho visível |
| Reanimated, worklets, gesture-handler, screens | Peers obrigatórios do drawer do React Navigation; com o carousel removido, passam a servir de base ao novo `BottomSheet`                                                                                                                                         |
| `@preeternal/react-native-cookie-manager` 7    | Sucessor oficial do pacote deprecado; só `clearAll()` é usado                                                                                                                                                                                                    |
| Persistência própria do TanStack Query         | Faz o que o persister oficial não faz (por conta, sem erros em disco); só precisa da correção do `gcTime`                                                                                                                                                        |
| `react-native-toast-message`                   | Mantida e é só o "motor"; colocar atrás de uma fachada `snackbar.*` e montar um host dentro do `Modal` da folha (hoje o toast fica atrás dela e o VoiceOver não anuncia)                                                                                         |
| FlatList/ScrollView do core                    | Listas simples de centenas de itens; FlashList v2 só se uma medição mostrar travamento                                                                                                                                                                           |
| Jest 30, Prettier 3, TypeScript 7              | Já são o caminho oficial ou o SOTA                                                                                                                                                                                                                               |

## Não vale a pena agora

- **Estilização:** NativeWind 4/5, Uniwind, Tamagui 3 e Unistyles 3 exigiriam reescrever cerca de 245 componentes. O Unistyles brilha na troca de tema sem re-render, um evento raro aqui.
- **Armazenamento e estado:** MMKV (sem gargalo medido), Zustand/Jotai (o estado de servidor está no TanStack e a identidade no controller), SQLite/WatermelonDB.
- **Rede:** `react-native-nitro-fetch` (o portal é HTTP/1.1 com TLS 1.2, e a lib não compartilha cookies com o XHR). Certificate pinning (o leaf atual vence em 30/10/2026, e a validade caiu para 200 dias). Detecção de root.
- **Plataforma:** migrar para Expo/CNG (há código nativo próprio, e nenhum SDK corresponde ao RN 0.87). Expo Modules avulsos, que trazem o `expo` inteiro como peer. EAS Build/Update (o Actions é grátis em repo público). CodePush (aposentado).
- **Módulos nativos:** trocar libs por versões Nitro só por velocidade (`react-native-nitro-cookies`, `react-native-sensitive-info`). Escrever um parser HTML nativo. Migrar o keychain para `expo-secure-store`.
- **Observabilidade:** Crashlytics (sem source maps), analytics de produto e Session Replay (telas com notas e nome, exigiria consentimento).
- **Testes e ferramentas:** Vitest (sem suporte oficial ao RN), Detox, MSW (a rede já está atrás de portas), Biome (lint por tipos sem o compilador), husky + lint-staged, changesets, testes visuais (Chromatic, Reassure).
- **UI:** `@gorhom/bottom-sheet`, Legend List, sheets nativas do `react-native-screens` (as folhas são UI transitória, não rotas).

## Bloqueados por versão

| Pacote                          | Atual → mais recente | Bloqueio                                                                                 |
| ------------------------------- | -------------------- | ---------------------------------------------------------------------------------------- |
| `react`                         | 19.2.3 → 19.3.0      | O RN 0.87 embute o renderer 19.2.3; a 19.3 vem com o RN 0.88 (ainda RC)                  |
| `test-renderer`                 | 1.2.0 → 1.3.1        | A 1.3 depende do `react-reconciler` 0.34, que exige React 19.3; sobe junto com o `react` |
| `@babel/core`, `@babel/runtime` | 7.29 → 8.0           | O preset de Babel do RN, o Metro e o plugin do worklets exigem Babel 7                   |

## Ordem sugerida

1. Correção do `gcTime`, verificação do certificado no Android 13 e decisão sobre o async-storage 3 (antes do próximo release).
2. Remoções sem risco, Knip e Renovate.
3. `react-native-modal` → motor próprio; regras de extração de dados.
4. Sentry com a configuração mínima.
5. Edge-to-edge + keyboard-controller, que mexem nas mesmas telas; QA em vários níveis de API.
6. cheerio (depois de criar fixtures reais) e o decodificador local.
7. React Compiler, depois de ligar as regras de lint.
8. Maestro, release no CI e In-App Updates.
9. Testing Library de forma gradual; Oxlint quando houver tempo.

## Fontes principais

- React Native: [0.86](https://reactnative.dev/blog/2026/06/11/react-native-0.86), [Upgrade Helper](https://react-native-community.github.io/upgrade-helper/), [State of React Native 2025](https://results.2025.stateofreactnative.com/)
- React Compiler: [1.0](https://react.dev/blog/2025/10/07/react-compiler-1), [instalação](https://react.dev/learn/react-compiler/installation)
- TanStack Query: [persistência e gcTime](https://tanstack.com/query/latest/docs/framework/react/plugins/persistQueryClient)
- Android: [Network Security Config](https://developer.android.com/privacy-and-security/security-config), [backup e extração de dados](https://developer.android.com/guide/topics/data/autobackup), [moodleapp#4914](https://github.com/moodlehq/moodleapp/pull/4914)
- [cheerio](https://github.com/cheeriojs/cheerio/releases), [Testing Library RN](https://callstack.github.io/react-native-testing-library/), [keyboard-controller](https://github.com/kirillzyusko/react-native-keyboard-controller/releases), [Sentry RN](https://github.com/getsentry/sentry-react-native/releases), [Maestro](https://docs.maestro.dev/platform-support/react-native)
- Ferramentas: [Knip](https://knip.dev/reference/plugins/react-native), [Renovate](https://docs.renovatebot.com/presets-group/), [Oxlint com tipos](https://oxc.rs/blog/2026-07-22-type-aware-linting-stable), [pnpm 11](https://pnpm.io/blog/releases/11.0)
