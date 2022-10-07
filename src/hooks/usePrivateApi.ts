import axios from 'axios';

const usePrivateApi = () => {
  const api = axios.create({baseURL: 'https://pitrol.dev/aouerj/'});

  return {
    reportError: async data => {
      try {
        await api.post('/reportError', data);
      } catch (err) {
        throw new Error('REPORT_ERROR');
      }
    },

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

    getMessages: async body => {
      try {
        const {data} = await api.post('/messages/get', body);
        return data;
      } catch (err) {
        throw new Error('GET_MESSAGES');
      }
    },

    postMessage: async body => {
      try {
        const {data} = await api.post('/messages/post', body);
        return data;
      } catch (err) {
        throw new Error('POST_MESSAGE');
      }
    },
  };
};

export default usePrivateApi;
