import axios from 'axios';

const usePrivateApi = () => {
  const api = axios.create({baseURL: 'https://pitrol.dev/aouerj/'});

  return {

    getDocentes: async () => {
      try {
        const {data} = await api.get('/docentes');
        return data;
      } catch (err) {
        throw new Error('GET_DOCENTES');
      }
    },

    getDocente: async (docente: string) => {
      try {
        const {data} = await api.get(`/docentes/${docente}`);
        return data;
      } catch (err) {
        throw new Error('GET_DOCENTE');
      }
    },
  };
};

export default usePrivateApi;
