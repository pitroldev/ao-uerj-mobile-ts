import store from '@root/store';
import * as attendedReducer from '@reducers/attendedClasses';

import {getAttendedClassesSchedule} from '@services/UerjApi';

export async function fetchAttendedClassesSchedule() {
  const data = await getAttendedClassesSchedule();
  const {userInfo} = store.getState();

  store.dispatch(
    attendedReducer.setAttendedClasses({
      period: userInfo.periodo as string,
      data,
    }),
  );

  return data;
}
