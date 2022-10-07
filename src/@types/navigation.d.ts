import {RootDrawerParamList} from '@root/routes';

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootDrawerParamList {}
  }
}
