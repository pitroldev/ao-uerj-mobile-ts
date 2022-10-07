import store from '@root/store';
import * as reducer from '@reducers/classSchedulesByUnit';

import {getClassesScheduleByUnit} from '@services/UerjApi';

export async function fetchClassesScheduleByUnit(opt?: string) {
  const data = await getClassesScheduleByUnit(opt);
  store.dispatch(reducer.setSubjects(data.subjects));
  store.dispatch(reducer.setOptions(data.options));

  return data;
}
