import store from '@root/store';
import * as reducer from '@root/reducers/subjectsAttended';

import {getAttendedSubjects} from '@services/UerjApi';
import isExpired from '@root/utils/isExpired';

export async function fetchAttendedSubjects() {
  const {subjectsAttended} = store.getState();
  if (!isExpired(subjectsAttended?.lastUpdatedAt, 12)) {
    return;
  }

  const data = await getAttendedSubjects();
  store.dispatch(reducer.setState(data));

  return data;
}
