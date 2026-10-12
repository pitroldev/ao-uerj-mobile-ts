import React from 'react';
import { Text as RNText } from 'react-native';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { ThemeProvider } from 'styled-components/native';

import { LIGHT } from '@root/themes';
import {
  AoLogo,
  Avatar,
  BlockedState,
  BottomSheet,
  Button,
  Card,
  Checkbox,
  ChipGroup,
  DayTimeline,
  Divider,
  EmptyState,
  ErrorState,
  FieldGroup,
  FieldGroupRow,
  FilterChip,
  FootNote,
  GradeCell,
  Icon,
  IconButton,
  IconTile,
  List,
  ListRow,
  LoadingBar,
  Notice,
  NumberStepper,
  OptionList,
  PORTAL_BLOCKED_FULL_TEXT,
  PORTAL_BLOCKED_TEXT,
  ProgressBar,
  PropertyList,
  Radio,
  SearchField,
  Section,
  SegmentedControl,
  SelectField,
  Skeleton,
  SkeletonList,
  Snackbar,
  Spinner,
  StatGroup,
  StatusLabel,
  Stepper,
  Switch,
  Table,
  TableRow,
  Tabs,
  Tag,
  Text,
  TextField,
  UpdatingBar,
  WeekDaySelector,
  formatDuration,
  formatGrade,
  healthTone,
  initials,
  shiftTone,
  toastConfig,
} from '../index';

jest.mock('react-native-modal', () => 'Modal');
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

let renderer: ReactTestRenderer;
const render = async (node: React.ReactElement) => {
  await act(async () => {
    renderer = create(<ThemeProvider theme={LIGHT}>{node}</ThemeProvider>);
  });
  return renderer;
};
const texts = () =>
  renderer.root
    .findAllByType(RNText)
    .map(t =>
      Array.isArray(t.props.children)
        ? t.props.children.join('')
        : String(t.props.children ?? ''),
    );
const byLabel = (label: string) =>
  renderer.root.findAll(
    n => n.props.accessibilityLabel === label && typeof n.type !== 'string',
  )[0];

afterEach(async () => {
  await act(async () => renderer?.unmount());
});

it('renders every primitive with the light theme (styles parse at render time)', async () => {
  await render(
    <>
      <Text variant="titleXL">Olá, Marina</Text>
      <Text variant="meta" tone="muted" tabular>
        12:20
      </Text>
      <Icon name="home" filled />
      <AoLogo color={LIGHT.colors.logo} />
      <Divider />
      <Divider label="Grupo 1" />
      <Divider label="Hoje" labelAlign="center" />
      <Section title="Notas" note="6 turmas" noteIcon="how_to_reg" first>
        <Card padding={0}>
          <PropertyList
            items={[
              { label: 'Código', value: 'IME02-10892' },
              { label: 'Créditos', value: '4', tabular: true },
            ]}
          />
        </Card>
      </Section>
      <Section
        title="Semana"
        action={
          <Button
            variant="text"
            size="sm"
            icon="share"
            label="Compartilhar grade"
          />
        }
      />
      <List>
        <ListRow
          title="Compiladores"
          code="IME02-10871"
          subtitle="Obrigatória"
          meta={['6º período · 4 créditos · 60 horas']}
          facts={<StatusLabel tone="good" label="Atendida" />}
          chevron
          onPress={() => undefined}
        >
          <Tag tone="warn" icon="lock" label="Trava de 140 créditos" />
        </ListRow>
        <ListRow
          title="Reportar problema"
          leading={<IconTile icon="bug_report" />}
          external
        />
      </List>
      <Table
        columns={[
          { key: 'name', label: 'Disciplina' },
          { key: 'p1', label: 'P1', width: 45, align: 'center' },
        ]}
      >
        <TableRow>
          <Text>Sistemas Distribuídos</Text>
          <GradeCell value={8.5} />
        </TableRow>
      </Table>
      <Button label="Entrar" block />
      <Button label="Anterior" variant="outline" icon="arrow_back" />
      <Button label="Não possui acesso ou esqueceu a senha?" variant="link" />
      <Button icon="arrow_forward" accessibilityLabel="Buscar disciplina" />
      <IconButton icon="send" variant="filled" accessibilityLabel="Enviar" />
      <IconButton icon="add" variant="outlined" accessibilityLabel="Aumentar" />
      <TextField label="Código" value="" onChangeText={() => undefined} />
      <TextField multiline value="" error="Obrigatório" />
      <SearchField placeholder="Pesquise pelo nome da disciplina" value="x" />
      <FieldGroup error="Matrícula ou senha incorretas.">
        <FieldGroupRow icon="badge" label="Matrícula" clearable value="" />
        <FieldGroupRow icon="lock" label="Senha" secureToggle value="" />
      </FieldGroup>
      <NumberStepper
        value="3"
        onChangeText={() => undefined}
        unit="matérias"
        accessibilityLabel="mínimo"
      />
      <SelectField
        label="Período"
        valueLabel="2026.1"
        icon="date_range"
        aside="CR atual 7,77"
      />
      <ChipGroup layout="scroll">
        <FilterChip label="Todas" selected />
        <FilterChip label="Obrigatórias" />
      </ChipGroup>
      <Checkbox checked />
      <Radio selected />
      <Switch value />
      <Tabs
        tabs={[
          { value: 'info', label: 'Informações' },
          { value: 'horarios', label: 'Horários' },
        ]}
        value="info"
        onChange={() => undefined}
      />
      <Stepper
        steps={['Qtd. Disciplinas', 'Horários Ocupados', 'Prioridades']}
        current={2}
      />
      <ProgressBar value={0.4} tone="warn" accessibilityLabel="Ocupadas" />
      <Tag label="Hoje" tone="accent" />
      <Notice kind="offline" text="Sem conexão." onRetry={() => undefined} />
      <Notice kind="updating" text="Atualizando dados…" />
      <LoadingBar tone="onBrand" width={120} />
      <UpdatingBar />
      <Spinner />
      <Skeleton width={120} cut />
      <SkeletonList count={2} />
      <EmptyState icon="search_off" text="Nenhuma disciplina encontrada." />
      <ErrorState message="Ops." onRetry={() => undefined} variant="card" />
      <ErrorState title="Algo deu errado" message="Ops." />
      <Notice kind="blocked" onRetry={() => undefined} />
      <BlockedState onRetry={() => undefined} />
      <StatGroup
        items={[
          { value: '54', label: 'Disciplinas concluídas' },
          { value: '7,77', label: 'CR aproximado' },
        ]}
      />
      <FootNote text="O CR é calculado pelo app." />
      <Avatar name="Marina Albuquerque Teixeira" tone="brand" />
      <WeekDaySelector
        days={[
          { key: 1, short: 'Seg', date: 12, hasEvents: true },
          { key: 2, short: 'Ter', date: 13, isToday: true },
        ]}
        selected={2}
        onSelect={() => undefined}
      />
      <DayTimeline
        now={{ minutes: 718, label: '11:58' }}
        events={[
          {
            key: 'a',
            start: 530,
            end: 630,
            title: 'Compiladores',
            state: 'past',
          },
          {
            key: 'b',
            start: 740,
            end: 850,
            title: 'Otimização Combinatória',
            status: <StatusLabel tone="afternoon" label="Tarde" />,
          },
        ]}
      />
      <DayTimeline events={[]} />
      <BottomSheet
        visible
        title="Disciplinas em Curso"
        meta="6 ativas"
        onClose={() => undefined}
        footer={<Button label="Entendi" />}
      >
        <Text>Corpo</Text>
      </BottomSheet>
      <Snackbar
        kind="success"
        title="Copiado com sucesso!"
        detail="O texto foi copiado."
      />
    </>,
  );
  const all = texts();
  expect(all).toEqual(expect.arrayContaining(['Olá, Marina', 'Livre · 1h50']));
  expect(all).toContain('Tentar novamente');
  // portal bloqueado: um texto só para o aviso e outro para o estado vazio
  expect(all).toEqual(
    expect.arrayContaining([
      PORTAL_BLOCKED_TEXT,
      PORTAL_BLOCKED_FULL_TEXT,
      'Algo deu errado',
    ]),
  );
});

it('formats grades, health, shifts, durations and initials', () => {
  expect(formatGrade(8.5)).toBe('8,5');
  expect(healthTone('GOOD')).toBe('good');
  expect(healthTone('BAD')).toBe('warn');
  expect(healthTone('CRITICAL')).toBe('bad');
  expect(healthTone('CANCELED')).toBe('neutral');
  expect(shiftTone('T1')).toBe('afternoon');
  expect(formatDuration(110)).toBe('1h50');
  expect(formatDuration(45)).toBe('45 min');
  expect(initials('Marina Albuquerque Teixeira')).toBe('MT');
  expect(initials('Petro')).toBe('P');
});

it('labels grade cells by health so status is never color only', async () => {
  await render(
    <>
      <GradeCell value={8.5} />
      <GradeCell value={6} />
      <GradeCell value={4.5} />
      <GradeCell value={null} />
    </>,
  );
  expect(byLabel('Nota 8,5, Bom')).toBeTruthy();
  expect(byLabel('Nota 6,0, Atenção')).toBeTruthy();
  expect(byLabel('Nota 4,5, Crítico')).toBeTruthy();
  expect(byLabel('sem nota')).toBeTruthy();
});

it('drops the divider of the last row only', async () => {
  await render(
    <List>
      <ListRow title="A" />
      <ListRow title="B" />
      <ListRow title="C" divider />
    </List>,
  );
  const rows = renderer.root.findAllByType(ListRow);
  expect(rows.map(r => r.props.divider)).toEqual([undefined, undefined, true]);
  await render(
    <List>
      <ListRow title="A" />
      <ListRow title="B" />
    </List>,
  );
  expect(
    renderer.root.findAllByType(ListRow).map(r => r.props.divider),
  ).toEqual([undefined, false]);
});

it('blocks presses while a button is loading and exposes busy', async () => {
  const onPress = jest.fn();
  await render(
    <Button
      label="Entrar"
      loading
      loadingLabel="Entrando…"
      onPress={onPress}
    />,
  );
  const button = byLabel('Entrando…');
  expect(button.props.accessibilityState).toMatchObject({
    disabled: true,
    busy: true,
  });
  expect(button.props.disabled).toBe(true);
});

it('clears busy explicitly when loading ends (Android keeps a stale busy on undefined)', async () => {
  const onPress = jest.fn();
  const tree = (loading: boolean) => (
    <ThemeProvider theme={LIGHT}>
      <Button
        label="Entrar"
        loading={loading}
        loadingLabel="Entrando…"
        onPress={onPress}
      />
      <IconButton
        icon="send"
        variant="filled"
        accessibilityLabel="Enviar mensagem"
        loading={loading}
        onPress={onPress}
      />
    </ThemeProvider>
  );
  // o nó que recebe o estado acessível (o Pressable), não o componente
  const control = (label: string) =>
    renderer.root.findAll(
      n =>
        n.props.accessibilityLabel === label &&
        n.props.accessibilityState != null &&
        typeof n.type !== 'string',
    )[0];
  await act(async () => {
    renderer = create(tree(true));
  });
  expect(control('Entrando…').props.accessibilityState.busy).toBe(true);
  expect(control('Enviar mensagem').props.accessibilityState.busy).toBe(true);

  await act(async () => renderer.update(tree(false)));
  const button = control('Entrar');
  const iconButton = control('Enviar mensagem');
  expect(button.props.accessibilityState.busy).toBe(false);
  expect(button.props.accessibilityState.disabled).toBe(false);
  expect(iconButton.props.accessibilityState.busy).toBe(false);
  expect(iconButton.props.accessibilityState.disabled).toBe(false);
  await act(async () => button.props.onPress());
  expect(onPress).toHaveBeenCalledTimes(1);
});

it('clears a field and toggles password visibility', async () => {
  const onChangeText = jest.fn();
  await render(
    <TextField
      label="Código"
      clearable
      clearLabel="Limpar código"
      secureToggle
      value="IME02"
      onChangeText={onChangeText}
    />,
  );
  await act(async () => byLabel('Limpar código').props.onPress());
  expect(onChangeText).toHaveBeenCalledWith('');
  await act(async () => byLabel('Mostrar senha').props.onPress());
  expect(byLabel('Ocultar senha')).toBeTruthy();
});

it('runs notice actions and selection callbacks', async () => {
  const retry = jest.fn();
  const onChange = jest.fn();
  const onSelect = jest.fn();
  await render(
    <>
      <Notice
        kind="refreshFailed"
        text="Não foi possível atualizar."
        onRetry={retry}
      />
      <SegmentedControl
        options={[
          { value: 'open', label: 'Não atendidas' },
          { value: 'done', label: 'Atendidas' },
        ]}
        value="open"
        onChange={onChange}
      />
      <OptionList
        options={[
          { value: '2026.1', label: '2026.1', aside: 'CR atual 7,77' },
          { value: '2025.2', label: '2025.2' },
        ]}
        value="2026.1"
        onSelect={onSelect}
      />
    </>,
  );
  await act(async () => byLabel('Tentar novamente').props.onPress());
  expect(retry).toHaveBeenCalled();
  await act(async () => byLabel('Atendidas').props.onPress());
  expect(onChange).toHaveBeenCalledWith('done');
  const radios = renderer.root.findAllByType(ListRow);
  expect(radios[0].props.accessibilityState).toMatchObject({ checked: true });
  await act(async () => radios[1].props.onPress());
  expect(onSelect).toHaveBeenCalledWith('2025.2');
});

it('opens the select sheet and reports the chosen option', async () => {
  const onChange = jest.fn();
  await render(
    <SelectField
      label="Departamento"
      value=""
      options={[
        { value: '', label: 'Todos os departamentos' },
        { value: 'IME', label: 'IME' },
      ]}
      onChange={onChange}
    />,
  );
  expect(texts()).toContain('Todos os departamentos');
  const option = renderer.root.findAllByType(ListRow)[1];
  await act(async () => option.props.onPress());
  expect(onChange).toHaveBeenCalledWith('IME');
});

it('renders toast types through the snackbar config', async () => {
  const hide = jest.fn();
  const Success = toastConfig.success as React.ComponentType<any>;
  await render(<Success text1="Relato enviado. Obrigado!" hide={hide} />);
  expect(texts()).toContain('Relato enviado. Obrigado!');
  await act(async () => byLabel('Relato enviado. Obrigado!').props.onPress());
  expect(hide).toHaveBeenCalled();
});
