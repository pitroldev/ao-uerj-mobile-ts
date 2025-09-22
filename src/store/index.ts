import {
  configureStore,
  ThunkAction,
  Action,
  combineReducers,
} from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import { persistReducer } from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';

import userInfo from '@reducers/userInfo';
import apiConfig from '@reducers/apiConfig';
import subjectsToTake from '@features/SubjectsToTake/reducer';
import curriculumSubjects from '@features/CurriculumSubjects/reducer';
import universalSubjects from '@features/UniversalSubjects/reducer';
import classSchedulesByUnit from '@features/ClassesScheduleByDepartment/reducer';
import subjectsAttended from '@features/SubjectsTaken/reducer';
import subjectClassesSearch from '@features/SubjectClassesSchedule/reducer';
import attendedClasses from '@features/AttendedClassesSchedule/reducer';
import classGrades from '@features/ClassGrades/reducer';

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
    classGrades,
  });

  const persistConfig = {
    key: 'root',
    version: 1,
    storage: AsyncStorage,
  };

  const persistedReducer = persistReducer(persistConfig, reducers);

  return configureStore({
    reducer: persistedReducer,
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
