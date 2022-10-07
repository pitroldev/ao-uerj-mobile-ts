import {useState, useEffect} from 'react';

const useRefresh = (onRefresh: () => void) => {
  const [refreshing, setRefreshing] = useState<boolean>(false);

  useEffect(() => {
    if (refreshing) {
      onRefresh();
    }
  }, [refreshing]);

  return {
    toggleRefresh: () => setRefreshing(c => !c),
    setRefreshing,
    refreshing,
  };
};

export default useRefresh;
