import BootSplash from 'react-native-bootsplash';
import { hideSplash, resetSplash } from '../splash';

jest.mock('react-native-bootsplash', () => ({
  __esModule: true,
  default: { hide: jest.fn(() => Promise.resolve()) },
}));

it('hides the native splash once per app root', () => {
  resetSplash();
  hideSplash();
  hideSplash();
  expect(BootSplash.hide).toHaveBeenCalledTimes(1);
  expect(BootSplash.hide).toHaveBeenCalledWith({ fade: true });

  // a atividade recriada mostra o splash de novo e monta outra raiz
  resetSplash();
  hideSplash();
  expect(BootSplash.hide).toHaveBeenCalledTimes(2);
});
