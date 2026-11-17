import { normalizeLocation, parseLocation } from '../domain/parseLocation';
import { leeRoom } from '../domain/labs';
import { orient } from '../domain/orientation';
import type {
  Entrance,
  Place,
  PlaceLocation,
  RoomLocation,
} from '../domain/types';
import type { CampusMapRepository } from './ports';

export class CampusMap {
  constructor(private readonly repository: CampusMapRepository) {}

  get atlas() {
    return this.repository.read();
  }

  search(query: string, category?: string) {
    const words = normalizeLocation(query).split(/\s+/).filter(Boolean);
    return this.atlas.places.filter(place => {
      if (category && place.category !== category) return false;
      const haystack = normalizeLocation(
        [place.name, place.subtitle, place.aliases].join(' '),
      );
      return words.every(word => haystack.includes(word));
    });
  }

  locate(input: string) {
    return parseLocation(input);
  }

  /**
   * A sala de um lugar com salas numeradas ("LEE 09"), com o nome da aula;
   * `undefined` quando o lugar não tem número ou o número passa do andar.
   */
  labRoom(location: PlaceLocation): RoomLocation | undefined {
    if (location.id !== 'lee' || location.number === undefined)
      return undefined;
    return leeRoom(this.atlas, location.number, location.label);
  }

  orientation(destination: RoomLocation | Place, entrance?: Entrance) {
    return orient(this.atlas, destination, entrance);
  }

  /** Only a documented room plan earns an exact polygon. */
  roomPlan(location: RoomLocation) {
    if (location.building !== 'pjlf') return undefined;
    return this.atlas.officialRooms.find(
      room =>
        room.code === location.code &&
        room.block === location.block &&
        room.floor === location.floor,
    );
  }

  isRecorded(location: RoomLocation) {
    if (!location.block || location.building !== 'pjlf') return false;
    if (
      location.block === 'F' &&
      location.floor === '6' &&
      /^RAV-(62|64)$/.test(location.code)
    )
      return true;
    return (
      this.atlas.rooms[location.block]?.[location.floor]?.includes(
        Number(location.code.slice(-3)),
      ) ?? false
    );
  }
}
