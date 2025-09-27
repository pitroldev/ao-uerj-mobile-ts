import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { AppState } from '@root/store';

import { SubjectToTake } from './types';

type State = {
  data: SubjectToTake[];
  lastUpdatedAt?: Date;
};

const initialState = {
  data: [],
} as State;

const slice = createSlice({
  name: 'subjectsToTake',
  initialState,
  reducers: {
    setState: (state, action: PayloadAction<SubjectToTake[]>) => {
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

export const { setState, clear } = slice.actions;
export const selectSubjectsToTake = (state: AppState) => state.subjectsToTake;

export default slice.reducer;
