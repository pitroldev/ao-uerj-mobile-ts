import {createSlice, PayloadAction} from '@reduxjs/toolkit';

import {AppState} from '@root/store';
import {AttendedClassesSchedule} from '@root/types/attendedClassSchedules';

type AttendedClassesByPeriod = {
  [period: string]: AttendedClassesSchedule[];
};

type State = {
  data: AttendedClassesByPeriod;
  lastUpdatedAt?: Date;
};

const initialState = {
  data: {},
} as State;

const slice = createSlice({
  name: 'attendedClasses',
  initialState,
  reducers: {
    setState: (state, action: PayloadAction<State['data']>) => {
      Object.assign(state, {
        data: action.payload,
        lastUpdatedAt: new Date(),
      });
    },
    setAttendedClasses: (
      state,
      action: PayloadAction<{period: string; data: AttendedClassesSchedule[]}>,
    ) => {
      const {period, data} = action.payload;

      Object.assign(state.data, {...state.data, [period]: data});
      Object.assign(state, {lastUpdatedAt: new Date()});
    },
    clear: state => {
      Object.assign(state, initialState);
    },
  },
});

export const {setState, clear, setAttendedClasses} = slice.actions;
export const selectAttendedClasses = (state: AppState) => state.attendedClasses;

export default slice.reducer;
