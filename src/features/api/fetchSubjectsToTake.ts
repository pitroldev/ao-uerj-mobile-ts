import store from '@root/store';
import * as reducer from '@root/reducers/subjectsToTake';

import {getSubjectsToTake} from '@services/UerjApi';
import isExpired from '@root/utils/isExpired';

export async function fetchSubjectsToTake() {
  const {subjectsToTake} = store.getState();
  const isEmpty = subjectsToTake.data.length === 0;
  if (!isExpired(subjectsToTake?.lastUpdatedAt, 12) && !isEmpty) {
    return;
  }

  const data = await getSubjectsToTake();
  store.dispatch(reducer.setState(data));

  return data;
}
