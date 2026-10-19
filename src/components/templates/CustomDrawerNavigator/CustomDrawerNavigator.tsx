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
  Container,
  Footer,
  GroupLabel,
  Highlight,
  Item,
  ItemLabel,
  Nav,
  Separator,
  User,
  UserText,
  Version,
} from './CustomDrawerNavigator.styles';

type NavGroup = { label: string | null; items: [string, IconName][] };

/** Agrupamento e ícones do menu (rotas sem entrada aqui vão para Ferramentas). */
const NAV: NavGroup[] = [
  {
    label: 'Acadêmico',
    items: [
      ['Início', 'home'],
      ['Meu Progresso', 'monitoring'],
      ['Plano até a formatura', 'school'],
      ['Emissão de Documentos', 'description'],
      ['Disciplinas Realizadas', 'task_alt'],
      ['Disciplinas do Currículo', 'account_tree'],
      ['Disciplinas Universais', 'public'],
      ['Pesquisa de Disciplinas', 'search'],
    ],
  },
  {
    label: 'Ferramentas',
    items: [
      ['Mapa', 'location_on'],
      ['Gerador de Grade', 'edit_calendar'],
      ['Mural de Mensagens', 'forum'],
      ['Pesquisa de Professores', 'person_search'],
    ],
  },
  {
    label: null,
    items: [
      ['Notificações', 'notifications'],
      ['Sobre', 'info'],
    ],
  },
];

const HIDDEN_ROUTES = ['Login', 'Loading', 'Informações da Disciplina'];
const KNOWN = new Set(NAV.flatMap(g => g.items.map(([name]) => name)));

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
  const isSignedIn = Boolean(account);

  const { routeNames } = state;
  const currentRouteName = routeNames[state.index];

  const groups = useMemo(() => {
    const available = new Set(routeNames);
    const extras = routeNames.filter(
      name => !KNOWN.has(name) && !HIDDEN_ROUTES.includes(name),
    );
    return NAV.map(group => ({
      label: group.label,
      items: [
        ...group.items.filter(([name]) => available.has(name)),
        ...(group.label === 'Ferramentas'
          ? extras.map(name => [name, 'chevron_right'] as [string, IconName])
          : []),
      ],
    })).filter(group => group.items.length > 0);
  }, [routeNames]);

  const [frames, setFrames] = useState<
    Record<string, { y: number; height: number }>
  >({});
  const highlightY = useAnimatedValue(0);
  const placed = useRef(false);
  const activeY = frames[currentRouteName]?.y;
  const activeHeight = frames[currentRouteName]?.height ?? theme.sizes.touch;

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
              <GroupLabel
                key={`g-${group.label}`}
                variant="meta"
                weight="medium"
                tone="onBrandMuted"
                accessibilityRole="header"
              >
                {group.label}
              </GroupLabel>
            ) : (
              <Separator key={`sep-${gi}`} />
            ),
          ].concat(
            group.items.map(([route, icon]) => {
              const active = route === currentRouteName;
              // desativado pelo aviso remoto: a tela explica o motivo
              const off = disabledRoutes.has(route);
              return (
                <Item
                  key={route}
                  onLayout={onItemLayout(route)}
                  onPress={() => navigation.navigate(route)}
                  accessibilityRole="menuitem"
                  accessibilityLabel={off ? `${route}, indisponível` : route}
                  accessibilityState={{ selected: active }}
                  style={({ pressed }) =>
                    pressed && !active && { backgroundColor: c.brandRule }
                  }
                >
                  <Icon
                    name={icon}
                    filled={active}
                    color={active ? c.onBrandSelected : c.onBrandMuted}
                  />
                  <ItemLabel
                    variant="body"
                    weight={active ? 'semibold' : 'regular'}
                    color={active ? c.onBrandSelected : c.onBrand}
                    numberOfLines={2}
                  >
                    {route}
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
      <ThemePreferenceSheet
        visible={themeSheetOpen}
        onClose={() => setThemeSheetOpen(false)}
      />
    </Container>
  );
};
