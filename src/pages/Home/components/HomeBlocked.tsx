import React from 'react';
import { useNavigation } from '@react-navigation/native';

import {
  BlockedState,
  IconTile,
  List,
  ListRow,
  Section,
  type IconName,
} from '@components/ui';
import { useAppServices } from '@root/app/providers/AppServicesProvider';
import { useDisabledRoutes } from '@root/modules/delivery/presentation/FeatureGate';

type Shortcut = {
  route: 'Emissão de Documentos' | 'Mapa' | 'Agora no campus';
  icon: IconName;
  title: string;
};

/**
 * O que não depende das consultas fechadas: os documentos seguem liberados no
 * portal durante a inscrição, e o mapa e os avisos do campus nem passam por
 * ele.
 */
const SHORTCUTS: readonly Shortcut[] = [
  { route: 'Emissão de Documentos', icon: 'description', title: 'Documentos' },
  { route: 'Mapa', icon: 'location_on', title: 'Mapa do campus' },
  { route: 'Agora no campus', icon: 'campaign', title: 'Agora no campus' },
];

type Props = {
  /** "Tentar novamente": pergunta ao portal se já liberou. */
  onRetry: () => void;
};

/**
 * Início com o Aluno Online bloqueado e nada salvo para mostrar: o motivo em
 * poucas palavras e, logo abaixo, o que continua funcionando, para a tela não
 * virar um beco sem saída nos dias da inscrição.
 */
export function HomeBlocked({ onRetry }: Props) {
  const navigation = useNavigation();
  const { campusNow } = useAppServices();
  const disabled = useDisabledRoutes();
  const shortcuts = SHORTCUTS.filter(
    ({ route }) =>
      !disabled.has(route) &&
      (route !== 'Agora no campus' || campusNow.supported),
  );
  return (
    <>
      <BlockedState onRetry={onRetry} />
      {shortcuts.length ? (
        <Section title="Continua funcionando" first>
          <List>
            {shortcuts.map(({ route, icon, title }) => (
              <ListRow
                key={route}
                title={title}
                leading={<IconTile icon={icon} />}
                chevron
                accessibilityRole="button"
                onPress={() => navigation.navigate(route)}
              />
            ))}
          </List>
        </Section>
      ) : null}
    </>
  );
}
