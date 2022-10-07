import {createRef} from 'react';

import {RootDrawerParamList} from '@root/routes';
import {DrawerActions, NavigationContainerRef} from '@react-navigation/native';

export const navigationRef =
  createRef<NavigationContainerRef<RootDrawerParamList>>();
export const isReadyRef = createRef<boolean>();

export function navigate(name: any, params: any) {
  if (isReadyRef.current && navigationRef.current) {
    navigationRef.current.navigate(name, params);
  }
}

export function toggleDrawer() {
  if (isReadyRef.current && navigationRef.current) {
    navigationRef.current.dispatch(DrawerActions.toggleDrawer());
  }
}

export function getCurrentRouteName() {
  if (isReadyRef.current && navigationRef.current) {
    return navigationRef.current.getCurrentRoute()?.name;
  }
}
