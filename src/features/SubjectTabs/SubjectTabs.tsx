import React from 'react';
import { StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Tabs } from '@components/ui';
import {
  rememberSubjectRoute,
  SUBJECT_ROUTES,
  SUBJECT_TAB_LABEL,
  type SubjectRoute,
} from './subjectRoutes';

const TABS = SUBJECT_ROUTES.map(route => ({
  value: route,
  label: SUBJECT_TAB_LABEL[route],
}));

/**
 * O topo fixo de "Disciplinas": Realizadas, Do currículo e Universais. Vai no
 * `header` do painel, com `SUBJECT_TABS_PANEL` (o traço das abas já separa o
 * topo da lista).
 */
export function SubjectTabs({ current }: { current: SubjectRoute }) {
  const navigation = useNavigation();
  return (
    <Tabs
      style={styles.tabs}
      tabs={TABS}
      value={current}
      onChange={route => {
        if (route === current) return;
        rememberSubjectRoute(route);
        navigation.navigate(route);
      }}
      accessibilityLabel="Disciplinas"
    />
  );
}

/** O estilo do topo do painel com as abas. */
export const SUBJECT_TABS_PANEL = { paddingTop: 4, borderBottomWidth: 0 };

const styles = StyleSheet.create({
  tabs: { marginHorizontal: 16 },
});
