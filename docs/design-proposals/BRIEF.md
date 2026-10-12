# AO UERJ — Briefing das 3 variantes visuais

## O pedido

"Siga algo na linha do atual, só que mais bonito, caprichado e pensado. As 3 variantes devem ser versões alternativas disso, cada uma com inspirações diferentes. As cores devem ser próximas às da UERJ, assim como hoje."

Uma rodada anterior com conceitos radicais (cartaz lambe-lambe, sinalização de prédio, carteira de cupons) foi **rejeitada** por se afastar demais do app. Portanto: **nada de metáforas, mundos temáticos, texturas, carimbos ou fontes de cartaz.** Cada variante tem que ser reconhecível na hora como "o AO UERJ, só que muito melhor".

Fontes de verdade:
- Produto: `PRODUCT.md` (raiz do repositório).
- Visual atual (código): `src/themes/index.ts`, `src/components/**`, `src/pages/**`, `src/features/**`.
- Dados de demonstração (fictícios): `docs/design-proposals/shared/data.js` → `window.AO_DATA`. Logo: `docs/design-proposals/shared/logo.js` → `aoLogo(classe, rótulo)` devolve o SVG do logo AO em `currentColor`.

## Identidade atual que as três variantes PRESERVAM

1. **Azul-marinho UERJ como chão do app.** `PRIMARY #003468`, `SECONDARY #004891`, `TERTIARY #016ba5`. O azul fica atrás de tudo: barra de status, cabeçalho e menu lateral.
2. **Painel de conteúdo claro sobre o azul, com o canto superior esquerdo muito arredondado** (`border-top-left-radius: 50px` em Início, Login, Progresso, Sobre…). É a assinatura do app. Pode ser refinado (40–56px), nunca removido.
3. **Cards com um canto reto**: raio 12px em três cantos e `border-top-right-radius: 0` (Box, SubjectBox, TextInput, Picker). Assinatura secundária: manter o canto superior direito reto (0–4px) em cards, campos e caixas.
4. **Cabeçalho azul**: botão de menu à esquerda, título centralizado (no Início, o período, ex.: "2026.2"), logo AO à direita (abre "Sobre").
5. **Menu lateral (drawer) azul** com os nomes das rotas e um destaque animado que desliza até a rota ativa; o conteúdo desliza para o lado revelando o menu atrás (`drawerType: 'back'`). Item "Sair" no rodapé.
6. **Login**: topo azul com o logo AO grande; painel claro com canto de 50px contendo Matrícula, Senha, Entrar e "Não possui acesso ou esqueceu a senha?".
7. **Cores de significado em tons pastel**: aprovado verde, reprovado vermelho, cancelado/isento cinza; turnos Manhã (amarelo), Tarde (pêssego), Noite (azul-claro); saúde da nota e das vagas (≥70% bom, ≥50% atenção, abaixo crítico — `AO_DATA.health()`).
8. **Rotas e títulos atuais** (são os textos do menu): Início, Meu Progresso, Gerador de Grade, Mural de Mensagens, Disciplinas Realizadas, Disciplinas do Currículo, Disciplinas Universais, Pesquisa de Disciplinas, Sobre. Copy real do app em `AO_DATA.copy`.

## O que "mais bonito, caprichado e pensado" significa aqui

- **Hierarquia**: cada tela responde primeiro à pergunta principal. No Início, a próxima aula (`AO_DATA.nextClass()`: "Otimização Combinatória · 12:20 · em 22 min · Sala 6019 B") vem antes de tudo; depois notas; depois a semana.
- **Consistência**: um só sistema de botões, campos, chips, listas, folhas inferiores e estados em todas as telas. Ícones de uma família só (Material Symbols, variante definida por variante).
- **Menu lateral melhor**: bloco do aluno no topo (nome, matrícula, curso), ícones, agrupamento leve (Acadêmico / Ferramentas), destaque ativo animado, versão e "Sair" no rodapé.
- **Notas**: tabela limpa P1, P2, PF, Média, com saúde mostrada por cor pastel **e** por rótulo/ícone (nunca só cor), números tabulares.
- **Semana**: seletor de dias (Seg–Sáb, hoje marcado) + lista ou linha do tempo do dia com horário (12:20–14:10), tempos (T1–T2), disciplina, sala; cor do turno; "Compartilhar grade". Substitui o carrossel de cartões.
- **Estados**: aviso fino de "Sem conexão / Atualizando / Não foi possível atualizar / Portal bloqueado" com ícone e "Tentar novamente"; esqueleto ao carregar (não spinner no meio do conteúdo); vazio e erro com ícone, frase real e ação.
- **Formulários**: campos com rótulo, ícone, botão de limpar; senha com mostrar/ocultar; seletores como menus suspensos ou chips roláveis (ex.: períodos em Disciplinas Realizadas como chips com o CR).
- **Folhas inferiores** no lugar dos modais centrais (Disciplinas em curso, Novidades, Configurar créditos, Reportar problema).
- **Tema escuro** de primeira classe: o azul UERJ continua sendo o cabeçalho/menu (mais profundo), superfícies escuras azuladas, pastéis viram tons escuros legíveis.

## As três variantes (mesma identidade, inspirações diferentes)

### Variante 1 · Material — inspiração: apps do Google no Android (Agenda, Classroom, Drive, Gmail)
A mais próxima do atual e a mais "nativa". `v1-material.html`.
- Tipo: **Roboto Flex** (Google Fonts), escala de tipos do Material 3.
- Cores: cabeçalho/menu `#003468`; esquema tonal do Material 3 com semente no azul UERJ: primária `#1F5BA3` (botões, ativo), contêiner primário `#D6E3FF` / texto `#001B3E`, superfície `#F8F9FD`, contêiner de superfície `#EEF1F7`, contorno `#C3C7D0`, texto `#191C20` / secundário `#44474E`. Escuro: cabeçalho `#0C2140`, superfície `#111318`, contêiner `#1D2026`, primária `#A9C7FF`, contêiner primário `#0E4280`.
- Componentes: Material 3 de verdade, com botões preenchidos/tonais/contornados, chips, campos contornados, interruptores, folhas, snackbar e indicador em pílula no menu lateral. Cards com raio 16px e canto superior direito 4px. Elevação tonal (pouca sombra).
- Semana em estilo Google Agenda: linha do tempo do dia com blocos coloridos pelo turno.
- Ícones: Material Symbols **Rounded**.

### Variante 2 · Banco digital — inspiração: Nubank, Banco Inter, C6 (apps que o aluno abre todo dia)
`v2-banco.html`.
- Tipo: **Figtree** (Google Fonts), números grandes e firmes, pesos 400/600/700/800.
- Cores: cabeçalho `#003468` mais alto no Início, funcionando como a "área do saldo": saudação, período e um resumo (próxima aula + CR aproximado), com botão de olho para **ocultar notas e CR** (como ocultar o saldo). Acento `#016BA5` (o terciário atual) para links e progresso; superfícies `#FFFFFF` e `#F3F5F9`; texto `#0F1B2D` / `#5A6475`. Escuro: cabeçalho `#06182F`, fundo `#0D1117`, superfícies `#161C26`, acento `#5BB2E8`.
- Componentes: fileira rolável de **atalhos circulares** abaixo do resumo (Gerador, Mural, Currículo, Pesquisar, Progresso), como Pix/Pagar/Transferir; seções separadas por divisores finos, linhas com chevron; cards só onde agrupam (raio 20px, canto superior direito 6px); botões em pílula grandes.
- Ícones: Material Symbols **Outlined** peso 400.

### Variante 3 · Agenda limpa — inspiração: Notion Calendar, Todoist, Apple Calendário (clareza tipográfica, fios finos, densidade calma)
`v3-agenda.html`.
- Tipo: **Inter** (Google Fonts) com `font-feature-settings: "tnum", "cv11"`; hierarquia só por tamanho e peso.
- Cores: cabeçalho `#003468` mais baixo e discreto; conteúdo branco `#FFFFFF`; fios `#E4E7EC`; texto `#101828` / `#5D6679`; acento `#004891` (o secundário atual) só em seleção e ações. Status com ponto colorido + rótulo; pastéis só em fundos pequenos. Escuro: cabeçalho `#0A1A33`, fundo `#0F1115`, fios `#252A33`, acento `#8DB4FF`.
- Componentes: menos cards e mais listas com divisores; tabelas compactas; semana como linha do tempo com coluna de horário à esquerda; cards (quando houver) sem sombra, com fio de 1px, raio 12px e canto superior direito reto.
- Ícones: Material Symbols **Outlined** peso 300.

## Requisitos comuns

**Arquivo único** por variante: HTML + CSS + JS vanilla inline, carregando `shared/logo.js`, `shared/data.js`, Google Fonts e Material Symbols. Abre via `file://` sem servidor. Comentário inicial no `<body>` com: inspiração, paleta, tipo e o que foi preservado do atual.

**Moldura de apresentação**
- Desktop (≥ 900px): celular Android 412×892 centralizado (barra de status com "11:58" e ícones em SVG, barra de gestos), cantos 36px. Ao lado, painel de controle discreto: nome da variante, alternador Claro/Escuro, lista de telas e estados (links de hash), "Dados fictícios para demonstração".
- Largura < 900px: sem moldura; o app ocupa a viewport. Os controles viram um botão flutuante pequeno (exceto com `embed=1`).
- Rotas por hash: `#/tela?theme=dark&state=offline&step=3&sheet=classes&drawer=1`. `capture=1` desliga animações e o botão flutuante. `embed=1` esconde moldura e controles (a página `index.html` incorpora cada variante em iframes de 412×892). Sem `theme`, usar claro.

**Telas e estados** (id da rota entre parênteses)
1. Carregamento (`splash`): logo, "Aguarde um momento enquanto carregamos os dados...".
2. Login (`login`): matrícula (numérico), senha (mostrar/ocultar), Entrar (estado carregando), link de recuperação. `state=error` mostra "Matrícula ou senha incorretas.".
3. Início (`home`): saudação, próxima aula, notas, semana, compartilhar; tocar numa aula abre `sheet=classes` (Disciplinas em curso, incluindo a cancelada com rótulo). `state=rid` = período de inscrição (sem grade; mostra RID parcial: Solicitadas/Oferecidas, Sua posição, status destacado quando posição = 0, "Última atualização em …"). Estados: `loading` (esqueleto), `updating`, `offline`, `refresh-failed`, `blocked`, `error` (com "Caso o erro persista"), `not-started`. `sheet=whatsnew` (Funcionalidades exclusivas).
4. Menu lateral aberto: `drawer=1` em qualquer tela.
5. Meu Progresso (`progress`): Concluídas, CR **aproximado** (dizer que é aproximado), gráfico de evolução do CR por período (SVG próprio), "Seu caminho no currículo" por tipo (Obrigatórias por contagem; eletivas por créditos), engrenagem → `sheet=credits` (3 campos, Resetar, Salvar). `state=unconfigured` mostra "Configure os créditos necessários para ver o progresso".
6. Gerador de Grade (`generator`, `step=1..7`): indicador de passos com rótulos; 1 mínimo/máximo (1–12, validação); 2 horários ocupados (Seg–Sáb × 17 tempos, tocar alterna, atalhos Manhã/Tarde/Noite ocupada, Limpar tudo, legenda, dica do toque longo); 3 prioridades (sugestões + interruptores; grupos de 2 exclusivos); 4 escolher disciplinas (filtro, busca, contador, "Trava de N créditos"); 5 carregar dados ("N de M disciplinas processadas", ok/recusada com motivo); 6 turmas (filtro por docente, seleção); 7 gerar ("Gerar grades", gerando, "Grade 1…3", abas Informações/Horários, "Gerar outra grade", estado vazio real). Barra inferior fixa com Anterior/Próximo.
7. Mural de Mensagens (`board` → `board-chat`): disciplinas em curso com turma; conversa com "Período das mensagens", dica quando vazio, mensagens (autor, hora, data, links), minhas mensagens diferenciadas, compositor e enviar; tocar copia → snackbar "Copiado com sucesso!".
8. Disciplinas Realizadas (`realizadas`): períodos com CR ("2026.1 · CR atual 7,77"), itens com status, tipo, nome, frequência, nota, créditos e horas.
9. Disciplinas do Currículo (`curriculo`): filtro de tipo, Não atendidas/Atendidas, busca, "Exibindo N disciplinas", itens com código, tipo, nome, período, ramificação, créditos, horas.
10. Disciplinas Universais (`universais`): departamento + busca + lista; vazio real.
11. Pesquisa de Disciplinas (`pesquisa`): campo "Exemplo: IME02-01388 ou 01388", histórico; código inválido → snackbar com o texto real.
12. Detalhe da disciplina (`subject`): código, nome, créditos/horas/duração, requisitos por grupo, turmas (Preferencial, docentes, Solicitadas x/y e Ocupadas x/y com barra e saúde, horários por dia com tempos), "Acessar ementa". Voltar com seta.
13. Sobre (`about`): logo, "AO UERJ", "Versão 1.3.5", aviso de app não oficial, Suporte (Reportar problema → `sheet=report` em 2 passos; Sugerir melhoria), Contribua (Ver repositório), Desenvolvedor Petro Cardoso (GitHub, LinkedIn, Email).

**Piso de qualidade**
- Material 3 como estrutura (Android); alvos de toque ≥ 48px; contraste de texto ≥ 4.5:1 (≥ 3:1 em texto grande) nos dois temas.
- Status nunca só por cor. Números tabulares. Seleção de texto, foco, caret e scrollbar tematizados.
- Proibido: rótulo/eyebrow acima de título, gradiente em texto, borda lateral colorida grossa, glassmorphism, sombra dura deslocada, emoji como ícone, texturas e ilustrações falsas, fontes de display chamativas.
- Copy real do app; nenhum número ou alegação além dos dados fictícios.
- Movimento: 150–250ms, só para estado (folhas, menu lateral, troca de dia, destaque do menu). `prefers-reduced-motion` e `capture=1` respeitados.

**Capturas** (Chrome headless em 412×892 exatos, já recorta):
`node docs/design-proposals/tools/shoot.cjs docs/design-proposals/<arquivo>.html docs/design-proposals/.impeccable/review/<vN> nome="rota?theme=light" nome-longa="rota?theme=light@412x1800" desktop="desktop:home?theme=light"`
