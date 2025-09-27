import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { AppState } from '@root/store';

import { SubjectInfo } from '@features/SubjectInfo/types';

type SubjectData = {
  code: number | string;
  periodo?: string;
  subject?: SubjectInfo;
};

type State = {
  data: SubjectData[];
  current: SubjectData | null;
};

const MAX_STORED_SUBJECTS = 20;

const initialState = {
  data: [],
  current: null,
} as State;

const slice = createSlice({
  name: 'subjectClassesSearch',
  initialState,
  reducers: {
    setState: (state, action: PayloadAction<SubjectData>) => {
      Object.assign(state, { data: action.payload });
    },
    addSubject: (state, action: PayloadAction<SubjectData>) => {
      const { data } = state;
      const { payload } = action;

      const otherSubjects = data.filter(
        subject =>
          parseInt(subject.code as string, 10) ===
          parseInt(payload.code as string, 10),
      );

      state.data = [...otherSubjects, payload].slice(0, MAX_STORED_SUBJECTS);
    },
    setCurrent: (state, action: PayloadAction<SubjectData>) => {
      const { data } = state;
      const { payload } = action;

      const otherSubjects = data.filter(
        subject => subject.code !== payload.code,
      );

      state.data = [payload, ...otherSubjects].slice(0, MAX_STORED_SUBJECTS);

      state.current = payload;
    },
    clearCurrent: state => {
      state.current = initialState.current;
    },
  },
});

export const { setState, addSubject, setCurrent, clearCurrent } = slice.actions;
export const selectSubjectClassesSearch = (state: AppState) =>
  state.subjectClassesSearch;

export default slice.reducer;
