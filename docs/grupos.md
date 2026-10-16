# Grupos — conceito e possibilidades

Proposta de produto para o AO UERJ · 14/10/2026 · Status: exploração, sem implementação.

## Proposta

Grupos conecta alunos em torno de um objetivo e facilita organizar o que vão fazer juntos: estudar, desenvolver um projeto, participar de uma atividade ou manter uma comunidade de interesse.

O diferencial é aproveitar o contexto acadêmico: disciplinas, turmas, horários e locais do campus. Um grupo consegue responder **quem quer participar, quando podemos nos encontrar, onde e com qual objetivo**.

Exemplo de jornada: alguém cria “Revisão de integrais”, associa a Cálculo II, convida colegas, oferece três horários compatíveis e confirma um encontro. Os participantes recebem o lembrete, acessam o material e abrem o ponto de encontro no mapa.

## Tipos de grupo e possibilidades

| Tipo                    | Uso concreto                                                    | Recursos que ajudam                                                                        |
| ----------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Estudo                  | Revisão para uma prova, resolução de exercícios, estudo semanal | Disciplina, objetivo do encontro, horários em comum, materiais                             |
| Trabalho e projeto      | Seminário, projeto de disciplina, TCC, hackathon                | Equipe por convite, tarefas simples, entregas e referências                                |
| Turma e acolhimento     | Colegas do mesmo período, calouros e veteranos                  | Avisos, dúvidas, encontros de apresentação e referências do campus                         |
| Pesquisa e extensão     | Aproximar interessados de um tema ou projeto                    | Apresentação, interesses, chamadas e encontros; vínculo institucional só quando verificado |
| Interesse e convivência | Clube de leitura, jogos, idiomas, cinema, esporte               | Descoberta por tema, encontros recorrentes e limite de participantes                       |
| Organização estudantil  | Coletivos, centros acadêmicos e equipes de eventos              | Administradores, comunicados, inscrições e agenda                                          |
| Voluntariado            | Montar uma equipe para uma ação ou atividade                    | Papéis, disponibilidade, ponto de encontro e confirmação                                   |

Esses tipos compartilham a mesma estrutura. A categoria muda as sugestões e os campos opcionais; não exige sete produtos separados.

## A experiência

### Encontrar ou criar

“Grupos” abre com **Meus grupos** e uma área **Explorar**, com convites pendentes em destaque quando existirem. A busca aceita nome, assunto e disciplina. Filtros de campus e curso entram quando esses dados estiverem disponíveis.

Cada resultado mostra objetivo, disciplina ou tema, próximo encontro e como entrar. A recomendação explica o motivo: “Da sua disciplina” ou “Encontro compatível com a disponibilidade que você informou”. Quantidade de membros não deve dominar a descoberta.

Criar exige nome, objetivo e forma de entrada. Associar disciplina, informar campus, definir limite de participantes e marcar o primeiro encontro são opcionais. É possível criar a partir de uma disciplina, já preenchendo esse vínculo.

Três formas de acesso:

- **Aberto:** aparece na busca; alunos autenticados podem entrar.
- **Com aprovação:** aparece na busca; responsáveis analisam os pedidos.
- **Por convite:** não aparece na busca; convites são revogáveis e podem expirar.

“Aberto” significa aberto dentro do app autenticado. Grupos exige login; o mapa continua sendo a única funcionalidade disponível sem login. Links de convite levam ao login e retomam o convite depois, sem expor conteúdo privado antes da autenticação.

### Dentro do grupo

A primeira tela prioriza o próximo encontro e a ação necessária: votar no horário, confirmar presença ou ver uma alteração. Abaixo ficam avisos e conversas por assunto. Materiais e participantes permanecem acessíveis sem criar um menu excessivo.

O grupo tem nome, objetivo, regras curtas, responsáveis e contexto opcional de disciplina, turma, período e campus. Um grupo de interesse pode durar anos; um grupo de trabalho pode terminar com a entrega.

### Combinar um encontro

1. Uma pessoa informa objetivo, duração e possíveis dias.
2. O app sugere horários a partir da disponibilidade compartilhada voluntariamente.
3. Os participantes votam; o organizador confirma horário e local.
4. Cada participante confirma presença e recebe um lembrete.
5. Mudanças de horário, local ou cancelamento ficam visíveis e notificam os envolvidos.

Ausência de aula na grade não significa disponibilidade. Trabalho, deslocamento e compromissos pessoais precisam ser considerados por meio de preferências ou votação. O aluno pode participar sem compartilhar seus horários.

Compartilhar disponibilidade deve revelar somente janelas autorizadas, nunca a grade completa, notas ou compromissos privados. Uma grade antiga gera uma sugestão a confirmar; não uma declaração de que a pessoa está livre.

O local pode ser um ponto conhecido do mapa ou uma descrição manual. Só oferecer rota quando o local estiver identificado. Marcar uma sala como ponto de encontro não equivale a reservá-la nem comprova que esteja disponível.

## Possibilidades de evolução

| Possibilidade                    | Benefício                                                              | Condição para valer a pena                                                                                                  |
| -------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Pedidos “quero estudar isto”     | Reunir pessoas com o mesmo objetivo antes de existir um grupo          | Adesão voluntária e interesse suficiente; criação confirmada pelos participantes                                            |
| Encontros recorrentes            | Manter uma rotina semanal sem refazer convites                         | Tratar feriados, pausas, mudanças e encerramento do semestre                                                                |
| Formação de equipes              | Encontrar parceiros por tema, disponibilidade e habilidades declaradas | Mostrar critérios de compatibilidade; sem ranquear alunos por notas                                                         |
| Materiais organizados            | Recuperar rapidamente listas, links e referências                      | Começar por links e descrições; anexos exigem armazenamento e moderação                                                     |
| Tarefas e entregas               | Coordenar trabalhos e projetos                                         | Lista simples com responsável e prazo, sem virar um gerenciador completo                                                    |
| Apoio entre veteranos e calouros | Ajudar na adaptação e em dúvidas recorrentes                           | Participação voluntária e papéis claros; veterano não é representante oficial                                               |
| Encontros acessíveis             | Considerar preferências de acesso ao escolher o local                  | Dados físicos verificados; não inferir acessibilidade apenas pelo mapa                                                      |
| Conexão com oportunidades        | Formar equipes para projetos e compartilhar chamadas relevantes        | Integrar o [radar de oportunidades](radar-oportunidades-fontes-e-viabilidade.md) quando houver fonte e situação verificadas |
| Resumo de decisões               | Recuperar horário, local, tarefas e materiais combinados               | Usar mensagens autorizadas, citar a origem e pedir confirmação antes de alterar compromissos                                |

## MVP recomendado

Começar por estudo, projetos e interesses, usando um único modelo de grupo:

1. Criar, descobrir, entrar, solicitar entrada, convidar e sair.
2. Avisos e conversas por assunto, com uma publicação fixada.
3. Links de materiais com título e descrição.
4. Encontro com opções de horário, votação e confirmação de presença.
5. Ponto de encontro ligado ao mapa quando identificado.
6. Lembretes, silenciamento por grupo, denúncia, bloqueio e gestão de membros.

A primeira versão usa horários propostos e votação. A sugestão automática pela grade vem depois, quando preferências e compartilhamento de disponibilidade estiverem claros. Chamadas de voz, vídeo, pagamentos, mensagens privadas e um sistema completo de arquivos ficam fora desse primeiro recorte.

Na implantação, validar grupos com colegas que já se conhecem e podem convidar outros. Um grupo deve ser útil para organizar um trabalho mesmo antes de existir uma comunidade grande para alimentar recomendações.

## Relação com o app atual

O código já oferece:

- Disciplinas, turmas e horários em [academics/domain/models.ts](../src/modules/academics/domain/models.ts).
- Mural por disciplina, turma e período em [community/domain/models.ts](../src/modules/community/domain/models.ts).
- Consulta e envio de mensagens em [Community.ts](../src/modules/community/application/Community.ts).
- Adaptador de API em [private-api/index.ts](../src/adapters/outbound/private-api/index.ts).
- Mapa e interpretação de locais em [campus-map](../src/modules/campus-map/).

O mural pode ser uma porta de entrada: “Criar grupo de estudo desta disciplina”. Não migrar mensagens antigas para um novo grupo nem adicionar colegas automaticamente. Uma eventual unificação do mural com Grupos precisa preservar o contexto e os acessos existentes.

O perfil atual contém matrícula, nome e período; curso, campus, interesses e disponibilidade pessoal precisam de dados adicionais. O identificador local de conta não deve ser tratado automaticamente como identidade global para colaboração.

## Viabilidade e cuidados de implementação

**Viável, com trabalho de backend além da interface.** O contrato atual de mensagens não contém membros, convites, permissões, encontros ou uma identidade estável do autor exposta ao cliente. O envio de `fullName` pelo app não comprova como o servidor autentica o autor; esse fluxo precisa ser verificado antes de reaproveitá-lo para Grupos.

| Área            | Decisão proposta                                                                                                |
| --------------- | --------------------------------------------------------------------------------------------------------------- |
| Identidade      | Autenticar e autorizar cada operação no servidor; nome exibido não concede permissões                           |
| Modelo          | Grupo, membro, convite, publicação, material, encontro, voto e presença                                         |
| Papéis          | Responsável, moderador e participante; transferência de responsabilidade antes de o último responsável sair     |
| Disponibilidade | Preferências locais por padrão; publicar apenas os intervalos explicitamente autorizados                        |
| Consistência    | Entradas e confirmações idempotentes; limite de vagas garantido pelo servidor em acessos simultâneos            |
| Offline         | Ler conteúdo salvo com idade visível; novas adesões e presenças só ficam confirmadas após resposta do servidor  |
| Privacidade     | Não divulgar matrícula, notas, telefone ou rotina completa; conteúdo privado exige autorização também nos links |
| Moderação       | Denunciar, bloquear, remover conteúdo e membros; limites contra spam e um responsável pela fila de denúncias    |
| Notificações    | Priorizar convites, confirmações e alterações relevantes; evitar alertar a cada mensagem por padrão             |
| Ciclo de vida   | Arquivar grupos encerrados, permitir saída e tratar revogação de acesso e limpeza de cache no logout            |

Na arquitetura, casos de uso dependem de portas de grupos, encontros e notificações. API, persistência e provedor de push ficam nos adaptadores, compostos na aplicação. O módulo de comunidade é um ponto de partida; sua divisão pode acompanhar o tamanho real da implementação.

## Como avaliar se ajuda

Medir grupos que chegam ao primeiro encontro confirmado, tempo até encontrar um grupo útil, participação declarada nos encontros e retorno nas semanas seguintes. Acompanhar também pedidos sem resposta, cancelamentos, grupos abandonados e denúncias.

Antes de ampliar, validar três hipóteses com um piloto: alunos aceitam entrar pelo app; votação reduz o esforço de combinar horários; encontros e materiais justificam voltar ao grupo. As métricas e a pesquisa devem avaliar coordenação e utilidade, sem depender de rastrear localização física.

O primeiro marco de produto é simples: alguém cria um grupo, reúne colegas e consegue realizar um encontro usando a funcionalidade.
