# Servidor do AO UERJ

O backend próprio do app, servido em `https://pitrol.dev`:

- em `/aouerj`, o mural de mensagens por turma, a lista de docentes, os
  relatos de erro, as sugestões dos apps antigos e a situação do Aluno Online
  vista do servidor. Veio da parte da UERJ do `server-pitroldev`; as rotas de
  rede (`/api/vpn`, `/api/isPortReachable`) e o site do pitrol.dev ficaram lá;
- em `/aouerj/v2`, a [identificação do aluno](#identificação-do-aluno-v2), a
  [Companhia agora](#companhia-agora) e o [Agora no campus](#agora-no-campus);
- em `/schedules`, o gerador de grades, que veio do `class-schedule-generator`.

Node 22.18 ou mais novo roda o TypeScript direto, sem etapa de build. Express
5, MongoDB (Mongoose 9), zod, pino, helmet, express-rate-limit e
`worker_threads` para o gerador.

> [!TIP]
> **Para quem chega:** o app sempre fala com `https://pitrol.dev`; rodar o
> servidor na sua máquina serve para mexer nele. O `pnpm install` da raiz já o
> instala, e o `pnpm test:server` roda os testes sem banco instalado. Boas
> portas de entrada são o domínio e os casos de uso de cada módulo
> (`domain.ts` e `application.ts`), testados com os repositórios em memória.
> O resto da documentação está em [docs/README.md](../docs/README.md), e o
> guia de contribuição, em [CONTRIBUTING.md](../CONTRIBUTING.md).

## Desenvolvimento

O `pnpm install` da raiz instala também o servidor (pelo `postinstall`). Ele
não faz parte do workspace do app: tem dependências e lockfile próprios, e
nada dele entra no `node_modules` do React Native.

```sh
cp server/.env.example server/.env   # ajuste o MONGODB_URI
pnpm server dev                      # node --watch src/main.ts
pnpm test:server                     # node --test (sobe um mongod próprio)
pnpm test:deploy                     # os scripts de deploy/server (só Linux)
```

`pnpm type-check`, `pnpm lint` e `pnpm format:check` da raiz cobrem o
servidor. O CI roda `pnpm test:server`, `pnpm test:deploy` e o `shellcheck`
dos scripts no Quality e antes de cada implantação.

## Arquitetura

Hexagonal (portas e adaptadores), com os nomes do app:

```text
src/
  main.ts             a partida e o desligamento (SIGINT/SIGTERM)
  config.ts           o ambiente, conferido na partida (zod)
  composition.ts      a raiz de composição: o único que conhece os dois lados
  shared/             erros do domínio e o relógio (com a cache por tempo)
  modules/<nome>/     o hexágono, um por módulo
    domain.ts         tipos, limites e regras puras (domain/ no schedules)
    ports.ts          a porta de entrada (o que o módulo oferece) e as de
                      saída (o que ele precisa: repositório, sonda, solver)
    application.ts    os casos de uso: implementam a porta de entrada
  adapters/
    inbound/          quem chama os casos de uso
      http/           Express: app, middlewares, erros, validação, contrato
        aouerj/       uma feature por arquivo: esquema, JSON e rotas
        schedules/    o pedido antigo → domínio (camada anticorrupção),
                      a resposta e as rotas
      scheduling/     o agendador que dispara a consulta ao portal
    outbound/         o que implementa as portas de saída
      mongo/          conexão, modelos e um repositório por agregado
      files/          anexos dos relatos em arquivo
      portal/         a consulta à página inicial do Aluno Online
      scheduleSolver/ a busca numa thread (com fila e prazo) ou na mesma
    logging.ts        o log em JSON
```

O domínio do gerador está dividido pelo que cada parte decide:

| Arquivo            | O que decide                                                         |
| ------------------ | -------------------------------------------------------------------- |
| `model.ts`         | Os tipos e os limites do pedido                                      |
| `compatibility.ts` | A política de compatibilidade: o que cabe na agenda e na mesma grade |
| `catalog.ts`       | As turmas que entram, a compatibilidade par a par e a identidade     |
| `metrics.ts`       | As medidas de uma grade (créditos, dias, tempo livre…)               |
| `ranking.ts`       | Uma estratégia por prioridade, compostas na ordem do aluno           |
| `leaderboard.ts`   | As cinco melhores, sem repetir, e o corte que poda a busca           |
| `search.ts`        | A busca em profundidade com poda                                     |

O Oxlint guarda as fronteiras:

- o domínio e os casos de uso não importam Express, Mongoose, pino, zod, o
  sistema de arquivos, a rede nem threads;
- o domínio não importa as portas nem os casos de uso;
- um adaptador de entrada não importa um de saída, nem o contrário: eles só
  se encontram no `composition.ts`.

Os testes:

| Arquivo                   | O que cobre                                                                      |
| ------------------------- | -------------------------------------------------------------------------------- |
| `schedules.test.ts`       | O domínio do gerador, comparado com um porte do gerador antigo                   |
| `application.test.ts`     | Os casos de uso, com os repositórios em memória (`test/support.ts`)              |
| `http.test.ts`            | As rotas, os status e os corpos que os apps publicados esperam                   |
| `mongo.test.ts`           | Os repositórios, os índices e a queda do banco, num mongod de verdade            |
| `adapters.test.ts`        | Anexos, a reconexão do banco, a fila e o pool de threads (heap estourado, saída) |
| `portal.test.ts`          | A situação do Aluno Online e a sonda, contra um portal local                     |
| `config.test.ts`          | O ambiente e os erros de configuração                                            |
| `main.test.ts`            | O processo de verdade: a partida, o log e o SIGTERM (este, fora do Windows)      |
| `smoke.test.ts`           | O `deploy/server/smoke.mjs` contra o servidor, como o deploy o roda              |
| `campusNow.test.ts`       | Agora no campus: as regras, os casos de uso, as rotas e a aba do admin           |
| `campusNow.mongo.test.ts` | Agora no campus num mongod: o lugar guardado e as gravações de uma vez só        |

O mongod vem do `mongodb-memory-server`, na versão de produção
(`test/mongo.ts`). A primeira execução baixa o binário para
`~/.cache/mongodb-binaries`: uns 100 MB no Linux, 800 MB no Windows. Os
scripts de implantação têm os próprios testes em `deploy/server/test/`, com
pm2, nginx e sudo de mentira no `PATH`.

## API

Os caminhos, métodos, status e corpos são os do servidor que a produção já
roda, porque os apps publicados dependem deles. Os tipos estão em
[`src/adapters/inbound/http/contract.ts`](src/adapters/inbound/http/contract.ts),
que o app também importa.

| Rota                         | O que faz                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------ |
| `GET /aouerj/portal-status`  | Situação do portal (`up`, `down`, `unknown`), sem banco, com cache de 60 s     |
| `GET /aouerj/health`         | O processo e o estado do banco                                                 |
| `GET /aouerj/status`         | A versão no ar (commit, cor, desde quando) e as partes; 503 sem o banco        |
| `POST /aouerj/messages/get`  | A conversa de uma turma: as 500 mais recentes, da mais antiga para a mais nova |
| `POST /aouerj/messages/post` | Grava e devolve a mensagem (200)                                               |
| `GET /aouerj/docentes`       | Os nomes, em ordem alfabética (cache de 5 min)                                 |
| `GET /aouerj/docentes/:name` | Até 50 docentes cujo nome contém o texto (literal)                             |
| `POST /aouerj/reportError`   | Grava os anexos e o relato; responde `{ "status": "ok" }`                      |
| `POST /aouerj/suggestions`   | Grava a sugestão; responde `{ "status": "ok" }`                                |
| `GET /aouerj/reportError`    | Administração: os 100 relatos mais recentes, com e-mail                        |
| `GET /aouerj/suggestions`    | Administração: as 200 sugestões mais recentes, com e-mail                      |
| `GET /aouerj/admin`          | Administração no navegador: a triagem dos relatos (veja abaixo)                |
| `POST /schedules/generate`   | As até 5 melhores grades das turmas enviadas (`{ data, exhaustive }`)          |
| `GET /schedules/health`      | O gerador: buscas rodando e na fila                                            |

- **Erros:** sempre `{ "error", "message" }`. Entrada inválida é 400
  `invalid_request`, com a mensagem do servidor antigo ("fullName is
  required"); banco fora é 503 `database_unavailable`; excesso de gravações é
  429 `rate_limited`; JSON quebrado é 400 `invalid_json`; corpo grande demais é
  413 (100 KB em `/aouerj`, como no servidor antigo, e 1 MB em `/schedules`).
- **Tolerância com os apps antigos:** número em `turma`, `periodo` e
  `disciplina` vira texto, como o Mongoose já fazia. Um e-mail inválido num
  relato ou sugestão é descartado, sem recusar o resto.
- **Administração:** as listagens trazem e-mail. Elas exigem
  `Authorization: Bearer <ADMIN_TOKEN>` ou o cookie do login de
  `/aouerj/admin`. Sem o acesso (ou sem o token configurado), respondem 404,
  como uma rota que não existe.
- **Gerador:** fila cheia é 503 `generator_busy`; uma thread que não responde
  é 503 `generator_timeout`. Entrada inválida diz onde
  (`classes[0].schedules[0].week_day`).

### Administração no navegador

`https://pitrol.dev/aouerj/admin` pede o `ADMIN_TOKEN` e grava um cookie de 30
dias. A página de login não diz o que protege nem onde fica o token, e cada IP
tem 10 tentativas erradas a cada 15 minutos (acertar não conta).

- **O cookie:** `HttpOnly`, `SameSite=Strict`, `Secure` em HTTPS e no caminho
  `/aouerj`. O valor é tirado do token por HMAC, não é o próprio token. Trocar
  o `ADMIN_TOKEN` derruba todos os logins; "Sair" apaga o deste navegador.
- **Relatos:** os abertos primeiro, por dia (no fuso de São Paulo), com
  filtro por situação (abertos, resolvidos, todos) e por tela. O diagnóstico
  que os apps 2.x mandam vira fatos no relato (versão do app, da leitura do
  portal, tipo e disciplina).
- **Resolver e reabrir:** grava `resolvedAt` no relato (os antigos não têm o
  campo e contam como abertos). O formulário leva um `csrf` tirado do token,
  além do cookie `SameSite=Strict`.
- **Anexos:** o diagnóstico abre numa página. A página do portal que os apps
  1.x mandavam abre com `Content-Security-Policy: sandbox`: sem script, numa
  origem própria e sem buscar nada na rede, então não lê o cookie nem as
  outras páginas. Só abre o anexo do próprio relato.
- **Sugestões:** numa aba ao lado, das mais novas às mais antigas.
- **Companhia:** a terceira aba. Em cima, os números dos últimos 14 dias
  (quem olhou a lista e quantos a acharam vazia, mesas e voltas abertas,
  quantas tiveram companhia, chegaram ao ponto e "Cheguei em casa", quem foi
  tirado, denúncias e chamadas fora do ar) e, no dia mais recente, quem olhou
  em cada hora. Embaixo, as denúncias dos últimos 30 dias: o motivo, de onde
  veio (de quem foi junto, de quem chamou ou de fora), a chamada como estava
  (sem as chaves) e se ela saiu do ar, com o botão "Tirar do ar" enquanto a
  chamada valer. Com os apps identificados, cada denúncia mostra quem estava
  (nome e matrícula de cada um) e quem denunciou, com o link para o aluno.
- **Alunos:** a quarta aba. Busca pela matrícula, os banidos e os que
  entraram por último; a página do aluno mostra matrícula, nome, aparelhos e
  primeira e última entrada, com "Banir" (motivo e prazo: 1, 7 ou 30 dias ou
  para sempre) e "Desbanir". O banimento vale na hora nas rotas com sessão e
  na entrada por qualquer aparelho, e o aluno sai das mesas da Companhia (as
  que ele abriu acabam). Os relatos da v2 também mostram o aluno. A busca vai
  por POST, para a matrícula não ficar nos logs. Sem `STUDENT_DATA_KEY`, a aba
  avisa que a identificação está desligada.
- **Agora no campus:** a aba entre a Companhia e os Alunos, com a contagem
  dos avisos denunciados que esperam você. Em cima, os números da semana;
  embaixo, os denunciados dos últimos 7 dias e os avisos mais recentes, cada
  um com o lugar, as respostas, quantos viram, os valeus e quem avisou (o
  link para o aluno). "Tirar do ar" tira os 15 pontos de quem avisou; "Voltar
  ao ar" e "Está certo" devolvem e fazem as denúncias pararem de tirá-lo do
  ar sozinhas.

As páginas são HTML montado no servidor (`http/aouerj/admin/`), sem
JavaScript, com as cores dos temas claro e escuro do app. Os relatos antigos
que chegaram sem a tela aparecem como "Sem tela".

### Identificação do aluno (v2)

O app identifica o aluno pela matrícula, com a Play Integrity no Android e o
App Attest no iPhone (o módulo `modules/students`). As rotas de `/aouerj`
continuam iguais, sem nada disso, para os apps publicados.

1. **O desafio:** `GET /aouerj/v2/students/challenge` devolve 36 bytes de uso
   único, válidos por 5 minutos, com um HMAC do servidor. É o mesmo para os
   dois aparelhos, e sai enquanto um deles tiver quem ateste.
2. **A entrada:** depois do login no Aluno Online, o app manda a matrícula e
   o nome do portal em `POST /aouerj/v2/students/session`, com a atestação
   sobre o `requestHash`: o SHA-256 de `AO UERJ student session v1`, do
   desafio, da instalação (32 bytes, os mesmos de sempre no aparelho) e, cada
   um com o tamanho (u16) na frente, da matrícula e do nome. O Android manda
   `integrityToken`, o token da Play Integrity sobre o hash em hex; o iPhone
   manda `appAttest` (`keyId` e `attestation`, em base64 padrão), uma chave
   nova do App Attest atestada com os 32 bytes do hash como `clientDataHash`.
   Um dos dois, nunca os dois (400). A atestação vale só para aquela
   matrícula, naquele aparelho, agora.
3. **As checagens:** o desafio é nosso, vale e é gasto; no Android, o Google
   decifra o token e o servidor confere o pacote, o `requestHash`, a idade,
   `PLAY_RECOGNIZED`, o certificado da Play, `MEETS_DEVICE_INTEGRITY` e o app
   instalado pela loja (`LICENSED`); no iPhone, o servidor mesmo confere o
   App Attest (abaixo).
4. **A sessão:** 32 bytes ao acaso, em `Authorization: Student <sessão>` em
   cada pedido. Vale 30 dias sem uso (cada uso empurra o prazo, uma vez por
   hora). O banco guarda só o SHA-256 (`studentsessions`, índice TTL). Uma
   sessão desconhecida dá 401 `invalid_session`, e o app entra de novo;
   `POST /students/session/end` é o logout.

**O iPhone (App Attest):** o servidor confere a atestação sozinho, sem falar
com a Apple (`adapters/outbound/attestation/appAttest.ts`), nos passos de
"Validating apps that connect to your server":

- **O objeto:** CBOR, `{ fmt: "apple-appattest", attStmt: { x5c, receipt },
authData }`, lido por um leitor estrito, feito só para ele (bytes, texto,
  listas e mapas de tamanho definido, sem chave repetida, nada sobrando, até
  24 KB). O pedido recusa uma `attestation` de mais de 32 768 caracteres e
  base64 fora da forma padrão (400).
- **A cadeia:** o credCert foi emitido e assinado pela intermediária, e ela
  pela Apple App Attestation Root CA, fixada no código (`appleRoot.ts`, com a
  impressão SHA-256 conferida na partida); os três valem agora.
- **O pedido:** o SHA-256 do `authData` com o `clientDataHash` (os 32 bytes do
  `requestHash`, que o servidor refaz como no Android) é o nonce da extensão
  1.2.840.113635.100.8.2 do credCert.
- **A chave:** o SHA-256 da chave pública do credCert (o ponto P-256 sem
  compressão) é o `keyId`, que também é o `credentialId` do `authData`.
- **O app:** o `rpIdHash` do `authData` é o SHA-256 do
  `APPLE_APP_ATTEST_APP_ID` (`<Team ID>.<bundle id>`).
- **Chave nova e ambiente:** o contador é zero e o `aaguid` é o da produção
  (`appattest` e sete zeros). `APPLE_APP_ATTEST_ENVIRONMENT=development`
  aceita também o `appattestdevelop` dos builds rodados pelo Xcode (a
  TestFlight e a App Store são sempre produção), e a partida avisa no log.

O iPhone não tem um `LICENSED` nem um `MEETS_DEVICE_INTEGRITY`: o App Attest
garante uma chave no Secure Enclave de um aparelho da Apple, no app assinado
pelo nosso time, mas não diz de onde o app foi instalado. O recibo (a métrica
de fraude da Apple) não é usado. Uma recusa é 403 `attestation_failed`, como
no Android, e o motivo vai só para o log. Sem `APPLE_APP_ATTEST_APP_ID` (hoje
não há conta da Apple), a entrada do iPhone responde 503
`student_identity_unavailable` e o Android segue igual.
`TOKEN_ATTESTATION=development` vale só para a Play Integrity: o simulador do
iPhone não tem App Attest.

- **Testes:** `appAttest.test.ts`, contra uma cadeia de mentira que o
  `test/fixtures/appAttest.sh` gerou com o OpenSSL (uma raiz e uma
  intermediária no lugar das da Apple e um credCert por caso; as chaves
  privadas não ficam no Git): a atestação boa, o nonce de outro pedido, outro
  `keyId`, outro App ID, o `aaguid` de desenvolvimento ou outro, o contador,
  a cadeia que não chega à raiz (com uma intermediária impostora de mesmo
  nome), as datas e o CBOR malformado. As rotas, em `students.test.ts`.

**O aluno no banco** (`students`): um documento por matrícula, achado pelo
HMAC dela (`lookup`, único). Matrícula e nome ficam cifrados (AES-256-GCM, o
nome do campo como dado associado); os aparelhos, pelo HMAC da instalação (os
10 mais recentes). As chaves saem de `STUDENT_DATA_KEY` (32 bytes em base64,
`openssl rand -base64 32`) por HKDF. Sem ela, a entrada responde 503
`student_identity_unavailable`. Trocar essa chave perde o acesso aos alunos
já guardados.

**Banimento:** um aluno banido recebe 403 `student_banned`, com `until`
(`null` é para sempre) e `reason`, na entrada e em qualquer rota com sessão;
as chamadas que ele abriu acabam e ele sai das outras. Vale na hora no
processo que baniu; o cache de 30 segundos das sessões é o prazo para valer
num outro. Enquanto `STUDENT_TOKENS=accept`, um app antigo (2.11.1 a 2.13)
ainda entra na Companhia com o token anônimo, que não diz quem é: o
banimento só fecha tudo com `refuse`.

**Com a sessão:**

- a Companhia agora (abaixo) guarda o aluno de cada membro;
- o mural (`POST /v2/mural/thread` e `/v2/mural/messages`), a busca de
  docentes (`GET /v2/teachers` e `/v2/teachers/:name`) e o relato de erro
  (`POST /v2/reports`, sem e-mail) exigem a sessão e guardam o aluno nas
  gravações, com os corpos e as respostas de `/aouerj`;
- o gerador (`/schedules`) aceita a sessão e conta a geração por aluno; sem
  ela, ou com o banco fora do ar, segue como antes (banido, 403).

As gravações contam por aluno (`COMPANION_MEMBER_LIMIT_PER_MINUTE`). Os
desafios, as entradas e as saídas contam por IP
(`STUDENT_RATE_LIMIT_PER_MINUTE`, 120: cada entrada é um desafio e um pedido,
e cada uma do Android gasta uma decifração da Play Integrity na cota do
Google; a do iPhone é conferida aqui mesmo; o aluno entra uma vez por mês,
então o Wi-Fi da UERJ cabe). O resultado de
cada sessão fica 5 minutos no cache do processo (nunca além do fim da
sessão ou do banimento; banir, desbanir e sair valem na hora), e só sessões
verdadeiras entram nele, até 20 000. Uma sessão que o cache já conhece
conta por aluno (`STUDENT_SESSION_LIMIT_PER_MINUTE`, 300), e não pelo IP: o
Wi-Fi da UERJ põe muitos alunos num IP só, e as listas da Companhia e de
Agora no campus atualizam sozinhas. A desconhecida (a primeira do processo,
um token inventado) conta antes do banco no teto da Companhia por IP. Os apps de 2.11.1 a
2.13 ainda entram na Companhia com o token anônimo (abaixo) enquanto
`STUDENT_TOKENS=accept`, o padrão; `refuse` exige a sessão (401
`session_required`).

### Tokens anônimos (apps de 2.11.1 a 2.13)

A primeira versão da v2 seguia o plano da prova de aluno anônima com o Privacy
Pass, e os apps dessa época continuam usando:

- **O token:** cada requisição leva `Authorization: PrivateToken token="…"`
  (RFC 9577), um token Blind RSA de 2048 bits (RFC 9578, tipo `0x0002`).
  Assinado às cegas, ele não se liga a quem o pediu, nem por nós.
- **O desafio:** fixo, com emissor e origem `pitrol.dev` e sem
  `redemption_context`, para o app buscar os tokens com antecedência e em
  lote.
- **Sem token válido:** 401 `unauthenticated`, sempre com a mesma resposta,
  e o desafio e a chave no `WWW-Authenticate`. O motivo (ausente, malformado,
  outra chave, chave vencida, assinatura falsa, já gasto) vai só para o log;
  o token nunca vai.
- **Uso único:** um token gasto fica na coleção `spenttokens` só como
  `SHA-256(id da chave ‖ nonce)`, sem a hora do uso, e o MongoDB o apaga um
  dia depois de a chave vencer (índice TTL; a folga cobre um relógio do banco
  adiantado). Um segundo uso perde na inserção, sem corrida.
- **As chaves:** `PRIVATE_TOKEN_KEYS`, com as chaves do emissor e a data em
  que cada uma deixa de valer (veja o `.env.example`). A privada (RSA comum,
  PKCS #8) resgata e emite; a pública (SPKI) só resgata, para uma chave
  antiga cuja privada já foi descartada. O id de cada chave é o SHA-256 do
  SPKI na forma da RFC; o servidor normaliza a que o OpenSSL exporta. Sem
  chave, a v2 responde 503 `student_access_unavailable`; sem o banco, 503
  `database_unavailable`, como as rotas de `/aouerj`.

**A emissão** (a fase 1 do plano) troca a atestação do app por um lote de
tokens assinados às cegas:

1. **O desafio:** `GET /aouerj/v2/tokens/challenge` devolve 36 bytes de uso
   único, válidos por 5 minutos, e a chave com que o app cega os pedidos. O
   desafio leva um HMAC do servidor e não fica guardado.
2. **O pedido:** o app cega até `TOKEN_BATCH_SIZE` tokens (32) e pede à Play
   Integrity (pedido standard) um token sobre o `requestHash`, o SHA-256 do
   desafio, da instalação (32 bytes ao acaso, criados uma vez) e dos pedidos.
   Os formatos estão em `contract.ts`.
3. **As checagens:** o desafio é nosso, vale e é gasto; cada pedido é para a
   chave atual; o Google decifra o token de integridade, e o servidor confere o
   pacote, o `requestHash`, a idade, `PLAY_RECOGNIZED`, o certificado de
   assinatura da Play e `MEETS_DEVICE_INTEGRITY`; a instalação não passou de
   `TOKEN_BATCHES_PER_DAY` lotes (4) no dia.
4. **A resposta:** as assinaturas cegas (RSA crua, conferida com a pública).
   O servidor não vê os tokens que saem delas, então o resgate não se liga à
   emissão.

O que fica no banco: o hash de cada desafio usado (`usedchallenges`, até
vencer) e, por instalação e dia, um HMAC com a contagem (`issuancecounters`,
um dia depois do fim do dia). O HMAC muda a cada dia, então os contadores de
dias diferentes não se ligam, e o banco sozinho não leva à instalação. O log
registra quantos tokens saíram e o motivo de uma recusa, nunca a instalação
nem a atestação.

O servidor não vê o login no Aluno Online: quem garante "aluno" é o app, que
só pede tokens logado (o limite registrado no plano). Sem a conta de serviço
da Play Integrity, a emissão responde 503 `token_issuance_unavailable` e o
resgate continua. `TOKEN_ATTESTATION=development` aceita qualquer app, para o
emulador e o debug, e a configuração o recusa em produção.

- **Testes:** o vetor 1 do apêndice A.2 da RFC 9578 confere a assinatura
  cega do servidor e o cliente de teste, que faz o papel do app (cegar,
  tirar o fator cego, montar o token). Também: o gasto duplo, o desafio
  forjado, vencido ou repetido, a atestação de outro pedido, o limite do dia,
  a corrida no contador, a Play Integrity com um Google de mentira, as chaves
  e o log.

| Rota                              | O que faz                                                                           |
| --------------------------------- | ----------------------------------------------------------------------------------- |
| `GET /aouerj/v2/tokens/challenge` | O desafio de emissão e a chave; 503 sem chave privada ou atestação                  |
| `POST /aouerj/v2/tokens`          | O lote: 403 `invalid_challenge` ou `attestation_failed`, 422, 429 com `Retry-After` |
| `GET /aouerj/v2/auth`             | 200 `{ "authenticated": true }` com token válido (que fica gasto); 401 sem          |

Desafios e lotes dividem um limite por IP (`TOKEN_RATE_LIMIT_PER_MINUTE`, 60).

### Companhia agora

Encontros de minutos entre alunos que não se conhecem (o módulo
`modules/companion`): uma mesa no almoço (`lunch`) ou um grupo para voltar
depois da última aula da noite (`home`).

- **Quem abre, entra ou denuncia de fora** manda a sessão de aluno (os apps
  antigos, um token). Abrir e entrar devolvem uma **chave de membro** (32
  bytes ao acaso) que vale só naquela chamada: o app a manda em
  `X-Member-Key` para ler a chamada, mandar recado, sair e denunciar de
  dentro. O banco guarda só o SHA-256 dela.
- **Com a sessão, o membro guarda o aluno:** a moderação sabe quem estava em
  cada chamada denunciada; um aluno abre uma chamada por vez (abrir outra
  encerra a anterior), entra uma vez em cada uma (409 `already_member`), e
  quem foi tirado não volta por outro aparelho. A participação de um aluno só
  vale com a sessão dele: a chave sozinha dá 403 `session_required`. A
  resposta nunca mostra o aluno de ninguém, só os primeiros nomes.
- **A lista** pede o **passe de aluno** (`X-Student-Pass`): 36 bytes que um
  token compra em `POST /companion/pass` e que valem uma hora de leituras,
  para o app atualizar a lista sem gastar um token a cada 20 segundos. O passe
  leva um HMAC tirado da chave privada do emissor e não fica guardado; a
  troca de chave não derruba os passes da hora.
- **"De olho agora":** a lista diz em `watching` quantos alunos a olharam nos
  últimos 15 minutos, contando quem pergunta. Conta pelo SHA-256 do passe,
  guardado só por esses 15 minutos (coleção `companionwatchers`, índice TTL):
  o passe não se liga a ninguém, e o número serve para quem pensa em abrir
  uma mesa saber que há gente olhando.
- **Os prazos:** a chamada aparece na lista 1 hora antes do horário e sai 30
  minutos depois (a mesa) ou 10 minutos depois da saída (a volta); some de
  vez, do banco também (índice TTL), 30 minutos depois na mesa e 2 horas
  depois na volta, para dar tempo do "Cheguei em casa". Abre-se até 3 horas à
  frente.
- **As regras:** o ponto de encontro é um lugar do Mapa do app dentro do
  campus (`ru`, `lago`, `concha` na mesa; `concha`, `portao-1`, `portao-5` na
  volta), o destino é genérico (`metro`, `trem`, `onibus`), até 6 pessoas na
  mesa e 8 na volta, o nome é um primeiro nome só, e o recado tem até 80
  caracteres, sem telefone, @ ou link (422 `note_not_allowed`). A última vaga
  se ocupa na mesma operação que confere a vaga: duas pessoas não ficam com
  ela.
- **Recados prontos**, sem conversa livre: `on_my_way`, `at_spot`, `late` e,
  só na volta, `home_safe`. A chamada guarda os 60 mais recentes.
- **Denúncias:** uma por membro e, de fora, uma por aluno (com o token dos
  apps antigos, cada uma gasta um token). Assédio
  denunciado por quem foi junto tira a chamada do ar na hora; outro motivo,
  com duas pessoas de dentro (quem chamou não conta). A denúncia de fora não
  tira nada sozinha, porque uma pessoa só, com três tokens, derrubaria
  qualquer chamada: ela vai para a moderação, que tira a chamada do ar pela
  aba "Companhia" de `/aouerj/admin`. Cada denúncia guarda, por 30 dias, o que
  a chamada era (tipo, horário, ponto, destino, recado e os primeiros nomes) e
  de onde veio, sem as chaves.
- **Tirar alguém:** cada membro tem um apelido ao acaso (`ref`, 11
  caracteres) que só quem está na chamada vê. Quem chamou tira alguém por ele
  (`POST …/members/:ref/remove`); o id de quem saiu fica em `removed`, e a
  chave dele passa a receber 403 `removed_from_call`.
- **Os números do dia** (coleção `companionstats`, um documento por dia de
  São Paulo, meio ano): só contagens, sem id, nome, recado ou hora exata.
  Abertas por tipo, chamadas que chegaram a duas pessoas e que lotaram,
  entradas, saídas, encerradas, tirados, cada recado pronto, chamadas com um
  "Cheguei no ponto", denúncias por origem, fora do ar por denúncia ou pela
  moderação, aberturas recusadas pelo teto e, por hora, quem chegou à lista e
  quem a achou vazia. Uma falha ao gravá-los não atrapalha o pedido.
- **O teto:** 500 chamadas valendo ao mesmo tempo (503 `companion_full`).
- **Os limites:** o token já é o limite de quem pede o passe, abre e entra,
  então o IP tem só um teto folgado (`COMPANION_IP_LIMIT_PER_MINUTE`, 1200),
  porque o Wi-Fi da UERJ e o CGNAT das operadoras põem centenas de alunos num
  IP só. O que usa a chave de membro (recados, sair, tirar, denunciar de
  dentro) conta por chave (`COMPANION_MEMBER_LIMIT_PER_MINUTE`, 30).

| Rota                                                      | Com                  | O que faz                                                         |
| --------------------------------------------------------- | -------------------- | ----------------------------------------------------------------- |
| `POST /aouerj/v2/companion/pass`                          | token                | O passe de uma hora                                               |
| `GET /aouerj/v2/companion/calls`                          | passe                | As chamadas na lista, a mais próxima primeiro; 401 `invalid_pass` |
| `POST /aouerj/v2/companion/calls`                         | token                | Abre (201): a chamada e a chave de membro                         |
| `GET /aouerj/v2/companion/calls/:id`                      | chave                | A chamada por dentro: os primeiros nomes e os recados             |
| `POST /aouerj/v2/companion/calls/:id/members`             | token                | Entra (201); 409 `call_full` ou `call_closed`                     |
| `POST /aouerj/v2/companion/calls/:id/phrases`             | chave                | Manda um recado pronto; 409 `call_ended`                          |
| `POST /aouerj/v2/companion/calls/:id/leave`               | chave                | Sai; quem chamou encerra para todos                               |
| `POST /aouerj/v2/companion/calls/:id/members/:ref/remove` | chave de quem chamou | Tira alguém; 403 `not_the_host`, 409 `cannot_remove_host`         |
| `POST /aouerj/v2/companion/calls/:id/reports`             | chave ou token       | Denuncia, com o motivo                                            |

Sem a chamada (acabou, saiu do ar, nunca existiu): 404 `call_not_found`; uma
chave que não é dela: 403 `not_a_member`; uma chave tirada por quem chamou:
403 `removed_from_call`. Os tipos estão em `contract.ts`.

### Agora no campus

Avisos curtos dos próprios alunos sobre o campus, que somem sozinhos (o
módulo `modules/campus-now`): a fila dos elevadores, o bandejão, a luz e o
ar, a internet, os banheiros e o acesso (portão, rampa, sala trancada). Só
com a sessão de aluno: o servidor sabe quem avisou e quem respondeu, para os
pontos, os limites e a moderação; os outros alunos nunca veem.

- **Sem texto livre.** O tipo (`kind`), a situação (`status`) e o lugar vêm
  de listas fechadas, e cada situação pede um tipo de lugar: o hall dos
  elevadores (no bloco C), o bandejão, um portão do atlas do Mapa, um andar
  de um bloco (o subsolo só no F) ou uma sala (o código da grade). O resto é
  422 `invalid_place`; uma situação de outro tipo, 400.
- **Novo até alguém confirmar.** O aviso vale para todos (`confirmed`) com o
  primeiro "Continua" de outro aluno ou, direto, se quem avisou tem nível 3
  ou mais (o selo `level`). A primeira confirmação dá 5 pontos a quem avisou.
- **Some sozinho:** cada situação vale um tempo desde a criação ou o último
  "Continua" (fila do bandejão, 30 minutos; filas dos elevadores, 45 e 60;
  elevadores parados, 3 horas; luz, internet e banheiros, 2 horas, interditado
  3; portão e rampa, 6 horas; sala trancada, 1 hora), nunca mais de 12 horas
  depois da criação. Três "Acabou" de alunos diferentes encerram antes, e o
  "Acabou" de quem avisou ("Já resolveu") encerra na hora.
- **Repetido vira confirmação.** Avisar o mesmo tipo, situação e lugar de um
  aviso que vale é o "Continua" dele (`merged`). Outra situação no mesmo
  lugar (a fila que cresceu) encerra a anterior (`replaced`). Dois alunos
  avisando o mesmo ao mesmo tempo ficam com um aviso só.
- **Uma vez por aluno.** Cada aluno responde um aviso uma vez (de "Continua"
  ainda pode ir a "Acabou"; o resto é 409 `already_answered`), agradece uma
  vez e denuncia uma vez; o próprio aviso não se confirma, agradece nem
  denuncia (403 `own_notice`). Uma linha por aviso e aluno (`campusanswers`,
  `_id` `<aviso>:<aluno>`), com a condição no filtro da gravação, faz dois
  pedidos juntos contarem uma vez só.
- **"Não é verdade":** três denúncias de alunos diferentes tiram o aviso do
  ar, e quem avisou perde 15 pontos. A moderação vê os denunciados na aba
  "Agora no campus" de `/aouerj/admin`, com quem avisou (nome e matrícula), e
  decide: "Tirar do ar" (os 15 pontos saem, uma vez só) ou "Voltar ao ar" /
  "Está certo" (os pontos voltam, e as denúncias não o tiram mais sozinhas).
  O banimento tira do ar, na hora, os avisos do aluno que ainda valem, sem
  mexer nos pontos.
- **Os pontos** ficam por aluno (`campuspeople`), sem placar entre alunos:
  avisar, 10; responder ("Continua" ou "Acabou", a primeira vez em cada
  aviso), 3; o próprio aviso confirmado, 5; cada "Valeu" recebido, 1; aviso
  tirado do ar, −15 (nunca abaixo de zero). Por dia (de São Paulo), só os 5
  primeiros avisos e as 10 primeiras respostas dão pontos. Os níveis: 1 desde
  o começo, 2 com 100, 3 com 300, 4 com 800, 5 com 2000.
- **Os limites:** 10 avisos novos por aluno por dia (429
  `notice_limit_reached`); 300 avisos valendo no campus inteiro (503
  `campus_full`); as gravações por aluno por minuto, na mesma conta da
  Companhia (`COMPANION_MEMBER_LIMIT_PER_MINUTE`, 30, num contador próprio);
  as leituras, só o teto por IP da v2.
- **Para muitos alunos:** a lista que vale para todos fica guardada 5
  segundos no processo (e é refeita a cada gravação dele); o que cada um
  respondeu vem numa consulta só, pelos `_id`. "Quantos ajudaram hoje"
  (`helpersToday`: quem avisou, respondeu ou agradeceu no dia, contado pelas
  linhas de `campusdays`) fica guardado um minuto, e o resumo do campus, dez.
- **Vistos:** o app manda os ids que apareceram na tela (`POST /seen`, até
  50); cada aluno conta uma vez em cada aviso, e o próprio não conta. Só
  quem avisou vê `views` e `thanks`.
- **O resumo do campus** (`/community`): a semana, de segunda até agora
  (avisos, respostas, vistos e a média até acabar), e o mês de agora ou o
  anterior (`?month=AAAA-MM`), só com avisos confirmados que não saíram do
  ar, juntados por tipo, situação e área (o bloco ou o portão): em quantos
  dias houve, quantos avisos, a média até acabar e as duas horas com mais
  avisos. `weekdays` são os dias de segunda a sexta do mês até hoje.

| Rota                                                | O que faz                                                                |
| --------------------------------------------------- | ------------------------------------------------------------------------ |
| `GET /aouerj/v2/campus-now`                         | Os avisos que valem, o que o aluno respondeu, `helpersToday` e os pontos |
| `POST /aouerj/v2/campus-now/notices`                | Avisa (201): o aviso, `merged`, `replaced` e os pontos                   |
| `POST /aouerj/v2/campus-now/notices/:id/answer`     | "Continua" (`confirm`) ou "Acabou" (`end`)                               |
| `POST /aouerj/v2/campus-now/notices/:id/thanks`     | "Valeu"                                                                  |
| `POST /aouerj/v2/campus-now/notices/:id/flag`       | "Não é verdade"                                                          |
| `POST /aouerj/v2/campus-now/seen`                   | Os avisos que apareceram na tela                                         |
| `GET /aouerj/v2/campus-now/you`                     | Os pontos, as contagens, a semana e os avisos de hoje do aluno           |
| `GET /aouerj/v2/campus-now/community?month=AAAA-MM` | O campus somado: a semana e o mês                                        |

Sem a sessão, 401; sem o aviso (acabou, saiu do ar, nunca existiu), 404
`notice_not_found`. Os tipos estão em `contract.ts`.

### Consultar o que está no ar

```sh
curl -s https://pitrol.dev/aouerj/status
```

Responde o commit e a cor (azul ou verde) implantados, quando o processo
subiu, o banco, a situação do portal e a fila do gerador, sem dado de aluno e
sem cache. A versão do Node fica de fora: só serviria para mirar uma falha
conhecida. O status HTTP é 200, ou 503 enquanto o banco
não está conectado: serve para um monitor de disponibilidade. A implantação
usa a mesma rota para conferir que a versão que responde é o commit que
acabou de subir (`smoke.mjs --expect-commit`).

## Gerador de grades

O pedido e a resposta são os do `class-schedule-generator` que a produção
roda: o commit 7ea21b8 mais três correções que só existem na VM (o mínimo do
aluno no lugar de 3, os horários ocupados repassados à busca e o choque
permitido valendo nas duas ordens). As regras:

- sai a turma de disciplina desconhecida e a que bate com um horário ocupado
  (nem o choque permitido passa por cima dele);
- uma turma por disciplina, sem choque, a não ser que uma das duas disciplinas
  permita;
- duas grades com as mesmas disciplinas nos mesmos horários são uma só: fica
  a turma que veio antes no pedido;
- mais disciplinas primeiro, depois as prioridades do aluno na ordem dada; no
  empate, a encontrada antes.

O servidor antigo guardava todas as combinações e só depois ordenava: com 12
disciplinas de duas turmas sem choque, eram 531 441 combinações na memória.
Esta busca guarda só as cinco melhores e corta o ramo que não alcança o número
de disciplinas da quinta; no mesmo caso, visita menos de 20 mil. Um teste
compara as respostas com um porte linha a linha do gerador antigo
(`test/legacyGenerator.ts`) em 400 pedidos sorteados.

Cada busca roda numa thread (`worker_threads`), para a CPU ocupada não travar
o mural: `GENERATOR_CONCURRENCY` ao mesmo tempo, `GENERATOR_QUEUE_LIMIT` na
fila, 128 MB de heap por thread. A thread fica aquecida de uma busca para a
outra (`workerPool.ts`): abrir uma e carregar o TypeScript custava uns 0,5 s
na VM a cada geração. Depois de `GENERATOR_BUDGET_MS`, a busca devolve o
melhor que achou com `exhaustive: false` (o servidor antigo seguia até o app
desistir, aos 60 s). Se o app cancela, a thread da busca é encerrada e a
próxima abre outra.

O que mudou de propósito:

- **Tempo livre:** o cálculo antigo media de um fim de aula ao próximo começo
  na ordem dos fins e, com choque permitido, contava como livre um horário
  coberto por outra aula. Agora as aulas que se sobrepõem são juntadas antes.
  Sem sobreposição, o número é o mesmo.
- **Mínimo zero** vale como 1: o antigo devolvia a grade vazia.
- **O que nenhum app manda** saiu: `avoid_groups`, `blacklisted_teachers` e o
  `selected_by_user` da disciplina (este, quebrado: exigia todas as turmas da
  disciplina na mesma grade).
- **`CRITICAL_FIRST`** soma o `criticality` das disciplinas da grade. Os apps
  até a 2.10 não o mandavam (a ordem não mudava, como na produção antiga).
  Desde então, o app manda quantas obrigatórias que faltam cada disciplina
  trava, direta ou indiretamente, pelos pré-requisitos lidos no Plano até a
  formatura. Sem eles, o campo não vai, e o servidor conta zero.

## Segurança e privacidade

- O log é JSON, uma linha por requisição: id (`X-Request-Id`), método, caminho
  sem query, status e duração. Não guarda IP, User-Agent nem corpo.
- O limite é por IP, por minuto: 120 gravações (`RATE_LIMIT_PER_MINUTE`) e
  120 gerações (`GENERATOR_RATE_LIMIT_PER_MINUTE`), folgado porque os alunos
  de um campus saem pelo mesmo IP. Ele só vê o IP do aluno se o nginx mandar
  o `X-Forwarded-For` (o `snippets/ao-uerj-proxy.conf` do cutover manda) e
  com `TRUST_PROXY=1`; sem isso, todo mundo seria o `127.0.0.1` do nginx e
  dividiria um limite só.
- O processo ouve só em `127.0.0.1` (`HOST`): ninguém chega nele sem passar
  pelo nginx, nem forja o `X-Forwarded-For`.
- `helmet` põe os cabeçalhos de segurança, menos o HSTS: ele valeria para o
  `pitrol.dev` inteiro e os subdomínios, e quem decide isso é o nginx. O CORS
  fica aberto: os apps são nativos.
- **Limites dos campos:** o servidor antigo não conferia nada (só o corpo, de
  100 KB) e os apps 1.x não cortam o texto. Os limites daqui ficam bem acima
  do uso (nome 200, mensagem 10 000, descrição 20 000), para nada que passava
  antes ser recusado agora.
- **O que fica guardado na Companhia agora:** cada chamada (tipo, horário,
  ponto, destino, recado, os primeiros nomes, os apelidos, os recados prontos
  e os hashes das chaves de membro) até pouco depois do horário, quando o
  índice TTL a apaga; as denúncias, por 30 dias; o hash do passe de quem olhou
  a lista, por 15 minutos; e as contagens de cada dia, por meio ano. Com a
  sessão, também o id do aluno de cada membro e de quem denunciou. Sem IP e
  sem localização.
- **O que fica guardado em Agora no campus:** cada aviso (tipo, situação,
  lugar, o id de quem avisou, as contagens e as datas) por 70 dias, para o
  resumo do mês anterior; o que cada aluno fez com cada aviso (a resposta, o
  "Valeu", a denúncia e se viu) até 2 dias depois do fim mais longe possível
  do aviso; as contagens do dia de cada aluno, por 3 dias; e os pontos e as
  contagens de sempre de cada aluno, sem prazo. Tudo pelo índice TTL, menos
  os pontos. Sem texto livre, sem IP e sem localização.
- **O que fica guardado dos alunos identificados:** a matrícula e o nome do
  portal, cifrados, o HMAC da matrícula, os HMACs das instalações e as datas
  de entrada, sem prazo de remoção; as sessões, pelo hash, até vencerem; o id
  do aluno nas mensagens, nos relatos e nas chamadas da v2. Só a aba "Alunos"
  do admin abre matrícula e nome. Da atestação, nada: nem o token da Play
  Integrity, nem a chave, o certificado ou o recibo do App Attest (o iPhone
  entra com uma chave nova a cada vez, e o aparelho fica só como o HMAC da
  instalação, como no Android).
- **O que fica guardado:** as mensagens do mural (com o nome que o aluno
  escolheu), os relatos (página, descrição, e-mail opcional e os anexos em
  `AOreports/`) e as sugestões (nome, texto e e-mail opcional), sem prazo de
  remoção. Os anexos dos relatos da 1.x trazem a página do portal, com dados
  pessoais: a pasta fica fora do Git e só se lê no servidor.
- **Quem posta:** na v2, só o aluno com a sessão, e o servidor sabe quem foi;
  o nome mostrado continua o que o app manda. As rotas de `/aouerj` dos apps
  antigos aceitam qualquer nome.

## Implantação

Automática, pelo workflow [`server.yml`](../.github/workflows/server.yml):
cada push na `main` que mexe no servidor, no contrato ou nos adaptadores do
app que falam com ele (um que só muda Markdown não implanta) roda lint, tipos,
os testes do servidor e o **teste de
contrato** (os adaptadores do app, com o axios do app, contra este servidor),
e só então implanta.

A implantação é azul/verde, na VM (`deploy/server/release.sh`):

1. a versão nova sobe ao lado da que está no ar (`ao-uerj-blue` na porta
   3101 ou `ao-uerj-green` na 3102, só em `127.0.0.1`), com o Node 22 dela;
2. a conferência (`deploy/server/smoke.mjs`) exige o banco conectado e passa
   por todas as rotas que os apps usam, só lendo;
3. só então o nginx troca de porta (`conf.d/ao-uerj-upstream.conf`) e a
   conferência roda de novo pelo nginx, como os apps chegam;
4. a versão anterior é encerrada, e as requisições em andamento terminam.

Uma falha até o passo 2 deixa a versão no ar intocada; no passo 3, o nginx
volta para a anterior. O CI ainda confere pela internet depois. Para voltar
de propósito: o workflow manual com `rollback`, que sobe de novo a versão
anterior (as últimas 5 ficam na VM).

A chave SSH do CI só roda `deploy/server/remote.sh` (`command=` e `restrict`
no `authorized_keys`), que só implanta commits que estão na `main`.

### Preparação (uma vez)

1. **VM:** `bash deploy/server/bootstrap.sh "<chave pública do CI>"`, de uma
   cópia de `deploy/server`. Instala o Node 22 em `~/ao-uerj-server/node`
   (o do sistema, 18, segue com os outros processos), cria o
   `shared/.env` com o `MONGODB_URI` do `server-pitroldev`, copia os anexos
   dos relatos para `shared/AOreports`, cria o upstream do nginx (sem uso
   ainda), liga o pm2 no boot e autoriza a chave do CI.
2. **GitHub:** o ambiente `production` (só a `main`), com os secrets
   `SERVER_SSH_KEY` e `SERVER_KNOWN_HOSTS` e as variáveis `SERVER_HOST` e
   `SERVER_USER`.
3. **Primeira implantação:** um push (ou o workflow manual). A versão sobe e é
   conferida, sem tráfego (`traffic=pending`).
4. **Cutover:** `bash ~/ao-uerj-server/releases/<sha>/deploy/server/cutover.sh`.
   Troca as quatro linhas `proxy_pass` do nginx (`/aouerj/` na 3000 e
   `/schedules/` na 3333, nos blocos 80 e 443) por
   `include snippets/ao-uerj-proxy.conf`, que manda o caminho inteiro para o
   upstream e passa o IP do aluno (`X-Forwarded-For`, para o limite por IP).
   Se a conferência pelo nginx falhar, desfaz sozinho. Se passar, copia os
   anexos que chegaram ao servidor antigo até ali e tira o `ao-uerj` e o
   `uerj-generator` do pm2 (as pastas deles ficam no disco). Voltar para eles
   é `cutover.sh --undo`: sobe os dois de novo e restaura o nginx.

Depois do cutover, cada push implanta sozinho.

### O que conferir

- Os modelos usam as mesmas coleções (`docentes`, `errorreports`,
  `muralmessages`, `suggestions`). Na primeira partida, o Mongoose cria os
  índices que faltam (o servidor antigo não tinha nenhum): a busca de uma
  conversa deixa de ler a coleção inteira. `MONGODB_AUTO_INDEX=false` não cria
  nada (o ensaio contra o banco de produção usa assim).
- Os anexos dos relatos ficam em `~/ao-uerj-server/shared/AOreports` (só o
  dono lê): o servidor não depende mais da pasta do `server-pitroldev`.
- **Memória:** a VM tem 1 GB. Cada instância usa uns 150 MB; durante a
  implantação, as duas cores rodam juntas por alguns segundos. O cutover
  devolve uns 120 MB ao aposentar os processos antigos.
- O processo antigo tinha também as rotas `/api`, que não vêm para cá. O
  nginx não as expõe (o `location /` redireciona para o blog).
