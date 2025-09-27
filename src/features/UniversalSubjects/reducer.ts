import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { AppState } from '@root/store';

import { UniversalSubject } from './types';

type State = {
  subjects: UniversalSubject[];
};

const initialState = {
  subjects: [],
  options: [],
} as State;

const slice = createSlice({
  name: 'universalSubjects',
  initialState,
  reducers: {
    setSubjects: (state, action: PayloadAction<UniversalSubject[]>) => {
      Object.assign(state, {
        subjects: action.payload,
      });
    },
    clear: state => {
      Object.assign(state, initialState);
    },
  },
});

export const { setSubjects, clear } = slice.actions;
export const selectUniversalSubjects = (state: AppState) =>
  state.universalSubjects;

export default slice.reducer;
