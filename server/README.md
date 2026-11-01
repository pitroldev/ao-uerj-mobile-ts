# Servidor do AO UERJ

O backend próprio do app, servido em `https://pitrol.dev`:

- em `/aouerj`, o mural de mensagens por turma, a lista de docentes, os
  relatos de erro, as sugestões dos apps antigos e a situação do Aluno Online
  vista do servidor. Veio da parte da UERJ do `server-pitroldev`; as rotas de
  rede (`/api/vpn`, `/api/isPortReachable`) e o site do pitrol.dev ficaram lá;
- em `/schedules`, o gerador de grades, que veio do `class-schedule-generator`.

Node 22.18 ou mais novo roda o TypeScript direto, sem etapa de build. Express
5, MongoDB (Mongoose 9), zod, pino, helmet, express-rate-limit e
`worker_threads` para o gerador.

## Desenvolvimento

O `pnpm install` da raiz instala também o servidor (pelo `postinstall`). Ele
não faz parte do workspace do app: tem dependências e lockfile próprios, e
nada dele entra no `node_modules` do React Native.

```sh
cp server/.env.example server/.env   # ajuste o MONGODB_URI
pnpm server dev                      # node --watch src/main.ts
pnpm test:server                     # node --test, sem MongoDB
```

`pnpm type-check`, `pnpm lint` e `pnpm format:check` da raiz cobrem o
servidor; o CI roda `pnpm test:server` no mesmo job do app.

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

Os testes trocam os adaptadores de saída por versões em memória
(`test/support.ts`), sem banco e sem tocar no Mongoose.

## API

Os caminhos, métodos, status e corpos são os do servidor que a produção já
roda, porque os apps publicados dependem deles. Os tipos estão em
[`src/adapters/inbound/http/contract.ts`](src/adapters/inbound/http/contract.ts),
que o app também importa.

| Rota                         | O que faz                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------ |
| `GET /aouerj/portal-status`  | Situação do portal (`up`, `down`, `unknown`), sem banco, com cache de 60 s     |
| `GET /aouerj/health`         | O processo e o estado do banco                                                 |
| `POST /aouerj/messages/get`  | A conversa de uma turma: as 500 mais recentes, da mais antiga para a mais nova |
| `POST /aouerj/messages/post` | Grava e devolve a mensagem (200)                                               |
| `GET /aouerj/docentes`       | Os nomes, em ordem alfabética (cache de 5 min)                                 |
| `GET /aouerj/docentes/:name` | Até 50 docentes cujo nome contém o texto (literal)                             |
| `POST /aouerj/reportError`   | Grava os anexos e o relato; responde `{ "status": "ok" }`                      |
| `POST /aouerj/suggestions`   | Grava a sugestão; responde `{ "status": "ok" }`                                |
| `GET /aouerj/reportError`    | Administração: os 100 relatos mais recentes, com e-mail                        |
| `GET /aouerj/suggestions`    | Administração: as 200 sugestões mais recentes, com e-mail                      |
| `POST /schedules/generate`   | As até 5 melhores grades das turmas enviadas (`{ data, exhaustive }`)          |
| `GET /schedules/health`      | O gerador: buscas rodando e na fila                                            |

- **Erros:** sempre `{ "error", "message" }`. Entrada inválida é 400
  `invalid_request`, com a mensagem do servidor antigo ("fullName is
  required"); banco fora é 503 `database_unavailable`; excesso de gravações é
  429 `rate_limited`; JSON quebrado é 400 `invalid_json`; corpo grande demais é 413.
- **Tolerância com os apps antigos:** número em `turma`, `periodo` e
  `disciplina` vira texto, como o Mongoose já fazia. Um e-mail inválido num
  relato ou sugestão é descartado, sem recusar o resto.
- **Administração:** as listagens trazem e-mail. Elas exigem
  `Authorization: Bearer <ADMIN_TOKEN>` e não existem (404) sem o token
  configurado.
- **Gerador:** fila cheia é 503 `generator_busy`; uma thread que não responde
  é 503 `generator_timeout`. Entrada inválida diz onde
  (`classes[0].schedules[0].week_day`).

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
fila, 128 MB de heap por thread. Depois de `GENERATOR_BUDGET_MS`, a busca
devolve o melhor que achou com `exhaustive: false` (o servidor antigo seguia
até o app desistir, aos 60 s). Se o app cancela, a busca para.

O que mudou de propósito:

- **Tempo livre:** o cálculo antigo media de um fim de aula ao próximo começo
  na ordem dos fins e, com choque permitido, contava como livre um horário
  coberto por outra aula. Agora as aulas que se sobrepõem são juntadas antes.
  Sem sobreposição, o número é o mesmo.
- **Mínimo zero** vale como 1: o antigo devolvia a grade vazia.
- **O que nenhum app manda** saiu: `avoid_groups`, `blacklisted_teachers` e o
  `selected_by_user` da disciplina (este, quebrado: exigia todas as turmas da
  disciplina na mesma grade).
- **`CRITICAL_FIRST`** depende de `criticality` em cada disciplina, que o app
  não manda: a ordem não muda, como na produção.

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
- **O que fica guardado:** as mensagens do mural (com o nome que o aluno
  escolheu), os relatos (página, descrição, e-mail opcional e os anexos em
  `AOreports/`) e as sugestões (nome, texto e e-mail opcional), sem prazo de
  remoção. Os anexos dos relatos da 1.x trazem a página do portal, com dados
  pessoais: a pasta fica fora do Git e só se lê no servidor.
- **Ainda não há prova de que quem posta é aluno:** o mural aceita qualquer
  nome.

## Implantação

Automática, pelo workflow [`server.yml`](../.github/workflows/server.yml):
cada push na `main` que mexe no servidor, no contrato ou nos adaptadores do
app que falam com ele roda lint, tipos, os testes do servidor e o **teste de
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
