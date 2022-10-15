import {createSlice, PayloadAction} from '@reduxjs/toolkit';

import {AppState} from '@root/store';

import {SubjectInfo} from '@features/SubjectInfo/types';
import {SubjectClassesSchedule} from '@root/features/SubjectClassesSchedule/types';

type ClassesPayload = {
  id: string;
  classes: SubjectClassesSchedule[];
};

export type SubjectData = {
  code: number;
  periodo?: string;
  classes?: SubjectClassesSchedule[];
  subject?: SubjectInfo;
};

type State = {
  data: SubjectData[];
  selected: SubjectData | null;
};

const MAX_STORED_SUBJECTS = 15;

const initialState = {
  data: [],
  selected: null,
} as State;

const slice = createSlice({
  name: 'subjectClassesSearch',
  initialState,
  reducers: {
    setState: (state, action: PayloadAction<SubjectData>) => {
      Object.assign(state, {data: action.payload});
    },
    add: (state, action: PayloadAction<SubjectData>) => {
      const newData = [action.payload];

      state.data.forEach(data => {
        const alreadyHas = newData.some(
          d => d.subject?.id === data.subject?.id,
        );
        if (alreadyHas) {
          return;
        }
        newData.push(data);
      });

      Object.assign(state, {data: newData.slice(0, MAX_STORED_SUBJECTS)});
    },
    setSubject: (state, action: PayloadAction<SubjectInfo>) => {
      state.data.forEach(data => {
        if (data.subject?.id === action.payload.id) {
          data.subject = action.payload;
        }
      });
    },
    setClasses: (state, action: PayloadAction<ClassesPayload>) => {
      state.data.forEach(data => {
        if (data.subject?.id === action.payload.id) {
          data.classes = action.payload.classes;
        }
      });
    },
    select: (state, action: PayloadAction<SubjectData>) => {
      state.selected = action.payload;
    },
    appendToSelect: (state, action: PayloadAction<Partial<SubjectData>>) => {
      if (state.selected) {
        Object.assign(state.selected, action.payload);
      }
    },
    appendData: (state, action: PayloadAction<Partial<SubjectData>>) => {
      const data = state.data.find(d => d.code === action.payload.code);

      if (data) {
        Object.assign(data, action.payload);
      } else {
        state.data.push(action.payload as SubjectData);
      }
    },
    clearSelected: state => {
      state.selected = initialState.selected;
    },
  },
});

export const {
  add,
  setSubject,
  setClasses,
  setState,
  select,
  clearSelected,
  appendToSelect,
  appendData,
} = slice.actions;
export const selectSubjectClassesSearch = (state: AppState) =>
  state.subjectClassesSearch;

export default slice.reducer;
