# Design system "Agenda limpa" (V3), temas claro e escuro

Base visual do AO UERJ para todas as telas. Referência: o protótipo
`v3-agenda.html` (claro e escuro), com fios finos de 1px, listas em vez de cards,
tabelas compactas, o azul UERJ atrás de tudo, o painel com o canto superior
esquerdo de 48 e o canto superior direito reto em cards, campos e chips.

```tsx
import { Text, Section, List, ListRow, Button, Notice } from '@components/ui';
import { ScreenPanel } from '@templates/ScreenPanel';
import { useHeaderBack } from '@templates/Header';
```

Regras que valem para tudo:

- **Alvos de toque de 48dp.** Todas as primitivas já garantem isso (chips de 36 usam `hitSlop`).
- **Status nunca só por cor.** Ponto + rótulo (`StatusLabel`), ícone + texto (`Notice`), célula de nota com rótulo acessível (`GradeCell`).
- **Fonte do sistema respeitada.** Não desligue `allowFontScaling`. Use `minHeight`, não `height`, em caixas com texto.
- **Peso pela família, nunca `fontWeight`.** No Android, `fontWeight` com fonte própria gera um negrito falso. Use `<Text weight="semibold">` ou `theme.fonts.semibold`.
- **Algarismos tabulares só em números alinhados** (`<Text tabular>`): horários, notas, contagens em colunas. Nunca em códigos ou prosa; no Inter, o tnum também alarga o hífen.
- **Movimento de 150 a 250ms, só para estado.** As primitivas animadas respeitam "remover animações" (`useReducedMotion`).
- **styled-components com o tema.** Use `theme.colors.*`, `theme.status.*` etc. Não use estilos inline com valores literais (`style={{ marginTop: 12 }}`): use styled components, `StyleSheet.create` ou valores do tema. O inline fica para valores calculados na hora (deslocamento de um arrasto, largura medida). Essa é uma convenção da revisão: o Oxlint não tem a regra `react-native/no-inline-styles` do antigo ESLint, então o `pnpm lint` não acusa.
- **Nada de cor, fonte ou tamanho de texto literal fora de `src/themes`.** Cores vêm de `theme.colors`/`status`/`shift`, fontes do `Text` (ou `theme.fonts`/`typeStyle`) e tamanhos de ícone de `theme.sizes.icon`. A exceção é a imagem exportada da grade (`scheduleSvg.ts`): usa sempre as cores do tema claro (`SHARE_IMAGE_COLORS`, porque sai do app e é vista por quem não está no escuro de quem enviou) e mantém a fonte própria.

---

## Tokens (`src/themes`)

Há dois temas com os mesmos nomes semânticos, `lightTheme` e `darkTheme`
(`LIGHT` e `DARK` em `@root/themes`), tipados como `DefaultTheme`. O `App`
entrega o tema ativo pelo `ThemeProvider`: o escolhido em "Tema" (rodapé do menu
lateral: Padrão do sistema, Claro ou Escuro) ou o do aparelho. Componentes leem
sempre `useTheme()`; `LIGHT` fica para testes e para a imagem compartilhada. Ramos por
`theme.name === 'dark'` só para o que o protótipo muda de forma no escuro
(faixa do cabeçalho de tabelas e da grade semanal).

A folha inferior já é uma superfície elevada: o `BottomSheet` aplica
`theme.sheetColors` ao conteúdo (no escuro, cada degrau sobe um nível; no claro,
nada muda).

### Cores: `theme.colors`

| Token                                                        | Claro                            | Escuro                  | Uso                                                                                                                  |
| ------------------------------------------------------------ | -------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `brand`                                                      | `#003468`                        | igual                   | Barra de status, cabeçalho, menu lateral, fundo atrás do painel                                                      |
| `brandHighlight`                                             | `#004891`                        | igual                   | Destaque do item ativo no menu, avatar no menu                                                                       |
| `onBrand` / `onBrandMuted`                                   | `#FFF` / `rgba(255,255,255,.76)` | igual                   | Texto e ícones sobre o azul                                                                                          |
| `brandRule`                                                  | `rgba(255,255,255,.14)`          | igual                   | Fios sobre o azul                                                                                                    |
| `onBrandPressed`                                             | `rgba(255,255,255,.16)`          | igual                   | Toque em botões sobre o azul (menu, voltar, logo)                                                                    |
| `onBrandTrack`                                               | `rgba(255,255,255,.18)`          | igual                   | Trilho da barra de carregamento sobre o azul                                                                         |
| `onBrandRing`                                                | `rgba(255,255,255,.2)`           | igual                   | Contorno do avatar no menu                                                                                           |
| `background`                                                 | `#FFFFFF`                        | `#0B1626`               | Fundo do painel e do Login (`--bg`)                                                                                  |
| `surface`                                                    | `#FFFFFF`                        | `#111F33`               | Superfície elevada: cards, campos, chips, seletor, botão contornado, segmentado                                      |
| `surfaceMuted`                                               | `#F6F7F9`                        | `#111F33`               | Linha pressionada, aviso neutro, eventos da agenda, "callout", balão                                                 |
| `surfacePressed`                                             | `#F6F7F9`                        | `#182A43`               | Toque sobre superfície elevada (card, chip, dia, segmento)                                                           |
| `surfaceStrong`                                              | `#EDF0F4`                        | `#182A43`               | Trilho de progresso, esqueleto, botão desabilitado                                                                   |
| `sheet`                                                      | `#FFFFFF`                        | `#111F33`               | Folha inferior                                                                                                       |
| `float`                                                      | `#FFFFFF`                        | `#182A43`               | Etiqueta flutuante (data grudada da conversa)                                                                        |
| `rule`                                                       | `#E4E7EC`                        | `#304259`               | Fio padrão (divisores, cards, tabelas)                                                                               |
| `ruleStrong`                                                 | `#D0D5DD`                        | `#3B4E68`               | Fio forte (chips, segmentado, contornos, borda tracejada)                                                            |
| `fieldBorder`                                                | `#B8BFCA`                        | `#63768F`               | Borda de campo e seletor                                                                                             |
| `gridRule`                                                   | `#E4E7EC`                        | `#26374D`               | Fios internos da malha de horários ocupados                                                                          |
| `ink`                                                        | `#101828`                        | `#E6EDF6`               | Texto principal                                                                                                      |
| `inkMuted`                                                   | `#5D6679`                        | `#A7B4C6`               | Texto secundário (5,8:1 no claro; 8,6:1 no escuro)                                                                   |
| `inkSubtle`                                                  | `#7C8596`                        | `#7E8DA3`               | Só decorativo (pontos de agenda, linha média do gráfico), nunca texto                                                |
| `accent`                                                     | `#004891`                        | `#6DAEF0`               | Acento: **só seleção e ações**, como texto, ícone, indicador e fio                                                   |
| `fill` / `onFill`                                            | `#004891` / `#FFF`               | `#2A6BC0` / `#FFF`      | Fundo de ação e seleção forte: botão primário, enviar, dia escolhido, caixa marcada, interruptor ligado, passo atual |
| `fillPressed`                                                | `#02427F`                        | `#3273C9`               | `fill` pressionado                                                                                                   |
| `accentSoft` / `accentLine`                                  | `#E8F0FA` / `#BBD0EC`            | `#123458` / `#2D5786`   | Selecionado suave (chip, segmento, linha em foco), aviso informativo                                                 |
| `selection`                                                  | `#CFE0F5`                        | `#17497B`               | Seleção de texto                                                                                                     |
| `noticeWarnAction` / `noticeBadAction`                       | = `accent`                       | = tinta do tom          | Ação em texto dos avisos de atenção e crítico (no escuro, sublinhada)                                                |
| `logo`                                                       | `#003468`                        | `#E6EDF6`               | Logo AO sobre a superfície                                                                                           |
| `scrim`                                                      | `rgba(10,20,40,.44)`             | `rgba(2,8,20,.62)`      | Véu das folhas                                                                                                       |
| `pressedOverlay`                                             | `rgba(16,24,40,.10)`             | `rgba(230,237,246,.12)` | Toque em botões de ícone sobre a superfície                                                                          |
| `snackbar`, `onSnackbar`, `snackbarSuccess`, `snackbarError` | `#1C2433`…                       | `#273E5C`…              | Snackbar                                                                                                             |

Dentro da folha inferior, no escuro: `background`/`sheet` `#111F33`, `surface` e
`surfaceMuted` `#182A43`, `surfacePressed` e `surfaceStrong` `#1F3551`, `rule`
`#33475F`, `ruleStrong` `#42566F` (`theme.sheetColors`). Os pares de texto dos
dois temas têm teste de contraste AA em `src/themes/__tests__/contrast.test.ts`.

### Significados: `theme.status` e `theme.shift`

Cada um tem `{ ink, bg, line }` (texto/ícone, fundo pastel pequeno, fio). Os de
`status` têm também `wash`/`washLine`, o fundo de áreas grandes (avisos,
células marcadas, alerta do RID): no claro é o próprio `bg`; no escuro,
atenção e crítico descem um degrau.

| Tom               | ink       | bg           | line         | Escuro (ink / bg / line)                           | Uso                                                   |
| ----------------- | --------- | ------------ | ------------ | -------------------------------------------------- | ----------------------------------------------------- |
| `status.good`     | `#17673A` | `#DDF5E3`    | `#A9DDB7`    | `#A4EBB8` / `#1E4A2E` / `#3B6A4A`                  | Aprovado, nota/vaga boa (≥70%)                        |
| `status.warn`     | `#715600` | `#FAF4CC`    | `#E5D682`    | `#F8D48B` / `#573900` / `#78571D` (wash `#462D00`) | Atenção (≥50%), falha ao atualizar, trava de créditos |
| `status.bad`      | `#A4261E` | `#FCE4E2`    | `#F1B5AF`    | `#FF9C92` / `#612E2B` / `#854B47` (wash `#4C221F`) | Reprovado, crítico, erro, bloqueado, horário ocupado  |
| `status.neutral`  | `#4A5263` | `#EDEFF3`    | `#D3D8E0`    | `#B3BFCF` / `#36414F` / `#535F6E`                  | Cancelada, isenta, sem dado                           |
| `status.info`     | = acento  | `accentSoft` | `accentLine` | idem                                               | "Hoje", "Agora", "Preferencial", aviso informativo    |
| `shift.morning`   | `#665400` | `#FBF8D6`    | `#E6DC98`    | `#F2D98C` / `#4E3A03` / `#715A24`                  | Manhã                                                 |
| `shift.afternoon` | `#894A0F` | `#FFEEDB`    | `#F0CBA4`    | `#FFCC9C` / `#593014` / `#7F4F31`                  | Tarde                                                 |
| `shift.night`     | `#0A5A73` | `#DEF3FA`    | `#A6D8E9`    | `#99E6FF` / `#184655` / `#356575`                  | Noite                                                 |

Pastéis só em fundos pequenos (célula de nota, tag, bloco da grade). Utilitários
em `@components/ui`: `toneColors(theme, tone)`, `healthTone('GOOD'|'BAD'|'CRITICAL')`
(converte `numberToColor`/`getVacancieHealth`), `shiftTone('T1')`, `HEALTH_LABEL`
("Bom", "Atenção", "Crítico") e `SHIFT_LABEL` ("Manhã", "Tarde", "Noite").

### Tipografia: `theme.typography` e `<Text variant>`

Inter estático: `theme.fonts.regular | medium | semibold | bold` e
`displaySemibold` (corte Display, usado sozinho pelas variantes de 22 ou mais).

| Variante                 | Tamanho/linha | Peso padrão        | Onde                                                                  |
| ------------------------ | ------------- | ------------------ | --------------------------------------------------------------------- |
| `display`                | 26/32         | semibold (Display) | Números de destaque (`StatGroup`)                                     |
| `titleXL`                | 24/30         | semibold (Display) | Saudação "Olá, Marina"                                                |
| `titleL`                 | 22/28         | semibold (Display) | Título de entidade: login, disciplina, Sobre; horário da próxima aula |
| `titleM`                 | 20/26         | semibold           | Título de passo do gerador                                            |
| `titleS`                 | 18/24         | semibold           | Título de folha, nome da turma no mural                               |
| `headline`               | 17/24         | semibold           | Título de seção, nome da próxima aula, número do dia                  |
| `appBar`                 | 17/24         | medium             | Título do cabeçalho azul                                              |
| `body`                   | 15/21         | regular            | Título de linha (com `weight="semibold"`), opções, mensagens, campos  |
| `callout` (padrão)       | 14/20         | regular            | Texto corrido, descrições, rótulos de chip                            |
| `meta`                   | 13/18         | regular            | Metadados de lista, avisos, contagens                                 |
| `caption`                | 12/16         | medium             | Cabeçalho de tabela, status, tags, horas da agenda                    |
| `button` / `buttonSmall` | 15/20, 14/20  | semibold           | Rótulos de botão                                                      |

Fora do `Text` (por exemplo num `TextInput`) use `typeStyle(theme, 'body')`.

### Espaço, raios, medidas e movimento

- `theme.spacing`: `xxs 2 · xs 4 · sm 8 · md 12 · lg 16 · xl 20 · xxl 24 · xxxl 32 · huge 40`.
- `theme.layout`: `gutter 20` (margem lateral), `panelPaddingTop 32`, `panelPaddingBottom 40`, `panelRadius 48`, `sectionGap 30`, `sectionHeaderGap 10`, `sectionHeaderMinHeight 32`, `appBarHeight 52`, `drawerWidth 300`, `sheetMaxHeight 0.86`.
- `theme.radii`: `xs 4 · checkbox 5 · sm 6 (tag, nota) · md 8 (chip) · lg 10 (botão, campo, aviso) · xl 12 (card, grupo, agenda) · xxl 20 (ícone vazio) · sheet 24 · panel 48`. **Canto cortado**: raio nos cantos e `border-top-right-radius: 0`. Botões são a exceção: raio 10 em todos os cantos.
- `theme.borders`: `hairline 1`, `focus 2` (borda de foco/erro; compense 1px de padding para o texto não pular).
- `theme.sizes`: `touch 48`, `row 56`, `field 48`, `select 52`, `fieldGroupRow 56`, `chip 36`, `tag 24`, `gradeCell 40×28`, `avatar 40`, `iconTile 40`, `emptyIcon 64`, `icon` (`xs 15 · sm 16 · md 18 · lg 20 · xl 22 · xxl 24 · empty 30`; ex.: `<Icon size={theme.sizes.icon.lg} />`).
- `theme.motion`: `fast 150`, `base 200`, `slow 250`, `easing [.2,.8,.2,1]` (use `Easing.bezier(...theme.motion.easing)`).
- `theme.shadows`: `panel`, `sheet`, `snackbar` (o sistema não usa sombra em cards).

---

## Padrões de layout (derivados do protótipo)

- **Painel**: toda tela de conteúdo usa `ScreenPanel`. Conteúdo com 32 no topo (abaixo da curva), **20 nas laterais** e 40 no fim.
- **Seções**: `Section` = 30 acima, título 17/24 com ação ou nota à direita, 10 até o conteúdo. A primeira seção da tela usa `first` (ou fica logo após a saudação, que já é o topo).
- **Avisos de estado** (`Notice`, `QueryNotice`) ficam **no topo do conteúdo**, antes de tudo, com 20 abaixo.
- **Listas**: `List` + `ListRow`. A lista sangra até as bordas do painel (margem −20) e cada linha volta a ter 20 de padding; o fio começa em 20 e vai até a borda direita. O último item não tem fio.
- **Ordem de uma linha de disciplina**: nome primeiro (`title`), código e contexto na linha de baixo (`code` + `subtitle`, unidos por " · "), depois linhas de `meta`, `facts` (status) e tags. Nunca um rótulo acima do título.
- **Filtros no topo de listas**: `ChipGroup layout="scroll"` → 10 → `SegmentedControl` → 10 → `SearchField` → linha de contagem ("Exibindo 15 disciplinas", `Text variant="meta" tone="muted"`, 16 acima e 4 abaixo; números em `weight="semibold" tone="ink"`).
- **Cards**: poucos. Só onde agrupam (próxima aula, números do progresso, gráfico, erro). Sem sombra, fio de 1px.
- **Tabelas**: notas e histórico usam `Table` (cabeçalho em legenda, fios entre linhas, colunas numéricas de largura fixa: 45 nas notas).
- **Rodapé fixo** (gerador, compositor do mural): `ScreenPanel footer`.
- **Folhas** substituem modais centrais: `BottomSheet` com rodapé de botões de mesma largura.
- **Copy**: textos reais do app; quando o protótipo tiver um texto melhor para o mesmo lugar, use o do protótipo.

### Estados obrigatórios das telas de dados

| Estado                       | Como mostrar                                                                                                                            |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Carregando (sem dados)       | `SkeletonList` (ou esqueleto com `Skeleton` no formato da tela), nunca um indicador girando no meio                                     |
| Atualizando (com dados)      | `UpdatingBar` (o `QueryNotice` já faz) ou `ScreenPanel updating`                                                                        |
| Sem conexão com dados salvos | `Notice kind="offline"` + "Tentar novamente" (o `QueryNotice` já faz)                                                                   |
| Falha ao atualizar           | `Notice kind="refreshFailed"` + "Tentar novamente"                                                                                      |
| Portal bloqueado com dados   | `Notice kind="blocked"` + "Tentar novamente" (sem `text`, usa `PORTAL_BLOCKED_TEXT`; o `QueryNotice` já faz)                            |
| Portal bloqueado sem dados   | `BlockedState onRetry={refetch}` (cadeado, `PORTAL_BLOCKED_FULL_TEXT` e "Tentar novamente")                                             |
| Vazio                        | `EmptyState` com ícone e a frase real (`search_off`, `history_edu`, `forum`, `manage_search`, `event_upcoming`, `event_busy`, `school`) |
| Erro                         | `ErrorState` (centralizado) ou `ErrorState variant="card"` (Início, acima da ajuda "Caso o erro persista")                              |

---

## Primitivas (`@components/ui`)

### Texto e marca

**`Text`**: `variant`, `weight` (`regular|medium|semibold|bold`), `tone` (`ink|muted|subtle|accent|onFill|onBrand|onBrandMuted|good|warn|bad|neutral`), `color` (literal), `tabular`, `align`, mais as props do `Text` do RN.

```tsx
<Text variant="titleXL" accessibilityRole="header">Olá, {firstName}</Text>
<Text tone="muted">Terça, 13 de outubro</Text>
<Text variant="titleL" tabular>12:20</Text>
```

**`Icon`**: `name` (tipado, Material Symbols Outlined peso 300), `size` (padrão `theme.sizes.icon.xl`, 22), `color` (`ink`), `filled` (variante preenchida, quando gerada), `accessibilityLabel` (sem rótulo é decorativo).

```tsx
<Icon name="share" size={theme.sizes.icon.md} color={theme.colors.accent} />
<Icon name="home" filled color={theme.colors.onBrand} />
```

Ícones disponíveis: veja `Icon/glyphs.ts` (todos em contorno, em `OUTLINED_GLYPHS`; a variante preenchida, em `FILLED_GLYPHS`, existe só para os itens do menu e para `check_circle`, `error`, `warning`, `cancel`, `lock`, `star`). Para acrescentar, edite as listas `OUTLINED`/`FILLED` em `scripts/generate-icons.cjs` e rode `node scripts/generate-icons.cjs`.

**`AoLogo`**: `width` (36), `color` (`onBrand`; use `theme.colors.logo` sobre o branco), `accessibilityLabel` ("AO UERJ"; `null` se decorativo).

```tsx
<AoLogo width={108} color={theme.colors.logo} />   {/* Sobre */}
<AoLogo width={164} />                              {/* Login e carregamento, sobre o azul */}
```

### Estrutura

**`Divider`**: `inset`, `strong`, `vertical`, `spacing`, `label` + `labelAlign` (`start` = "Grupo 1 ——", `center` = "—— Hoje ——" do mural).

**`Section`**: `title`, `action` (nó à direita, já com margens negativas), `note` + `noteIcon` (texto secundário à direita), `description` (".sec-p"), `first`, `dense`.

```tsx
<Section
  title="Semana"
  action={<Button variant="text" size="sm" icon="share" label="Compartilhar grade" onPress={share} />}
>
  …
</Section>
<Section title="RID Parcial" note="Período de inscrição" noteIcon="how_to_reg">…</Section>
```

**`List` / `ListRow` / `ListSeparator`**: a linha aceita `title`, `titleWeight`, `code`, `subtitle`, `meta` (string ou array), `facts`, `children` (tag, barra), `leading` (`Checkbox`, `Radio`, `IconTile`, `Avatar`), `leadingIcon`, `leadingAlign`, `trailing`, `aside` (texto tabular à direita), `chevron`, `external`, `onPress`, `onLongPress`, `highlighted` (fundo de acento suave), `divider`, `inset` (14 dentro de cards), `dense`, `accessibilityRole` e `accessibilityState`. `List`: `bleed` (padrão true), `lastDivider`. Em `FlatList`, use `ListRow divider={false}` + `ItemSeparatorComponent={ListSeparator}`.

```tsx
<List>
  {items.map(s => (
    <ListRow
      key={s.id}
      title={s.name}
      code={s.id}
      subtitle={SUBJECT_TYPE[s.type]}
      meta={`${s.period}º período · ${s.credits} créditos · ${s.workload} horas`}
      facts={s.taken ? <StatusLabel tone="good" label="Atendida" /> : undefined}
      chevron
      onPress={() => open(s.id)}
    >
      {s.minimum_credits ? (
        <Tag
          tone="warn"
          icon="lock"
          label={`Trava de ${s.minimum_credits} créditos`}
        />
      ) : null}
    </ListRow>
  ))}
</List>;

{
  /* linha selecionável (gerador) */
}
<ListRow
  title={c.subject}
  code={c.subjectId}
  subtitle={`Turma ${c.classNumber}`}
  leading={<Checkbox checked={on} />}
  leadingAlign="start"
  accessibilityRole="checkbox"
  accessibilityState={{ checked: on }}
  onPress={toggle}
/>;

{
  /* interruptor (prioridades) */
}
<ListRow
  title={p.label}
  titleWeight="regular"
  trailing={<Switch value={on} />}
  accessibilityRole="switch"
  accessibilityState={{ checked: on }}
  onPress={toggle}
/>;
```

**`Card`**: `padding` (16), `muted`, `dashed`, `onPress` (vira botão com fundo pressionado). Fio de 1px, raio 12, canto superior direito reto, sem sombra.

**`Table` / `TableRow`**: `columns` (`key`, `label`, `width` ou `flex`, `align`), `verticalAlign` (`center|top`), `rowPadding` (10 notas, 12 histórico), `hideHeader`, `accessibilityLabel`. Cada filho da `TableRow` ocupa a coluna correspondente; dê à linha um `accessibilityLabel` com o resumo.

```tsx
<Table
  accessibilityLabel={`Notas do período ${period}`}
  columns={[
    { key: 'name', label: 'Disciplina' },
    { key: 'p1', label: 'P1', width: 45, align: 'center' },
    { key: 'p2', label: 'P2', width: 45, align: 'center' },
    { key: 'pf', label: 'PF', width: 45, align: 'center' },
    { key: 'avg', label: 'Média', width: 45, align: 'center' },
  ]}
>
  <TableRow accessibilityLabel="Sistemas Distribuídos: P1 8,5, Bom na P1">
    <View>
      <Text weight="medium">Sistemas Distribuídos</Text>
      <StatusLabel tone="good" label="Bom na P1" />
    </View>
    <GradeCell value={8.5} />
    <GradeCell value={null} />
    <GradeCell value={null} />
    <GradeCell value={null} />
  </TableRow>
</Table>
```

**`PropertyList`**: `items` (`label`, `value`, `tabular`), `layout` (`aligned` = rótulo numa coluna de 128, propriedades da disciplina; `spread` = valor em negrito à direita, resumo do gerador).
**`StatGroup`**: números de destaque lado a lado (`items: { value, label }[]`).
**`FootNote`**: ícone + nota secundária ("O CR é calculado pelo app…").
**`Avatar`**: iniciais (`name`, `tone` `brand|accent`). `initials(name)` também é exportado.
**`IconTile`**: ícone em caixa de canto cortado (`icon`, `tone` `accent|bad|muted|…`, `size` `md` 40 / `lg` 64).

### Ações

**`Button`**: `label`, `variant` (`primary` preenchido · `outline` contornado · `text` · `link` largura total centralizado), `size` (`md` 15 · `sm` 14 · `xs` 13; todos com 48 de altura), `icon`, `iconPosition`, `loading` + `loadingLabel`, `block`, `selected` (botão alternável, como "Manhã" no gerador), `color` e `underline` (só `text`/`link`: rótulo em outra cor, com toque neutro, como a ação dos avisos quentes no escuro), `disabled`. Sem `label` e com `icon` vira o quadrado de 48 (exige `accessibilityLabel`).

```tsx
<Button label="Entrar" block loading={isPending} loadingLabel="Entrando…" onPress={submit} />
<Button variant="outline" icon="arrow_back" label="Anterior" onPress={prev} />
<Button label="Próximo" icon="arrow_forward" iconPosition="end" disabled={!valid} onPress={next} />
<Button variant="link" label="Não possui acesso ou esqueceu a senha?" onPress={recover} />
<Button icon="arrow_forward" accessibilityLabel="Buscar disciplina" onPress={search} />
```

**`IconButton`**: `icon`, `accessibilityLabel` (obrigatório), `variant` (`plain` círculo · `outlined` canto cortado, o − e + · `filled` círculo em `fill`, o enviar do mural), `color`, `iconSize`, `filledIcon`, `onBrand` (sobre o azul), `selected`, `loading`.

### Campos

**`TextField`**: `label` (acima, 13/18), `leadingIcon`, `clearable` + `clearLabel`/`onClear`, `secureToggle` (mostrar/ocultar senha), `error` (texto ou `true`), `helper`, `trailing`, `multiline` (área de 132), `containerStyle`/`fieldStyle`/`inputStyle`, mais as props do `TextInput` (aceita `ref`).
**`SearchField`**: lupa + limpar + tecla de busca; o `placeholder` vira o rótulo acessível.
**`FieldGroup` + `FieldGroupRow`**: o grupo do login (rótulo na coluna da esquerda, fio entre linhas, borda de foco no grupo). `FieldGroup error` mostra a mensagem do formulário abaixo, anunciada.
**`FieldError`**: a linha de erro de campo isolada.
**`NumberStepper`**: − [campo] + e unidade (`value` string, `onChangeText`, `min`, `max`, `step`, `unit`, `accessibilityLabel`, `invalid`). Ao focar, o campo seleciona o número, e o que se digita o substitui.

```tsx
<FieldGroup error={error}>
  <FieldGroupRow icon="badge" label="Matrícula" placeholder="Digite sua matrícula"
    keyboardType="number-pad" clearable value={matricula} onChangeText={setMatricula}
    returnKeyType="next" onSubmitEditing={() => passwordRef.current?.focus()} />
  <FieldGroupRow ref={passwordRef} icon="lock" label="Senha" placeholder="Digite sua senha"
    secureToggle value={password} onChangeText={setPassword} />
</FieldGroup>

<SearchField placeholder="Pesquise pelo nome da disciplina" value={q} onChangeText={setQ} />
<NumberStepper value={min} onChangeText={setMin} min={1} max={12} unit="matérias"
  accessibilityLabel="mínimo de matérias" invalid={Boolean(minError)} />
```

**`SelectField`**: parece um campo e abre uma folha. `label`, `icon`, `aside`, `placeholder`, `disabled`. Modo com opções (o campo controla a folha): `options` (`value`, `label`, `aside`, `description`), `value`, `onChange`, `sheetTitle`. Modo livre: `valueLabel` + `onPress`.
**`OptionList`**: rádios para o corpo de uma folha (`options`, `value`, `onSelect`).

```tsx
<SelectField
  label="Período"
  icon="date_range"
  options={periods.map(p => ({
    value: p.value,
    label: p.value,
    aside: p.inProgress ? 'Em curso' : `CR ${p.cra}`,
  }))}
  value={period}
  onChange={setPeriod}
/>
```

### Seleção

- **`SegmentedControl`**: `options` (`value`, `label`, `icon`), `value`, `onChange`, `accessibilityLabel`. O selecionado ganha "check".
- **`FilterChip`**: `label`, `selected`, `onPress`, `icon`. **`ChipGroup`**: `layout` `scroll` (uma linha, sangra, bordas esmaecidas em 20dp) ou `wrap`; `fadeColor` se o fundo não for `surface`.
- **`Checkbox`**, **`Radio`**, **`Switch`**: só o desenho quando estão dentro de uma `ListRow` com o papel acessível certo; com `onPress`/`onValueChange` viram controles próprios de 48dp (aí `accessibilityLabel` é obrigatório).
- **`Tabs`**: `tabs` (`value`, `label`), `value`, `onChange` ("Informações / Horários").
- **`Stepper`**: trilho do gerador (`steps`, `current` a partir de 1, `onStepPress` para voltar a passos visitados, `fadeColor`). Bordas esmaecidas (14 no início, 24 no fim). Coloque no `ScreenPanel header`.
- **`EdgeFade`**: esmaecimento de borda para outras faixas roláveis na horizontal (`side` `start|end`, `width`, `color`). Vai depois da `ScrollView`, no mesmo contêiner.

### Status

- **`StatusLabel`**: `tone` (`good|warn|bad|neutral|info|accent|morning|afternoon|night`), `label`, `icon` (no lugar do ponto: "check" em "Encerrada", "star" em "Preferencial"), `muted` (legenda). É o "● Bom na P1".
- **`Tag`**: `label`, `tone` (`neutral` padrão), `icon`, `dot`. "Hoje" (`accent`), "Sem meta", "Trava de 140 créditos" (`warn` + `lock`).
- **`GradeCell`**: `value` (0–10 ou nulo → "–"), `tone` (padrão: saúde ≥7/≥5/abaixo), `size` (`md`/`lg`), `decimals`. Rótulo acessível "Nota 8,5, Bom". `formatGrade(8.5)` → "8,5".
- **`ProgressBar`**: `value` 0–1, `tone` (`accent|good|warn|bad`), `thin` (4dp, dentro das células de vagas), `accessibilityLabel` obrigatório.

### Avisos e estados

- **`Notice`**: `text`/`children`, `kind` (`updating|offline|refreshFailed|blocked`, que define tom e ícone; `blocked` sem texto usa `PORTAL_BLOCKED_TEXT`), ou `tone` (`info|neutral|warn|bad|good`) + `icon`/`iconColor`, `spin`, `onRetry` ("Tentar novamente") ou `action` (`label`, `onPress`). Sem margem própria.
- **`UpdatingBar`** / **`LoadingBar`**: barra fina indeterminada (`tone` `accent|onBrand`, `width`, `height`). `LoadingBar tone="onBrand" width={120}` é a do carregamento.
- **`Spinner`**: o `progress_activity` girando (botões e trechos curtos; prefira esqueleto no conteúdo).
- **`Skeleton`** (`width`, `height`, `radius`, `cut`) e **`SkeletonList`** (`count`).
- **`EmptyState`**: `text`, `title`, `icon`, `tone` (`neutral|bad`), `action` (`label`, `onPress`, `icon`).
- **`ErrorState`**: `message`, `title` (só `centered`), `onRetry`, `retryLabel`, `icon`, `variant` (`centered|card`).
- **`BlockedState`**: portal bloqueado sem dados (`onRetry`, `text`). Textos únicos exportados: `PORTAL_BLOCKED_TEXT` ("O Aluno Online está temporariamente bloqueado.", aviso com dados) e `PORTAL_BLOCKED_FULL_TEXT` ("Parece que o Aluno Online está temporariamente bloqueado. Tente novamente mais tarde.", sem dados).

```tsx
<Notice kind="blocked" text="O Aluno Online está temporariamente bloqueado." onRetry={refetch} />
<Notice tone="info" icon="tune" text="Configure os créditos necessários para ver o progresso."
  action={{ label: 'Configurar créditos', onPress: openCredits }} />
<Notice tone="neutral" iconColor={theme.colors.accent} icon="info"
  text="Aplicativo não oficial e de código aberto…" />   {/* "callout" do Sobre */}
<EmptyState icon="search_off" text="Nenhuma disciplina encontrada com os filtros selecionados."
  action={{ label: 'Limpar filtros', icon: 'filter_alt_off', onPress: clear }} />
<ErrorState message={copy.listError} onRetry={refetch} />
```

### Sobreposições

**`BottomSheet`**: `visible`, `onClose` (X, véu, voltar do Android, arrastar), `title`, `meta`, `footer` (cada filho com a mesma largura), `scrollable`, `swipeToClose`, `closeLabel`, `onClosed`, `bodyStyle`. O corpo tem 20 nas laterais: dentro dele, `List` também sangra até as bordas.

- Motor: `Modal` do React Native (transparente, sem animação nativa), com a entrada, a saída e o arrasto animados no próprio componente (`Animated` com driver nativo). O `Modal` fica montado até a folha terminar de descer; `onClosed` vem depois disso. Com "Remover animações" ligado, a folha aparece e some sem deslizar.
- Ponta a ponta como o app: o véu cobre as barras de status e de navegação, e o rodapé (ou o fim do corpo) fica acima da área segura inferior.
- Teclado: a folha sobe junto com ele (`KeyboardAvoidingView` do `react-native-keyboard-controller`) e encolhe se faltar altura; o rodapé continua visível.
- Arrasto: a folha acompanha o dedo e fecha se for solta longe (100) ou rápido; senão volta. Vale onde nenhum filho rola ou é tocado (alça, título, rodapé, corpo curto). `swipeToClose={false}` enquanto uma ação não pode ser interrompida.
- Acessibilidade: `accessibilityViewIsModal`, o foco vai para o título ao abrir, o véu é o botão "Fechar folha" e o gesto de escape do VoiceOver fecha.
- Avisos do `snackbar` com a folha aberta aparecem por cima dela (ela tem o próprio `SnackbarHost`).
- Não importe `react-native-modal` nem monte `Modal` à mão para folhas.

```tsx
<BottomSheet
  visible={open}
  onClose={close}
  title="Configurar créditos exigidos"
  footer={[
    <Button
      key="r"
      variant="outline"
      icon="restart_alt"
      label="Resetar"
      onPress={reset}
    />,
    <Button key="s" label="Salvar" onPress={save} />,
  ]}
>
  …
</BottomSheet>
```

**Snackbar**: dispare com a fachada `snackbar`, nunca com `Toast` direto (o `react-native-toast-message` é só o motor e fica dentro de `Snackbar/`):

```tsx
import { snackbar } from '@components/ui';

snackbar.success(
  'Copiado com sucesso!',
  'O texto foi copiado para a área de transferência.',
);
snackbar.error(errorMessage(error));
snackbar.info('Título', 'Detalhe opcional');
snackbar.show({ kind: 'error', title, detail });
snackbar.hide();
```

O título é 14/20 semibold e o detalhe 13/18; o aviso fica 10 s na tela e some ao toque. Quem desenha é o `SnackbarHost`: um no `App.tsx` e um dentro de cada `BottomSheet` aberta (a folha é outra janela, então o host da raiz ficaria atrás dela). Só o host montado por último desenha, e um aviso na tela acompanha a troca: entra na folha que abre e volta para a raiz quando ela fecha. O aviso fica acima da área segura inferior e sobe junto com o teclado. Leitores de tela: no Android a live region do `Snackbar` lê o aviso; no iOS a fachada o anuncia ao VoiceOver.

### Agenda

- **`WeekDaySelector`**: `days` (`WeekDayItem[]`: `key`, `short`, `date`, `hasEvents`, `isToday`, `accessibilityLabel`), `selected`, `onSelect`. Hoje em acento; o escolhido preenchido; ponto quando há aulas.
- **`DayTimeline`**: `events` (`key`, `start`/`end` em minutos desde 00:00, `title`, `meta`, `status`, `state` `past|live|upcoming`, `onPress`, `accessibilityLabel`), `now` (`minutes`, `label`), `pxPerMinute` (0,8 = 48dp por hora), `freeGapMinutes` (40), `freeLabel`, `hourLabel`, `emptyText`. Desenha a régua de horas, os intervalos "Livre · 1h50" e a linha de agora. `formatDuration(110)` → "1h50". Para aulas de um tempo só (50 min), o bloco tem 40dp e mostra uma linha: considere `pxPerMinute={1}` se a tela precisar.

```tsx
<WeekDaySelector days={days} selected={day} onSelect={setDay} />
<DayTimeline
  now={isToday ? { minutes: nowMinutes, label: '11:58' } : undefined}
  events={classes.map(c => ({
    key: c.id, start: c.start, end: c.end, title: c.name,
    meta: `${c.from}–${c.to} · ${c.slots} · ${c.room}`,
    state: c.end <= nowMinutes ? 'past' : c.start <= nowMinutes ? 'live' : 'upcoming',
    status: <StatusLabel tone={shiftTone(c.slot)} label={SHIFT_LABEL[shiftTone(c.slot)]} />,
    onPress: () => openClasses(c.id),
  }))}
  emptyText="Sem aulas neste dia."
/>
```

---

## Moldes (`@templates/*`)

**`ScreenPanel`** (`@templates/ScreenPanel`): o painel de cada tela.
Props: `scroll` (padrão; `false` para usar sua própria `FlatList` com
`contentContainerStyle={usePanelContentStyle()}`), `refreshing` + `onRefresh`
(puxar para atualizar), `header` + `headerStyle` (topo fixo com fio inferior e 18
no topo; o trilho do gerador já tem padding lateral; o cabeçalho da conversa usa
`headerStyle={{ paddingTop: 22, paddingHorizontal: 20, paddingBottom: 12 }}`),
`footer` (rodapé fixo com fio, filhos de mesma largura), `updating` (barra fina
no topo), `padded`, `contentContainerStyle`, `scrollRef`, `scrollProps`.
O painel encolhe com o teclado (a janela de ponta a ponta não encolhe): o
rodapé fixo e o fim da rolagem ficam acima dele, sem `KeyboardAvoidingView` na
tela. O teclado aberto por uma folha fica com a folha.

```tsx
<ScreenPanel refreshing={isRefetching} onRefresh={refetch}>
  <QueryNotice {...} />
  <Text variant="titleXL" accessibilityRole="header">Olá, {firstName}</Text>
  <Section title="Próxima aula">…</Section>
</ScreenPanel>

<ScreenPanel
  header={<Stepper steps={STEPS} current={step} onStepPress={goTo} />}
  footer={[
    <Button key="p" variant="outline" icon="arrow_back" label="Anterior" disabled={step === 1} onPress={prev} />,
    <Button key="n" label="Próximo" icon="arrow_forward" iconPosition="end" onPress={next} />,
  ]}
>
  <Text variant="titleM" accessibilityRole="header">Quais são suas prioridades?</Text>
  …
</ScreenPanel>
```

**`Header`** (`@templates/Header`): azul, menu (ou voltar), título centralizado e
logo AO que leva a Sobre; controla a `StatusBar`. Para mostrar a seta de voltar
numa tela (detalhe da disciplina, conversa do mural):

```tsx
import { useHeaderBack } from '@templates/Header';

useHeaderBack(selectedSubject ? () => setSelectedSubject(null) : null);
// o botão voltar do Android continua com useBackHandler
```

**`CustomDrawerNavigator`**: menu azul com avatar de iniciais, nome e matrícula
(o app não tem o curso), grupos Acadêmico e Ferramentas com ícones, Sobre,
destaque que desliza até o item ativo (ícone preenchido), Sair e versão no
rodapé. Largura 300 (definida em `routes.tsx`). Rotas novas sem ícone entram em
Ferramentas; para dar ícone/grupo, edite `NAV` no componente.

**`QueryNotice`** (`src/modules/academics/presentation`): já usa `Notice`
(sem conexão / falha ao atualizar / bloqueado, com "Tentar novamente") e a
`UpdatingBar`. Coloque no topo do conteúdo do `ScreenPanel`.

---

## Importação e nomes

- Telas e features importam do barril: `import { Text, Button } from '@components/ui'`. Moldes vêm de `@templates/ScreenPanel` e `@templates/Header`.
- O caminho de uma pasta (`@components/ui/Notice`, o `index.ts` dela) também é público. Não importe arquivos de dentro da pasta (`@components/ui/Feedback/LoadingBar`). A exceção é um `.ts` puro testado no projeto `unit` do Jest, que roda em Node sem o preset do React Native: ele importa direto o módulo sem componentes de que precisa (`@components/ui/tones`, `@components/ui/Feedback/blockedText`), porque o barril e o `index.ts` das pastas puxariam as primitivas e o React Native.
- Só exports nomeados, no app inteiro (primitivas, moldes, features, telas, parsers): `import { ScreenPanel } from '@templates/ScreenPanel'`, nunca `export default`. Cada pasta exporta componentes e tipos pelo nome (`Button`, `ButtonProps`); um nome por primitiva, sem sinônimos. A única exceção é o spec do codegen (`src/specs`), que segue o modelo da documentação do React Native (`export default TurboModuleRegistry.get<Spec>(…)`).
- O Knip (`pnpm knip`, também no CI) acusa arquivo, export e tipo sem uso. Aqui, os tipos exportados (`ButtonProps`, `NoticeKind`, `TabItem`…) são API pública e ficam fora dessa checagem (`knip.jsonc`); componentes e funções sem uso continuam sendo acusados. Fora do design system, exporte só o que outro arquivo importa.
- Os componentes antigos (`@atoms/*`, `@molecules/*`) e as chaves `COLORS`/`FONTS`/`FONT_SIZE` do tema foram removidos. Folhas usam `BottomSheet`, avisos usam `snackbar` (não importe `react-native-toast-message` fora de `Snackbar/`) e ícones só o `Icon` (os pacotes `@react-native-vector-icons/*` não são mais importados).

## Testes

- `react-native-svg` renderiza no Jest (preset `react-native`) sem mock.
- Os testes usam a Testing Library (`@testing-library/react-native`) com `renderWithProviders` de `@root/test-utils/render` (tema claro, ou `{ theme: 'dark' }`, e, se passar, `QueryClientProvider`).
- Folhas: o `Modal` do preset do Jest só renderiza com `visible`, então o conteúdo de uma folha fechada não está na árvore. Abra a folha no teste como o aluno faria (toque no gatilho) antes de procurar o conteúdo, e espere a saída com `waitFor(() => expect(…).not.toBeOnTheScreen())`: a animação de saída termina num timer.
- Avisos: espie a fachada (`jest.spyOn(snackbar, 'error')`) e confira título e detalhe. Para ver o aviso desenhado, renderize um `<SnackbarHost />` junto da tela. Não simule `react-native-toast-message`.
- Teclado: o `react-native-keyboard-controller` usa o mock oficial da lib (`jest/setup-keyboard-controller.js`): `KeyboardProvider` vira um host simples, `KeyboardAvoidingView` e `KeyboardStickyView` viram `View`, e `KeyboardAwareScrollView` vira `ScrollView`. O mock de Reanimated (`jest/setup-reanimated.js`) mantém shared values entre renders e lê estilos/props animados a partir dos valores atuais. Gesture Handler (`jest/setup-gesture-handler.js`) expõe os callbacks aos testes de pan/pinça; esses testes verificam movimentos sem renders React e reenquadramentos controlados do cache, sem representar uma medição de FPS nativo.
- Telas que usam `ScreenPanel`, `BottomSheet`, `SnackbarHost` ou `usePanelContentStyle` precisam de `SafeAreaProvider` ou de `jest.mock('react-native-safe-area-context', …)` com `useSafeAreaInsets`.
- Busque pelo que o usuário percebe: papel e nome acessível (`getByRole('button', { name })`), rótulo e texto, nessa ordem; `testID` só para o que não tem nada acessível. Não busque por estilo nem por componente.
- `src/components/ui/__tests__/primitives.test.tsx` renderiza todas as primitivas: um CSS inválido no styled-components só quebra na renderização, então acrescente ali o que criar.
