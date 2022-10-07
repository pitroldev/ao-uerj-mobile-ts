import store from '@root/store';
import * as reducer from '@root/reducers/subjectsToTake';

import {getSubjectsToTake} from '@services/UerjApi';
import isExpired from '@root/utils/isExpired';

export async function fetchSubjectsToTake() {
  const {subjectsAttended} = store.getState();
  if (!isExpired(subjectsAttended?.lastUpdatedAt, 12)) {
    return;
  }

  const data = await getSubjectsToTake();
  store.dispatch(reducer.setState(data));

  return data;
}
