import store from '@root/store';
import * as attendedReducer from '@reducers/attendedClasses';

import isExpired from '@utils/isExpired';
import {getAttendedClassesSchedule} from '@services/UerjApi';

export async function fetchAttendedClassesSchedule() {
  const {userInfo, attendedClasses} = store.getState();

  const isEmpty =
    attendedClasses?.data[userInfo.periodo as string]?.length === 0;

  if (!isExpired(attendedClasses?.lastUpdatedAt, 12) && !isEmpty) {
    return;
  }

  const data = await getAttendedClassesSchedule();

  store.dispatch(
    attendedReducer.setAttendedClasses({
      period: userInfo.periodo as string,
      data,
    }),
  );

  return data;
}
