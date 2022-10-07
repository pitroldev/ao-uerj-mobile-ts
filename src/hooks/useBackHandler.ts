import {useEffect} from 'react';
import {BackHandler} from 'react-native';

export const useBackHandler = (callback: () => void, goBack = true) => {
  useEffect(() => {
    const onBackPress = () => {
      callback();
      return goBack;
    };
    BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => {
      BackHandler.removeEventListener('hardwareBackPress', onBackPress);
    };
  }, [callback]);
};
