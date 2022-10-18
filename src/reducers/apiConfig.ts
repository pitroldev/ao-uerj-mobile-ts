import {Cookies} from '@react-native-cookies/cookies';
import {createSlice, PayloadAction} from '@reduxjs/toolkit';

import {AppState} from '@root/store';

type Dict = {[key: string]: string};

type ApiConfig = {
  cookies: Cookies | null;
  dictionary: Dict;
  isBlocked: boolean;
  createdAt: Date;
};

const initialState: ApiConfig = {
  cookies: null,
  isBlocked: false,
  dictionary: {},
  createdAt: new Date(),
};

const apiConfigSlice = createSlice({
  name: 'apiConfig',
  initialState,
  reducers: {
    setState: (state, action: PayloadAction<Partial<ApiConfig>>) => {
      const createdAt = new Date();
      Object.assign(state, {...action.payload, createdAt});
    },
    addDictionary: (state, action: PayloadAction<Dict>) => {
      Object.assign(state.dictionary, action.payload);
    },
    setIsBlocked: (state, action: PayloadAction<boolean>) => {
      Object.assign(state, {isBlocked: action.payload});
    },
    clear: state => {
      Object.assign(state, initialState);
    },
  },
});

export const {setState, addDictionary, setIsBlocked, clear} =
  apiConfigSlice.actions;
export const selectApiConfig = (state: AppState) => state.apiConfig;

export default apiConfigSlice.reducer;
