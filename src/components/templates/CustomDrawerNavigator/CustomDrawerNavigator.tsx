import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  useAnimatedValue,
  type LayoutChangeEvent,
} from 'react-native';
import { DrawerContentComponentProps } from '@react-navigation/drawer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from 'styled-components/native';

import {
  useAppServices,
  useIdentity,
} from '@root/app/providers/AppServicesProvider';
import { errorMessage } from '@root/shared/errors/AppError';
import { useDisabledRoutes } from '@root/modules/delivery/presentation/FeatureGate';
import {
  useCanInvite,
  useRemoteStatus,
} from '@root/modules/delivery/presentation/DeliveryProvider';
import { isEnrollmentSeason } from '@root/modules/delivery/domain/appStatus';
import { useNow } from '@features/AttendedClassesSchedule/useNow';
import {
  lastSubjectRoute,
  SUBJECT_ROUTES,
  SUBJECTS_TITLE,
} from '@features/SubjectTabs/subjectRoutes';
import { InviteSheet } from '@root/modules/delivery/presentation/InviteSheet';
import {
  appInvite,
  type Invite,
} from '@root/modules/delivery/presentation/inviteText';
import {
  THEME_PREFERENCE_LABEL,
  ThemePreferenceSheet,
} from '@root/modules/appearance/presentation/ThemePreferenceSheet';
import { useThemePreference } from '@root/modules/appearance/presentation/useThemePreference';
import { version } from '@/package.json';
import {
  Avatar,
  Icon,
  IconButton,
  Text,
  snackbar,
  useReducedMotion,
} from '@components/ui';
import type { IconName } from '@components/ui';

import {
  Bottom,
  Container,
  Footer,
  GroupHead,
  GroupLabel,
  Highlight,
  Item,
  ItemLabel,
  Nav,
  SeasonTag,
  Separator,
  User,
  UserText,
  Version,
} from './CustomDrawerNavigator.styles';

type NavItem = {
  /** A rota que o item abre. */
  route: string;
  icon: IconName;
  /** O nome no menu, quando é mais curto que o da tela. */
  label?: string;
  /** As rotas que acendem o item (Disciplinas: as três abas). */
  routes?: readonly string[];
};

type NavGroup = {
  label: string | null;
  /** Ganha "Época de inscrição" na época do aviso remoto (sem mudar a ordem). */
  enrollment?: boolean;
  items: NavItem[];
};

/**
 * O menu pelo que o aluno faz, não pela origem da tela (Aluno Online ou app):
 * o Início sozinho no topo, o dia no campus, o curso e a inscrição. Rotas sem
 * entrada aqui vão para o fim, junto de Notificações e Sobre.
 */
const NAV: NavGroup[] = [
  { label: null, items: [{ route: 'Início', icon: 'home' }] },
  {
    label: 'No campus',
    items: [
      { route: 'Agora no campus', icon: 'campaign' },
      { route: 'Companhia agora', icon: 'groups' },
      { route: 'Mapa', icon: 'location_on' },
      { route: 'Mural de Mensagens', icon: 'forum', label: 'Mural da turma' },
    ],
  },
  {
    label: 'Meu curso',
    items: [
      { route: 'Meu Progresso', icon: 'monitoring' },
      { route: 'Plano até a formatura', icon: 'school' },
      {
        route: SUBJECT_ROUTES[0],
        icon: 'menu_book',
        label: SUBJECTS_TITLE,
        routes: SUBJECT_ROUTES,
      },
      {
        route: 'Emissão de Documentos',
        icon: 'description',
        label: 'Documentos',
      },
    ],
  },
  {
    label: 'Inscrição',
    enrollment: true,
    items: [
      { route: 'Gerador de Grade', icon: 'edit_calendar' },
      { route: 'Pesquisa de Disciplinas', icon: 'search' },
      { route: 'Pesquisa de Professores', icon: 'person_search' },
    ],
  },
  {
    label: null,
    items: [
      { route: 'Notificações', icon: 'notifications' },
      { route: 'Sobre', icon: 'info' },
    ],
  },
];

const HIDDEN_ROUTES = ['Login', 'Loading', 'Informações da Disciplina'];
const covered = (item: NavItem) => item.routes ?? [item.route];
const KNOWN = new Set(NAV.flatMap(g => g.items.flatMap(covered)));

export const DrawerNavigator = ({
  state,
  navigation,
}: DrawerContentComponentProps) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { identity } = useAppServices();
  const { account } = useIdentity();
  const disabledRoutes = useDisabledRoutes();
  const { preference } = useThemePreference();
  const [themeSheetOpen, setThemeSheetOpen] = useState(false);
  // indicar o app fica no pé do menu, sempre à vista, só onde há loja
  const canInvite = useCanInvite();
  // a época de inscrição vem do aviso remoto
  const remote = useRemoteStatus();
  const now = useNow();
  const [invite, setInvite] = useState<Invite | null>(null);
  const isSignedIn = Boolean(account);

  const { routeNames } = state;
  const currentRouteName = routeNames[state.index];

  const groups = useMemo(() => {
    const available = new Set(routeNames);
    const extras: NavItem[] = routeNames
      .filter(name => !KNOWN.has(name) && !HIDDEN_ROUTES.includes(name))
      .map(name => ({ route: name, icon: 'chevron_right' }));
    const last = NAV.length - 1;
    return NAV.map((group, index) => ({
      ...group,
      items: [
        ...(index === last ? extras : []),
        ...group.items.flatMap(item => {
          const routes = covered(item).filter(name => available.has(name));
          return routes.length ? [{ ...item, routes }] : [];
        }),
      ],
    })).filter(group => group.items.length > 0);
  }, [routeNames]);

  // o item aceso (Disciplinas fica aceso em qualquer uma das abas)
  const activeKey = groups
    .flatMap(group => group.items)
    .find(item => covered(item).includes(currentRouteName))?.route;
  const enrolling = isEnrollmentSeason(remote.status, now.getTime());

  const [frames, setFrames] = useState<
    Record<string, { y: number; height: number }>
  >({});
  const highlightY = useAnimatedValue(0);
  const placed = useRef(false);
  const activeY = activeKey ? frames[activeKey]?.y : undefined;
  const activeHeight =
    (activeKey ? frames[activeKey]?.height : undefined) ?? theme.sizes.touch;

  useEffect(() => {
    if (activeY == null) return;
    if (!placed.current || reduced) {
      placed.current = true;
      highlightY.setValue(activeY);
      return;
    }
    Animated.timing(highlightY, {
      toValue: activeY,
      duration: theme.motion.base,
      easing: Easing.bezier(...theme.motion.easing),
      useNativeDriver: true,
    }).start();
  }, [activeY, highlightY, reduced, theme.motion]);

  if (!isSignedIn) {
    return <Container $bottom={0} />;
  }

  const onItemLayout = (route: string) => (event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    setFrames(prev =>
      prev[route]?.y === y && prev[route]?.height === height
        ? prev
        : { ...prev, [route]: { y, height } },
    );
  };

  function handleLogout() {
    navigation.closeDrawer();
    void identity.signOut().catch(error => snackbar.error(errorMessage(error)));
  }

  const c = theme.colors;

  return (
    <Container $bottom={22 + insets.bottom}>
      <User>
        <Avatar name={account!.name} tone="brand" />
        <UserText>
          <Text variant="body" weight="semibold" tone="onBrand">
            {account!.name}
          </Text>
          <Text variant="meta" tone="onBrandMuted">
            {`Matrícula ${account!.matricula}`}
          </Text>
        </UserText>
      </User>

      <Nav accessibilityRole="menu" accessibilityLabel="Menu principal">
        {activeY != null ? (
          <Highlight
            testID="drawer-highlight"
            pointerEvents="none"
            $height={activeHeight}
            style={{ transform: [{ translateY: highlightY }] }}
          />
        ) : null}
        {groups.map((group, gi) =>
          [
            group.label ? (
              <GroupHead key={`g-${group.label}`}>
                <GroupLabel
                  variant="meta"
                  weight="medium"
                  tone="onBrandMuted"
                  accessibilityRole="header"
                  accessibilityLabel={
                    group.enrollment && enrolling
                      ? `${group.label}, época de inscrição`
                      : group.label
                  }
                >
                  {group.label}
                </GroupLabel>
                {group.enrollment && enrolling ? (
                  <SeasonTag importantForAccessibility="no-hide-descendants">
                    <Text variant="caption" weight="medium" tone="onBrand">
                      Época de inscrição
                    </Text>
                  </SeasonTag>
                ) : null}
              </GroupHead>
            ) : gi > 0 ? (
              <Separator key={`sep-${gi}`} />
            ) : null,
          ].concat(
            group.items.map(item => {
              const routes = covered(item);
              const active = item.route === activeKey;
              const name = item.label ?? item.route;
              // desativado pelo aviso remoto: a tela explica o motivo
              const open = routes.filter(route => !disabledRoutes.has(route));
              const off = open.length === 0;
              // Disciplinas volta à última aba aberta (ou à primeira que abre)
              const remembered = lastSubjectRoute();
              const target = open.includes(remembered)
                ? remembered
                : (open[0] ?? routes[0]);
              return (
                <Item
                  key={item.route}
                  onLayout={onItemLayout(item.route)}
                  onPress={() => navigation.navigate(target)}
                  accessibilityRole="menuitem"
                  accessibilityLabel={off ? `${name}, indisponível` : name}
                  accessibilityState={{ selected: active }}
                  style={({ pressed }) =>
                    pressed && !active && { backgroundColor: c.brandRule }
                  }
                >
                  <Icon
                    name={item.icon}
                    filled={active}
                    color={active ? c.onBrandSelected : c.onBrandMuted}
                  />
                  <ItemLabel
                    variant="body"
                    weight={active ? 'semibold' : 'regular'}
                    color={active ? c.onBrandSelected : c.onBrand}
                    numberOfLines={2}
                  >
                    {name}
                  </ItemLabel>
                  {off ? (
                    <Text variant="caption" tone="onBrandMuted">
                      Indisponível
                    </Text>
                  ) : null}
                </Item>
              );
            }),
          ),
        )}
      </Nav>

      <Bottom>
        {canInvite ? (
          <Item
            onPress={() => setInvite(appInvite('menu'))}
            accessibilityRole="button"
            accessibilityLabel="Indicar o app"
            accessibilityHint="Abre a mensagem para mandar à turma e o QR"
            style={({ pressed }) => pressed && { backgroundColor: c.brandRule }}
          >
            <Icon name="share" color={c.onBrandMuted} />
            <ItemLabel variant="body" tone="onBrand" numberOfLines={2}>
              Indicar o app
            </ItemLabel>
          </Item>
        ) : null}
        <Footer>
          <Item
            $auto
            onPress={handleLogout}
            accessibilityRole="button"
            accessibilityLabel="Sair"
            style={({ pressed }) => pressed && { backgroundColor: c.brandRule }}
          >
            <Icon name="logout" color={c.onBrandMuted} />
            <Text variant="body" tone="onBrand">
              Sair
            </Text>
          </Item>
          <Version
            variant="caption"
            weight="regular"
            tone="onBrandMuted"
            align="right"
          >
            {`Versão ${version}`}
          </Version>
          <IconButton
            icon={theme.name === 'dark' ? 'dark_mode' : 'light_mode'}
            onBrand
            accessibilityLabel={`Tema: ${THEME_PREFERENCE_LABEL[preference]}`}
            accessibilityHint="Abre as opções de tema"
            onPress={() => setThemeSheetOpen(true)}
          />
        </Footer>
      </Bottom>
      <ThemePreferenceSheet
        visible={themeSheetOpen}
        onClose={() => setThemeSheetOpen(false)}
      />
      <InviteSheet invite={invite} onClose={() => setInvite(null)} />
    </Container>
  );
};
