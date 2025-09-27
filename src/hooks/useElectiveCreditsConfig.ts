import { useLocalStorage } from '@hooks/useLocalStorage';

export type ElectiveType = 'RESTRICTED' | 'DEFINED' | 'UNIVERSAL';

export interface ElectiveCreditsConfig {
  RESTRICTED: number;
  DEFINED: number;
  UNIVERSAL: number;
}

const STORAGE_KEY = '@elective_credits_config';

const DEFAULT_CONFIG: ElectiveCreditsConfig = {
  RESTRICTED: 0,
  DEFINED: 0,
  UNIVERSAL: 0,
};

export function useElectiveCreditsConfig() {
  const {
    value: config,
    updateValue: setConfig,
    removeValue: resetConfig,
    refresh,
    loading,
    error,
  } = useLocalStorage<ElectiveCreditsConfig>(STORAGE_KEY, DEFAULT_CONFIG);

  const updateCredits = (type: ElectiveType, credits: number) => {
    return setConfig(prev => ({
      ...prev,
      [type]: Math.max(0, credits),
    }));
  };

  const hasConfiguredCredits = (type: ElectiveType) => {
    return config[type] > 0;
  };

  const getRemainingCredits = (
    type: ElectiveType,
    completedCredits: number,
  ) => {
    const required = config[type];
    return required > 0 ? Math.max(0, required - completedCredits) : 0;
  };

  const getProgress = (type: ElectiveType, completedCredits: number) => {
    const required = config[type];
    return required > 0 ? Math.round((completedCredits / required) * 100) : 0;
  };

  return {
    config,
    setConfig,
    updateCredits,
    resetConfig,
    refresh,
    loading,
    error,
    hasConfiguredCredits,
    getRemainingCredits,
    getProgress,
  };
}
