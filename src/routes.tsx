import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  createDrawerNavigator,
  type DrawerContentComponentProps,
} from '@react-navigation/drawer';
import { useTheme } from 'styled-components/native';
import {
  useAppServices,
  useIdentity,
} from '@root/app/providers/AppServicesProvider';

import { DrawerNavigator } from '@root/components/templates/CustomDrawerNavigator';
import { FeatureGate } from '@root/modules/delivery/presentation/FeatureGate';
import { hideSplash } from '@root/app/splash';

import { CurriculumSubjects } from '@root/pages/CurriculumSubjects';
import { UniversalSubjects } from '@root/pages/UniversalSubjects';
import { SubjectsTakenScreen } from '@root/pages/SubjectsTaken';
import { SubjectDetailPage } from '@root/pages/SubjectDetails';
import { HomePage } from '@root/pages/Home';
import { LoginPage } from '@root/pages/Login';
import { MessageBoard } from '@root/pages/MessageBoard';
import { AboutPage } from '@root/pages/About';
import { ScheduleCreationPage } from '@root/pages/ScheduleSimulator';
import { MyProgressPage } from '@root/pages/MyProgress';
import { LoadingPage } from './pages/Loading';
import { CampusMapPage } from './pages/CampusMap/CampusMap';
import { DocumentsPage } from '@root/pages/Documents';
import { NotificationsPage } from '@root/pages/Notifications';

export type RootDrawerParamList = {
  Login: undefined;

  /** `focus`: o atalho "Notas" abre o Início no quadro de notas. */
  Início: { focus?: 'grades' } | undefined;
  Mapa: { location?: string } | undefined;
  'Mural de Mensagens': undefined;
  'Disciplinas Realizadas': undefined;
  'Disciplinas do Currículo': undefined;
  'Disciplinas Universais': undefined;
  'Pesquisa de Disciplinas':
    { subjectId?: string; sourceRoute?: keyof RootDrawerParamList } | undefined;
  'Pesquisa de Professores': undefined;
  'Gerador de Grade': undefined;
  'Meu Progresso': undefined;
  'Emissão de Documentos': undefined;
  Notificações: undefined;
  Sobre: undefined;

  Loading: undefined;
};

const Drawer = createDrawerNavigator<RootDrawerParamList>();

const renderDrawerContent = (props: DrawerContentComponentProps) => (
  <DrawerNavigator {...props} />
);

// recursos desativados pelo aviso remoto viram um estado de indisponível; o
// primeiro layout de tela tira o splash nativo (a tela já está desenhada)
const renderScreenLayout = ({
  route,
  children,
}: {
  route: { name: string };
  children: React.ReactElement;
}) => (
  <View style={styles.screen} onLayout={hideSplash}>
    <FeatureGate routeName={route.name}>{children}</FeatureGate>
  </View>
);

export const MainRoutes = () => {
  const theme = useTheme();
  const { account, status } = useIdentity();
  // os avisos dependem do módulo nativo, que só existe no Android
  const notificationsSupported =
    useAppServices().notifications.settings.getSnapshot().supported;
  const showLoading = status === 'restoring';
  const isSignedIn =
    Boolean(account) && (status === 'signedIn' || status === 'refreshing');

  return (
    <Drawer.Navigator
      drawerContent={renderDrawerContent}
      screenLayout={renderScreenLayout}
      initialRouteName={
        showLoading ? 'Loading' : isSignedIn ? 'Início' : 'Login'
      }
      screenOptions={{
        headerShown: false,
        drawerType: 'back',
        drawerStyle: {
          width: theme.layout.drawerWidth,
          backgroundColor: theme.colors.brand,
        },
        overlayColor: 'transparent',
        swipeEnabled: isSignedIn,
      }}
    >
      {showLoading && (
        <Drawer.Group navigationKey="restoring">
          <Drawer.Screen name="Loading" component={LoadingPage} />
        </Drawer.Group>
      )}
      {!showLoading && isSignedIn && (
        <Drawer.Group navigationKey={account!.scope}>
          <Drawer.Screen name="Início" component={HomePage} />
          <Drawer.Screen
            name="Mapa"
            component={CampusMapPage}
            options={{ swipeEnabled: false }}
          />
          <Drawer.Screen name="Meu Progresso" component={MyProgressPage} />
          <Drawer.Screen
            name="Emissão de Documentos"
            component={DocumentsPage}
          />
          <Drawer.Screen
            name="Gerador de Grade"
            component={ScheduleCreationPage}
          />
          <Drawer.Screen name="Mural de Mensagens" component={MessageBoard} />
          <Drawer.Screen
            name="Disciplinas Realizadas"
            component={SubjectsTakenScreen}
          />
          <Drawer.Screen
            name="Disciplinas do Currículo"
            component={CurriculumSubjects}
          />
          <Drawer.Screen
            name="Disciplinas Universais"
            component={UniversalSubjects}
          />
          <Drawer.Screen
            name="Pesquisa de Disciplinas"
            component={SubjectDetailPage}
          />
          {/* <Drawer.Screen
            name="Pesquisa de Professores"
            component={TeacherSearch}
          /> */}
          {notificationsSupported ? (
            <Drawer.Screen name="Notificações" component={NotificationsPage} />
          ) : null}
          <Drawer.Screen name="Sobre" component={AboutPage} />
        </Drawer.Group>
      )}
      {!showLoading && !isSignedIn && (
        <Drawer.Group navigationKey="signed-out">
          <Drawer.Screen name="Login" component={LoginPage} />
          <Drawer.Screen
            name="Mapa"
            component={CampusMapPage}
            options={{ swipeEnabled: false }}
          />
        </Drawer.Group>
      )}
    </Drawer.Navigator>
  );
};

const styles = StyleSheet.create({ screen: { flex: 1 } });
