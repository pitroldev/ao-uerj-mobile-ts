# No campus: Companhia agora e Agora no campus

As duas funções entre alunos do grupo "No campus" do menu. Só existem onde o app entra como aluno identificado (ver [Dados e armazenamento](dados-e-armazenamento.md#identificação-do-aluno)): no Android instalado pela Play, com a Play Integrity, e no iPhone, com o App Attest. No simulador e num app de fora da loja, elas não aparecem no menu. No iPhone, dependem ainda da configuração do servidor (ver [iOS](ios.md#estado-atual)).

> [!IMPORTANT]
> Escreva os textos destas telas como um calouro falaria. Nunca use "chamada": na faculdade, chamada é a lista de presença. No almoço é "mesa"; na saída, "grupo para voltar". Mais regras no [guia de contribuição](../CONTRIBUTING.md#textos-do-app).

## Companhia agora

Encontros de minutos com outros alunos: uma mesa para almoçar junto ou um grupo para voltar depois da última aula da noite. Quem abre diz onde e quando; quem quiser entra. A mesa ou o grupo some sozinho pouco depois do horário.

- **Vocabulário:** o app fala com quem acabou de entrar na faculdade. No almoço é "mesa" ("Abrir mesa", "Sentar junto"); na saída, "grupo para voltar" ("Abrir grupo", "Entrar no grupo", "Grupo para o metrô, 22:15"). Quem cria é "quem abriu". Nunca "chamada", que na faculdade é a lista de presença.
  - No código do app, o tipo é `CompanionCall`, com `CallKind` `lunch` ou `home` (no servidor, `Call`), e as palavras de cada tipo ficam em `KIND_TEXT` (`src/modules/companion/presentation/companionText.ts`).
- **O horário livre vem da grade, no aparelho:** livre até a próxima aula, em aula ou a última aula que acabou. A folha de abrir oferece os horários que cabem:
  - a mesa nos quartos de hora (:00, :15, :30, :45), para quem abre na mesma hora cair na mesma mesa, terminando 40 minutos antes da próxima aula;
  - o grupo para voltar parte do fim da última aula do dia, de 5 em 5 minutos;
  - "Outro horário" aceita qualquer hora das próximas 3 horas.
  - O servidor recebe só o horário.
- **Entrar em vez de abrir:** com uma mesa ou um grupo parecido já na lista (o mesmo ponto e, no grupo, o mesmo destino, até 15 minutos de diferença e com vaga), a folha de abrir oferece "Sentar junto" ou "Entrar no grupo", para não haver duas mesas meio vazias.
- **De olho agora:** a lista diz quantos outros alunos olharam a Companhia nos últimos 15 minutos. O servidor conta cada aluno uma vez, e a lista mostra só o número.
- **Dois tipos:** "Almoço e pausa" (até 6 pessoas, some 30 minutos depois do horário) e "Voltar junto" (até 8, some 2 horas depois da saída, para dar tempo do "Cheguei em casa"). A lista mostra o que aparece 1 hora antes do horário.
- **Encontro dentro do campus:** só pontos do Mapa (o RU, o Lago dos Peixinhos, a Concha Acústica, os portões 1 e 5 do lado de dentro). O destino do grupo é genérico: a Estação Maracanã (metrô ou trem) ou o ponto de ônibus da São Francisco Xavier, com a saída pelo portão certo. A tela mostra o encontro, a saída e o destino no desenho do próprio Mapa, e "Ver no Mapa" abre o lugar.
- **Primeiro nome para os outros, aluno identificado para a moderação:** quem está fora vê o primeiro nome de quem abriu e quantos vão; quem está dentro vê os primeiros nomes. O servidor sabe quem é cada um pela sessão; só a moderação vê matrícula e nome, numa denúncia. O nome é o da conta, ou outro que o aluno escolha (o nome social, um apelido), guardado só no aparelho.
- **Recados prontos, sem conversa livre:** "Estou indo", "Cheguei no ponto", "Atrasei 5 min" e, no grupo, "Cheguei em casa"; "Não vou mais" sai. O recado de quem abre tem até 80 caracteres e recusa telefone, @ e links, no app e no servidor.
- **Avisos no aparelho:** 10 minutos antes do encontro e, no grupo para voltar, "Chegou bem?" 40 minutos depois da saída. Não há push: quem entra e os recados aparecem com o app aberto.
  - No Android, saem no canal "Companhia agora", com a tela em Notificações para desligar.
  - No iPhone, saem pelo `UNUserNotificationCenter`, com no máximo 4 agendados de uma vez (ver [iOS](ios.md#módulos-nativos)).
- **Uma por vez:** abrir outra mesa ou outro grupo encerra o anterior. Quem abriu e sai encerra para todos.
- **Denúncia sempre à mão:** de dentro ou de fora, com o motivo. Assédio denunciado por quem foi junto tira do ar na hora; outro motivo, com duas pessoas de dentro. De fora, a denúncia vai só para a moderação, que tira do ar pela administração do servidor: ninguém de fora derruba as mesas dos outros. De fora, uma denúncia por aluno em cada mesa ou grupo.
- **Tirar alguém:** quem abriu vê cada pessoa em "Quem vai" e pode tirá-la, com confirmação. Quem saiu assim deixa de ver os nomes e os recados, fica sabendo e não vê mais o botão de entrar ali.
- **No Início:** só quando faz sentido, logo abaixo da próxima aula: a mesa ou o grupo em que o aluno está, as mesas abertas no intervalo do almoço ou os grupos para voltar depois da última aula da noite.
  - Com a lista vazia nessa hora, aparece o convite: "Abrir a primeira mesa" (ou "Abrir um grupo para voltar"), que abre a folha já com o horário e o ponto, quantos estão de olho, "Me avise se tiver mesa" (ou "grupo") e "Agora não", que esconde o convite até o fim do dia.
  - Em aula, nada aparece.
- **Me avise se tiver mesa ou grupo** (só no Android): para quem não quer abrir, na lista vazia ou no convite do Início.
  - Fora do app, a mesma tarefa do WorkManager do portal lê a lista a cada 15 minutos, com rede, até o fim do horário livre (40 minutos antes da próxima aula na mesa, 40 minutos depois da última aula no grupo).
  - Avisa uma vez no canal "Companhia agora" quando abre uma mesa ou um grupo do tipo pedido, com vaga. Com a tela aberta e a mesa ou o grupo à vista, o pedido termina. Sai no logout.
  - O iPhone não acorda o app com essa frequência (ver [iOS](ios.md#fora-do-iphone)).
- **Código:** domínio e casos de uso em `src/modules/companion`, adaptador em `src/adapters/outbound/private-api/companion.ts`, telas em `src/pages/Companion` e o bloco do Início em `src/features/Companion`. A API está no [README do servidor](../server/README.md#companhia-agora).

## Agora no campus

Avisos curtos dos próprios alunos sobre o campus, como um Waze feito por todo mundo (sem rotas): elevadores, fila do bandejão, luz e ar, internet, banheiros e acesso (portão, rampa, sala trancada). Quem está no lugar avisa em dois toques; quem passa por ali confirma ("Continua"), diz que acabou ou agradece ("Valeu"). Tudo some sozinho.

- **Dois toques, sem texto livre:** o que é e como está.
  - O lugar vem da grade, no aparelho (a aula de agora ou a próxima, em até 40 minutos): o andar ou a sala da aula.
  - O elevador é sempre o hall do bloco C, onde ficam os 10 elevadores do Pavilhão, e o bandejão é o RU. "Outro lugar" escolhe o bloco e o andar, a sala ou o portão.
  - Sem foto, sem nome de ninguém, sem crime ou segurança (para isso, os canais oficiais).
- **Novo até alguém confirmar:** o aviso nasce "novo" (tracejado no mapa) e passa a valer para todos com a confirmação de outro aluno, ou direto se quem avisou tem nível 3 ou mais.
  - Cada "Continua" empurra o fim; três "Acabou" encerram antes, e o "Já resolveu" de quem avisou encerra na hora.
  - Um aviso igual a um que já vale vira a confirmação dele; uma situação nova no mesmo lugar (a fila que cresceu) encerra a anterior.
- **"Ainda está lá?" sem GPS:** a tela e o Início perguntam do aviso do caminho do aluno, pela grade: os elevadores para quem tem aula do 3º andar para cima, o mesmo andar ou a mesma sala. "Não vou passar por lá" dispensa até o fim do dia.
- **Pontos e nível na conta, sem placar:**
  - avisar (+10, nos 5 primeiros avisos do dia), o aviso confirmado (+5), responder (+3, nas 10 primeiras respostas do dia) e cada valeu (+1); três "Não é verdade" tiram o aviso do ar e 15 pontos de quem avisou;
  - níveis: Chegando, Na área, Olho no campus, Guia do campus e Lenda do Pavilhão;
  - "Você ajudou" mostra o nível, a semana (quantas vezes alguém viu um aviso do aluno), os avisos de hoje e as conquistas. Ninguém vê os pontos de ninguém.
- **Comunidade:** o campus somado, sem ninguém: a semana e o mês (o atual e o anterior), com os problemas que mais se repetem (só avisos confirmados) e "Compartilhar o resumo" em texto, para o CA e o DCE levarem números à administração.
- **No Início, sempre à vista:** quando o aluno deve estar no campus (de 1 hora antes da primeira aula a 30 minutos depois da última), o "ainda está lá?", respondido ali mesmo, ou até dois avisos confirmados; sem aviso, uma linha só, "Nada no seu caminho", com "Avisar".
  - Fora desse horário, ou sem resposta do servidor, a linha diz para que serve, sem consultar nada.
  - Na primeira vez, uma apresentação curta ("Conhecer" ou "Agora não") toma o lugar da linha. A seção entra em "Personalizar o Início".
- **No celular** (só no Android): a tarefa do WorkManager no modo `campus`, a cada 15 minutos e fora das 22h às 7h, só busca a lista quando há aula por perto ou um aviso do aluno em aberto.
  - Avisa no canal "Agora no campus": "ainda está lá?" de um aviso confirmado no caminho (até 3 por dia, uma vez por aviso), o aviso do aluno confirmado, quantos agradeceram quando ele acaba e o nível novo.
  - Liga depois da primeira visita à tela; a chave fica em Notificações (no iPhone, ela não aparece).
  - A tarefa não entra no portal: as salas da grade ficam guardadas na preferência `campus-now` da conta (o logout apaga).
- **Carga:** com mais de 10 mil alunos, a lista anda a cada 30 s só com a tela na frente e a cada minuto no Início; "quantos viram" vai em lotes de até 50, uma vez por aviso. O aviso remoto desliga tudo com `disabledFeatures: ["campus"]` (ver [Aviso remoto](aviso-remoto.md#disabledfeatures)).
- **Código:** domínio e casos de uso em `src/modules/campus-now`, adaptador em `src/adapters/outbound/private-api/campusNow.ts`, telas em `src/pages/CampusNow` e o bloco do Início em `src/features/CampusNow`. A API e a moderação estão no [README do servidor](../server/README.md#agora-no-campus).
