import React from 'react';
import { act, screen } from '@testing-library/react-native';
import { bundledCampusMap } from '@root/adapters/outbound/campus-map';
import { CampusMap } from '@root/modules/campus-map/application/CampusMap';
import { renderWithProviders } from '@root/test-utils/render';
import { FloorPlanCanvas } from '../FloorPlanCanvas';
import * as geometry from '../floorGeometry';
import { gestureCallbacks, panSession } from './mapGestures';

it('keeps floor geometry cached during pan and pinch while preserving the destination', async () => {
  const map = new CampusMap(bundledCampusMap);
  const destination = {
    kind: 'room',
    building: 'pjlf',
    code: '6019',
    block: 'B',
    floor: '6',
  } as const;
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
