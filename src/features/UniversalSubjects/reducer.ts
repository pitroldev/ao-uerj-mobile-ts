import {createSlice, PayloadAction} from '@reduxjs/toolkit';

import {AppState} from '@root/store';

import {UniversalSubject, DepartmentOptions} from './types';

type State = {
  subjects: UniversalSubject[];
  options: DepartmentOptions[];
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

export const {setSubjects, setOptions, clear} = slice.actions;
export const selectUniversalSubjects = (state: AppState) =>
  state.universalSubjects;

export default slice.reducer;
