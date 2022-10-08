import {getPartialRID} from '@services/UerjApi';

export async function fetchPartialRID() {
  const data = await getPartialRID();

  return data;
}
