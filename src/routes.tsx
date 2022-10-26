import React from 'react';
import {createDrawerNavigator} from '@react-navigation/drawer';

import {selectApiConfig} from '@reducers/apiConfig';
import {useAppSelector} from '@root/store';

import CustomDrawerNavigator from '@root/components/templates/CustomDrawerNavigator';

import SubjectsToTake from '@root/pages/SubjectsToTake';
import CurriculumSubjects from '@root/pages/CurriculumSubjects';
import UniversalSubjects from '@root/pages/UniversalSubjects';
import ClassSchedulesByDepartment from '@root/pages/ClassSchedulesByDepartment';
import SubjectsTaken from '@root/pages/SubjectsTaken';
import SubjectDetails from '@root/pages/SubjectDetails';
import Home from '@root/pages/Home';
import Login from '@root/pages/Login';
import MessageBoard from '@root/pages/MessageBoard';
import About from '@root/pages/About';
import TeacherSearch from '@root/pages/TeacherSearch';
// import Playground from '@root/pages/Playground';

export type RootDrawerParamList = {
  Login: undefined;
  Playground: undefined;

  Início: undefined;
  'Mural de Mensagens': undefined;
  'Disciplinas a Cursar': undefined;
  'Disciplinas Realizadas': undefined;
  'Disciplinas do Currículo': undefined;
  'Disciplinas Universais': undefined;
  'Horário das Turmas': undefined;
  'Pesquisa de Disciplinas': undefined;
  'Pesquisa de Professores': undefined;
  Sobre: undefined;
};

const Drawer = createDrawerNavigator<RootDrawerParamList>();

const MainRoutes = () => {
  const {cookies} = useAppSelector(selectApiConfig);
  const isSignedIn = Boolean(cookies);

  const initialRoute = isSignedIn ? 'Início' : 'Login';
  return (
    <Drawer.Navigator
      drawerContent={props => <CustomDrawerNavigator {...props} />}
      initialRouteName={initialRoute}
      screenOptions={{
        headerShown: false,
        drawerType: 'back',
        overlayColor: 'transparent',
        swipeEnabled: isSignedIn,
      }}>
      {isSignedIn ? (
        <>
          {/* <Drawer.Screen name="Playground" component={Playground} /> */}
          <Drawer.Screen name="Início" component={Home} />
          <Drawer.Screen name="Mural de Mensagens" component={MessageBoard} />
          <Drawer.Screen
            name="Disciplinas a Cursar"
            component={SubjectsToTake}
          />
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
            name="Horário das Turmas"
            component={ClassSchedulesByDepartment}
          />
          <Drawer.Screen
            name="Pesquisa de Disciplinas"
            component={SubjectDetails}
          />
          <Drawer.Screen
            name="Pesquisa de Professores"
            component={TeacherSearch}
          />
          <Drawer.Screen name="Sobre" component={About} />
        </>
      ) : (
        <>
          <Drawer.Screen name="Login" component={Login} />
        </>
      )}
    </Drawer.Navigator>
  );
};

export default MainRoutes;
