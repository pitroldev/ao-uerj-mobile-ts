import {useState, useEffect} from 'react';

type Options = {
  initialData?: any;
};

type CallbackType = () => Promise<any>;

function useApiFetch<T>(callback: CallbackType, options: Options = {}) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<T>(options?.initialData ?? null);
  const [error, setError] = useState<unknown | Error>(null);

  const clear = () => setData(options?.initialData ?? null);

  const fetch = async () => {
    try {
      setLoading(true);
      const response = await callback();
      setData(response);
    } catch (err) {
      console.log(callback.name, err);
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();
  }, []);

  return {
    loading,
    data,
    error,
    fetch,
    clear,
    setData,
  };
}

export default useApiFetch;
