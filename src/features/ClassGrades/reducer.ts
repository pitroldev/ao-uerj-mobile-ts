import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { AppState } from '@root/store';

import { ClassGrade } from './types';

type State = {
  data: ClassGrade[];
  isClassGradesAvailable?: Boolean;
  lastUpdatedAt?: Date;
};

const initialState = {
  data: {},
} as State;

const slice = createSlice({
  name: 'classGrades',
  initialState,
  reducers: {
    setState: (state, action: PayloadAction<State>) => {
      Object.assign(state, action.payload);
    },
    setClassGrades: (state, action: PayloadAction<State['data']>) => {
      const data = action.payload;

      const isClassGradesAvailable = data.some(({ grades }) =>
        Object.values(grades).some(grade => typeof grade === 'number'),
      );

      Object.assign(state, {
        data,
        isClassGradesAvailable,
        lastUpdatedAt: new Date(),
      });
    },
    clear: state => {
      Object.assign(state, initialState);
    },
  },
});

export const { setState, clear, setClassGrades } = slice.actions;
export const selectClassGrades = (state: AppState) => state.classGrades;

export default slice.reducer;
