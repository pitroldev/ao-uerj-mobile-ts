# Documentação do AO UERJ

Chegou agora? Comece pelo [README](../README.md) e pelo [guia de contribuição](../CONTRIBUTING.md).

## Para quem contribui

| Documento                                                      | O que tem                                                                                                                |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| [Guia de contribuição](../CONTRIBUTING.md)                     | Ambiente passo a passo, fluxo de PR, commits, convenções, textos do app e privacidade                                    |
| [Desenvolvimento](desenvolvimento.md)                          | Versões das ferramentas, scripts do Gradle, assinatura, verificações, hooks, CI, Renovate e o diagnóstico do portal real |
| [Arquitetura](arquitetura.md)                                  | Camadas, mapa de pastas, módulos, fronteiras do Oxlint, Aluno Online, servidor, contrato e sessão de aluno               |
| [Ferramentas de desenvolvimento](../scripts/dev/README.md)     | Login com a conta do `.env`, deep links de debug, capturas e testes E2E (Maestro)                                        |
| [Design system "Agenda limpa"](../src/components/ui/README.md) | Tokens, temas claro e escuro e componentes                                                                               |
| [Diretrizes visuais](design-brief.md)                          | A identidade do app e como validar uma tela                                                                              |
| [Contexto de produto](../PRODUCT.md)                           | Quem usa o app, para quê, e os princípios do produto                                                                     |

## Como o app funciona

| Documento                                                                                                       | O que tem                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| [Funcionalidades](funcionalidades.md)                                                                           | Sem internet e portal fora do ar, notas, PF e faltas, provas e trabalhos, Início, plano até a formatura e atividades complementares |
| [No campus](no-campus.md)                                                                                       | Companhia agora e Agora no campus                                                                                                   |
| [Notificações e widget](notificacoes-e-widget.md)                                                               | Lembretes de aula e de avaliações, avisos do portal, widgets, ícone e atalhos                                                       |
| [Emissão de documentos](emissao-de-documentos.md)                                                               | O fluxo dos PDFs do portal e o diagnóstico autenticado                                                                              |
| [Mapa do campus: design](../src/pages/CampusMap/DESIGN.md) e [no app](../src/pages/CampusMap/DESIGN.native.md)  | As decisões do mapa e a fidelidade das plantas                                                                                      |
| [Fontes do mapa](../scripts/campus-map/README.md) e [proveniência das medidas](../scripts/campus-map/PLANTA.md) | A geração do atlas offline e a origem de cada medida                                                                                |
| [Dados e armazenamento](dados-e-armazenamento.md)                                                               | O que fica no aparelho, onde, e o que sai dele, no nível do código                                                                  |
| [Aviso remoto](aviso-remoto.md)                                                                                 | O `config/app-status.json`: avisos, telas desligadas, versão mínima e época de inscrição                                            |
| [iOS](ios.md)                                                                                                   | O estado do iPhone, o workflow `ios.yml`, os módulos nativos e o segundo plano                                                      |

## Servidor

| Documento                       | O que tem                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------ |
| [Servidor](../server/README.md) | API, arquitetura, identificação do aluno, segurança, privacidade e implantação |

## Para quem mantém

| Documento                                                                      | O que tem                                                 |
| ------------------------------------------------------------------------------ | --------------------------------------------------------- |
| [Release](release.md)                                                          | Versão, tags, release-please e publicação na Play         |
| [Observabilidade](observabilidade.md)                                          | O Sentry, hoje desligado, e o que falta para ligá-lo      |
| [Receptor de compartilhamento](../scripts/qa/android-share-receiver/README.md) | Um app auxiliar para testar o compartilhamento no Android |
| [Histórico de versões](../CHANGELOG.md)                                        | O que mudou em cada versão (escrito pelo release-please)  |

## Para os alunos

| Documento                                         | O que tem                                                         |
| ------------------------------------------------- | ----------------------------------------------------------------- |
| [Política de privacidade](privacidade.md)         | O texto publicado na Play e no app. O caminho do arquivo não muda |
| [Avisos de terceiros](../THIRD_PARTY_NOTICES.txt) | As licenças de fontes, ícones, dados e marcas                     |

## O que entra em `docs/`

Só documentação do código e do uso do app. Planos de produto, roteiros, pesquisas e protótipos ficam fora do repositório. Nada de dados pessoais nem de segredos, nem em exemplos.
