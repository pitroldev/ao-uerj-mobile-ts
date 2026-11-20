import React from 'react';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { bundledCampusMap } from '@root/adapters/outbound/campus-map';
import { CampusMap } from '@root/modules/campus-map/application/CampusMap';
import type {
  Block,
  Floor,
  RoomLocation,
} from '@root/modules/campus-map/domain/types';
import { renderWithProviders } from '@root/test-utils/render';
import { FloorPlanCanvas } from '../FloorPlanCanvas';
import * as geometry from '../floorGeometry';
import { gestureCallbacks, panSession } from './mapGestures';

const map = new CampusMap(bundledCampusMap);
const room = (code: string, block: Block, floor: Floor): RoomLocation => ({
  kind: 'room',
  building: 'pjlf',
  code,
  block,
  floor,
});
/** O que o `onLayout` entrega no aparelho; nos testes ninguém mede sozinho. */
const measure = (width = 360, height = 380) =>
  fireEvent(screen.getByTestId('floor-plan-plot'), 'layout', {
    nativeEvent: { layout: { width, height } },
  });
type Host = {
  type: string;
  props: { content?: string };
  children: (Host | string)[];
};
/** As views do desenho de um tipo (o texto do SVG não é um `Text` nativo). */
const drawn = (type: string) => {
  const found: Host[] = [];
  const walk = (node: Host | string) => {
    if (typeof node === 'string') return;
    if (node.type === type) found.push(node);
    node.children.forEach(walk);
  };
  walk(screen.getByTestId('floor-plan-plot'));
  return found;
};
const labels = () => drawn('RNSVGTSpan').map(node => node.props.content);

it('keeps floor geometry cached during pan and pinch while preserving the destination', async () => {
  const destination = room('6019', 'B', '6');
  const path = jest.spyOn(geometry, 'floorPath');
  try {
    await renderWithProviders(
      <FloorPlanCanvas
        atlas={map.atlas}
        block="B"
        floor="6"
        destination={destination}
        orientation={map.orientation(destination)}
      />,
    );
    // sem a medida da área não há o que enquadrar: só a moldura
    expect(path).not.toHaveBeenCalled();
    await measure();
    const paths = path.mock.calls.length;
    expect(paths).toBeGreaterThan(0);
    const gesture = screen.getByTestId('mock-gesture-detector').props.gesture;
    const pan = panSession(gesture);
    const pinch = gestureCallbacks(gesture, 'Pinch');
    await act(() => {
      pan.start();
      for (let frame = 0; frame < 30; frame += 1) {
        pan.move({ changeX: 1, changeY: 0.5, numberOfPointers: 1 });
      }
      pinch.onStart({ focalX: 180, focalY: 190 });
      pan.finish();
      for (let frame = 0; frame < 30; frame += 1) {
        pinch.onChange({ scaleChange: 1.01, focalX: 180, focalY: 190 });
      }
    });
    expect(path).toHaveBeenCalledTimes(paths);
    await act(() => pinch.onFinalize());
    expect(path.mock.calls.length).toBeGreaterThan(paths);
    expect(
      screen.getByLabelText(
        'Planta do Bloco B, 6º andar, caminho até a sala 6019',
      ),
    ).toBeVisible();
    expect(screen.getByLabelText('Reenquadrar planta')).toBeVisible();
  } finally {
    path.mockRestore();
  }
});

it('draws only what crosses each section of a long block', async () => {
  // o Bloco F tem 228 m e a planta mostra dois recortes: o hall e os 36 m em
  // volta da sala. Cada recorte desenhava as 63 salas e os 174 pilares do
  // andar, com o resto escondido pelo clipPath: 782 caminhos.
  const destination = room('5116', 'F', '5');
  const orientation = map.orientation(destination)!;
  await renderWithProviders(
    <FloorPlanCanvas
      atlas={map.atlas}
      block="F"
      floor="5"
      destination={destination}
      orientation={orientation}
    />,
  );
  await measure();
  expect(orientation.floorPlan!.rooms.length).toBeGreaterThan(60);
  expect(drawn('RNSVGClipPath')).toHaveLength(2);
  // com os pilares de cada recorte num caminho só (não se tocam, mesma cor)
  expect(drawn('RNSVGPath').length).toBeLessThan(160);
  // o que está à vista continua: a sala, as vizinhas e as do hall
  expect(labels()).toEqual(
    expect.arrayContaining(['5116', '5118', '5110', '5077', 'Elevadores']),
  );
});

it('keeps the measured size and updates in place when the floor changes', async () => {
  const sixth = room('6019', 'B', '6');
  const eighth = room('8019', 'B', '8');
  const view = await renderWithProviders(
    <FloorPlanCanvas
      atlas={map.atlas}
      block="B"
      floor="6"
      destination={sixth}
      orientation={map.orientation(sixth)}
      resetKey="6"
    />,
  );
  await measure(412, 500);
  const drawing = screen.getByLabelText(/^Planta do Bloco B, 6º andar/);
  await view.rerender(
    <FloorPlanCanvas
      atlas={map.atlas}
      block="B"
      floor="8"
      destination={eighth}
      orientation={map.orientation(eighth)}
      resetKey="8"
    />,
  );
  // a mesma view do desenho, sem nova medida: com `key`, a planta era
  // desmontada e voltava no tamanho provisório
  expect(screen.getByLabelText(/^Planta do Bloco B, 8º andar/)).toBe(drawing);
  expect(labels()).toContain('8019');
  expect(labels()).not.toContain('6019');
});
