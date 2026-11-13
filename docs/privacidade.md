# Política de privacidade do AO UERJ

**Última atualização:** 12 de novembro de 2026

O AO UERJ é um app não oficial e de código aberto para alunos da UERJ. Ele não tem vínculo com a universidade e usa a sua conta do Aluno Online. Esta política explica o que fica no seu celular, o que vai para o servidor do app, quem vê cada coisa e por quanto tempo. Ela vale para o app no Android, distribuído pela Google Play, e no iPhone.

## Resumo

- A sua senha do Aluno Online só vai para o portal da UERJ e fica guardada, cifrada, no seu celular.
- As suas notas, o histórico, a grade e os documentos ficam no seu celular. Eles não vão para o servidor do app.
- O app manda ao servidor do AO UERJ a sua **matrícula** e o seu **nome**, para confirmar que você é aluno e moderar o mural, a Companhia agora e o Agora no campus.
- O app não tem anúncios, não usa ferramentas de análise ou de rastreamento e não vende dados.
- O app não usa a sua localização, a câmera, o microfone nem os contatos.
- Você pode pedir acesso, correção ou exclusão dos seus dados pelo e-mail **contato@pitrol.dev**.

## Quem cuida dos dados

O AO UERJ é feito e mantido por Petro Cardoso ([pitrol.dev](https://pitrol.dev)), o controlador dos dados descritos aqui, nos termos da Lei Geral de Proteção de Dados (LGPD, Lei nº 13.709/2018). O contato para qualquer assunto de privacidade é **contato@pitrol.dev**.

A UERJ não opera o app e não responde por ele. O que acontece dentro do Aluno Online segue as regras da própria universidade.

## O que fica só no seu celular

O app entra no Aluno Online direto do seu celular, como um navegador faria. Tudo nesta seção fica no aparelho e não passa pelo servidor do AO UERJ.

- **Login:** a matrícula e a senha ficam no armazenamento seguro do sistema (o Android Keystore ou o Keychain do iPhone). A senha e os cookies do portal só vão para o Aluno Online (`alunoonline.uerj.br`).
- **Dados do portal:** grade, notas, histórico, currículo, Síntese da Formação, RID e disciplinas ficam num cofre cifrado (no Android, AES-256-GCM com a chave no Android Keystore; no iPhone, com uma chave P-256 no Keychain, só deste aparelho), fora do backup do celular, para o app abrir sem internet ou com o portal fora do ar. Essa cópia vale até 180 dias (o RID e os detalhes de disciplinas, 7 dias).
- **Documentos:** os PDFs que você escolhe guardar ficam no mesmo cofre, no máximo 5 por conta.
- **O que você anota:** faltas, provas e trabalhos, o Plano até a formatura e as escolhas dos lembretes e dos avisos.
- **Lembretes e avisos:** os lembretes de aula e os avisos de nota nova, do RID e da inscrição são montados no celular. Para os avisos, o app consulta o portal em segundo plano, do próprio celular.
- **Widget "Próxima aula":** guarda a disciplina, o horário e a sala das suas aulas, para aparecer com o app fechado.
- **Preferências do app:** o tema, os avisos que você dispensou e o histórico de uso que decide quando o app pede uma avaliação na loja.

Quando você sai da conta, o app apaga do celular o login, os dados do portal, os PDFs, as anotações, os lembretes e o widget dessa conta. As preferências do app ficam até você desinstalá-lo. Desinstalar apaga tudo.

## O que vai para o servidor do AO UERJ

O servidor do app fica em `pitrol.dev`. Toda a comunicação usa HTTPS.

### Identificação do aluno

Para usar o mural, a busca de docentes, a Companhia agora, o Agora no campus, o relato de erro e o gerador de grades, o app confirma que você é aluno da UERJ. Logo depois do login no Aluno Online, ele manda ao servidor a sua **matrícula** e o seu **nome**, como aparecem no portal, um código desta instalação do app e uma verificação de que o app é o original: no Android, a do Google Play (Play Integrity), de que ele veio da Play Store; no iPhone, a da Apple (App Attest), de que ele é o app do AO UERJ, num iPhone de verdade.

- **Para que usamos:** para saber quem escreveu cada mensagem do mural, quem mandou cada relato, quem estava em cada mesa ou grupo da Companhia agora e quem mandou cada aviso do Agora no campus. Também para moderar: impedir que a mesma pessoa entre duas vezes e suspender quem for denunciado por assédio, spam ou outro abuso.
- **Quem vê:** os outros alunos veem só o primeiro nome que você escolher, ou o nome que você assina no mural. A matrícula e o nome completo só aparecem para a moderação do app.
- **Como guardamos:** a matrícula e o nome ficam cifrados no banco (AES-256-GCM). A busca pela matrícula usa um código derivado dela (HMAC), e não a matrícula em si. Do celular, guardamos só um código derivado do id da instalação.
- **Sessão:** o app recebe uma sessão, que vence depois de 30 dias sem uso e fica no cofre do celular, fora do backup. Sair da conta encerra a sessão no servidor.
- **Suspensão:** se a sua conta for suspensa, o app mostra até quando e por quê. A suspensão vale em qualquer aparelho.
- **Sem essa verificação** (em aparelhos Android sem os serviços do Google, ou num iPhone que não tenha o App Attest), o app não faz essa identificação, e as funções entre alunos (o mural, a Companhia agora e o Agora no campus) não abrem. O relato de erro ainda chega, sem dizer quem mandou.

### Mural de mensagens

Quando você escreve no mural de uma turma, o app manda o nome que você quer mostrar, a disciplina, a turma, o período e o texto. A mensagem aparece para quem abrir o mural da mesma turma. Ela fica guardada sem prazo de remoção, ligada à sua identificação, para a moderação.

### Busca de docentes

O app só lê a lista de docentes e das turmas de cada um. O que você procura não fica ligado a você.

### Gerador de grades

Quando você pede para gerar, o app manda as turmas e as preferências escolhidas. O servidor calcula as grades, responde e não guarda nada. A sua identificação, quando existe, só serve para limitar quantos pedidos cada aluno faz por minuto.

### Companhia agora

Quem abre uma mesa no almoço ou um grupo para voltar manda o tipo, o horário, o ponto de encontro (de uma lista do campus), o destino de forma genérica, um recado curto e o primeiro nome que quiser mostrar. O recado não aceita telefone, @, link nem nome de app de conversa. Quem entra manda o primeiro nome e os recados prontos que escolher. O horário livre sai da sua grade, calculado no celular. A grade não vai para o servidor, e o app não acompanha onde você está.

- A mesa ou o grupo some do servidor pouco depois do horário: 30 minutos na mesa e 2 horas no grupo para voltar.
- Para mostrar quantos alunos estão de olho na lista, o servidor guarda, por 15 minutos, um código de quem a abriu.
- As denúncias ficam 30 dias. As contagens de cada dia, sem nome nem recado, ficam meio ano.
- A moderação vê quem participou de cada mesa ou grupo.

### Agora no campus

Quando você avisa algo sobre o campus (por exemplo, "elevadores parados no hall do bloco C"), o app manda o tipo, a situação e o lugar, escolhidos de listas prontas, sem texto livre. Também vão as suas respostas "Continua" e "Acabou", os "Valeu", os "Não é verdade" e quais avisos você viu, para contar quantos alunos viram cada um.

- Os outros alunos veem o aviso sem saber quem avisou. A moderação vê quem foi.
- O app não usa a sua localização: o "no seu caminho" sai da sua grade, no celular, e a grade não vai para o servidor.
- Os seus pontos e o seu nível ficam na sua conta, no servidor, e ninguém mais os vê.
- Os avisos ficam 70 dias, para o resumo do mês anterior. As respostas, os "Valeu", as denúncias e o que você viu somem cerca de 2 dias depois do fim do aviso. As contagens do dia de cada aluno somem em 3 dias. Os pontos ficam enquanto a conta existir.

### Relato de erro

Quando você relata um problema, o app manda a tela, o que você escreveu e um diagnóstico técnico: a operação que falhou, o tipo de erro, a versão do app (com a atualização que ela roda, se houver uma) e, às vezes, o código da disciplina. No relato do gerador de grades, vai também um resumo da sua última tentativa, só com números: o passo em que você parou, quantas disciplinas e turmas havia, quantos horários ocupados você marcou e o resultado. Nenhuma disciplina, turma ou horário vai junto. O diagnóstico não leva os seus dados do portal. Com a identificação, o servidor sabe quem mandou. Os relatos ficam guardados sem prazo de remoção, para corrigir o app.

Os relatos das versões 1.x do app levavam a página do portal em que o erro aconteceu, que pode ter dados pessoais. Eles ficam só no servidor, fora do código público, e podem ser apagados a pedido.

### Situação do portal

Quando o Aluno Online cai, o app pergunta ao servidor se o portal voltou, no máximo a cada 2 minutos. Esse pedido não leva dados seus.

### Atualizações do app

Ao abrir, o app pergunta ao servidor do AO UERJ se há uma atualização do código dele, para receber correções (por exemplo, quando o Aluno Online muda) sem esperar uma versão nova na loja. O pedido leva o sistema (Android ou iPhone), a versão do app, a atualização que está instalada e um código aleatório desta instalação, criado pela biblioteca de atualização, que não diz quem você é. O servidor não guarda esse código nem liga o pedido à sua conta. A atualização vem assinada pelo AO UERJ, e o app recusa qualquer código que não tenha essa assinatura. Ela usa a biblioteca `expo-updates`, mas não passa pelos servidores da Expo.

### Registros técnicos

O servidor do app registra cada pedido sem o IP, sem o User-Agent e sem o conteúdo: só o caminho, o resultado e quanto tempo levou. Para limitar abusos, ele conta os pedidos por IP na memória, sem gravar. Como em quase todo site, o servidor web que fica na frente pode manter registros de acesso com o IP e o horário, apagados periodicamente.

## Serviços de outras empresas

- **UERJ (Aluno Online):** o app conversa com o portal em seu nome, com o seu login.
- **Google (Android):** a Play Integrity confirma que o app é o original. O Google vê que o app pediu a verificação, mas não recebe a sua matrícula nem o seu nome, só um código calculado a partir deles. Atualizar e avaliar o app usam a própria Play Store, sem dados do AO UERJ. Esses serviços seguem a [política de privacidade do Google](https://policies.google.com/privacy).
- **Apple (iPhone):** o App Attest confirma que o app é o original. O iPhone cria uma chave nova a cada entrada, e a Apple recebe essa chave e um código calculado a partir do pedido, nunca a sua matrícula nem o seu nome. O serviço segue a [política de privacidade da Apple](https://www.apple.com/br/legal/privacy/).
- **GitHub (Microsoft):** o app baixa, no máximo a cada 15 minutos, um arquivo de avisos e de configuração deste repositório, em `raw.githubusercontent.com`. O pedido não leva dados seus, mas o GitHub vê o IP, o horário e o User-Agent ([declaração de privacidade do GitHub](https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement)).
- **Oracle Cloud e MongoDB Atlas:** o servidor roda numa máquina da Oracle Cloud, e o banco de dados fica no MongoDB Atlas. Eles guardam os dados em nome do AO UERJ e não os usam para outra coisa. Esses serviços podem ficar fora do Brasil, inclusive nos Estados Unidos.
- **Links e compartilhamento:** "Como chegar", no mapa, abre o Google Maps só com o destino. Os links do Sobre abrem o GitHub, o LinkedIn e a Play Store. Quando você compartilha a grade ou o convite do app, você escolhe o app de destino (o WhatsApp, por exemplo), e o que você manda segue as regras dele.

## O que o app não faz

- Não mostra anúncios.
- Não usa ferramentas de análise, de rastreamento ou de publicidade, nem o identificador de publicidade do Android ou do iPhone.
- Não vende os seus dados nem os compartilha para publicidade.
- Não pede a localização, a câmera, o microfone, os contatos nem os arquivos do celular.
- Não manda ao servidor a sua senha, as suas notas, o histórico nem a sua grade.

## Por quanto tempo

| O quê                                          | Onde               | Por quanto tempo                                                       |
| ---------------------------------------------- | ------------------ | ---------------------------------------------------------------------- |
| Login e dados do portal                        | celular            | até você sair da conta (os dados do portal valem até 180 dias)         |
| Cadastro (matrícula, nome e aparelhos)         | servidor           | enquanto você usar o app, ou até você pedir a exclusão                 |
| Sessão                                         | servidor e celular | até 30 dias sem uso, ou até você sair da conta                         |
| Mensagens do mural e relatos de erro           | servidor           | sem prazo, até você pedir a exclusão                                   |
| Mesas e grupos da Companhia agora              | servidor           | até 30 minutos (mesa) ou 2 horas (grupo para voltar) depois do horário |
| Denúncias da Companhia agora                   | servidor           | 30 dias                                                                |
| Avisos do Agora no campus                      | servidor           | 70 dias                                                                |
| Respostas, "Valeu", denúncias e o que você viu | servidor           | cerca de 2 dias depois do fim do aviso                                 |
| Pontos e nível do Agora no campus              | servidor           | enquanto a conta existir                                               |
| Contagens sem nome                             | servidor           | até meio ano                                                           |

## Seus direitos

Pela LGPD (art. 18), você pode pedir:

- a confirmação de que tratamos dados seus e o acesso a eles;
- a correção de dados errados ou desatualizados;
- a anonimização, o bloqueio ou a exclusão de dados desnecessários;
- a portabilidade dos seus dados;
- a informação sobre com quem os dados são compartilhados;
- a exclusão dos seus dados;
- a oposição a um tratamento.

Para pedir, mande um e-mail para **contato@pitrol.dev** com a sua matrícula. Podemos pedir uma confirmação de que a conta é sua. A resposta chega em até 15 dias.

Na exclusão, apagamos o seu cadastro, os aparelhos, as sessões e os pontos, e tiramos o vínculo com você das mensagens, dos relatos e dos avisos. Se preferir, apagamos também as mensagens e os relatos.

Você também pode reclamar à Autoridade Nacional de Proteção de Dados ([ANPD](https://www.gov.br/anpd)).

## Base legal

- **Executar as funções que você usa** (LGPD, art. 7º, V): o login no portal, o mural, a Companhia agora, o Agora no campus, o gerador de grades e o relato de erro.
- **Legítimo interesse** (LGPD, art. 7º, IX): confirmar que você é aluno, manter o app seguro, evitar fraudes e moderar as funções entre alunos.

## Segurança

- Toda a comunicação usa HTTPS.
- No celular, os dados ficam num cofre cifrado, fora do backup.
- No servidor, a matrícula e o nome ficam cifrados, e só a moderação os abre.
- O código é aberto: qualquer pessoa pode conferir o que o app faz no [repositório](https://github.com/pitroldev/ao-uerj-mobile-ts).

Se acontecer um incidente de segurança que possa trazer risco ou dano relevante aos alunos, avisamos os afetados e a ANPD.

## Crianças

O app é feito para alunos da UERJ e não é voltado a crianças.

## Mudanças nesta política

Quando esta política mudar, a data no topo muda. O histórico de todas as versões fica no [GitHub](https://github.com/pitroldev/ao-uerj-mobile-ts/commits/main/docs/privacidade.md). As mudanças importantes também aparecem no app.
