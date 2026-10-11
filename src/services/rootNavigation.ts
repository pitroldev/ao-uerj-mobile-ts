import { createRef } from 'react';

import type { RootDrawerParamList } from '@root/routes';
import {
  DrawerActions,
  NavigationContainerRef,
} from '@react-navigation/native';

export const navigationRef =
  createRef<NavigationContainerRef<RootDrawerParamList>>();
export function isNavigationReady(): boolean {
  return navigationRef.current?.isReady() ?? false;
}

export function navigate(name: any, params?: any) {
  if (isNavigationReady()) {
    navigationRef.current?.navigate(name, params);
  }
}

export function toggleDrawer() {
  if (isNavigationReady()) {
    navigationRef.current?.dispatch(DrawerActions.toggleDrawer());
  }
}

export function getCurrentRouteName() {
  if (isNavigationReady()) {
    return navigationRef.current?.getCurrentRoute()?.name;
  }
  return undefined;
}
