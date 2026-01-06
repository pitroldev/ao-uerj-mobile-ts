import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { AppState } from '@root/store';

import { SubjectInfo } from '@features/SubjectInfo/types';

type SubjectData = {
  code: number | string;
  periodo?: string;
  subject?: SubjectInfo;
};

type SetCurrentPayload = SubjectData & {
  sourceRoute?: string;
};

type State = {
  data: SubjectData[];
  current: SubjectData | null;
  sourceRoute: string | null;
};

const MAX_STORED_SUBJECTS = 20;

const initialState: State = {
  data: [],
  current: null,
  sourceRoute: null,
};

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
    setCurrent: (state, action: PayloadAction<SetCurrentPayload>) => {
      const { data } = state;
      const { sourceRoute, ...subjectData } = action.payload;

      const otherSubjects = data.filter(
        subject => subject.code !== subjectData.code,
      );

      state.data = [subjectData, ...otherSubjects].slice(
        0,
        MAX_STORED_SUBJECTS,
      );
      state.current = subjectData;
      state.sourceRoute = sourceRoute ?? null;
    },
    clearCurrent: state => {
      state.current = initialState.current;
      state.sourceRoute = null;
    },
  },
});

export const { setState, addSubject, setCurrent, clearCurrent } = slice.actions;
export const selectSubjectClassesSearch = (state: AppState) =>
  state.subjectClassesSearch;

export default slice.reducer;
