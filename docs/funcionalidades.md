# Funcionalidades

Como cada funcionalidade se comporta, com as regras que o código segue. Serve para quem vai mexer nela: antes de mudar uma regra, confira aqui o que os alunos já esperam.

| Funcionalidade                                 | Onde está a explicação                                                                                    |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Sem internet ou com o portal fora do ar        | [Abaixo](#sem-internet-ou-com-o-portal-fora-do-ar)                                                        |
| Notas, PF e faltas                             | [Abaixo](#notas-pf-e-faltas)                                                                              |
| Provas e trabalhos                             | [Abaixo](#provas-e-trabalhos)                                                                             |
| Início do seu jeito                            | [Abaixo](#início-do-seu-jeito)                                                                            |
| Plano até a formatura                          | [Abaixo](#plano-até-a-formatura)                                                                          |
| Atividades complementares                      | [Abaixo](#atividades-complementares)                                                                      |
| Companhia agora e Agora no campus              | [No campus](no-campus.md)                                                                                 |
| Lembretes, avisos do portal, widgets e atalhos | [Notificações e widget](notificacoes-e-widget.md)                                                         |
| Emissão de documentos                          | [Emissão de documentos](emissao-de-documentos.md)                                                         |
| Mapa offline do campus                         | [DESIGN.md do mapa](../src/pages/CampusMap/DESIGN.md) e [fontes do mapa](../scripts/campus-map/README.md) |

Quando o AO não informa o semestre, a interface usa "Período atual". O período do mural é um filtro selecionado pelo usuário; não é uma confirmação do calendário acadêmico oficial.

## Sem internet ou com o portal fora do ar

- **Abertura:** com a conta salva, o app abre na hora com os dados salvos e entra no portal por trás ("Entrando no Aluno Online…"). As leituras esperam esse login, sem um segundo login em paralelo. Uma senha recusada nesse login leva ao Login.
- **Sem internet:** as consultas pausam e voltam com a conexão.
- **Portal fora do ar:** com a internet funcionando, uma resposta 502, 503 ou 504, ou duas falhas de rede seguidas, marcam o portal como fora do ar.
  - Daí em diante, as leituras falham na hora, sem esperar o tempo-limite.
  - Uma requisição leve à página inicial do portal testa a volta, com espera crescente: 1, 2, 5, 10 e depois 15 minutos. O teste só acontece com o app na tela.
  - Uma leitura pedida (tela aberta, "Tentar novamente", puxar para atualizar) também dispara o teste, no máximo a cada 30 segundos.
  - O aviso de cada tela diz desde quando e a próxima tentativa, e oferece "Tentar agora".
  - Com a situação vista pelo servidor próprio (`GET /aouerj/portal-status`, ver [server/README.md](../server/README.md#api)), o aviso diz se a queda é de todos ou se o problema pode ser a rede do aluno.
  - Quando o portal volta, o app avisa "O Aluno Online voltou" e atualiza as telas que falharam.
- **Lentidão:** uma resposta de 8 segundos ou mais troca a barra de atualização por "O Aluno Online está lento".
- **Avisar quando voltar:** no aviso da queda, o aluno pede um aviso. Fora do app, uma tarefa do WorkManager testa o portal a cada 15 minutos, com rede e fora das 22h às 7h, avisa uma vez no canal "Aluno Online de volta" e para. O pedido vence em 3 dias e sai no logout.
  - No iPhone, a mesma tarefa roda quando o iOS deixar, no mínimo 15 minutos depois do pedido ou da rodada anterior (ver [iOS](ios.md#verificação-em-segundo-plano)), e o aviso de confirmação diz que pode demorar.
- **Busca antecipada:** com a conta logada, internet, o portal no ar e o app na tela, grade, histórico, currículo e Síntese vencidos são renovados, uma página por vez, no máximo a cada 30 minutos por conta. Notas e RID ficam de fora, porque a verificação de avisos compara com o que o aluno já viu.
- **Ações que dependem do portal:** emitir e excluir documentos e "Ler os pré-requisitos de novo" ficam desativados sem internet ou com o portal fora do ar.
- **Documentos guardados:** na folha do PDF, "Guardar no aparelho" mantém o documento cifrado no cofre. A seção "Guardados no aparelho" abre e compartilha o PDF sem internet e sem o portal.

## Notas, PF e faltas

As contas seguem o art. 95 da Deliberação nº 33/CSEPE/1995, que o Aluno Online publica em "Critérios de Avaliação (Crédito)". O regime seriado (Deliberação nº 44/1979) tem outra conta e não é coberto. O código fica em `src/modules/academics/domain/rules/finalExam.ts`.

- **Quanto preciso na PF:** no quadro de notas do Início, cada disciplina diz o que falta para passar por nota.
  - A média semestral é a média de P1 e P2. A partir de 7,0, o rótulo é "Dispensado da PF".
  - Abaixo de 4,0, é "Sem direito à PF": a disciplina reprova mesmo que uma PF apareça lançada.
  - Entre 4,0 e 7,0, é "Precisa de X na PF", com X = 10 − média, arredondado para cima na primeira casa. Essa nota aparece tracejada na coluna da PF.
  - Só com uma das provas, o rótulo diz quanto a outra precisa para dispensar a PF ("6,5 na P2 dispensa a PF"). Quando nem 10 dispensa, diz quanto ela precisa para dar direito à PF ("Precisa de 5,0 na P1 para ter PF").
  - Com a PF lançada ou a média publicada, mostra a média final, (média + PF) ÷ 2, que aprova com 5,0.
  - As notas aparecem com uma casa, e a segunda só quando existe. Elas são cortadas em vez de arredondadas, e assim nada abaixo de 5 aparece como "5,0".
- **Simular PF e CR:** a folha começa cada PF na nota mínima, de novo a cada abertura, e muda a nota de 0,5 em 0,5. Mostra a média final de cada disciplina que precisa de PF e o CR aproximado de agora e com as notas do período.
  - Os créditos vêm do histórico, do currículo ou das disciplinas universais. A folha os lê ao abrir, do cache (que vale 24 horas) ou do portal.
  - O histórico já lista as disciplinas do período em curso, sem nota, e depois que o período termina, com a nota. A simulação troca essa linha pela do quadro de notas, e o período não conta duas vezes.
  - O CR segue a mesma regra aproximada do Meu Progresso. Atividades sem crédito ficam de fora, e sem nenhuma nota no histórico não há CR atual.
  - Também ficam de fora as disciplinas sem as duas provas e sem média lançada.
- **Controle de faltas:** o aluno marca "Faltei" de dois jeitos: tocando numa aula já terminada da agenda da semana, ou em "Faltas", em Disciplinas em Curso, que lista as aulas das últimas 4 semanas e as faltas mais antigas.
  - O limite é de 25% da carga horária (a frequência mínima é de 75% das horas-aula), contado em tempos de aula de 50 minutos.
  - A carga horária vem das mesmas fontes dos créditos. Sem ela, não há limite nem barra.
  - Disciplinas em Curso mostra a barra de cada disciplina: neutra sem faltas, verde abaixo da metade do limite, amarela da metade até o limite e vermelha além dele.
  - A lista sai da grade e não conhece feriados nem o começo das aulas; nesses dias, basta não marcar.
  - O portal não mostra a frequência do período em curso, só a do histórico.

## Provas e trabalhos

O aluno anota as datas de P1, P2, PF, trabalhos, seminários e outras avaliações das disciplinas em curso. Não há tela nova: as datas aparecem onde ele já olha. Tudo fica só no aparelho, como as faltas. O código fica em `src/modules/evaluations` e `src/features/Evaluations`.

- **Onde aparece:**
  - No Início, "Próximas avaliações" fica logo abaixo da próxima aula, da mais perto para a mais longe, com a contagem ("Hoje", "Amanhã", "Em 4 dias") e a observação. Mostra 3 (o padrão, que muda em "Personalizar o Início"), com "Ver todas".
  - A próxima aula ganha "P2 nesta aula" (ou "Seminário nesta aula") quando há prova, seminário ou outra avaliação nela; trabalhos não entram.
  - Na semana, o dia com avaliação ganha a marca de calendário ao lado do ponto das aulas. No dia, as avaliações aparecem no topo, com "Editar", e a aula da prova troca o turno pelo tipo da prova.
  - No quadro de notas, enquanto a nota não sai, a célula da P1, da P2 ou da PF mostra a data anotada, tracejada. A célula vazia (e a PF necessária, quando há PF) anota a data daquela prova direto.
- **A folha** (`features/Evaluations/EvaluationSheet`) abre por "Adicionar", por "Avaliação" num dia da semana, pela célula de nota ou por uma avaliação:
  - A data parte da grade: as opções são até 4 dias de aula da disciplina nos próximos 28 dias (duas aulas no mesmo dia contam como uma), e o horário vem da aula daquele dia. Trabalhos começam com prazo às 23:59. "Outra data" abre um calendário na própria folha.
  - Uma P1 (P2, PF) por disciplina: anotar de novo troca a data, com o aviso antes de salvar. Prova com nota lançada não se anota ("P1 · saiu 6,5").
  - A observação tem até 500 caracteres.
- **Lembretes:** sete antecedências combináveis em cada avaliação: 1 semana, 3 dias, véspera, no dia, 2 h, 1 h e 30 min antes.
  - As de dias saem no horário dos avisos de dias antes (20:00 por padrão); "No dia", no horário do dia (7:00). As de horas contam a partir do início.
  - A folha lista quando cada um chega. Os que já passaram, ou que cairiam depois do início, não se escolhem.
  - Os padrões das novas avaliações (véspera e no dia) mudam em Notificações, onde uma chave também desliga todos.
  - Como os lembretes chegam no Android e no iPhone está em [Notificações](notificacoes-e-widget.md#notificações).
- **A nota manda:** quando a P1, a P2 ou a PF sai no portal, a data some da célula e a avaliação deixa o Início, a semana e os lembretes. A PF anotada sai também quando as notas a dispensam (média 7 ou mais), tiram o direito a ela (abaixo de 4) ou a média final é publicada.
- **"Já fiz":** os avisos de trabalhos, seminários e outras trazem o botão. Ele para os lembretes que faltam sem abrir o app, e a avaliação sai das próximas na volta ao app. Na folha, "Desfazer" traz de volta.

## Início do seu jeito

No fim do Início, "Personalizar o Início" abre uma folha em que o aluno arruma a tela, e cada toque vale na hora:

- **Seções:** mostrar ou esconder e mudar a ordem da Próxima aula, Companhia agora e Agora no campus (onde existem), Próximas avaliações, Notas e Semana. As setas sobem e descem; o leitor de tela anuncia a nova posição. Com tudo escondido, o Início oferece voltar à folha.
- **Saudação:** "Olá" e a data, só a data ou nenhuma.
- **Espaçamento:** normal (o espaço do app) ou compacto, com as seções mais juntas.
- **Detalhes:** o botão "Ver no mapa" da próxima aula e quantas avaliações aparecem no Início (1, 3 ou 5).
- **Restaurar** volta ao Início de sempre. O atalho "Notas" do ícone mostra as notas mesmo escondidas.
- **Onde fica:** só no aparelho, por conta (`home-layout` nas preferências; o logout apaga). Uma seção nova de uma versão futura entra no lugar dela, visível. O código está em `src/modules/home` e na folha `src/features/HomeLayout`.

## Plano até a formatura

Em Meu Progresso, o cartão "Plano até a formatura" abre a tela do plano: as obrigatórias que faltam distribuídas pelos próximos períodos, com os pré-requisitos, os gargalos e o prazo máximo do curso. O código fica em `src/modules/graduation` e `src/pages/GraduationPlan`.

- **Fontes:**
  - O currículo e o histórico dizem o que falta. As disciplinas da grade do período contam como aprovadas.
  - A Síntese da Formação dá a versão curricular, os créditos que faltam em cada grupo e o prazo. Os períodos restantes são o máximo, mais os extras, menos os utilizados (os cursados e o inscrito).
  - Em Meu Progresso, os créditos exigidos de cada grupo de eletivas também vêm da Síntese, e esses grupos não se configuram à mão. Os que ela não informa, ou todos quando ela não carrega ou o regime é seriado, usam os créditos configurados. Um grupo com 0 crédito exigido aparece como "Não exigida".
  - Os pré-requisitos vêm da Pesquisa de Disciplinas, uma página por disciplina que falta, duas por vez. Na primeira abertura, a tela mostra o progresso da leitura. As leituras ficam guardadas por versão curricular, e as aberturas seguintes não consultam o portal. Uma leitura interrompida continua de onde parou.
  - A leitura para em bloqueio, limite de acessos, portal fora do ar, falta de rede ou sessão perdida. O plano usa o que já foi lido e oferece "Tentar novamente". "Ler os pré-requisitos de novo" esquece as leituras e consulta tudo outra vez, sem o cache das páginas.
- **Regras:**
  - Cada grupo de pré-requisitos é um "ou", e todos os grupos valem. Um grupo com uma só alternativa entre as que faltam vira dependência.
  - Gargalo é a disciplina que trava, direta ou indiretamente, ao menos 3 outras. A cadeia mais longa de dependências é o mínimo de períodos possível.
  - A trava de créditos ("60 Créditos Obrigatórios") conta os créditos obrigatórios aprovados, com os do período em curso.
  - A carga é contada em disciplinas por período, com no mínimo 2, o piso da inscrição. "Quando formar" lista as formaturas possíveis, cada uma com a menor carga que chega lá. O padrão é a mais cedo, e uma carga maior que não adianta a data não vira opção.
  - Cada período recebe, até a carga, primeiro as disciplinas que travam outras; depois, pelo período recomendado no currículo. Um período fica com 1 disciplina só quando não há outra disponível, e o cartão avisa que ele está abaixo do mínimo da inscrição.
  - As eletivas entram como vagas "a escolher", no tamanho mais comum das disciplinas do grupo.
  - "Adiar um período", na folha da disciplina, guarda o período a partir do qual ela pode entrar. Antes, a folha mostra o efeito na formatura. "Restaurar o plano" desfaz todos os adiamentos.
- **Limites:**
  - O plano não conhece vagas, horários, a oferta de cada período nem correquisitos. A inscrição de verdade pode mudar.
  - Sem a Síntese, não há prazo, e os créditos exigidos das eletivas são os configurados em Meu Progresso.
  - Uma disciplina sem os pré-requisitos lidos entra como livre, com aviso. Uma que depende de disciplina fora das que faltam fica fora do plano, também com aviso.
- **Gerador de grades:** o app manda ao gerador quantas obrigatórias que faltam cada disciplina trava, pelos pré-requisitos lidos aqui (o `criticality` da prioridade `CRITICAL_FIRST`, ver [server/README.md](../server/README.md#gerador-de-grades)).
- Para desligar a tela sem nova versão, inclua `graduation-plan` em `disabledFeatures` do [aviso remoto](aviso-remoto.md#disabledfeatures).

## Atividades complementares

Em Meu Progresso, a seção "Atividades complementares" mostra as horas que contam e, ao tocar num tipo de atividade, as atividades dele.

- **Fonte:** as duas tabelas que "Disciplinas Realizadas" só traz para quem tem atividades registradas (`parsers/ComplementaryActivities.ts`):
  - a das atividades (período, tipo, horas e descrição);
  - o "Resumo por Tipo de Atividade", em que cada tipo conta só até um teto (CH Máxima); o que passa dele é excedente e não conta.
- **Leitura:** a mesma página do histórico. O adaptador compartilha por 15 segundos a requisição dessa página, então o histórico e as atividades pedidos juntos saem de uma requisição só.
- **Carga exigida:** a página não a informa. Ela aparece ("120 h de 200 h · faltam 80 h") só quando a Síntese da Formação traz um requisito de atividades complementares; senão, a seção mostra o total que conta.
- Sem atividades nem exigência, a seção não aparece.
