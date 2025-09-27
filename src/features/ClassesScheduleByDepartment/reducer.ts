import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { AppState } from '@root/store';
import { DepartmentOptions, SubjectByUnit } from './types';

type State = {
  subjects: SubjectByUnit[];
  options: DepartmentOptions[];
};

const initialState = {
  subjects: [],
  options: [],
} as State;

const slice = createSlice({
  name: 'classSchedulesByUnit',
  initialState,
  reducers: {
    setSubjects: (state, action: PayloadAction<SubjectByUnit[]>) => {
      Object.assign(state, {
        subjects: action.payload,
      });
    },
    setOptions: (state, action: PayloadAction<DepartmentOptions[]>) => {
      Object.assign(state, {
        options: action.payload,
      });
    },
    clear: state => {
      Object.assign(state, initialState);
    },
  },
});

export const { setSubjects, setOptions, clear } = slice.actions;
export const selectClassSchedulesByDepartment = (state: AppState) =>
  state.classSchedulesByUnit;

export default slice.reducer;
