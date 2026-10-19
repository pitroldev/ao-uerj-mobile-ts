import React, { useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import {
  act,
  fireEvent,
  screen,
  userEvent,
  waitFor,
  within,
} from '@testing-library/react-native';

import { LIGHT } from '@root/themes';
import { renderWithProviders } from '@root/test-utils/render';
import {
  BottomSheet,
  Button,
  SnackbarHost,
  Text,
  snackbar,
  type BottomSheetProps,
} from '../index';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 16, left: 0, right: 0 }),
}));

const TITLE = 'Configurar créditos exigidos';

type HarnessProps = Partial<BottomSheetProps> & {
  /** Abre a folha já na montagem. */
  open?: boolean;
};

/** Tela com um botão que abre a folha; fechar devolve o estado ao pai. */
function Harness({ open = false, ...props }: HarnessProps) {
  const [visible, setVisible] = useState(open);
  return (
    <>
      <Button label="Abrir" onPress={() => setVisible(true)} />
      <BottomSheet
        visible={visible}
        onClose={() => setVisible(false)}
        title={TITLE}
        testID="sheet"
        footer={<Button label="Salvar" />}
        {...props}
      >
        <Text>Corpo da folha</Text>
      </BottomSheet>
    </>
  );
}

const title = () => screen.queryByRole('header', { name: TITLE });
/** A folha é um `Modal`: só fica na árvore enquanto aberta ou descendo. */
const sheetModal = () =>
  screen.container
    .queryAll(node => node.type === 'Modal')
    .find(modal => within(modal).queryByRole('header', { name: TITLE })) ??
  null;
/** Deixa o tempo correr (timers reais), por exemplo até uma animação acabar. */
const wait = (ms: number) =>
  act(() => new Promise<void>(resolve => setTimeout(resolve, ms)));
const touch = (pageY: number, timestamp: number, pageX = 100) => ({
  nativeEvent: { pageX, pageY, timestamp },
});

/**
 * Arrasta a folha de `fromY` até `toY` em `ms`, em passos iguais (a
 * velocidade no fim é a média). Devolve se a folha tomou o gesto.
 */
async function drag(fromY: number, toY: number, ms: number, dx = 0) {
  const sheet = screen.getByTestId('sheet');
  await fireEvent(sheet, 'touchStart', touch(fromY, 0));
  const claimed = await fireEvent(
    sheet,
    'moveShouldSetResponder',
    touch(fromY + 10, 1, 100 + dx),
  );
  if (!claimed) return false;
  await fireEvent(sheet, 'responderGrant', touch(fromY + 10, 1));
  for (let step = 1; step <= 4; step++) {
    await fireEvent(
      sheet,
      'responderMove',
      touch(fromY + ((toY - fromY) * step) / 4, (ms * step) / 4),
    );
  }
  await fireEvent(sheet, 'responderRelease', touch(toY, ms));
  return true;
}

/**
 * Arrasto que começa onde nenhum filho responde (alça, título): o conteúdo da
 * folha toma o toque no início, senão ele ficaria com o `Modal` e a folha
 * nunca veria o arrasto. Devolve se a folha tomou o gesto.
 */
async function dragFromTitle(fromY: number, toY: number, ms: number) {
  const claimed = await fireEvent(
    screen.getByRole('header', { name: TITLE }),
    'startShouldSetResponder',
    touch(fromY, 0),
  );
  return Boolean(claimed) && drag(fromY, toY, ms);
}

describe('BottomSheet', () => {
  it('opens on top of the screen and closes from the X, the scrim and the back button', async () => {
    const onClosed = jest.fn();
    const user = userEvent.setup();
    await renderWithProviders(<Harness onClosed={onClosed} />);
    expect(title()).not.toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Abrir' }));
    expect(title()).toBeOnTheScreen();
    expect(screen.getByText('Corpo da folha')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Fechar' }));
    // a folha desce antes de o Modal sair da árvore
    await waitFor(() => expect(title()).not.toBeOnTheScreen());
    expect(onClosed).toHaveBeenCalledTimes(1);

    await user.press(screen.getByRole('button', { name: 'Abrir' }));
    await user.press(screen.getByRole('button', { name: 'Fechar folha' }));
    await waitFor(() => expect(title()).not.toBeOnTheScreen());

    await user.press(screen.getByRole('button', { name: 'Abrir' }));
    // voltar do Android
    await fireEvent(sheetModal()!, 'requestClose');
    await waitFor(() => expect(title()).not.toBeOnTheScreen());
    expect(onClosed).toHaveBeenCalledTimes(3);
  });

  it('keeps the sheet when it is reopened while going down', async () => {
    const onClosed = jest.fn();
    await renderWithProviders(<Harness open onClosed={onClosed} />);
    // os dois toques antes de a animação de saída terminar
    await fireEvent.press(screen.getByRole('button', { name: 'Fechar' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Abrir' }));
    await wait(300);
    expect(title()).toBeOnTheScreen();
    // a saída interrompida não conta como fechamento
    expect(onClosed).not.toHaveBeenCalled();
  });

  it('closes when dragged down far or fast, and settles back otherwise', async () => {
    const onClosed = jest.fn();
    // a folha anima pelo driver nativo: no Jest o estilo não acompanha o
    // deslocamento, então o teste confere as animações que ela pede
    const timing = jest.spyOn(Animated, 'timing');
    await renderWithProviders(<Harness open onClosed={onClosed} />);
    // a entrada leva o deslocamento da folha a 0
    expect(timing).toHaveBeenCalledTimes(1);
    const [offset, opening] = timing.mock.calls[0];
    expect(opening).toMatchObject({ toValue: 0, duration: LIGHT.motion.slow });
    timing.mockClear();

    // curto e devagar: não fecha, e a folha volta para o lugar
    expect(await drag(400, 450, 600)).toBe(true);
    expect(timing).toHaveBeenCalledTimes(1);
    expect(timing.mock.calls[0][0]).toBe(offset);
    expect(timing.mock.calls[0][1]).toMatchObject({
      toValue: 0,
      duration: LIGHT.motion.base,
    });
    expect(title()).toBeOnTheScreen();
    // gesto lateral não é da folha
    expect(await drag(400, 420, 200, 60)).toBe(false);
    // longe
    expect(await drag(400, 560, 400)).toBe(true);
    await waitFor(() => expect(title()).not.toBeOnTheScreen());
    expect(onClosed).toHaveBeenCalledTimes(1);
    timing.mockRestore();
  });

  it('closes on a quick flick even when the distance is short', async () => {
    await renderWithProviders(<Harness open />);
    expect(await drag(400, 460, 40)).toBe(true);
    await waitFor(() => expect(title()).not.toBeOnTheScreen());
  });

  it('takes a drag that starts on the title', async () => {
    await renderWithProviders(<Harness open />);
    expect(await dragFromTitle(400, 560, 400)).toBe(true);
    await waitFor(() => expect(title()).not.toBeOnTheScreen());
  });

  it('takes the touch inside the scrolling body, never around it', async () => {
    await renderWithProviders(<Harness open />);
    const body = screen.getByText('Corpo da folha');
    // no Android, a view que tem o toque intercepta os filhos: um ancestral da
    // rolagem com o toque faria o corpo só rolar começando num botão
    const claimers: { insideScroll: boolean }[] = [];
    let insideScroll = true;
    for (let node = body.parent; node; node = node.parent) {
      if (node.type === 'RCTScrollView') insideScroll = false;
      if (node.props.onStartShouldSetResponder) claimers.push({ insideScroll });
    }
    expect(claimers).toEqual([{ insideScroll: true }]);
    expect(
      await fireEvent(body, 'startShouldSetResponder', touch(400, 0)),
    ).toBe(true);
  });

  it('does not take the drag when swipe to close is off', async () => {
    await renderWithProviders(<Harness open swipeToClose={false} />);
    expect(await drag(400, 600, 300)).toBe(false);
    expect(await dragFromTitle(400, 600, 300)).toBe(false);
    expect(title()).toBeOnTheScreen();
  });

  it('is modal for screen readers, labels the scrim and focuses the title', async () => {
    await renderWithProviders(<Harness open />);
    expect(screen.getByTestId('sheet')).toHaveProp(
      'accessibilityViewIsModal',
      true,
    );
    expect(
      screen.getByRole('button', { name: 'Fechar folha' }),
    ).toBeOnTheScreen();
    await fireEvent(sheetModal()!, 'show');
    // o foco vai para o título, e não para o X ou o véu
    expect(AccessibilityInfo.sendAccessibilityEvent).toHaveBeenCalledTimes(1);
    expect(AccessibilityInfo.sendAccessibilityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        props: expect.objectContaining({
          accessibilityRole: 'header',
          children: TITLE,
        }),
      }),
      'focus',
    );
    // gesto de escape do VoiceOver (dois dedos em Z)
    await fireEvent(screen.getByTestId('sheet'), 'accessibilityEscape');
    await waitFor(() => expect(title()).not.toBeOnTheScreen());
  });

  it('skips the slide when the system asks for less motion', async () => {
    const reduceMotion = jest.mocked(AccessibilityInfo.isReduceMotionEnabled);
    reduceMotion.mockResolvedValue(true);
    const timing = jest.spyOn(Animated, 'timing');
    const user = userEvent.setup();
    await renderWithProviders(<Harness />);
    await user.press(screen.getByRole('button', { name: 'Abrir' }));
    await user.press(screen.getByRole('button', { name: 'Fechar' }));
    await waitFor(() => expect(title()).not.toBeOnTheScreen());
    // saída direto para fora da tela, sem a duração do tema
    expect(timing).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        toValue: Dimensions.get('window').height,
        duration: 0,
      }),
    );
    expect(timing).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ duration: LIGHT.motion.slow }),
    );
    timing.mockRestore();
    reduceMotion.mockResolvedValue(false);
  });
});

describe('snackbar', () => {
  const originalOS = Platform.OS;
  afterEach(() => {
    Object.defineProperty(Platform, 'OS', {
      value: originalOS,
      configurable: true,
    });
  });

  it('shows the message in the host and reads it out on iOS', async () => {
    await renderWithProviders(<SnackbarHost />);
    await act(() =>
      snackbar.success('Créditos salvos', 'O progresso foi recalculado.'),
    );
    expect(
      screen.getByLabelText('Créditos salvos. O progresso foi recalculado.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Créditos salvos')).toBeOnTheScreen();
    expect(
      AccessibilityInfo.announceForAccessibilityWithOptions,
    ).toHaveBeenCalledWith('Créditos salvos. O progresso foi recalculado.', {
      queue: true,
    });
  });

  it('leaves Android to the live region of the snackbar', async () => {
    Object.defineProperty(Platform, 'OS', {
      value: 'android',
      configurable: true,
    });
    await renderWithProviders(<SnackbarHost />);
    await act(() => snackbar.error('Não foi possível abrir este link.'));
    expect(
      screen.getByRole('alert', { name: 'Não foi possível abrir este link.' }),
    ).toHaveProp('accessibilityLiveRegion', 'polite');
    expect(
      AccessibilityInfo.announceForAccessibilityWithOptions,
    ).not.toHaveBeenCalled();
  });

  it('shows messages above an open sheet and keeps them when it closes', async () => {
    const user = userEvent.setup();
    // o host da raiz monta antes da folha, como no App
    await renderWithProviders(
      <>
        <SnackbarHost />
        <Harness open />
      </>,
    );
    // com a folha aberta, o aviso vai para o host dentro do Modal dela
    await act(() => snackbar.error('Confira os dados informados.'));
    expect(
      within(sheetModal()!).getByText('Confira os dados informados.'),
    ).toBeOnTheScreen();

    // fechar e avisar no mesmo toque: o aviso passa para o host da raiz
    await act(() => snackbar.success('Créditos salvos'));
    await user.press(screen.getByRole('button', { name: 'Fechar' }));
    await waitFor(() => expect(title()).not.toBeOnTheScreen());
    expect(screen.getByText('Créditos salvos')).toBeOnTheScreen();
  });

  it('moves a message on screen into a sheet that opens and keeps the sheet on top', async () => {
    const user = userEvent.setup();
    await renderWithProviders(
      <>
        <SnackbarHost />
        <Harness />
      </>,
    );
    await act(() => snackbar.info('Mensagens atualizadas'));
    await user.press(screen.getByRole('button', { name: 'Abrir' }));
    // o aviso da raiz ficaria atrás do véu: passa para a folha
    expect(
      within(sheetModal()!).getByText('Mensagens atualizadas'),
    ).toBeOnTheScreen();
    // o aviso some sozinho e o próximo continua indo para a folha
    await act(() => snackbar.hide());
    await act(() => snackbar.error('Confira os dados informados.'));
    expect(
      within(sheetModal()!).getByText('Confira os dados informados.'),
    ).toBeOnTheScreen();
  });
});
