# Product

<!-- impeccable:product-schema 1 -->

## Platform

android

## Users

Estudantes de graduação da UERJ que já usam o Aluno Online (AO), o portal acadêmico oficial. Abrem o app no celular, muitas vezes de pé, no corredor, no ônibus ou entre uma aula e outra, para responder perguntas rápidas: "qual é a próxima aula e em que sala?", "saiu a nota da P2?", "consegui vaga na inscrição (RID)?", "quanto falta para eu me formar?". Em épocas de inscrição usam o app com mais calma, para planejar a grade do próximo período.

## Product Purpose

Aplicativo não oficial e de código aberto (GPLv3) que traduz o Aluno Online em uma interface móvel legível. Consulta notas do período, grade semanal de horários, RID parcial, histórico, currículo, disciplinas universais e detalhes de disciplinas e turmas. Acrescenta o que o portal não tem: progresso no currículo e evolução do CR, gerador de grades de horário e mural de mensagens por turma. O sucesso é o aluno nunca precisar abrir o portal no navegador do celular.

## Positioning

Não é o app da UERJ; é o app que os alunos gostariam que a UERJ tivesse feito. Lê o portal real com a conta do próprio aluno, guarda os últimos dados para uso offline e cria ferramentas próprias (gerador de grade, progresso, mural) em cima dele.

## Operating Context

- Login com matrícula e senha do Aluno Online; recuperação de senha leva ao portal oficial.
- Vocabulário próprio da UERJ que deve permanecer intacto: tempos M1–M6, T1–T6, N1–N5; períodos no formato 2025.1; P1, P2, PF e Média; RID parcial (vagas solicitadas/oferecidas e posição na fila); disciplina Obrigatória, Eletiva Restrita, Eletiva Definida e Universal; códigos de disciplina como IME02-01388; ementa no ementário da UERJ.
- O portal fica bloqueado ou instável com frequência; o app deve mostrar dados salvos, avisar que estão desatualizados e permitir tentar de novo.
- Mural: mensagens por disciplina, turma e período, com nome do autor, para trocar links de grupos, materiais e datas de prova.
- Gerador de grade em 7 passos: quantidade de disciplinas, horários ocupados, prioridades, seleção de disciplinas, carregamento de dados, escolha de turmas e geração.

## Capabilities and Constraints

- React Native 0.87 (nova arquitetura, React Compiler) com styled-components; Android publicado na Google Play, build iOS existe mas é secundário.
- Rotas atuais: Início, Meu Progresso, Emissão de Documentos, Gerador de Grade, Mural de Mensagens, Disciplinas Realizadas, Disciplinas do Currículo, Disciplinas Universais, Pesquisa de Disciplinas, Mapa, Notificações (Android), Sobre, além de Login e Carregamento.
- Notificações são opt-in por tipo: lembrete antes da aula (grade salva, sem portal) e avisos do Aluno Online (nota, RID e documento perto de vencer), com verificação a cada 4 horas fora do horário noturno.
- No Android, o widget "Próxima aula" mostra a próxima aula da grade salva na tela inicial, e o ícone do app tem atalhos para Próxima aula, Notas, Mapa e Documentos. Nenhum dos dois acessa o portal.
- Navegação por menu lateral (drawer), como hoje; todas as rotas continuam acessíveis por ele.
- O app precisa oferecer tema claro e escuro.
- Estados obrigatórios em cada tela de dados: carregando, vazio, erro com nova tentativa, portal bloqueado, sem conexão com dados salvos e atualizando.
- O CR exibido é aproximado (cálculo próprio); a interface não deve apresentá-lo como oficial.

## Brand Commitments

- Nome "AO UERJ" e o logo AO (`src/assets/AO_Logo.svg`) permanecem.
- O redesenho é uma evolução do visual atual, não uma troca de identidade: cores próximas às da UERJ (azul-marinho institucional `#003468` e seus azuis), cabeçalho azul com menu, título e logo AO, painel de conteúdo claro com o canto superior esquerdo bem arredondado sobre o azul, e cards com um canto reto (superior direito).
- Tom: português brasileiro direto e próximo do aluno, sem jargão de marketing.

## Evidence on Hand

- Fixtures sintéticas de parser em `src/adapters/outbound/aluno-online/__fixtures__/`.
- Não há depoimentos, número de usuários, avaliações ou parcerias confirmados; não inventar.
- Desenvolvedor: Petro Cardoso; repositório público no GitHub (pitroldev/ao-uerj-mobile-ts).

## Product Principles

1. A resposta vem antes da navegação: a informação do momento (próxima aula, nota nova, posição no RID) aparece sem toques extras.
2. Dado salvo é melhor do que tela vazia; a idade do dado fica sempre visível.
3. Fala a língua da UERJ: tempos, períodos, códigos e tipos de disciplina aparecem como o aluno já conhece.
4. Planejar é uma conversa: o gerador guia passo a passo e explica cada escolha.
5. Honestidade sobre a origem: não oficial, CR aproximado, falhas do portal assumidas com clareza.

## Accessibility & Inclusion

Uso ao ar livre e em movimento: contraste alto, alvos de toque de pelo menos 48dp, texto que respeita o tamanho de fonte do sistema e cor nunca como único sinal de status (aprovado, reprovado, vagas).
