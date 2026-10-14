import { bundledCampusMap } from '@root/adapters/outbound/campus-map';
import { CampusMap } from '@root/modules/campus-map/application/CampusMap';
import type {
  Block,
  Floor,
  RoomLocation,
} from '@root/modules/campus-map/domain/types';
import {
  floorLayout,
  floorPoint,
  floorTextWidth,
  roomFontSize,
} from '../floorGeometry';

const map = new CampusMap(bundledCampusMap);

function destination(code: string, block: Block, floor: Floor): RoomLocation {
  return { kind: 'room', building: 'pjlf', code, block, floor };
}

describe('floor drawing geometry', () => {
  it.each([
    ['6019', 'B', '6'],
    ['9023', 'D', '9'],
    ['4044', 'F', '4'],
    ['11033', 'E', '11'],
    ['10006', 'A', '10'],
    ['6002', 'C', '6'],
  ] as const)(
    'keeps %s%s and its route start in the visible measured sections',
    (code, block, floor) => {
      const orientation = map.orientation(destination(code, block, floor))!;
      const layout = floorLayout(map.atlas, block, orientation.room);
      for (const point of [
        orientation.route[0],
        orientation.route[orientation.route.length - 1],
      ]) {
        const segment = layout.segments.find(
          section => point[0] >= section.x0 && point[0] <= section.x1,
        );
        expect(segment).toBeDefined();
        const projected = floorPoint(point, segment!, layout.top);
        expect(projected[0]).toBeGreaterThanOrEqual(0);
        expect(projected[0]).toBeLessThanOrEqual(layout.width);
        expect(projected[1]).toBeGreaterThanOrEqual(0);
        expect(projected[1]).toBeLessThanOrEqual(layout.height);
      }
      const room = orientation.room!;
      expect(
        layout.segments.some(
          segment =>
            room.bounds[0] >= segment.x0 && room.bounds[2] <= segment.x1,
        ),
      ).toBe(true);
    },
  );

  it('preserves distance and orientation within each section; only the marked bridge is shortened', () => {
    const layout = floorLayout(map.atlas, 'B');
    const [hall, arm] = layout.segments;
    expect(hall.x0).toBeGreaterThan(arm.x1);
    expect(layout.gap!.metres).toBeCloseTo(hall.x0 - arm.x1);
    const a = floorPoint([70.73, 56.35], arm, layout.top);
    const b = floorPoint([70.73, 71.6], arm, layout.top);
    expect(a[1] - b[1]).toBeCloseTo(15.25);
    const c = floorPoint([72.03, 71.6], arm, layout.top);
    expect(b[0] - c[0]).toBeCloseTo(1.3);
  });

  it.each([320, 390])(
    'fits room labels inside their physical rooms at %s dp',
    width => {
      for (const [code, block, floor] of [
        ['6019', 'B', '6'],
        ['9023', 'D', '9'],
        ['4044', 'F', '4'],
      ] as const) {
        const orientation = map.orientation(destination(code, block, floor))!;
        const layout = floorLayout(map.atlas, block, orientation.room);
        const unit =
          Math.max(layout.width + 2, ((layout.height + 2) * width) / 330) /
          width;
        for (const room of orientation.floorPlan!.rooms.filter(
          item => item.code,
        )) {
          const rotated = block === 'F';
          const font = roomFontSize(room.code, room.bounds, unit, rotated);
          const along = rotated
            ? room.bounds[3] - room.bounds[1]
            : room.bounds[2] - room.bounds[0];
          const across = rotated
            ? room.bounds[2] - room.bounds[0]
            : room.bounds[3] - room.bounds[1];
          expect(floorTextWidth(room.code, font)).toBeLessThanOrEqual(
            along - 2.99 * unit,
          );
          expect(font).toBeLessThanOrEqual(across - 1.49 * unit);
        }
        expect(
          roomFontSize(code, orientation.room!.bounds, unit, block === 'F') /
            unit,
        ).toBeGreaterThanOrEqual(9);
      }
    },
  );
});
