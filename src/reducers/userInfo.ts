import {createSlice, PayloadAction} from '@reduxjs/toolkit';

import {AppState} from '@root/store';

type UserInfo = {
  name?: string;
  periodo?: string;
  matricula?: string;
  password?: string;
};

const initialState = {} as UserInfo;

const slice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setState: (state, action: PayloadAction<UserInfo>) => {
      Object.assign(state, action.payload);
    },
    setName: (state, action: PayloadAction<string>) => {
      state.name = action.payload;
    },
    setPeriodo: (state, action: PayloadAction<string>) => {
      state.periodo = action.payload;
    },
    clear: state => {
      Object.assign(state, initialState);
    },
  },
});

export const {setName, setPeriodo, setState, clear} = slice.actions;
export const selectUserInfo = (state: AppState) => state.userInfo;

export default slice.reducer;
