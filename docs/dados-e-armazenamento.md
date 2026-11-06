# Dados e armazenamento

O que o app guarda, onde e o que sai do aparelho, no nível do código. É a referência para quem mexe em qualquer coisa que grava ou envia dados.

> [!IMPORTANT]
> Isto **não** é a política de privacidade. A política publicada é [`docs/privacidade.md`](privacidade.md): o link da Play Console e o do Sobre apontam para a página dela no GitHub, então o arquivo não muda de caminho (o `pnpm test:tooling` confere). Toda mudança no que o app guarda ou envia (as listas abaixo) entra lá também, com a data do topo, e no formulário "Segurança dos dados" da Play Console.

## No aparelho

### Conta e portal

- **Credenciais e identificação da conta:** no Keychain (iPhone) ou no Keystore (Android), por `react-native-keychain`.
- **Cookies, token e IDs de requisição:** efêmeros, pertencem ao adaptador do Aluno Online.
- **Migração do app antigo:** a migração do antigo Redux persistido transfere as credenciais para o armazenamento seguro e remove a cópia em texto simples. Se a transferência falhar, um novo login pode ser necessário.
- **Reinstalação no iPhone:** o Keychain sobrevive à desinstalação; ver [iOS](ios.md#outros-detalhes).

### Cofre

O cache acadêmico persistido tem dono explícito (a conta), e a interface conserva a última resposta quando uma atualização falha. Ele fica no cofre do app:

- **Android:** AES-256-GCM, chave não exportável no Android Keystore, arquivos fora do backup (`noBackupFilesDir`).
- **iPhone:** ECIES com chave P-256 no Keychain, só deste aparelho, e arquivos em Application Support fora do backup.

| O quê                                                                                                       | Validade no cofre |
| ----------------------------------------------------------------------------------------------------------- | ----------------- |
| Grade, notas, histórico, currículo, Síntese da Formação, disciplinas universais e atividades complementares | 180 dias          |
| RID e detalhes de disciplinas                                                                               | 7 dias            |

- A cópia antiga, sem cifra, é lida uma vez na atualização e apagada na primeira gravação.
- Sem o cofre (módulo nativo ausente), o cache segue no AsyncStorage, sem criptografia, com validade de sete dias para tudo.
- No mesmo cofre ficam também:
  - os PDFs que o aluno pede para guardar ("Guardar no aparelho", ver [Funcionalidades](funcionalidades.md#sem-internet-ou-com-o-portal-fora-do-ar)), no máximo 5 por conta;
  - a sessão de aluno do servidor próprio;
  - as chaves de membro da Companhia agora, uma por participação.

### Preferências da conta

Ficam no AsyncStorage, em `ao:v2:preferences:<conta>:<chave>`, e o logout as apaga (a lista está em `ACCOUNT_PREFERENCES`, em `src/app/composition/createAppServices.ts`).

| Chave                                                   | O que guarda                                                                                                                                                                 |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `notifications`, `notifications-check`                  | As escolhas dos avisos, o estado da última verificação e a referência dos avisos: as últimas notas, as posições no RID Parcial e os resultados da inscrição lidos no período |
| `notifications-good-news`                               | A boa notícia que o aluno já viu no app                                                                                                                                      |
| `portal-return-alert`                                   | O pedido de "Avisar quando voltar"                                                                                                                                           |
| `attendance`                                            | As faltas marcadas, por período                                                                                                                                              |
| `evaluations`                                           | As provas e os trabalhos anotados, por período, com a observação                                                                                                             |
| `graduation-prerequisites`, `graduation-plan`           | Os pré-requisitos lidos na Pesquisa de Disciplinas; a carga escolhida e os adiamentos do plano                                                                               |
| `elective-credits`                                      | Os créditos configurados das eletivas em Meu Progresso                                                                                                                       |
| `home-layout`                                           | O Início personalizado                                                                                                                                                       |
| `companion-name`, `companion-invite`, `companion-watch` | O nome que o aluno mostra na Companhia agora, o "Agora não" do convite do Início e o "Me avise se tiver mesa"                                                                |
| `campus-now`                                            | As salas da grade e o estado do Agora no campus, para a tarefa em segundo plano não entrar no portal                                                                         |
| `app-info-version`                                      | A última versão cuja folha de novidades o aluno viu                                                                                                                          |

A simulação de PF e CR não grava nada. O Plano até a formatura é calculado no aparelho.

### Preferências do app

No AsyncStorage, valem para o app inteiro e **não** são apagadas no logout: o tema, a última cópia do aviso remoto, os avisos dispensados, a data do último pedido de atualização e o histórico de uso que decide o pedido de avaliação. No iPhone, também a marca da instalação (`ao:v2:install`, da regra da reinstalação).

### Fora do JS

- **Lembretes:** os de aula (disciplina, horário e sala), os das avaliações (título e corpo já montados) e os da Companhia agora ficam nas SharedPreferences do Android ou agendados no iOS.
- **Widget:** a grade salva (disciplina, horário e sala) fica nas SharedPreferences do Android (no iPhone, no App Group) para o widget desenhar com o app fechado. O logout a apaga, e o widget passa a pedir o login.
- **Segundo plano no iPhone:** a próxima vez da verificação e de "Avisar quando voltar" fica no UserDefaults, sem dados do aluno (só horários e o intervalo), para o app aberto pelo iOS em segundo plano saber o que fazer antes do JS.

### O que o logout faz

- Invalida resultados tardios, aguarda as operações nativas e limpa cookies, credenciais e o cache da conta.
- Apaga os PDFs guardados, as preferências da conta, os lembretes e as verificações (cancelados), os avisos já mostrados na barra e a grade do widget.
- Sai de todas as mesas e grupos da Companhia agora, apaga as chaves de membro e encerra a sessão de aluno no servidor, que também sai do aparelho. O id da instalação fica.
- Vale também para a troca de conta e para o logout automático, quando o portal recusa a senha salva.

## O que sai do aparelho

### Para o Aluno Online

O app entra no portal direto do aparelho, com o login do aluno. A senha e os cookies do portal só vão para ele.

### Para o servidor próprio

O backend é o [`server/`](../server/README.md), em `pitrol.dev`. O que ele guarda está em [server/README.md](../server/README.md#segurança-e-privacidade): as mensagens, os relatos e as sugestões ficam no MongoDB sem prazo de remoção, e o log não registra IP nem User-Agent.

- **Situação do portal:** durante uma queda do portal, o app consulta `https://pitrol.dev/aouerj/portal-status`, no máximo a cada 2 minutos. A requisição não leva dados do aluno, mas o servidor vê o IP do aparelho e o horário.
- **Relato de erro:** diagnóstico estruturado e descrição sanitizada. Não coleta HTML bruto, senha, cookies ou tokens do portal. Com o Sentry ativo, o diagnóstico leva também o id do evento de feedback correspondente (ver [Observabilidade](observabilidade.md)).
- **Mural:** nome do autor, turma, disciplina, período escolhido e texto.
- **Gerador de grades:** os dados necessários ao cálculo. O servidor não guarda nada: calcula e responde.
- **Companhia agora:** a mesa ou o grupo para voltar leva o tipo, o horário, o ponto de encontro, o destino genérico, o recado e o primeiro nome.
  - O servidor apaga pouco depois do horário (30 minutos na mesa, 2 horas no grupo). As denúncias ficam 30 dias, e as contagens do dia, meio ano.
  - Todo pedido vai com a sessão de aluno, e cada membro guarda o aluno: um aluno abre uma por vez, entra uma vez em cada uma, e quem foi tirado não volta por outro aparelho.
  - O horário livre é calculado no aparelho, e não há localização ao vivo.
- **Agora no campus:** o tipo, a situação e o lugar, de listas prontas, sem texto livre, mais as respostas, os "Valeu", os "Não é verdade" e os avisos vistos. O "no seu caminho" sai da grade, no aparelho; a grade não vai para o servidor.
- **Avisos no aparelho:** os avisos são opt-in e montados no aparelho. Os do portal consultam só o portal. Os da Companhia agora ("Me avise se tiver mesa") e do Agora no campus leem as listas do servidor próprio, com a sessão de aluno.

### Identificação do aluno

No Android, com a Play Integrity; no iPhone, com o App Attest da Apple. O mural, a busca de docentes, a Companhia agora, o Agora no campus, o relato de erro e o gerador de grades falam com o servidor próprio como o aluno identificado. O fluxo está em [Arquitetura](arquitetura.md#sessão-de-aluno).

- De 5 a 30 segundos depois do login confirmado no Aluno Online (ou na primeira tela que precisar), o app manda a **matrícula e o nome** do login a `/aouerj/v2/students/session`, com um id da instalação e uma atestação sobre exatamente esses campos.
- **Android:** a atestação é um token da Play Integrity. O servidor manda o Google decifrar o token para saber se o app é o da loja, instalado pela loja, sem modificação, num aparelho íntegro.
- **iPhone:** é o App Attest. O app cria uma chave nova no Secure Enclave, e a Apple a atesta sobre o hash desses campos. O servidor confere a cadeia de certificados da Apple para saber se o app é o da loja, sem modificação, num iPhone de verdade.
- **No servidor:** a matrícula e o nome ficam cifrados, com os aparelhos de onde o aluno entrou (um HMAC do id da instalação). O servidor devolve uma sessão, que vale 30 dias sem uso e vai em cada pedido. No aparelho, a sessão fica no cofre, fora do backup.
- **Quem vê o quê:** com a sessão, o servidor sabe quem escreveu cada mensagem do mural, quem mandou cada relato e quem estava em cada mesa ou grupo da Companhia. Os outros alunos continuam vendo só o primeiro nome (ou o nome do mural); só a moderação, no admin, vê matrícula e nome, para banir.
- **Banimento:** vale para a conta, em qualquer aparelho. O app mostra até quando e por quê.
- **Google e Apple:** o pedido não leva senha nem cookies do portal. O Google vê, pela Play Integrity, que o app pediu um veredito. A Apple vê, pelo App Attest, que o app pediu a atestação de uma chave: recebe a chave pública nova e um hash do pedido, sem a matrícula nem o nome.
- **Sem a atestação** (Android sem a Play, simulador do iPhone): o mural, a busca de docentes, a Companhia agora e o Agora no campus não abrem. O relato de erro ainda chega, pela rota antiga, sem o aluno, e o gerador gera sem a sessão.

### Para o GitHub (aviso remoto)

O aviso remoto (ver [Aviso remoto](aviso-remoto.md)) está sempre ligado. O app baixa `config/app-status.json` deste repositório em `raw.githubusercontent.com` na abertura, ao voltar ao primeiro plano e, em segundo plano, quando a verificação de avisos vai de fato consultar o portal (antes disso, vale a cópia salva). Faz isso no máximo a cada 15 minutos, inclusive antes do login. A requisição não leva dados do aluno, mas o GitHub (Microsoft, nos EUA) vê o IP do aparelho, o horário e o User-Agent. Os links "Saiba mais" dos avisos só abrem hosts permitidos.

### Para as lojas

A atualização (In-App Updates da Play, só no Android) e a avaliação (In-App Review da Play; no iPhone, o `SKStoreReviewController`) usam as APIs da própria loja, que passam pelo app da loja no aparelho. O app não envia dados próprios nesses fluxos.

### Para o Sentry

Hoje, nada: o DSN está vazio. O que seria enviado está em [Observabilidade](observabilidade.md).
