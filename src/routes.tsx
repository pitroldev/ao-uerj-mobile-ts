import React, { useMemo } from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { useQuery } from '@tanstack/react-query';

import { selectApiConfig } from '@reducers/apiConfig';
import { selectUserInfo } from '@reducers/userInfo';
import { useAppSelector } from '@root/store';
import { refreshAuth } from '@services/UerjApi';

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
  'Gerador de Grade': undefined;
  'Meu Progresso': undefined;
  Sobre: undefined;

  Loading: undefined;
};

const Drawer = createDrawerNavigator<RootDrawerParamList>();

const renderDrawerContent = (props: any) => (
  <CustomDrawerNavigator {...props} />
);

const MainRoutes = () => {
  const { cookies } = useAppSelector(selectApiConfig);
  const { matricula, password } = useAppSelector(selectUserInfo);

  const shouldRefresh = Boolean(matricula && password);

  const { isLoading, isError } = useQuery({
    queryKey: ['refresh-auth'],
    queryFn: async () => {
      await refreshAuth();
      return true;
    },
    enabled: shouldRefresh,
    retry: 1, // Tentar uma vez antes de falhar
    retryDelay: 1000, // Esperar 1s antes de retry
    refetchInterval: 10 * 60 * 1000, // Refresh a cada 10 minutos
    refetchOnWindowFocus: true,
    staleTime: 30 * 1000, // Considerar dados frescos por 30s (evita refetch imediato ao voltar do background)
  });

  const isSignedIn = Boolean(cookies);

  // Se houve erro no refresh mas temos cookies, ainda podemos mostrar o app
  const showLoading = isLoading && shouldRefresh && !cookies;

  const initialRoute = useMemo(() => {
    if (showLoading) return 'Loading';
    return isSignedIn ? 'Início' : 'Login';
  }, [showLoading, isSignedIn]);

  return (
    <Drawer.Navigator
      drawerContent={renderDrawerContent}
      initialRouteName={initialRoute}
      screenOptions={{
        headerShown: false,
        drawerType: 'back',
        overlayColor: 'transparent',
        swipeEnabled: isSignedIn,
      }}
    >
      {showLoading && <Drawer.Screen name="Loading" component={Loading} />}
      {!showLoading && isSignedIn && (
        <>
          {/* <Drawer.Screen name="Playground" component={Playground} /> */}
          <Drawer.Screen name="Início" component={Home} />
          <Drawer.Screen name="Meu Progresso" component={MyProgress} />
          <Drawer.Screen
            name="Gerador de Grade"
            component={ScheduleSimulator}
          />
          <Drawer.Screen name="Mural de Mensagens" component={MessageBoard} />
          {/* <Drawer.Screen
            name="Disciplinas a Cursar"
            component={SubjectsToTake}
          /> */}
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
          {/* { <Drawer.Screen
            name="Horário das Turmas"
            component={ClassSchedulesByDepartment}
          />} */}
          <Drawer.Screen
            name="Pesquisa de Disciplinas"
            component={SubjectDetails}
          />
          {/* <Drawer.Screen
            name="Pesquisa de Professores"
            component={TeacherSearch}
          /> */}
          <Drawer.Screen name="Sobre" component={About} />
        </>
      )}
      {!showLoading && !isSignedIn && (
        <>
          <Drawer.Screen name="Login" component={Login} />
        </>
      )}
    </Drawer.Navigator>
  );
};

export default MainRoutes;
