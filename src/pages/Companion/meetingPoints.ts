import type { CampusAtlas, Point } from '@root/modules/campus-map/domain/types';
import type { CompanionCall } from '@root/modules/companion/domain/companion';
import {
  clockText,
  DESTINATION_TEXT,
  SPOT_TEXT,
  type MapAnchor,
} from '@root/modules/companion/presentation/companionText';

/** Um pino do mapa da chamada: o encontro, a saída e o destino, numerados. */
export type MeetingPin = {
  key: string;
  point: Point;
  label: string;
  /** "1", "2", "3" na volta; vazio na mesa (um pino só). */
  number: string;
};

/** O centro de um desenho do atlas (o lago não é um lugar, é um desenho). */
function centroid(rings: readonly (readonly Point[])[]): Point | null {
  const points = rings[0];
  if (!points?.length) return null;
  const x = points.reduce((sum, [px]) => sum + px, 0) / points.length;
  const y = points.reduce((sum, [, py]) => sum + py, 0) / points.length;
  return [x, y];
}

/** Onde fica um ponto de encontro no atlas; `null` se o atlas não o tiver. */
function anchorPoint(atlas: CampusAtlas, anchor: MapAnchor): Point | null {
  if ('place' in anchor)
    return atlas.places.find(place => place.id === anchor.place)?.point ?? null;
  const shape = atlas.shapes.find(item => item.id === anchor.shape);
  return shape ? centroid(shape.rings) : null;
}

/** O lugar do Mapa para "Ver no Mapa" (o lago não tem um). */
export function mapPlaceOf(call: Pick<CompanionCall, 'spot'>): string | null {
  const anchor = SPOT_TEXT[call.spot].map;
  return 'place' in anchor ? anchor.place : null;
}

/** Os pinos da chamada: o encontro e, na volta, a saída e o destino. */
export function meetingPins(
  atlas: CampusAtlas,
  call: Pick<CompanionCall, 'kind' | 'spot' | 'destination' | 'at'>,
): MeetingPin[] {
  const pins: MeetingPin[] = [];
  const meet = anchorPoint(atlas, SPOT_TEXT[call.spot].map);
  const home = call.kind === 'home' && call.destination;
  if (meet)
    pins.push({
      key: 'meet',
      point: meet,
      label: `Encontro, ${clockText(call.at)}`,
      number: home ? '1' : '',
    });
  if (home) {
    const destination = DESTINATION_TEXT[call.destination!];
    if (destination.exit !== call.spot) {
      const exit = anchorPoint(atlas, SPOT_TEXT[destination.exit].map);
      if (exit)
        pins.push({
          key: 'exit',
          point: exit,
          label: SPOT_TEXT[destination.exit].short,
          number: String(pins.length + 1),
        });
    }
    const place = destination.place
      ? atlas.places.find(item => item.id === destination.place)
      : undefined;
    if (place)
      pins.push({
        key: 'destination',
        point: place.point,
        label: call.destination === 'metro' ? 'Metrô' : 'Trem',
        number: String(pins.length + 1),
      });
  }
  return pins;
}
