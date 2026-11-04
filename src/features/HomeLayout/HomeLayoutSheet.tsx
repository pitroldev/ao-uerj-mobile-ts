import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import styled from 'styled-components/native';

import {
  BottomSheet,
  Button,
  ChipGroup,
  FilterChip,
  IconButton,
  IconTile,
  List,
  ListRow,
  SegmentedControl,
  Switch,
  Text,
} from '@components/ui';
import {
  EVALUATION_LIMITS,
  GREETING_STYLES,
  isDefaultLayout,
  isSectionVisible,
  moveSection,
  setSectionVisible,
  type HomeLayout,
  type HomeSectionId,
} from '@root/modules/home/domain/homeLayout';
import {
  DENSITY_TEXT,
  GREETING_TEXT,
  limitText,
  SECTION_TEXT,
} from '@root/modules/home/presentation/homeLayoutText';

const Lede = styled(Text)`
  margin-top: ${({ theme }) => theme.spacing.xs}px;
`;

const Group = styled.View`
  margin-top: ${({ theme }) => theme.spacing.xxl}px;
`;

const Label = styled(Text)`
  margin-bottom: ${({ theme }) => theme.spacing.sm}px;
`;

const Help = styled(Text)`
  margin-top: ${({ theme }) => theme.spacing.sm}px;
`;

const Below = styled.View`
  margin-top: ${({ theme }) => theme.spacing.lg}px;
`;

const Controls = styled.View`
  flex-direction: row;
  align-items: center;
`;

/** Quanto tempo a linha movida fica destacada. */
const MOVED_MS = 900;

type Props = {
  visible: boolean;
  onClose: () => void;
  layout: HomeLayout;
  /** As seções que este aparelho tem (sem a sessão de aluno, sem a Companhia). */
  available: readonly HomeSectionId[];
  onChange: (update: (current: HomeLayout) => HomeLayout) => void;
  onReset: () => void;
};

/**
 * Personalizar o Início: quais seções aparecem e em que ordem, a saudação, a
 * densidade e os detalhes de cada seção. Cada toque vale na hora, só neste
 * aparelho; "Restaurar" volta ao Início de sempre.
 */
export function HomeLayoutSheet({
  visible,
  onClose,
  layout,
  available,
  onChange,
  onReset,
}: Props) {
  const [moved, setMoved] = useState<HomeSectionId | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const listed = layout.order.filter(id => available.includes(id));
  const shown = listed.filter(id => isSectionVisible(layout, id)).length;

  const move = (id: HomeSectionId, delta: -1 | 1) => {
    const next = moveSection(layout, id, delta, available);
    const position = next.order
      .filter(item => available.includes(item))
      .indexOf(id);
    onChange(current => moveSection(current, id, delta, available));
    setMoved(id);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMoved(null), MOVED_MS);
    AccessibilityInfo.announceForAccessibility(
      `${SECTION_TEXT[id].title}: posição ${position + 1} de ${listed.length}`,
    );
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Personalizar o Início"
      footer={[
        <Button
          key="reset"
          variant="outline"
          icon="restart_alt"
          label="Restaurar"
          accessibilityLabel="Restaurar o Início de sempre"
          disabled={isDefaultLayout(layout)}
          onPress={onReset}
        />,
        <Button key="done" label="Pronto" onPress={onClose} />,
      ]}
    >
      <Lede tone="muted">
        Escolha o que aparece no Início e em que ordem. Vale na hora, só neste
        aparelho.
      </Lede>

      <Group>
        <Label variant="meta" weight="medium">
          Seções · {shown} de {listed.length} no Início
        </Label>
        <List>
          {listed.map((id, index) => {
            const text = SECTION_TEXT[id];
            const on = isSectionVisible(layout, id);
            return (
              <ListRow
                key={id}
                leading={
                  <IconTile icon={text.icon} tone={on ? 'accent' : 'muted'} />
                }
                title={text.title}
                meta={on ? text.description : 'Escondida'}
                highlighted={moved === id}
                accessibilityRole="switch"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${text.title}, posição ${index + 1} de ${listed.length}`}
                accessibilityHint={
                  on ? 'Toque para esconder' : 'Toque para mostrar'
                }
                onPress={() =>
                  onChange(current => setSectionVisible(current, id, !on))
                }
                trailing={
                  <Controls>
                    <Switch value={on} />
                    <IconButton
                      icon="arrow_upward"
                      accessibilityLabel={`Subir ${text.title}`}
                      disabled={index === 0}
                      onPress={() => move(id, -1)}
                    />
                    <IconButton
                      icon="arrow_downward"
                      accessibilityLabel={`Descer ${text.title}`}
                      disabled={index === listed.length - 1}
                      onPress={() => move(id, 1)}
                    />
                  </Controls>
                }
              />
            );
          })}
        </List>
        <Help variant="meta" tone="muted">
          As setas mudam a ordem; o toque na linha mostra ou esconde.
        </Help>
      </Group>

      <Group>
        <Label variant="meta" weight="medium">
          Saudação
        </Label>
        <SegmentedControl
          accessibilityLabel="Saudação"
          options={GREETING_STYLES.map(value => ({
            value,
            label: GREETING_TEXT[value],
          }))}
          value={layout.greeting}
          onChange={greeting => onChange(current => ({ ...current, greeting }))}
        />
      </Group>

      <Group>
        <Label variant="meta" weight="medium">
          Espaçamento
        </Label>
        <SegmentedControl
          accessibilityLabel="Espaçamento"
          options={(['comfortable', 'compact'] as const).map(value => ({
            value,
            label: DENSITY_TEXT[value],
          }))}
          value={layout.density}
          onChange={density => onChange(current => ({ ...current, density }))}
        />
        <Help variant="meta" tone="muted">
          Compacto deixa as seções mais juntas: cabe mais coisa na tela.
        </Help>
      </Group>

      <Group>
        <Label variant="meta" weight="medium">
          Detalhes
        </Label>
        <List>
          <ListRow
            title="Botão “Ver no mapa” na próxima aula"
            titleWeight="regular"
            trailing={<Switch value={layout.nextClassMap} />}
            accessibilityRole="switch"
            accessibilityState={{ checked: layout.nextClassMap }}
            onPress={() =>
              onChange(current => ({
                ...current,
                nextClassMap: !current.nextClassMap,
              }))
            }
          />
        </List>
        <Below>
          <Label variant="meta" tone="muted">
            Próximas avaliações: mostrar até
          </Label>
          <ChipGroup accessibilityLabel="Avaliações mostradas no Início">
            {EVALUATION_LIMITS.map(limit => (
              <FilterChip
                key={limit}
                label={limitText(limit)}
                selected={layout.evaluationLimit === limit}
                onPress={() =>
                  onChange(current => ({ ...current, evaluationLimit: limit }))
                }
              />
            ))}
          </ChipGroup>
        </Below>
      </Group>
    </BottomSheet>
  );
}
