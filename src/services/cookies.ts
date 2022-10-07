import CookieManager, {Cookies} from '@react-native-cookies/cookies';

const BASE_URL = 'https://www.alunoonline.uerj.br';

export const clearAllCookies = CookieManager.clearAll;

export const getCookies = async () => await CookieManager.get(BASE_URL);

export const setCookies = (cookies: Cookies) => {
  Object.values(cookies).forEach(cookie => {
    CookieManager.set(BASE_URL, cookie);
  });
};
