import axios from 'axios';

const BASE_URL = 'https://pitrol.dev/aouerj';

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
  },
});

export default api;
