# Design system "Agenda limpa" (V3), tema claro

Base visual do AO UERJ para todas as telas. Referência: o protótipo
`v3-agenda.html` (tema claro), com fios finos de 1px, listas em vez de cards,
tabelas compactas, o azul UERJ atrás de tudo, o painel claro com o canto superior
esquerdo de 48 e o canto superior direito reto em cards, campos e chips.

```tsx
import { Text, Section, List, ListRow, Button, Notice } from '@components/ui';
import ScreenPanel from '@templates/ScreenPanel';
import { useHeaderBack } from '@templates/Header';
```

Regras que valem para tudo:

- **Alvos de toque de 48dp.** Todas as primitivas já garantem isso (chips de 36 usam `hitSlop`).
- **Status nunca só por cor.** Ponto + rótulo (`StatusLabel`), ícone + texto (`Notice`), célula de nota com rótulo acessível (`GradeCell`).
- **Fonte do sistema respeitada.** Não desligue `allowFontScaling`. Use `minHeight`, não `height`, em caixas com texto.
- **Peso pela família, nunca `fontWeight`.** No Android, `fontWeight` com fonte própria gera um negrito falso. Use `<Text weight="semibold">` ou `theme.fonts.semibold`.
- **Algarismos tabulares só em números alinhados** (`<Text tabular>`): horários, notas, contagens em colunas. Nunca em códigos ou prosa; no Inter, o tnum também alarga o hífen.
- **Movimento de 150 a 250ms, só para estado.** As primitivas animadas respeitam "remover animações" (`useReducedMotion`).
- **styled-components com o tema.** Use `theme.colors.*`, `theme.status.*` etc. O lint proíbe estilos inline com valores literais (`react-native/no-inline-styles`): use styled components, `StyleSheet.create` ou valores do tema.
- **Nada de cor, fonte ou tamanho de texto literal fora de `src/themes`.** Cores vêm de `theme.colors`/`status`/`shift`, fontes do `Text` (ou `theme.fonts`/`typeStyle`) e tamanhos de ícone de `theme.sizes.icon`. A exceção é a imagem exportada da grade (`scheduleSvg.ts`): recebe as cores do tema, mas mantém a fonte própria.

---

## Tokens (`src/themes`)

O tema é `LIGHT` (`@root/themes`), entregue pelo `ThemeProvider` e tipado como
`DefaultTheme`. Os nomes são semânticos para que o tema escuro entre depois só
com outra paleta.

### Cores: `theme.colors`

| Token | Valor | Uso |
|---|---|---|
| `brand` | `#003468` | Barra de status, cabeçalho, menu lateral, fundo atrás do painel |
| `brandHighlight` | `#004891` | Destaque do item ativo no menu, avatar no menu |
| `onBrand` / `onBrandMuted` | `#FFF` / `rgba(255,255,255,.76)` | Texto e ícones sobre o azul |
| `brandRule` | `rgba(255,255,255,.14)` | Fios sobre o azul |
| `onBrandPressed` | `rgba(255,255,255,.16)` | Toque em botões sobre o azul (menu, voltar, logo) |
| `onBrandTrack` | `rgba(255,255,255,.18)` | Trilho da barra de carregamento sobre o azul |
| `onBrandRing` | `rgba(255,255,255,.2)` | Contorno do avatar no menu |
| `surface` | `#FFFFFF` | Painel, cards, campos |
| `surfaceMuted` | `#F6F7F9` | Linha pressionada, aviso neutro, eventos da agenda, "callout" |
| `surfaceStrong` | `#EDF0F4` | Trilho de progresso, esqueleto, botão desabilitado |
| `sheet` | `#FFFFFF` | Folha inferior |
| `rule` | `#E4E7EC` | Fio padrão (divisores, cards, tabelas) |
| `ruleStrong` | `#D0D5DD` | Fio forte (chips, segmentado, contornos, borda tracejada) |
| `fieldBorder` | `#B8BFCA` | Borda de campo e seletor |
| `ink` | `#101828` | Texto principal |
| `inkMuted` | `#5D6679` | Texto secundário (5,8:1) |
| `inkSubtle` | `#7C8596` | Só decorativo (pontos de agenda, linha média do gráfico): 3,7:1, nunca texto |
| `accent` / `onAccent` | `#004891` / `#FFF` | Acento: **só seleção e ações** |
| `accentPressed` | `#02427F` | Botão primário e enviar do mural pressionados (acento 88% + tinta 12%) |
| `accentSoft` / `accentLine` | `#E8F0FA` / `#BBD0EC` | Selecionado suave (chip, segmento, linha em foco), aviso informativo |
| `selection` | `#CFE0F5` | Seleção de texto |
| `logo` | `#003468` | Logo AO sobre superfície clara |
| `scrim` | `rgba(10,20,40,.44)` | Véu das folhas |
| `pressedOverlay` | `rgba(16,24,40,.10)` | Toque em botões de ícone sobre a superfície |
| `snackbar`, `onSnackbar`, `snackbarSuccess`, `snackbarError` | `#1C2433`… | Snackbar escuro |

### Significados: `theme.status` e `theme.shift`

Cada um tem `{ ink, bg, line }` (texto/ícone, fundo pastel pequeno, fio).

| Tom | ink | bg | line | Uso |
|---|---|---|---|---|
| `status.good` | `#17673A` | `#DDF5E3` | `#A9DDB7` | Aprovado, nota/vaga boa (≥70%) |
| `status.warn` | `#715600` | `#FAF4CC` | `#E5D682` | Atenção (≥50%), falha ao atualizar, trava de créditos |
| `status.bad` | `#A4261E` | `#FCE4E2` | `#F1B5AF` | Reprovado, crítico, erro, bloqueado, horário ocupado |
| `status.neutral` | `#4A5263` | `#EDEFF3` | `#D3D8E0` | Cancelada, isenta, sem dado |
| `status.info` | = acento | `accentSoft` | `accentLine` | "Hoje", "Agora", "Preferencial", aviso informativo |
| `shift.morning` | `#665400` | `#FBF8D6` | `#E6DC98` | Manhã |
| `shift.afternoon` | `#894A0F` | `#FFEEDB` | `#F0CBA4` | Tarde |
| `shift.night` | `#0A5A73` | `#DEF3FA` | `#A6D8E9` | Noite |

Pastéis só em fundos pequenos (célula de nota, tag, bloco da grade). Utilitários
em `@components/ui`: `toneColors(theme, tone)`, `healthTone('GOOD'|'BAD'|'CRITICAL')`
(converte `numberToColor`/`getVacancieHealth`), `shiftTone('T1')`, `HEALTH_LABEL`
("Bom", "Atenção", "Crítico") e `SHIFT_LABEL` ("Manhã", "Tarde", "Noite").

### Tipografia: `theme.typography` e `<Text variant>`

Inter estático: `theme.fonts.regular | medium | semibold | bold` e
`displaySemibold` (corte Display, usado sozinho pelas variantes de 22 ou mais).

| Variante | Tamanho/linha | Peso padrão | Onde |
|---|---|---|---|
| `display` | 26/32 | semibold (Display) | Números de destaque (`StatGroup`) |
| `titleXL` | 24/30 | semibold (Display) | Saudação "Olá, Marina" |
| `titleL` | 22/28 | semibold (Display) | Título de entidade: login, disciplina, Sobre; horário da próxima aula |
| `titleM` | 20/26 | semibold | Título de passo do gerador |
| `titleS` | 18/24 | semibold | Título de folha, nome da turma no mural |
| `headline` | 17/24 | semibold | Título de seção, nome da próxima aula, número do dia |
| `appBar` | 17/24 | medium | Título do cabeçalho azul |
| `body` | 15/21 | regular | Título de linha (com `weight="semibold"`), opções, mensagens, campos |
| `callout` (padrão) | 14/20 | regular | Texto corrido, descrições, rótulos de chip |
| `meta` | 13/18 | regular | Metadados de lista, avisos, contagens |
| `caption` | 12/16 | medium | Cabeçalho de tabela, status, tags, horas da agenda |
| `button` / `buttonSmall` | 15/20, 14/20 | semibold | Rótulos de botão |

Fora do `Text` (por exemplo num `TextInput`) use `typeStyle(theme, 'body')` ou
`typeCss(theme, 'meta')` dentro de um template do styled-components.

### Espaço, raios, medidas e movimento

- `theme.spacing`: `xxs 2 · xs 4 · sm 8 · md 12 · lg 16 · xl 20 · xxl 24 · xxxl 32 · huge 40`.
- `theme.layout`: `gutter 20` (margem lateral), `panelPaddingTop 32`, `panelPaddingBottom 40`, `panelRadius 48`, `sectionGap 30`, `sectionHeaderGap 10`, `sectionHeaderMinHeight 32`, `appBarHeight 52`, `drawerWidth 300`, `sheetMaxHeight 0.86`.
- `theme.radii`: `xs 4 · checkbox 5 · sm 6 (tag, nota) · md 8 (chip) · lg 10 (botão, campo, aviso) · xl 12 (card, grupo, agenda) · xxl 20 (ícone vazio) · sheet 24 · panel 48`. **Canto cortado**: raio nos cantos e `border-top-right-radius: 0` (helpers `cutCorner(r)` e `cutCornerCss(r)`). Botões são a exceção: raio 10 em todos os cantos.
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

| Estado | Como mostrar |
|---|---|
| Carregando (sem dados) | `SkeletonList` (ou esqueleto com `Skeleton` no formato da tela), nunca um indicador girando no meio |
| Atualizando (com dados) | `UpdatingBar` (o `QueryNotice` já faz) ou `ScreenPanel updating` |
| Sem conexão com dados salvos | `Notice kind="offline"` + "Tentar novamente" (o `QueryNotice` já faz) |
| Falha ao atualizar | `Notice kind="refreshFailed"` + "Tentar novamente" |
| Portal bloqueado com dados | `Notice kind="blocked"` + "Tentar novamente" (sem `text`, usa `PORTAL_BLOCKED_TEXT`; o `QueryNotice` já faz) |
| Portal bloqueado sem dados | `BlockedState onRetry={refetch}` (cadeado, `PORTAL_BLOCKED_FULL_TEXT` e "Tentar novamente") |
| Vazio | `EmptyState` com ícone e a frase real (`search_off`, `history_edu`, `forum`, `manage_search`, `event_upcoming`, `event_busy`, `school`) |
| Erro | `ErrorState` (centralizado) ou `ErrorState variant="card"` (Início, acima da ajuda "Caso o erro persista") |

---

## Primitivas (`@components/ui`)

### Texto e marca

**`Text`**: `variant`, `weight` (`regular|medium|semibold|bold`), `tone` (`ink|muted|subtle|accent|onAccent|onBrand|onBrandMuted|good|warn|bad|neutral`), `color` (literal), `tabular`, `align`, mais as props do `Text` do RN.

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

Ícones disponíveis: veja `Icon/glyphs.ts` (133 contornos; preenchidos para os itens do menu e `check_circle`, `error`, `warning`, `cancel`, `lock`, `star`). Para acrescentar, edite as listas `OUTLINED`/`FILLED` em `scripts/generate-icons.cjs` e rode `node scripts/generate-icons.cjs`.

**`AoLogo`**: `width` (36), `color` (`onBrand`; use `theme.colors.logo` sobre o branco), `accessibilityLabel` ("AO UERJ"; `null` se decorativo).

```tsx
<AoLogo width={108} color={theme.colors.logo} />   {/* Sobre */}
<AoLogo width={164} />                              {/* Login e carregamento, sobre o azul */}
```

### Estrutura

**`Divider`**: `inset`, `strong`, `vertical`, `spacing`, `label` + `labelAlign` (`start` = "Grupo 1 ——", `center` = "—— Hoje ——" do mural).

**`Section` / `SectionHeader`**: `title`, `action` (nó à direita, já com margens negativas), `note` + `noteIcon` (texto secundário à direita), `description` (".sec-p"), `first`, `dense`.

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
      {s.minimum_credits ? <Tag tone="warn" icon="lock" label={`Trava de ${s.minimum_credits} créditos`} /> : null}
    </ListRow>
  ))}
</List>

{/* linha selecionável (gerador) */}
<ListRow
  title={c.subject} code={c.subjectId} subtitle={`Turma ${c.classNumber}`}
  leading={<Checkbox checked={on} />} leadingAlign="start"
  accessibilityRole="checkbox" accessibilityState={{ checked: on }}
  onPress={toggle}
/>

{/* interruptor (prioridades) */}
<ListRow
  title={p.label} titleWeight="regular" trailing={<Switch value={on} />}
  accessibilityRole="switch" accessibilityState={{ checked: on }} onPress={toggle}
/>
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

**`Button`**: `label`, `variant` (`primary` preenchido · `outline` contornado · `text` · `link` largura total centralizado), `size` (`md` 15 · `sm` 14 · `xs` 13; todos com 48 de altura), `icon`, `iconPosition`, `loading` + `loadingLabel`, `block`, `selected` (botão alternável, como "Manhã" no gerador), `disabled`. Sem `label` e com `icon` vira o quadrado de 48 (exige `accessibilityLabel`).

```tsx
<Button label="Entrar" block loading={isPending} loadingLabel="Entrando…" onPress={submit} />
<Button variant="outline" icon="arrow_back" label="Anterior" onPress={prev} />
<Button label="Próximo" icon="arrow_forward" iconPosition="end" disabled={!valid} onPress={next} />
<Button variant="link" label="Não possui acesso ou esqueceu a senha?" onPress={recover} />
<Button icon="arrow_forward" accessibilityLabel="Buscar disciplina" onPress={search} />
```

**`IconButton`**: `icon`, `accessibilityLabel` (obrigatório), `variant` (`plain` círculo · `outlined` canto cortado, o − e + · `filled` círculo de acento, o enviar do mural), `color`, `iconSize`, `filledIcon`, `onBrand` (sobre o azul), `selected`, `loading`.

### Campos

**`TextField`**: `label` (acima, 13/18), `leadingIcon`, `clearable` + `clearLabel`/`onClear`, `secureToggle` (mostrar/ocultar senha), `error` (texto ou `true`), `helper`, `trailing`, `multiline` (área de 132), `containerStyle`/`fieldStyle`/`inputStyle`, mais as props do `TextInput` (aceita `ref`).
**`SearchField`**: lupa + limpar + tecla de busca; o `placeholder` vira o rótulo acessível.
**`FieldGroup` + `FieldGroupRow`**: o grupo do login (rótulo na coluna da esquerda, fio entre linhas, borda de foco no grupo). `FieldGroup error` mostra a mensagem do formulário abaixo, anunciada.
**`FieldError`**: a linha de erro de campo isolada.
**`NumberStepper`**: − [campo] + e unidade (`value` string, `onChangeText`, `min`, `max`, `step`, `unit`, `accessibilityLabel`, `invalid`).

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
  label="Período" icon="date_range"
  options={periods.map(p => ({ value: p.value, label: p.value, aside: p.inProgress ? 'Em curso' : `CR ${p.cra}` }))}
  value={period} onChange={setPeriod}
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

**`BottomSheet`**: `visible`, `onClose` (X, véu, voltar do Android, arrastar), `title`, `meta`, `footer` (cada filho com a mesma largura), `scrollable`, `swipeToClose`, `closeLabel`, `onClosed`, `bodyStyle`. O corpo tem 20 nas laterais: dentro dele, `List` também sangra até as bordas. O véu cobre a barra de status; no Android 15+ a folha também passa por baixo da barra de gestos/navegação (o rodapé fica acima dela pelo `insets.bottom`) e sobe sozinha com o teclado (`useKeyboardHeight`), porque nesse modo o sistema não redimensiona a janela.

```tsx
<BottomSheet
  visible={open} onClose={close} title="Configurar créditos exigidos"
  footer={[
    <Button key="r" variant="outline" icon="restart_alt" label="Resetar" onPress={reset} />,
    <Button key="s" label="Salvar" onPress={save} />,
  ]}
>
  …
</BottomSheet>
```

**Snackbar**: o `<Toast config={toastConfig} />` já está no `App.tsx`. Continue usando `Toast.show({ type: 'success' | 'error' | 'info', text1, text2 })`: `text1` é o título (14/20 semibold), `text2` o detalhe. Ex.: `Toast.show({ type: 'success', text1: 'Copiado com sucesso!', text2: 'O texto foi copiado para a área de transferência.' })`.

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

**`ScreenPanel`** (`@templates/ScreenPanel`): o painel claro de cada tela.
Props: `scroll` (padrão; `false` para usar sua própria `FlatList` com
`contentContainerStyle={usePanelContentStyle()}`), `refreshing` + `onRefresh`
(puxar para atualizar), `header` + `headerStyle` (topo fixo com fio inferior e 18
no topo; o trilho do gerador já tem padding lateral; o cabeçalho da conversa usa
`headerStyle={{ paddingTop: 22, paddingHorizontal: 20, paddingBottom: 12 }}`),
`footer` (rodapé fixo com fio, filhos de mesma largura), `updating` (barra fina
no topo), `padded`, `contentContainerStyle`, `scrollRef`, `scrollProps`.

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
- O caminho de uma pasta (`@components/ui/Notice`, o `index.ts` dela) também é público. Ele é obrigatório quando um teste simula a primitiva com `jest.mock` (`QueryNotice`) e num `.ts` puro testado no projeto `unit` do Jest, que roda em Node sem o preset do React Native (`@components/ui/tones`). Não importe arquivos de dentro da pasta (`@components/ui/Feedback/LoadingBar`).
- Cada pasta exporta componentes e tipos pelo nome (`Button`, `ButtonProps`); as pastas com um componente principal também exportam `default`. Um nome por primitiva, sem sinônimos.
- Os componentes antigos (`@atoms/*`, `@molecules/*`) e as chaves `COLORS`/`FONTS`/`FONT_SIZE` do tema foram removidos. Folhas usam `BottomSheet` (não importe `react-native-modal` direto) e ícones só o `Icon` (os pacotes `@react-native-vector-icons/*` não são mais importados).

## Testes

- `react-native-svg` renderiza no Jest (preset `react-native`) sem mock.
- Para folhas, faça `jest.mock('react-native-modal', () => 'Modal')`: o conteúdo é renderizado e pode ser inspecionado.
- Telas que usam `ScreenPanel`, `BottomSheet` ou `usePanelContentStyle` precisam de `SafeAreaProvider` ou de `jest.mock('react-native-safe-area-context', …)` com `useSafeAreaInsets`.
- Prefira buscar por `accessibilityLabel`/papel e pelo componente (`findAllByType(ListRow)`) a buscar estilos.
- `src/components/ui/__tests__/primitives.test.tsx` renderiza todas as primitivas: um CSS inválido no styled-components só quebra na renderização, então acrescente ali o que criar.
