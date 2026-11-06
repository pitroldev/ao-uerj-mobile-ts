# Notificações, widgets e atalhos

Os lembretes, os avisos do portal, os widgets da tela inicial e os atalhos do ícone. Os detalhes do iPhone (o `BGTaskScheduler`, os 64 avisos agendados, o WidgetKit) estão em [iOS](ios.md).

## Notificações

A tela **Notificações** liga cada aviso separadamente; o Início convida uma vez a ligar o lembrete de aula. No iPhone, ela diz que é o iOS quem escolhe quando o app olha o portal, que o aviso pode chegar horas depois e que a "Atualização em 2º Plano" precisa estar ligada (ver [iOS](ios.md#verificação-em-segundo-plano)).

### Lembrete antes da aula

10, 15 ou 30 minutos antes, a partir da grade salva, sem consultar o portal.

- O `AlarmManager` repete cada aula toda semana e refaz os alarmes depois de reiniciar o aparelho, atualizar o app ou mudar o relógio.
- Enquanto houver lembretes, o WorkManager também os refaz a cada 6 horas, sem rede e sem abrir o app. Assim, retirar "Alarmes e lembretes" pausa os lembretes por no máximo esse tempo.
- Sem "Alarmes e lembretes" liberado (Android 12+), o sistema entrega o lembrete numa janela de até 10 minutos antes do horário. Se o app reagenda dentro dessa janela, o lembrete sai na hora. Com o celular parado (Doze), pode atrasar.
- Um lembrete que chegaria depois do início da aula é descartado. Uma aula já avisada não é avisada de novo, nem ao mudar a antecedência.
- Os lembretes param 21 dias depois da última leitura da grade e não conhecem feriados. Sem a grade salva (o cache em disco perdeu a validade ou foi apagado), os lembretes já agendados continuam até essa validade.
- No iPhone, os lembretes são avisos de data única no `UNUserNotificationCenter`, agendados até a validade do plano.

### Lembretes de avaliações

Os das provas e trabalhos anotados (ver [Provas e trabalhos](funcionalidades.md#provas-e-trabalhos)), no canal "Avaliações", com a mesma permissão. Ligados por padrão: quem escolhe é cada avaliação, e a primeira com lembrete pede a permissão.

- Cada lembrete é um alarme de data única (`EvaluationReminders.kt`), mostrado uma vez só. Os alarmes voltam depois de reiniciar, atualizar ou mudar o relógio, e o WorkManager dos lembretes de aula também os refaz.
- **Atrasado** (aparelho desligado, ou o Doze segurando o alarme sem "Alarmes e lembretes"), no Android o lembrete ainda sai enquanto o título vale: "Amanhã" e "Em 3 dias" até o fim daquele dia, "Hoje, 8:00" até o início e "Em 1 hora" por 15 minutos. Depois disso, ou depois do início da avaliação, é descartado.
- Os horários vão também como hora local: numa viagem com outro fuso, a prova das 8h continua lembrada às 7h da hora local, mesmo sem abrir o app.
- **Um aviso por avaliação** (Android): o seguinte substitui o anterior na barra. Na tela de bloqueio que oculta conteúdo, aparece só o título; a observação fica escondida.
- **No iPhone:** cada lembrete é um aviso separado (não substitui o anterior), o atraso não é recuperado e, com as prévias ocultas, a tela de bloqueio mostra "Toque para ver no AO UERJ.". O "Já fiz" funciona nos dois.

### Avisos do Aluno Online

Nota nova ou alterada, posição ou situação nova no RID Parcial, resultado da inscrição (aceitas e não aceitas, com o motivo) e documento emitido a até 3 dias de vencer.

- **Android:** o WorkManager roda a verificação em JS sem tela (`src/app/background`) a cada 4 horas, com rede e bateria não baixa. Das 22h às 7h, ou com as notificações desligadas no sistema, ele só refaz os lembretes de aula e nem inicia o React Native.
- **iPhone:** o `BGTaskScheduler` roda a mesma verificação quando o iOS deixar, cerca de 4 horas depois da anterior (a primeira, uma hora depois de ligar; uma rodada adianta o que venceria nos 15 minutos seguintes), com uns 30 segundos: o JS para em 25 segundos, com o que já leu. Das 22h às 7h, com a tela bloqueada ou com as notificações desligadas, nem inicia o React Native.
- Antes de qualquer acesso à rede, a verificação decide com o que está no aparelho: horário, pausa, avisos ligados da conta salva e a cópia salva do aviso remoto. Só então busca o aviso remoto e entra no portal.
- Cada rodada faz uma autenticação e consulta só as páginas dos avisos ligados. Os documentos e a grade são consultados no máximo uma vez a cada 20 horas; a grade, só com o lembrete de aula ligado.
- Se o login falha, a rodada para. Uma página fora do menu da conta, como o RID fora da época de inscrição, não interrompe as outras.
- Pausa por 12 horas depois de um bloqueio ou limite de consultas do portal, de um login que o portal não abre (HTTP 4xx ou página desconhecida) ou de senha recusada. Com o app na tela, não roda.

A verificação compara cada aviso com uma referência: o que o app mostrou (o cache) mais o que a própria verificação já leu no período.

- A primeira leitura vira referência, sem aviso, e o que o aluno já viu no app não volta como aviso.
- Uma leitura vazia ou em branco não apaga a referência: um dado que some e volta igual não avisa de novo.
- Os documentos são a exceção: avisam pelo prazo já na primeira verificação, uma vez por via.
- Com o app em segundo plano, a volta da rede não recarrega os dados. Eles atualizam quando o app volta à tela, e a verificação não perde a mudança.

### Outros avisos

A mesma tarefa sem tela também leva "Avisar quando voltar" (ver [Funcionalidades](funcionalidades.md#sem-internet-ou-com-o-portal-fora-do-ar)) e, só no Android, as leituras da Companhia agora e do Agora no campus (ver [No campus](no-campus.md)).

### Privacidade, logout e desligamento remoto

- O texto da nota só leva o valor se o aluno pedir. Na tela de bloqueio que oculta conteúdo sensível, os avisos mostram uma versão genérica.
- O logout, a troca de conta e o logout automático por senha recusada tiram da barra os avisos já mostrados e cancelam os lembretes.
- Para desligar tudo sem nova versão, inclua `notifications` em `disabledFeatures` do [aviso remoto](aviso-remoto.md#disabledfeatures). A tela fica indisponível, e os lembretes e a verificação são cancelados na abertura do app ou na próxima verificação em segundo plano.
  - Só com o lembrete de aula ligado não há verificação em segundo plano, e o cancelamento espera a abertura do app.
  - Eles voltam quando o aluno abre o app depois da correção.

## Widget e atalhos

Nenhum deles acessa o portal: usam a grade salva. No iPhone, os widgets ficam na extensão `ios/NextClassWidget`, com outros tamanhos (ver [iOS](ios.md#widgets-atalhos-e-app-intents)).

### Widget "Próxima aula"

4×1, redimensionável: a próxima aula da grade salva, pela mesma regra do card do Início.

- Um bloco à esquerda traz o dia ("Agora", "Hoje" ou o dia da semana) e o horário de início, em azul cheio quando a aula é hoje. Ao lado vêm a disciplina, o fim da aula com os tempos e a sala, e o local.
- O texto do bloco tem tamanho fixo e não cresce com a fonte do sistema. O leitor de tela lê o dia e o horário pela descrição do widget.
- O app envia a grade ao widget sempre que ela muda, com o app aberto. Em segundo plano, isso só acontece quando a verificação de avisos relê a grade (ver [Avisos do Aluno Online](#avisos-do-aluno-online)). Sem avisos ligados, o widget se atualiza ao abrir o app.
- O widget se redesenha quando a aula mostrada começa ou termina, à meia-noite e depois de mudar o relógio, reiniciar ou atualizar o app. O alarme nunca acorda o aparelho. Com "Alarmes e lembretes" liberado (a permissão dos lembretes), chega no minuto certo; sem ela, pode atrasar até 10 minutos.
- Depois do logout, pede o login. Pede para abrir o app em dois casos: antes de receber a primeira grade (widget posto antes de abrir o app) ou com a conta sem grade lida, e com a grade parada há mais de 21 dias.
- Sem nenhuma disciplina em curso com horário, mostra "Sem aulas na grade". O toque abre o Início.

### Widget "Hoje"

4×2, redimensionável (`TodayWidget.kt`): todas as aulas do dia, com o início, o fim, a disciplina e a sala. A aula em andamento ganha o fundo azul suave e as que já terminaram ficam esmaecidas; cabem 6 linhas, e o resto vira "mais N aulas hoje".

- Usa a mesma grade e a mesma política de alarmes do "Próxima aula": redesenha em cada início e fim de aula do dia e à meia-noite.
- Sem aulas no dia, mostra a próxima ("Sem aulas hoje. Próxima: Segunda, 17:00 · …"). Os avisos de login, grade não lida e grade parada são os do "Próxima aula".

### Ícone temático

Material You, Android 13+: o ícone é adaptativo, com a arte de sempre na frente (`drawable-nodpi/ic_launcher_art.png`) e o logo AO na camada `monochrome`, que o sistema pinta com as cores do tema. O vetor sai de `src/assets/AO_Logo.svg` por `node scripts/generate-icons.cjs --logo`.

### Atalhos do ícone

Tocar e segurar: Próxima aula, Notas, Mapa e Documentos ([shortcuts.xml](../android/app/src/main/res/xml/shortcuts.xml)).

- O Android abre atalhos limpando a tarefa. Por isso eles passam pela `ShortcutActivity`, sem tela, que repassa o destino à `MainActivity` pelo mesmo caminho do toque nos avisos e no widget. Com o app aberto, a tela atual fica.
- Não há esquema de deep link público, mas a `MainActivity` é exportada: outro app pode abri-la com a mesma ação (`com.aouerjmobile.notifications.OPEN`, ver [scripts/dev/README.md](../scripts/dev/README.md#capturas-de-tela)). O JS só aceita os destinos conhecidos: `home`, `grades`, `map` e `documents` (os dos atalhos) e `companion` e `campus` (os dos avisos da Companhia agora e do Agora no campus).
- O Mapa abre mesmo sem login; as outras telas esperam a conta.
- "Notas" abre o Início no quadro de notas. Quando as notas carregam e o período não tem nenhuma, avisa que ainda não há notas.
