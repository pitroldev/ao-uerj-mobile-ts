import React from 'react';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '@root/test-utils/render';
import { CampusMap } from '@root/modules/campus-map/application/CampusMap';
import { bundledCampusMap } from '@root/adapters/outbound/campus-map';
import * as geometry from '@root/modules/campus-map/domain/geometry';
import { MapScreen } from '../CampusMap';
import * as floorGeometry from '../floorGeometry';
import { panSession } from './mapGestures';

// O que o mapa deixa de refazer. Cada view do SVG é uma view nativa, e
// qualquer mudança nela rasteriza o desenho inteiro de novo: o que conta é
// não desmontar, não medir duas vezes e não tocar no que não mudou.

const mockService = new CampusMap(bundledCampusMap);
jest.mock('@root/app/providers/AppServicesProvider', () => ({
  useAppServices: () => ({ campusMap: mockService }),
}));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
  useRoute: () => ({ params: {} }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const CAMPUS = 'Campus Maracanã, norte para cima, ruas e entradas';
type Host = {
  type: string;
  props: Record<string, unknown>;
  children: (Host | string)[];
};
const measure = (testID: string, width: number, height: number) =>
  fireEvent(screen.getByTestId(testID), 'layout', {
    nativeEvent: { layout: { width, height } },
  });
/** As views de um tipo dentro do desenho. */
function drawn(root: unknown, type: string) {
  const found: Host[] = [];
  const walk = (node: Host | string) => {
    if (typeof node === 'string') return;
    if (node.type === type) found.push(node);
    node.children.forEach(walk);
  };
  walk(root as Host);
  return found;
}
/** A escala do rodapé ("50 m"): muda com o zoom, volta com o enquadramento. */
const scale = () =>
  screen
    .getByText(/^\d+ m$/)
    .children.filter(child => typeof child === 'string')
    .join('');

afterEach(() => jest.restoreAllMocks());

it('draws the campus once, after its area is measured', async () => {
  const orient = jest.spyOn(geometry, 'orientPoint');
  await renderWithProviders(<MapScreen />);
  // antes da medida, só a moldura (um palpite de tamanho montava e
  // rasterizava o mapa duas vezes)
  expect(screen.queryByLabelText(CAMPUS)).toBeNull();
  expect(screen.getByLabelText('Ampliar mapa')).toBeVisible();
  await measure('campus-map-plot', 412, 540);
  const drawing = screen.getByLabelText(CAMPUS);
  expect(drawing).toBeVisible();
  // a mesma medida de novo não refaz nada
  orient.mockClear();
  await measure('campus-map-plot', 412, 540.2);
  expect(orient).not.toHaveBeenCalled();
  // outra medida atualiza o desenho no lugar
  await measure('campus-map-plot', 412, 470);
  expect(screen.getByLabelText(CAMPUS)).toBe(drawing);
});

it('keeps the drawing mounted and reframes it when a place is selected', async () => {
  await renderWithProviders(<MapScreen />);
  await measure('campus-map-plot', 390, 430);
  const drawing = screen.getByLabelText(CAMPUS);
  const framed = scale();
  // afasta (o ponto continua à vista para o toque)
  await fireEvent.press(screen.getByLabelText('Reduzir mapa'));
  await fireEvent.press(screen.getByLabelText('Reduzir mapa'));
  expect(scale()).not.toBe(framed);

  await fireEvent.press(screen.getByLabelText('No mapa: Ponto UERJ'));
  expect(screen.getByRole('header', { name: 'Ponto UERJ' })).toBeVisible();
  // a mesma view: a seleção não desmonta mais as ~270 views do desenho
  expect(screen.getByLabelText(CAMPUS)).toBe(drawing);
  // e a câmera volta ao campus inteiro, como quando o desenho remontava
  expect(scale()).toBe(framed);

  await fireEvent.press(screen.getByLabelText('Ver campus inteiro'));
  expect(screen.getByLabelText(CAMPUS)).toBe(drawing);
});

it('does not redraw the map to open a sheet', async () => {
  await renderWithProviders(<MapScreen initialPlace="onibus-2035o00015c0" />);
  await measure('campus-map-plot', 412, 470);
  const orient = jest.spyOn(geometry, 'orientPoint');
  await fireEvent.press(
    screen.getByRole('button', { name: 'Linhas e destinos' }),
  );
  expect(screen.getByLabelText('Linha 363, para Vila Valqueire')).toBeVisible();
  expect(orient).not.toHaveBeenCalled();
});

it('does not redraw the floor plan to open the directions', async () => {
  await renderWithProviders(<MapScreen initialLocation="5116 F" />);
  await measure('campus-map-plot', 412, 470);
  await fireEvent.press(screen.getByRole('tab', { name: 'Andar' }));
  await measure('floor-plan-plot', 412, 500);
  const path = jest.spyOn(floorGeometry, 'floorPath');
  await fireEvent.press(screen.getByRole('button', { name: 'Como chegar' }));
  expect(screen.getByLabelText('Passo 3')).toBeVisible();
  // a planta do F refazia 1.012 caminhos em JavaScript a cada folha aberta
  expect(path).not.toHaveBeenCalled();
});

it('moves the campus by one transform, leaving the geometry as it is', async () => {
  await renderWithProviders(<MapScreen />);
  await measure('campus-map-plot', 412, 540);
  const world = () =>
    drawn(screen.getByLabelText(CAMPUS), 'RNSVGGroup').find(
      group => group.props.matrix && drawn(group, 'RNSVGPath').length > 50,
    )!;
  const before = world();
  const paths = drawn(before, 'RNSVGPath').map(path => path.props);
  const matrix = before.props.matrix;

  await act(() => {
    const pan = panSession(
      screen.getByTestId('mock-gesture-detector').props.gesture,
    );
    pan.start();
    for (let frame = 0; frame < 20; frame += 1)
      pan.move({ changeX: 3, changeY: 2, numberOfPointers: 1 });
    pan.finish();
  });
  const after = world();
  expect(after).toBe(before);
  expect(after.props.matrix).not.toEqual(matrix);
  // ruas, terreno e prédios: nem as props mudam (as mesmas, por identidade)
  const moved = drawn(after, 'RNSVGPath').map(path => path.props);
  expect(moved).toHaveLength(paths.length);
  moved.forEach((props, index) => expect(props).toBe(paths[index]));
});
