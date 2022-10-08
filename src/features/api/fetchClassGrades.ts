import store from '@root/store';
import * as reducer from '@reducers/classGrades';

import {getClassGrades} from '@services/UerjApi';
import isExpired from '@root/utils/isExpired';

export async function fetchClassGrades() {
  const {classGrades} = store.getState();
  if (!isExpired(classGrades?.lastUpdatedAt, 6)) {
    return;
  }

  const data = await getClassGrades();
  store.dispatch(reducer.setClassGrades(data));

  return data;
}
