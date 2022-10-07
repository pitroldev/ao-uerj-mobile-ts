import store from '@root/store';
import * as reducer from '@reducers/universalSubjects';

import {getUniversalSubjects} from '@services/UerjApi';

export async function fetchUniversalSubjects(opt?: string) {
  const data = await getUniversalSubjects(opt);
  store.dispatch(reducer.setSubjects(data.subjects));
  store.dispatch(reducer.setOptions(data.options));

  return data;
}
