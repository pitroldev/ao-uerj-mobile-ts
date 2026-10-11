import { useCallback } from 'react';
import { BackHandler } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

export const useBackHandler = (callback: () => void, goBack = true) => {
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        callback();
        return goBack;
      };
      const listener = BackHandler.addEventListener(
        'hardwareBackPress',
        onBackPress,
      );
      return () => {
        listener.remove();
      };
    }, [callback, goBack]),
  );
};
