import {createSlice, PayloadAction} from '@reduxjs/toolkit';

import {AppState} from '@root/store';
import {SubjectAttended} from '@root/types/subjectsAttended';

type State = {
  data: SubjectAttended[];
  lastUpdatedAt?: Date;
};

const initialState = {
  data: [],
} as State;

const slice = createSlice({
  name: 'subjectsAttended',
  initialState,
  reducers: {
    setState: (state, action: PayloadAction<SubjectAttended[]>) => {
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
export const selectSubjectsAttended = (state: AppState) =>
  state.subjectsAttended;

export default slice.reducer;
