import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(initialValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadValue();
  }, [key]);

  const loadValue = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const stored = await AsyncStorage.getItem(key);
      if (stored !== null) {
        const parsedValue = JSON.parse(stored);
        setValue(parsedValue);
      }
    } catch (err) {
      console.error(`Error loading value for key ${key}:`, err);
      setError(err instanceof Error ? err.message : 'Failed to load value');
    } finally {
      setLoading(false);
    }
  }, [key]);

  const updateValue = useCallback(
    async (newValue: T | ((prev: T) => T)) => {
      try {
        setError(null);
        const valueToStore =
          typeof newValue === 'function'
            ? (newValue as (prev: T) => T)(value)
            : newValue;

        await AsyncStorage.setItem(key, JSON.stringify(valueToStore));
        setValue(valueToStore);

        return true;
      } catch (err) {
        console.error(`Error saving value for key ${key}:`, err);
        setError(err instanceof Error ? err.message : 'Failed to save value');
        return false;
      }
    },
    [key, value],
  );

  const removeValue = useCallback(async () => {
    try {
      setError(null);
      await AsyncStorage.removeItem(key);
      setValue(initialValue);
      return true;
    } catch (err) {
      console.error(`Error removing value for key ${key}:`, err);
      setError(err instanceof Error ? err.message : 'Failed to remove value');
      return false;
    }
  }, [key, initialValue]);

  const refresh = useCallback(() => {
    loadValue();
  }, [loadValue]);

  return {
    value,
    updateValue,
    removeValue,
    refresh,
    loading,
    error,
  };
}
