# Sugestões de funcionalidades

Proposta de produto para o AO UERJ · 17/10/2026 · Status: análise e priorização, sem implementação.

## Conclusão

O app cobre bem a consulta do período (próxima aula, notas, agenda e RID provisório), o histórico, o currículo, os documentos, o mapa e o Gerador de Grade. Duas lacunas pesam mais:

1. **O portal oferece mais do que o app lê.** O menu do Aluno Online tem 31 itens, e o app usa 7. Consultas como Síntese da Formação, RID: Resultado da Inscrição e Situação no ENADE respondem perguntas frequentes sem nenhuma operação de escrita.
2. **O app não aparece fora dele.** Não há notificação, widget, tarefa em segundo plano, atalho no ícone nem exportação para a agenda. O manifest principal só declara `INTERNET`, e o único código nativo próprio é o módulo de In-App Updates. Isso contraria o primeiro princípio do [PRODUCT.md](../PRODUCT.md): a resposta vem antes da navegação.

Recomendação: nas próximas semanas, priorizar leitura do portal e cálculo local ligados à PF e à inscrição do 2026.2. Em seguida, notificações e widget.

## Como foi verificado

- Leitura do código: adaptador do Aluno Online, módulos, telas e camada nativa Android.
- Leitura de [PRODUCT.md](../PRODUCT.md), [Grupos](grupos.md), [Radar de oportunidades](radar-oportunidades-fontes-e-viabilidade.md), da auditoria interna dos relatos de bugs de 2026 e de avaliações recentes na Play. Este documento não reproduz dados pessoais desses materiais.
- Consulta somente leitura ao Aluno Online em 17/10/2026, com uma conta autorizada. Foram listados os itens do menu e os rótulos de oito páginas de consulta; nenhum conteúdo foi gravado. Páginas de cadastro e de solicitação não foram abertas.
- Pesquisa na web sobre o calendário acadêmico de 2026 e o cardápio do Restaurante Universitário.

Os rótulos mostram a estrutura vista em uma conta. Valores, variações entre cursos e páginas com pendências precisam de validação antes de qualquer parser.

## Menu do Aluno Online

| Situação no app          | Itens                                                                                                                                                                                                                                              |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Usados (7)               | Notas do Período; Requisitos Cursados; Disciplinas do Currículo/A Cursar; Disciplinas Universais; Disciplinas em Curso; RID: Resultado Provisório; Emissão de Documentos                                                                           |
| Consultas não usadas (9) | Síntese da Formação; Pendências de Documentos; Situação no ENADE; Critérios de Avaliação (Crédito); Critérios de Avaliação (Seriado); Tabela de Horário UERJ / CAP; SID: Consultar Inscrição; RID: Resultado da Inscrição; SAID: Consultar Recibos |
| Cadastro (5)             | Alteração de Senha; Dados Bancários; Dados Complementares; Dados para Contato; Dados Pessoais                                                                                                                                                      |
| Solicitações (8)         | Retorno Antecipado; Trancamento de Matrícula; Transferência Interna; SID: Solicitar Inscrição; SAID: Alteração de Inscrição; SAID: Cancelamento de Inscrição; Ramificação: Abrir; Ramificação: Excluir                                             |
| Links externos (2)       | Consulte Página do DAA; Consulte Página do DEP                                                                                                                                                                                                     |

A Pesquisa de Disciplinas usa uma requisição derivada da página do currículo, fora do menu. As oito consultas abertas nesta verificação responderam com `controle=Aluno`.

### O que as consultas não usadas trazem

| Página                           | Conteúdo observado                                                                                                                                                                                                       | Uso proposto                                                            |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| Síntese da Formação              | Coeficiente de Rendimento; Versão Curricular; Habilitação e Ênfase; "Requisitos do Currículo" com Exigido, Cumprido e A Cumprir; Períodos Letivos com mínimo, utilizados, máximo, restantes e extras para integralização | Meu Progresso oficial (item 4)                                          |
| RID: Resultado da Inscrição      | Disciplina, Turma, Créditos, Carga Horária, Ramif. e Horário; "Inscrição ACEITA" e "Inscrição NÃO ACEITA - Falta Requisito ( CO / PRE )"                                                                                 | Ciclo da inscrição (item 2)                                             |
| SID: Consultar Inscrição         | Disciplina, Turma, Tipo, Ramif., Mensagem, Data e Orig.                                                                                                                                                                  | Ciclo da inscrição (item 2)                                             |
| SAID: Consultar Recibos          | Sem recibos: "Não consta nenhum SAID Online para ser apresentado." Formato com recibos não observado                                                                                                                     | Ciclo da inscrição (item 2)                                             |
| Situação no ENADE                | Ano, Curso, Unidade, Faixa e Situação                                                                                                                                                                                    | Alertas de pendência (item 5)                                           |
| Pendências de Documentos         | Sem pendências: "no momento não existem exigências registradas". Formato com pendências não observado                                                                                                                    | Alertas de pendência (item 5)                                           |
| Critérios de Avaliação (Crédito) | PDF embutido                                                                                                                                                                                                             | Calculadora de PF (item 1)                                              |
| Tabela de Horário UERJ / CAP     | Sem texto extraível                                                                                                                                                                                                      | Nenhum; os tempos já estão em [time.ts](../src/utils/constants/time.ts) |

## Calendário

Segundo notícia do TMC de 17/07/2026, o Conselho Superior de Ensino, Pesquisa e Extensão aprovou uma resolução que redefiniu os semestres depois da greve:

- o 2026.1 termina em 31/10, após o período de provas;
- a inscrição em disciplinas do 2026.2 é em novembro;
- as aulas do 2026.2 começam em 18/11 e seguem até abril de 2027.

O calendário mês a mês publicado pela UERJ em janeiro é anterior à mudança. O calendário detalhado deve ser confirmado na Pró-Reitoria de Graduação.

Consequência: as próximas semanas concentram PF e inscrição, quando o Gerador de Grade e o RID são mais usados.

## Propostas

Legenda de esforço, como em [dependencias.md](dependencias.md): **P** (horas), **M** (1 a 3 dias), **G** (uma semana ou mais). São estimativas de implementação, não cronograma.

### Agora: leitura do portal ou cálculo local

#### 1. Quanto preciso na PF?

Com P1 e P2 do quadro de notas, mostrar a nota necessária na PF em cada disciplina e, em seguida, simular o efeito no CR. A regra vem do PDF **Critérios de Avaliação (Crédito)**, que precisa ser transcrito e conferido; o regime seriado tem documento próprio. Com a Síntese da Formação (item 4), a simulação parte do CR oficial.

Cálculo local, sem novas requisições. Janela: até o fim das provas do 2026.1. Esforço: M.

#### 2. Ciclo da inscrição completo

O Início já mostra o RID Provisório. Completar o ciclo com três consultas:

- **SID: Consultar Inscrição:** o que o aluno pediu, com mensagem e data.
- **RID: Resultado da Inscrição:** inscrição aceita ou não aceita por falta de requisito (CO/PRE), com link para a disciplina.
- **SAID: Consultar Recibos:** alterações e cancelamentos registrados.

O dicionário do menu já traduz "RID: Resultado da Inscrição" para `RidInscricao` em [parseReqIds.ts](../src/adapters/outbound/aluno-online/parsers/parseReqIds.ts), mas nenhuma operação usa essa chave. Os parsers seguem o padrão do RID Provisório, com fixtures sintéticas e estados vazios reconhecidos.

Janela: antes da inscrição de novembro. Esforço: M.

#### 3. Explicar quando o Gerador não gera grade

Sete dos 18 relatos de bugs de 2026 tratam do Gerador. Quatro são genéricos ("não gera a grade", "ocorre erro") e não trazem dados para reproduzir. Uma avaliação na Play, da versão 1.3.3, relata o mesmo.

Hoje a última etapa mostra só "Não foi possível gerar nenhuma grade com os dados informados" ([GenerationStep.tsx](../src/features/ScheduleSimulator/steps/GenerationStep/GenerationStep.tsx)). Boa parte do motivo já é conhecida no aparelho: [GenerateSchedules.ts](../src/modules/planning/application/GenerateSchedules.ts) descarta as turmas que conflitam com os horários indisponíveis e devolve uma lista vazia quando sobram menos disciplinas que o mínimo. O app pode dizer:

- quais disciplinas perderam todas as turmas para os horários indisponíveis;
- quais pares de disciplinas só têm turmas no mesmo horário;
- quantas disciplinas restaram, quando ficam abaixo do mínimo pedido.

As mesmas contagens, sem dados pessoais, entram no relatório de erro.

Cálculo local. Janela: antes da inscrição de novembro. Esforço: M.

#### 4. Meu Progresso oficial

A Síntese da Formação permite:

- mostrar o **CR oficial** no lugar do aproximado; a evolução por período continua calculada pelo app e identificada como estimativa;
- ler os créditos exigidos e cumpridos por tipo de disciplina, no lugar da configuração manual de [CreditsSheet.tsx](../src/pages/MyProgress/CreditsSheet.tsx) e [useElectiveCreditsConfig.ts](../src/hooks/useElectiveCreditsConfig.ts), da qual hoje depende o progresso das eletivas;
- mostrar os períodos usados e o máximo para integralizar, com aviso para quem estiver perto do prazo.

A correspondência entre as categorias da Síntese e os tipos do app (Obrigatória, Eletiva Restrita, Eletiva Definida e Universal) precisa ser conferida. A versão curricular, a habilitação e a ênfase também servem ao plano até a formatura (item 10). Se a Síntese falhar, o app mantém o cálculo atual, identificado como aproximado.

Esforço: M.

#### 5. Alertas de pendência

Um card no Início, só quando houver algo a resolver:

- **Situação no ENADE** irregular. O ENADE é componente curricular obrigatório da graduação (Lei 10.861/2004, art. 5º, § 5º), e a situação irregular pode impedir a conclusão do curso.
- **Pendências de Documentos** com exigências registradas.

Sem pendência, nada aparece. É preciso observar o formato das duas páginas com pendência antes de escrever os parsers.

Esforço: P.

### Próximo: recursos nativos

#### 6. Notificações

**Status (18/10/2026): implementado.** Comportamento, privacidade e desligamento remoto estão na seção [Notificações do README](../README.md#notificações). O aviso de resultado da inscrição trouxe o parser de "RID: Resultado da Inscrição" (parte do item 2); a tela do resultado continua pendente.

- **Lembrete de aula**, a partir da grade salva e sem rede, com horário e sala.
- **Verificação periódica** com WorkManager: nota nova, mudança de posição no RID, resultado da inscrição e documento perto do vencimento (`validUntil` em [documents/domain/models.ts](../src/modules/documents/domain/models.ts)).

Cuidados:

- opt-in por tipo de aviso;
- sem a nota na tela de bloqueio por padrão;
- uma autenticação por execução, só as páginas necessárias e intervalos de horas, com espera maior quando o portal bloquear ou limitar requisições;
- permissão de notificação no Android 13 ou superior;
- leitura das credenciais no Keystore com o app fechado, a validar.

O módulo nativo pode seguir o padrão do TurboModule local de In-App Updates ([NativeInAppUpdates.ts](../src/specs/NativeInAppUpdates.ts)). Os lembretes de aula vêm primeiro, porque não tocam no portal.

Esforço: G.

#### 7. Widget "Próxima aula" e atalhos no ícone

- Widget com a próxima aula, o horário e a sala, a partir da última grade salva, sem acessar o portal.
- Atalhos ao pressionar o ícone: Próxima aula, Mapa, Notas e Documentos. Exigem deep links no build de produção; hoje o esquema `aouerj-dev://` existe só no debug.

Esforço: M (atalhos) a G (widget).

#### 8. Calendário acadêmico remoto e exportação para a agenda

O app já baixa [config/app-status.json](../config/app-status.json) na abertura e ao voltar ao primeiro plano, no máximo a cada 15 minutos. Um bloco de calendário, revisado a cada semestre, permite:

- contagens no Início, como "A inscrição abre em 3 dias";
- exportar a grade para a agenda em `.ics`, com repetição semanal até o fim do período e a sala no local do evento;
- corrigir o período sugerido no mural. O fallback `suggestedPeriod`, em [messagePeriod.ts](../src/features/MessageBoard/messagePeriod.ts), considera o 2º semestre a partir de julho, mas em outubro de 2026 o período ainda é 2026.1.

A mudança de 2026 mostra por que datas fixas no código envelhecem; o aviso remoto atualiza sem nova versão na Play. É preciso estender [app-status.schema.json](../config/app-status.schema.json) e a validação em [appStatus.ts](../src/modules/delivery/domain/appStatus.ts).

Janela: antes do início das aulas, em 18/11. Esforço: M.

### Depois: planejamento

#### 9. Controle de faltas

O aluno marca "faltei" numa aula da agenda e vê quantas faltas ainda pode ter, pela carga horária da disciplina e pela frequência mínima dos Critérios de Avaliação. Os dados ficam só no aparelho. O menu do portal não tem a frequência do período em curso; ela só aparece no histórico.

Esforço: M.

#### 10. Plano até a formatura

Distribuir as disciplinas que faltam pelos próximos períodos, respeitando pré-requisitos, créditos mínimos e o prazo máximo da Síntese, e destacar as disciplinas-gargalo, que trancam outras. O modelo do Gerador já tem `criticality` ([planning/domain/models.ts](../src/modules/planning/domain/models.ts)), sem uso na interface.

Os pré-requisitos exigem uma requisição por disciplina. O grafo deve ser carregado aos poucos e guardado por versão curricular.

Esforço: G.

## Antes de Grupos e do Radar de oportunidades

[Grupos](grupos.md) e o [Radar de oportunidades](radar-oportunidades-fontes-e-viabilidade.md) já estão desenhados e dependem de identidade verificada no servidor. O mural ainda não tem isso: o cliente lê as mensagens de uma turma sem credencial, como faz [diagnose-community.cjs](../scripts/diagnose-community.cjs) sem login, e o próprio app envia o nome do autor ([private-api/index.ts](../src/adapters/outbound/private-api/index.ts)). Antes de Grupos, autenticar a leitura e o envio no mural.

Enquanto isso, rever o texto "Canal de comunicação exclusivo entre alunos da mesma turma com total privacidade", em [info.ts](../src/features/AppInfoModal/info.ts), que o cliente atual não sustenta.

## Fora do escopo agora

| Ideia                                                                                     | Motivo                                                                                                                                                                          |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Solicitar, alterar ou cancelar inscrição, trancar matrícula ou abrir ramificação pelo app | Viável com o padrão de POST dos documentos, mas um erro altera a matrícula, e a validação real só é possível quando a janela abre. Ficar nas consultas e no link para o portal. |
| Avaliação de professores                                                                  | Demanda alta, com risco de moderação e difamação. A Pesquisa de Professores já está desligada em [routes.tsx](../src/routes.tsx).                                               |
| Cardápio do Restaurante Universitário                                                     | A pesquisa não encontrou fonte pública e atual do cardápio.                                                                                                                     |
| Dados cadastrais e alteração de senha                                                     | Pouco ganho sobre o portal, com dados pessoais e escrita.                                                                                                                       |

## Ordem sugerida

| #   | Funcionalidade                  | Dados                                        | Esforço | Janela                         |
| --- | ------------------------------- | -------------------------------------------- | ------- | ------------------------------ |
| 1   | Quanto preciso na PF?           | Notas do Período e Critérios de Avaliação    | M       | Até o fim das provas do 2026.1 |
| 2   | Ciclo da inscrição              | SID, RID e SAID                              | M       | Antes da inscrição de novembro |
| 3   | Explicar grade vazia no Gerador | Cálculo local                                | M       | Antes da inscrição de novembro |
| 4   | Meu Progresso oficial           | Síntese da Formação                          | M       | —                              |
| 5   | Alertas de pendência            | Situação no ENADE e Pendências de Documentos | P       | —                              |
| 6   | Notificações                    | Grade salva e consultas periódicas           | G       | Lembretes de aula primeiro     |
| 7   | Widget e atalhos                | Grade salva                                  | M a G   | —                              |
| 8   | Calendário remoto e `.ics`      | `config/app-status.json`                     | M       | Antes de 18/11                 |
| 9   | Controle de faltas              | Registro local                               | M       | —                              |
| 10  | Plano até a formatura           | Currículo, Síntese e pré-requisitos          | G       | —                              |

## Fontes

- [Calendário Acadêmico 2026 mês a mês](https://www.uerj.br/wp-content/uploads/2026/01/CA-2026_mes-a-mes-9_1_26.pdf), UERJ, janeiro de 2026, anterior à redefinição dos semestres.
- [Após greve, estudantes reclamam de novo cronograma da Uerj](https://tmc.com.br/?p=78341), TMC, 17/07/2026.
- [Lei nº 10.861/2004 (SINAES)](https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2004/lei/l10.861.htm), art. 5º, § 5º.
