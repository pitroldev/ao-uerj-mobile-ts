import React from 'react';
import {
  createDrawerNavigator,
  type DrawerContentComponentProps,
} from '@react-navigation/drawer';
import { useIdentity } from '@root/app/providers/AppServicesProvider';
import { LIGHT } from '@root/themes';

import CustomDrawerNavigator from '@root/components/templates/CustomDrawerNavigator';

import CurriculumSubjects from '@root/pages/CurriculumSubjects';
import UniversalSubjects from '@root/pages/UniversalSubjects';
import SubjectsTaken from '@root/pages/SubjectsTaken';
import SubjectDetails from '@root/pages/SubjectDetails';
import Home from '@root/pages/Home';
import Login from '@root/pages/Login';
import MessageBoard from '@root/pages/MessageBoard';
import About from '@root/pages/About';
import ScheduleSimulator from '@root/pages/ScheduleSimulator';
import MyProgress from '@root/pages/MyProgress';
import Loading from './pages/Loading';

export type RootDrawerParamList = {
  Login: undefined;

  Início: undefined;
  'Mural de Mensagens': undefined;
  'Disciplinas Realizadas': undefined;
  'Disciplinas do Currículo': undefined;
  'Disciplinas Universais': undefined;
  'Pesquisa de Disciplinas':
    { subjectId?: string; sourceRoute?: keyof RootDrawerParamList } | undefined;
  'Pesquisa de Professores': undefined;
  'Gerador de Grade': undefined;
  'Meu Progresso': undefined;
  Sobre: undefined;

  Loading: undefined;
};

const Drawer = createDrawerNavigator<RootDrawerParamList>();

const renderDrawerContent = (props: DrawerContentComponentProps) => (
  <CustomDrawerNavigator {...props} />
);

const MainRoutes = () => {
  const { account, status } = useIdentity();
  const showLoading = status === 'restoring';
  const isSignedIn =
    Boolean(account) && (status === 'signedIn' || status === 'refreshing');

  return (
    <Drawer.Navigator
      drawerContent={renderDrawerContent}
      initialRouteName={
        showLoading ? 'Loading' : isSignedIn ? 'Início' : 'Login'
      }
      screenOptions={{
        headerShown: false,
        drawerType: 'back',
        drawerStyle: {
          width: LIGHT.layout.drawerWidth,
          backgroundColor: LIGHT.colors.brand,
        },
        overlayColor: 'transparent',
        swipeEnabled: isSignedIn,
      }}
    >
      {showLoading && (
        <Drawer.Group navigationKey="restoring">
          <Drawer.Screen name="Loading" component={Loading} />
        </Drawer.Group>
      )}
      {!showLoading && isSignedIn && (
        <Drawer.Group navigationKey={account!.scope}>
          <Drawer.Screen name="Início" component={Home} />
          <Drawer.Screen name="Meu Progresso" component={MyProgress} />
          <Drawer.Screen
            name="Gerador de Grade"
            component={ScheduleSimulator}
          />
          <Drawer.Screen name="Mural de Mensagens" component={MessageBoard} />
          <Drawer.Screen
            name="Disciplinas Realizadas"
            component={SubjectsTaken}
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
            component={SubjectDetails}
          />
          {/* <Drawer.Screen
            name="Pesquisa de Professores"
            component={TeacherSearch}
          /> */}
          <Drawer.Screen name="Sobre" component={About} />
        </Drawer.Group>
      )}
      {!showLoading && !isSignedIn && (
        <Drawer.Group navigationKey="signed-out">
          <Drawer.Screen name="Login" component={Login} />
        </Drawer.Group>
      )}
    </Drawer.Navigator>
  );
};

export default MainRoutes;
