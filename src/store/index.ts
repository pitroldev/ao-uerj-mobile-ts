import {
  configureStore,
  ThunkAction,
  Action,
  combineReducers,
} from '@reduxjs/toolkit';
import {TypedUseSelectorHook, useDispatch, useSelector} from 'react-redux';
import {persistReducer} from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';

import userInfo from '@reducers/userInfo';
import apiConfig from '@reducers/apiConfig';
import subjectsToTake from '@reducers/subjectsToTake';
import curriculumSubjects from '@reducers/curriculumSubjects';
import universalSubjects from '@reducers/universalSubjects';
import classSchedulesByUnit from '@reducers/classSchedulesByUnit';
import subjectsAttended from '@reducers/subjectsAttended';
import subjectClassesSearch from '@reducers/subjectClassesSearch';
import attendedClasses from '@reducers/attendedClasses';

export function makeStore() {
  const reducers = combineReducers({
    userInfo,
    apiConfig,
    subjectsToTake,
    curriculumSubjects,
    universalSubjects,
    classSchedulesByUnit,
    subjectsAttended,
    subjectClassesSearch,
    attendedClasses,
  });

  const persistConfig = {
    key: 'root',
    version: 1,
    storage: AsyncStorage,
  };

  const persistedReducer = persistReducer(persistConfig, reducers);

  return configureStore({
    reducer: persistedReducer,
    middleware: [],
  });
}

const store = makeStore();

export type AppState = ReturnType<typeof store.getState>;

export type AppDispatch = typeof store.dispatch;

export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  AppState,
  unknown,
  Action<string>
>;

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<AppState> = useSelector;

export default store;
