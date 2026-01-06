import { createRef } from 'react';

import { RootDrawerParamList } from '@root/routes';
import {
  DrawerActions,
  NavigationContainerRef,
} from '@react-navigation/native';

export const navigationRef =
  createRef<NavigationContainerRef<RootDrawerParamList>>();
export const isReadyRef: { current: boolean } = { current: false };

// Reset ready state - call when app comes from background after being killed
export function resetNavigationReady() {
  isReadyRef.current = false;
}

export function isNavigationReady(): boolean {
  return isReadyRef.current && navigationRef.current != null;
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
