import React from 'react';
import {
  fireEvent,
  screen,
  userEvent,
  within,
} from '@testing-library/react-native';

import { LIGHT } from '@root/themes';
import { renderWithProviders } from '@root/test-utils/render';
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
  formatTime,
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
  parseTime,
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
  TimeField,
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

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

it('renders every primitive with the light theme (styles parse at render time)', async () => {
  await renderWithProviders(
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
  expect(screen.getByText('Olá, Marina')).toBeOnTheScreen();
  expect(screen.getByText('Livre · 1h50')).toBeOnTheScreen();
  expect(screen.getAllByText('Tentar novamente')).not.toHaveLength(0);
  // portal bloqueado: um texto só para o aviso e outro para o estado vazio
  expect(screen.getByText(PORTAL_BLOCKED_TEXT)).toBeOnTheScreen();
  expect(screen.getByText(PORTAL_BLOCKED_FULL_TEXT)).toBeOnTheScreen();
  expect(screen.getByText('Algo deu errado')).toBeOnTheScreen();
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
  await renderWithProviders(
    <>
      <GradeCell value={8.5} />
      <GradeCell value={6} />
      <GradeCell value={4.5} />
      <GradeCell value={null} />
    </>,
  );
  expect(screen.getByLabelText('Nota 8,5, Bom')).toBeOnTheScreen();
  expect(screen.getByLabelText('Nota 6,0, Atenção')).toBeOnTheScreen();
  expect(screen.getByLabelText('Nota 4,5, Crítico')).toBeOnTheScreen();
  expect(screen.getByLabelText('sem nota')).toBeOnTheScreen();
});

it('draws the grade still needed as a dashed cell, in both themes', async () => {
  for (const theme of ['light', 'dark'] as const) {
    const { unmount } = await renderWithProviders(
      <GradeCell value={4.2} tone="warn" target />,
      { theme },
    );
    const cell = screen.getByLabelText('Nota necessária 4,2');
    expect(cell).toHaveStyle({ borderStyle: 'dashed', borderWidth: 1.5 });
    expect(within(cell).getByText('4,2')).toBeOnTheScreen();
    await unmount();
  }
});

it('drops the divider of the last row only', async () => {
  // o fio é decorativo (fora da acessibilidade)
  const divider = (row: string) =>
    within(screen.getByTestId(row)).queryByTestId('list-row-divider', {
      includeHiddenElements: true,
    });
  await renderWithProviders(
    <List>
      <ListRow testID="a" title="A" />
      <ListRow testID="b" title="B" />
      <ListRow testID="c" title="C" divider />
    </List>,
  );
  for (const row of ['a', 'b', 'c']) {
    expect(divider(row)).toBeOnTheScreen();
  }
  await screen.rerender(
    <List>
      <ListRow testID="a" title="A" />
      <ListRow testID="b" title="B" />
    </List>,
  );
  expect(divider('a')).toBeOnTheScreen();
  expect(divider('b')).not.toBeOnTheScreen();
});

it('blocks presses while a button is loading and exposes busy', async () => {
  const onPress = jest.fn();
  await renderWithProviders(
    <Button
      label="Entrar"
      loading
      loadingLabel="Entrando…"
      onPress={onPress}
    />,
  );
  const button = screen.getByRole('button', { name: 'Entrando…' });
  expect(button).toBeDisabled();
  expect(button).toBeBusy();
});

it('clears busy explicitly when loading ends (Android keeps a stale busy on undefined)', async () => {
  const onPress = jest.fn();
  const tree = (loading: boolean) => (
    <>
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
    </>
  );
  await renderWithProviders(tree(true));
  expect(screen.getByRole('button', { name: 'Entrando…' })).toBeBusy();
  expect(screen.getByRole('button', { name: 'Enviar mensagem' })).toBeBusy();

  await screen.rerender(tree(false));
  // `false` de fato, não `undefined` (o toBeBusy não distingue os dois)
  const idle = expect.objectContaining({ busy: false, disabled: false });
  const button = screen.getByRole('button', { name: 'Entrar' });
  expect(button).toHaveProp('accessibilityState', idle);
  expect(screen.getByRole('button', { name: 'Enviar mensagem' })).toHaveProp(
    'accessibilityState',
    idle,
  );
  await userEvent.setup().press(button);
  expect(onPress).toHaveBeenCalledTimes(1);
});

it('clears a field and toggles password visibility', async () => {
  const onChangeText = jest.fn();
  const user = userEvent.setup();
  await renderWithProviders(
    <TextField
      label="Código"
      clearable
      clearLabel="Limpar código"
      secureToggle
      value="IME02"
      onChangeText={onChangeText}
    />,
  );
  await user.press(screen.getByRole('button', { name: 'Limpar código' }));
  expect(onChangeText).toHaveBeenCalledWith('');
  await user.press(screen.getByRole('button', { name: 'Mostrar senha' }));
  expect(
    screen.getByRole('button', { name: 'Ocultar senha' }),
  ).toBeOnTheScreen();
});

it('selects the number on focus so typing replaces it', async () => {
  await renderWithProviders(
    <NumberStepper
      value="3"
      onChangeText={() => undefined}
      accessibilityLabel="mínimo de matérias"
    />,
  );
  expect(screen.getByLabelText('mínimo de matérias')).toHaveProp(
    'selectTextOnFocus',
    true,
  );
});

it('reads the times typed in the time field', () => {
  expect(parseTime('14:20')).toBe(860);
  expect(parseTime('1420')).toBe(860);
  expect(parseTime('820')).toBe(500);
  expect(parseTime('8')).toBe(480);
  expect(parseTime('8:5')).toBe(485);
  expect(parseTime('24:00')).toBeNull();
  expect(parseTime('12:60')).toBeNull();
  expect(parseTime('')).toBeNull();
  expect(formatTime(480)).toBe('08:00');
  expect(formatTime(1439)).toBe('23:59');
});

it('commits every time typed, so saving with the field focused keeps it', async () => {
  const onChange = jest.fn();
  await renderWithProviders(
    <TimeField label="Horário" value={480} onChange={onChange} />,
  );
  const field = screen.getByLabelText('Horário');
  expect(field).toHaveDisplayValue('08:00');
  // no aparelho o foco seleciona tudo, e o que se digita substitui
  expect(field).toHaveProp('selectTextOnFocus', true);
  await fireEvent.changeText(field, '9');
  expect(onChange).toHaveBeenLastCalledWith(540);
  await fireEvent.changeText(field, '93');
  expect(onChange).toHaveBeenCalledTimes(1);
  await fireEvent.changeText(field, '930');
  expect(onChange).toHaveBeenLastCalledWith(570);
  expect(field).toHaveDisplayValue('930');
  await fireEvent.changeText(field, '1420');
  expect(onChange).toHaveBeenLastCalledWith(860);
  expect(field).toHaveDisplayValue('14:20');

  onChange.mockClear();
  await fireEvent.changeText(field, '2575');
  expect(onChange).not.toHaveBeenCalled();
  expect(
    screen.getByText('Use um horário entre 00:00 e 23:59.'),
  ).toBeOnTheScreen();

  // ao sair, o campo mostra o horário que valeu (aqui o pai não mudou)
  await fireEvent(field, 'blur');
  expect(field).toHaveDisplayValue('08:00');
  expect(screen.queryByText('Use um horário entre 00:00 e 23:59.')).toBeNull();
});

it('runs notice actions and selection callbacks', async () => {
  const retry = jest.fn();
  const onChange = jest.fn();
  const onSelect = jest.fn();
  const user = userEvent.setup();
  await renderWithProviders(
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
  await user.press(screen.getByRole('button', { name: 'Tentar novamente' }));
  expect(retry).toHaveBeenCalled();
  await user.press(screen.getByRole('tab', { name: 'Atendidas' }));
  expect(onChange).toHaveBeenCalledWith('done');
  expect(screen.getByRole('radio', { name: /^2026\.1/ })).toBeChecked();
  await user.press(screen.getByRole('radio', { name: '2025.2' }));
  expect(onSelect).toHaveBeenCalledWith('2025.2');
});

it('opens the select sheet and reports the chosen option', async () => {
  const onChange = jest.fn();
  const user = userEvent.setup();
  await renderWithProviders(
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
  const field = () =>
    screen.getByRole('button', {
      name: 'Departamento: Todos os departamentos. Trocar',
    });
  expect(within(field()).getByText('Todos os departamentos')).toBeOnTheScreen();
  await user.press(field());
  expect(field()).toBeExpanded();
  await user.press(screen.getByRole('radio', { name: 'IME' }));
  expect(onChange).toHaveBeenCalledWith('IME');
  expect(field()).toBeCollapsed();
});

it('renders toast types through the snackbar config', async () => {
  const hide = jest.fn();
  const Success = toastConfig.success as React.ComponentType<any>;
  await renderWithProviders(
    <Success text1="Relato enviado. Obrigado!" hide={hide} />,
  );
  expect(screen.getByText('Relato enviado. Obrigado!')).toBeOnTheScreen();
  await userEvent
    .setup()
    .press(screen.getByLabelText('Relato enviado. Obrigado!'));
  expect(hide).toHaveBeenCalled();
});
