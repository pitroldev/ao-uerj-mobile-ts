# Radar de oportunidades — fontes e viabilidade

Pesquisa realizada em 14/10/2026 para o AO UERJ. Proposta documental; nenhum coletor ou integração foi implementado.

## Conclusão

**É viável começar com um catálogo de fontes oficiais, curadoria e recomendações explicáveis.** Foram confirmados endpoints públicos de conteúdo no IME, PR4, DEPEXT e PR2, além de RSS no IME. A principal dificuldade é transformar publicações heterogêneas em oportunidades corretas e atualizadas.

O produto deve ajudar o aluno a descobrir uma oportunidade, entender os requisitos e chegar ao canal oficial de inscrição. Um primeiro lançamento não deve prometer cobertura de toda a UERJ, aprovação em processos seletivos ou inscrição automática.

Recomendação: piloto com monitorias de unidades selecionadas e chamadas diretas para graduandos. Incluir assistência estudantil como orientação com requisitos pendentes; ampliar pesquisa e extensão conforme as fontes forem mapeadas.

## O que foi verificado

Pesquisa na web, leitura de páginas institucionais e de uma errata em PDF, e requisições HTTP pontuais sem autenticação para conferir HTML, RSS e JSON. Os testes de API leram uma amostra de post ou página; não constituem inventário completo nem medição de disponibilidade contínua.

No repositório, foram consultados os modelos acadêmicos, de identidade, de comunidade e o adaptador da API existente. As avaliações de esforço e a arquitetura abaixo são recomendações a partir dessas evidências, não integrações prontas.

Não foram acessados sistemas autenticados de candidatos, enviados formulários ou coletadas bases de resultados pessoais.

## Fontes institucionais

| Fonte                                                                                                          | O que oferece                                                     | Evidência e limite                                                                                                            | Uso recomendado                                                                                         |
| -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| [IME — Oportunidades](https://www.ime.uerj.br/oportunidades/)                                                  | Publicações de bolsas e monitoria, além de outras notícias        | HTML, RSS e API responderam. A página mistura categorias e conserva chamadas encerradas                                       | Primeira fonte para piloto; ler a publicação completa e seus anexos                                     |
| [Direito — Monitoria](https://www.direito.uerj.br/monitoria)                                                   | Editais por disciplina, modelos e resultados                      | HTML acessível e links para documentos; a seção de editais também contém resultados                                           | Segunda fonte para testar um formato diferente e seleção por disciplina                                 |
| [PR4](https://www.pr4.uerj.br/) e [Avaliação Socioeconômica](https://www.pr4.uerj.br/avaliacao-socioeconomica) | Bolsas, auxílios, chamadas e orientação para acesso à assistência | Notícias via API; requisitos e calendários também estão em páginas e PDFs. A avaliação individual ocorre em sistema próprio   | Publicar oportunidades e orientar etapas; elegibilidade completa depende de informações externas ao app |
| [PR2 — Iniciação Científica e Tecnológica](https://www.pr2.uerj.br/?page_id=1930)                              | Informações dos programas, documentos e movimentação de bolsistas | Página e seu registro na API responderam por HTTP. A existência de um programa não comprova vaga disponível em um laboratório | Fonte de contexto e regras; buscar chamadas específicas para selecionar alunos                          |
| [DEPEXT/DIREXT](https://www.depext.uerj.br/)                                                                   | Editais, programas, projetos e calendário de extensão             | HTML e API responderam. Há seleções destinadas a coordenadores, com indicação posterior de discentes                          | Separar seleção de projetos, vaga discente e atividade sem seleção                                      |
| [PROSSIM — exemplo de seleção 1711](https://prossim.uerj.br/carregar_selecao/1711)                             | Descrição, calendário e documentos de processos seletivos         | HTML respondeu. O exemplo é voltado a graduandos de Geografia e Pedagogia, mas o sistema também atende outros públicos        | Fonte adicional; filtrar público e situação, ler edital e avisos                                        |
| [CETREINA](https://www.cetreina.uerj.br/)                                                                      | Departamento responsável por modalidades de bolsas e estágios     | A página respondeu 200, mas o HTML inicial contém carregamento dinâmico. Não foi validada uma API de publicações              | Relevante institucionalmente; integração automatizada permanece pendente de investigação                |

A atribuição institucional do CETREINA é descrita pela [PR1](https://www.pr1.uerj.br/termos-frequentes). Já a [listagem de projetos de extensão](https://www.depext.uerj.br/listagem-de-projetos-ativos) aponta para o SIEXT, mas projeto cadastrado não equivale a vaga aberta. Esses itens devem aparecer como diretório ou contexto quando não houver uma chamada verificável.

## Evidência técnica reproduzível

Requisições GET realizadas em 14/10/2026, sem cookies ou credenciais:

| Recurso consultado                                                                                                  | Resultado observado                                                                                 |
| ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| [RSS do IME](https://www.ime.uerj.br/feed/)                                                                         | HTTP 200, XML RSS válido, 10 itens na resposta                                                      |
| [Posts do IME](https://www.ime.uerj.br/wp-json/wp/v2/posts?per_page=1&_fields=id,date,modified,link,title)          | HTTP 200, JSON com identificador, publicação, alteração, link e título                              |
| [Posts da PR4](https://www.pr4.uerj.br/wp-json/wp/v2/posts?per_page=1&_fields=id,date,modified,link,title)          | HTTP 200, JSON com os campos solicitados                                                            |
| [Posts do DEPEXT](https://www.depext.uerj.br/wp-json/wp/v2/posts?per_page=1&_fields=id,date,modified,link,title)    | HTTP 200, JSON com os campos solicitados                                                            |
| [Página 1930 da PR2](https://www.pr2.uerj.br/index.php?rest_route=/wp/v2/pages/1930&_fields=id,modified,link,title) | HTTP 200, JSON da página de bolsas de iniciação científica e tecnológica                            |
| [Página de monitoria de Direito](https://www.direito.uerj.br/monitoria)                                             | HTTP 200, HTML com links para documentos                                                            |
| [Detalhe PROSSIM 1711](https://prossim.uerj.br/carregar_selecao/1711)                                               | HTTP 200, HTML com descrição e referências a edital, aviso e resultados                             |
| [Página inicial do CETREINA](https://www.cetreina.uerj.br/)                                                         | HTTP 200, HTML inicial com conteúdo dependente de JavaScript; leitura de publicações não comprovada |

Os endpoints WordPress são APIs de conteúdo dos sites, não uma API institucional unificada de vagas. A [documentação oficial do WordPress](https://developer.wordpress.org/rest-api/reference/posts/) descreve paginação, filtros, conteúdo e datas de alteração. A presença de `modified` ajuda a localizar mudanças, mas a regra de atualização precisa ser validada por fonte.

RSS serve à descoberta de publicações recentes. Não basta para acompanhar alterações em páginas fixas ou substituições de PDFs no mesmo endereço. Esses recursos precisam de revisão periódica própria.

As páginas HTML principais verificadas de IME, Direito, PR4, PR2, DEPEXT e PROSSIM não retornaram `ETag` nem `Last-Modified` nessa amostra. O coletor deve tolerar essa ausência e comparar o conteúdo relevante. Uma alteração de layout ou rodapé não deve gerar alerta de edital.

## Três casos que definem os cuidados do produto

### Uma oportunidade pode continuar publicada depois do encerramento

A [monitoria de Arquitetura de Computadores I no IME](https://www.ime.uerj.br/2026/07/novo-edital-para-selecao-de-monitor-arquitetura-de-computadores-i/) consta na lista de oportunidades, mas a publicação completa informa prazo de inscrição em 04/09/2026 e já apresenta resultado. O edital está ligado ao Google Drive e a inscrição a um formulário externo.

**Consequência:** em 14/10/2026 esse registro não deve receber o rótulo “Inscrições abertas”. Data da notícia, categoria e existência de formulário não comprovam abertura. Links externos referenciados pela unidade podem ser fontes auxiliares, mantendo a publicação institucional como origem.

### Uma errata pode alterar requisitos e calendário

O [PDF da PR4 consultado](https://www.pr4.uerj.br/wp-content/uploads/2026/03/SEI_128730781_Edital_de_Selecao_7_assinado.pdf) é a Errata 02 do Edital 03/2026. Ele altera critérios e prazos de uma seleção para graduandos; não é o edital integral.

**Consequência:** registrar edital, retificações e avisos como documentos relacionados. Uma errata isolada não basta para reconstruir todos os requisitos, e o nome do arquivo não determina o tipo do documento.

### Uma chamada pode selecionar o coordenador, não o estudante

A página de [Vivências 2026–2028](https://www.depext.uerj.br/vivencias) descreve seleção de projetos e indicação posterior de bolsista discente.

**Consequência:** não transformar todo anúncio com a palavra “bolsa” em uma inscrição disponível para o aluno. Registrar quem pode se candidatar e qual ação o estudante realmente pode realizar.

## Até onde é possível personalizar

| Informação necessária                                      | Disponibilidade atual                           | Tratamento proposto                                                                             |
| ---------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Disciplinas concluídas e situação                          | Modelo de histórico já existente                | Cruzar códigos explícitos do edital; equivalências exigem confirmação                           |
| Horários das aulas                                         | Modelo de grade já existente                    | Apontar conflitos quando a oportunidade publicar horário; confirmar disponibilidade pessoal     |
| Curso, campus e modalidade                                 | Não constam no `StudentProfile` atual           | Cadastro complementar ou integração específica; não inferir somente pela matrícula              |
| Interesse e área desejada                                  | Não cadastrados atualmente                      | Preferências opcionais, editáveis e explicáveis                                                 |
| Período cursado                                            | O campo `period` identifica o período acadêmico | Não confundir “2026.2” com “está no quarto período”; pedir a informação necessária              |
| CR e desempenho exigidos                                   | Histórico disponível; CR do app é aproximado    | Não usar estimativa para declarar atendimento a um corte oficial                                |
| ASE, renda, modalidade de ingresso e benefícios acumulados | Não disponíveis nesses modelos                  | Não inferir nem buscar em listas de candidatos; mostrar requisitos a confirmar no canal oficial |
| Documentação e disponibilidade para entrevista             | Não verificadas pelo app                        | Lista de providências e confirmação pelo aluno                                                  |

Base local: [perfil de identidade](../src/modules/identity/domain/types.ts), [modelos acadêmicos](../src/modules/academics/domain/models.ts) e [princípios do produto](../PRODUCT.md).

A [PR4 informa que a ASE envolve comprovação e sistema próprio](https://www.pr4.uerj.br/avaliacao-socioeconomica). Encontrar uma chamada compatível com o curso é diferente de comprovar todos os seus critérios. A interface deve usar estados como **“Combina com seu curso”**, **“Requisitos a confirmar”** e **“Inscrições encerradas”**, apresentando a justificativa. Evitar um percentual opaco de compatibilidade ou um selo de elegibilidade baseado em dados incompletos.

## Viabilidade por capacidade

| Capacidade                                   | Avaliação                               | Dependência principal                                                                           |
| -------------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Catálogo com fonte, prazo e inscrição        | Alta para um conjunto pequeno de fontes | Revisão editorial e classificação correta                                                       |
| Descoberta automática por API/RSS            | Alta nas fontes testadas                | Paginação, acompanhamento de alterações e filtros por público                                   |
| Extração de campos de HTML                   | Alta em formatos estáveis               | Adaptador por fonte e exemplos de regressão                                                     |
| Extração de PDF                              | Média                                   | Verificar texto, tabelas, anexos e documentos digitalizados; OCR não foi testado nesta pesquisa |
| Recomendar por disciplina, curso e interesse | Alta após complementar o perfil         | Correspondência de códigos e critérios documentados                                             |
| Alertar prazo e retificação                  | Média                                   | Distinguir mudança material, identificar qual documento prevalece e evitar duplicação           |
| Garantir elegibilidade completa              | Baixa com os dados atuais               | Avaliações e comprovações externas ao app                                                       |
| Inscrever automaticamente                    | Fora do MVP                             | Canais distintos, autenticação e documentos; nenhuma integração de inscrição foi validada       |
| Cobrir toda a universidade                   | Não demonstrada                         | Seleções descentralizadas, páginas específicas e canais não catalogados                         |

Essas avaliações expressam viabilidade de implementação, não estimativas de prazo ou custo. A pesquisa pontual não mede quantas oportunidades novas cada fonte produz por mês.

## Fluxo técnico proposto

1. **Cadastrar fontes:** responsável, escopo, formato, URL, frequência e estado de saúde. Revisar condições de acesso e `robots.txt` antes de ativar coleta recorrente; isso não foi auditado nesta pesquisa.
2. **Coletar no backend:** adaptadores para WordPress, RSS, HTML e documentos públicos, com limites por domínio, tentativas espaçadas e reaproveitamento de resultados. O celular consulta um catálogo consolidado.
3. **Extrair evidência:** guardar origem de cada campo, data de consulta e referência ao trecho ou página. Preservar a versão relevante do documento de regras, sem indexar bases de candidatos.
4. **Normalizar:** instituição, unidade, público, modalidade, curso, campus, requisitos, remuneração quando publicada, datas, canal de inscrição e documentos relacionados.
5. **Revisar e publicar:** distinguir chamada, programa permanente, seleção de projeto, errata, resultado e notícia. Dados essenciais conflitantes ou ausentes vão para revisão.
6. **Personalizar:** regras determinísticas para requisitos explícitos e preferências. Começar no aparelho com os dados acadêmicos já disponíveis, evitando enviar o histórico completo ao catálogo.
7. **Acompanhar mudanças:** verificar recursos conhecidos, inclusive PDFs no mesmo URL; atualizar situação e alertar quem salvou uma oportunidade quando houver alteração relevante.

Entidades mínimas: `Source`, `Opportunity`, `Requirement`, `SourceDocument` e `OpportunityRevision`. Os documentos devem manter a relação com a chamada original, e a deduplicação deve considerar órgão, número/ano, projeto e URL, sem juntar editais diferentes apenas porque os títulos se parecem.

Situações úteis: em revisão, futura, aberta, contínua, encerrada, suspensa e cancelada. “Prazo não confirmado” permanece uma condição explícita; não converter ausência de prazo em fluxo contínuo. Datas incluem fuso e precisão disponível: se o documento não publica horário, não inventar 23:59 como limite oficial.

Casos de uso dependem de portas de catálogo, preferências e notificações. Coleta e interpretação de cada provedor ficam em adaptadores. IA pode sugerir extração e classificação, com evidência e revisão; não decide elegibilidade nem publica condições sem suporte documental.

## MVP e validação

**Primeiro recorte:** IME, monitoria de Direito e chamadas diretas da PR4 para graduandos; PROSSIM entra após validar o índice de descoberta. PR2 e extensão entram inicialmente como referências, promovendo apenas chamadas discentes verificadas ao catálogo de vagas.

Entregar busca e filtros, lista personalizada com motivos, detalhe com requisitos e documentos, salvar, lembrete de prazo e ação para abrir a inscrição oficial. O recurso exige login, preservando o mapa como única funcionalidade sem autenticação.

Antes de lançar, executar um piloto de coleta e revisão por duas a quatro semanas — janela proposta para aprendizado, não cronograma estimado de implementação. Avaliar:

- Publicação encerrada ainda presente na página de oportunidades.
- Retificação que muda prazo ou requisito e PDF substituído no mesmo endereço.
- Edital para coordenadores, resultado ou seleção de pós-graduação entrando indevidamente na lista de graduação.
- Falha de fonte sem apagar o catálogo salvo nem fingir atualização recente.
- Prazo sem horário, conflito entre documentos e inscrição via site externo.
- Aluno sem curso cadastrado ou com requisito não verificável.
- Informação pessoal de candidatos sendo excluída da extração e das recomendações.

Critérios para avançar: toda oportunidade publicada deve ter origem e situação justificadas; todos os campos obrigatórios devem apontar para evidência; erros encontrados no piloto precisam ser corrigidos antes de notificações automáticas. Medir taxa de classificações incorretas, atraso de atualização, tempo de revisão e quantidade de oportunidades realmente relevantes por público.

O custo operacional dominante ainda precisa ser medido: manutenção de fontes e revisão de documentos, especialmente retificações. A coleta demonstrada é tecnicamente simples; a qualidade do catálogo é o que determinará se o recurso merece a confiança do aluno.
