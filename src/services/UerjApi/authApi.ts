import axios from 'axios';
import iconv from 'iconv-lite';
import { Buffer } from 'buffer';

const BASE_URL = 'https://www.alunoonline.uerj.br';

const authApi = axios.create({
  baseURL: BASE_URL,
  responseType: 'arraybuffer',
  withCredentials: true,
  timeout: 15_000,
  transformResponse: [
    res => (res ? iconv.decode(Buffer.from(res), 'iso-8859-1') : res),
  ],
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
  },
});

export default authApi;
