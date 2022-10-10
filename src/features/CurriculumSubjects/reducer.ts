import {createSlice, PayloadAction} from '@reduxjs/toolkit';

import {AppState} from '@root/store';

import {CurriculumSubject} from './types';

type State = {
  data: CurriculumSubject[];
  lastUpdatedAt?: Date;
};

const initialState = {
  data: [],
} as State;

const slice = createSlice({
  name: 'curriculumSubjects',
  initialState,
  reducers: {
    setState: (state, action: PayloadAction<CurriculumSubject[]>) => {
      Object.assign(state, {
        data: action.payload,
        lastUpdatedAt: new Date(),
      });
    },
    clear: state => {
      Object.assign(state, initialState);
    },
  },
});

export const {setState, clear} = slice.actions;
export const selectCurriculumSubjects = (state: AppState) =>
  state.curriculumSubjects;

export default slice.reducer;
