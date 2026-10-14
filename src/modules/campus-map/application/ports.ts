import type { CampusAtlas } from '../domain/types';

export interface CampusMapRepository {
  read(): CampusAtlas;
}
