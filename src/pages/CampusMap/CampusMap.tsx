import React, { useCallback, useState } from 'react';
import { FlatList, Keyboard, Linking, StyleSheet, View } from 'react-native';
import {
  useFocusEffect,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from 'styled-components/native';
import {
  BottomSheet,
  Button,
  ChipGroup,
  FilterChip,
  IconButton,
  ListRow,
  SegmentedControl,
  Text,
  TextField,
  snackbar,
} from '@components/ui';
import { ScreenPanel } from '@templates/ScreenPanel';
import { useAppServices } from '@root/app/providers/AppServicesProvider';
import { useBackHandler } from '@root/hooks/useBackHandler';
import { floorLabel } from '@root/modules/campus-map/domain/parseLocation';
import type {
  Floor,
  Place,
  RoomLocation,
  Source,
} from '@root/modules/campus-map/domain/types';
import type { RootDrawerParamList } from '@root/routes';
import { CampusCanvas } from './CampusCanvas';

const categories = [
  ['predios', 'Prédios'],
  ['bibliotecas', 'Bibliotecas'],
  ['alimentacao', 'RU'],
  ['portoes', 'Portões'],
  ['servicos', 'Atendimento'],
  ['transporte', 'Transporte'],
  ['cultura', 'Cultura'],
] as const;
const sources: Source[] = [
  {
    title: 'UERJ · mapa do campus',
    url: 'https://www.prefeitura.uerj.br/campus-maracana',
  },
  {
    title: 'UERJ/DAENG · planta do 9º andar do D (2024)',
    url: 'https://pncp.gov.br/pncp-api/v1/orgaos/42498600000171/compras/2024/8397/arquivos/8',
  },
  {
    title: 'Prefeitura do Rio / IPP · Data.Rio',
    url: 'https://www.arcgis.com/home/item.html?id=124f1607b57d4292af5c0dfc2ff8572c',
  },
  {
    title: 'Licença CC BY 4.0 · geometrias do IPP',
    url: 'https://creativecommons.org/licenses/by/4.0/deed.pt-br',
  },
  {
    title: '© contribuidores do OpenStreetMap · ODbL',
    url: 'https://www.openstreetmap.org/copyright',
  },
];

function openLink(url: string) {
  void Linking.openURL(url).catch(() =>
    snackbar.error('Não foi possível abrir o link.'),
  );
}

export function CampusMapPage() {
  const route = useRoute<RouteProp<RootDrawerParamList, 'Mapa'>>();
  const [visit, setVisit] = useState(0);
  // Reopening the same classroom from Home must honor the requested location,
  // even if the student explored another block on the previous visit.
  useFocusEffect(
    useCallback(() => {
      setVisit(value => value + 1);
    }, []),
  );
  return (
    <MapScreen
      key={`${route.params?.location ?? 'campus'}-${visit}`}
      initialLocation={route.params?.location}
    />
  );
}

export function MapScreen({ initialLocation }: { initialLocation?: string }) {
  const { campusMap } = useAppServices();
  const atlas = campusMap.atlas;
  const theme = useTheme(),
    c = theme.colors;
  const insets = useSafeAreaInsets();
  const initial = campusMap.locate(initialLocation ?? '');
  const [destination, setDestination] = useState<RoomLocation | undefined>(
    initial.kind === 'room' ? initial : undefined,
  );
  const [place, setPlace] = useState<Place>();
  const [query, setQuery] = useState(
    initial.kind === 'room' ? '' : (initialLocation ?? ''),
  );
  const [searching, setSearching] = useState(
    Boolean(initialLocation && initial.kind !== 'room'),
  );
  const [category, setCategory] = useState<string>();
  const [sheet, setSheet] = useState<
    'blocks' | 'floors' | 'directions' | 'sources' | null
  >(null);
  const [view, setView] = useState<'campus' | 'floor'>('campus');
  const [entrance, setEntrance] = useState<'metro' | 'sfx'>('metro');
  const [floor, setFloor] = useState<Floor | undefined>(
    initial.kind === 'room' ? initial.floor : undefined,
  );
  const parsed = campusMap.locate(query);
  const block = destination?.block ?? place?.block;
  const pavilion =
    destination?.building === 'pjlf' || place?.building === 'pjlf';
  const activePlace =
    place ??
    (destination
      ? atlas.places.find(
          p =>
            p.id ===
            (block ? `bloco-${block.toLowerCase()}` : destination.building),
        )
      : undefined);
  const roomPlan = destination ? campusMap.roomPlan(destination) : undefined;
  const matches = campusMap.search(query, category);
  const selected = Boolean(destination || place);
  const label =
    place?.name ??
    (destination
      ? `Sala ${destination.code}${block ? ` ${block}` : ''}`
      : 'Campus Maracanã');
  const detail = destination
    ? [
        floorLabel(destination.floor),
        block
          ? `Bloco ${block}`
          : destination.building === 'haroldinho'
            ? 'Haroldinho'
            : 'Escolha o bloco',
        ...(place ? [`Sala ${destination.code}`] : []),
      ].join(' · ')
    : floor
      ? floorLabel(floor)
      : place?.subtitle;
  const floors = atlas.blocks.find(b => b.id === (block ?? 'F'))?.floors ?? [];
  const orientation =
    destination || place
      ? campusMap.orientation((destination ?? place)!, entrance)
      : undefined;

  function reset() {
    Keyboard.dismiss();
    setDestination(undefined);
    setPlace(undefined);
    setFloor(undefined);
    setQuery('');
    setCategory(undefined);
    setSearching(false);
    setView('campus');
  }
  function selectPlace(next: Place) {
    Keyboard.dismiss();
    setSearching(false);
    setCategory(undefined);
    setQuery('');
    setView('campus');
    setPlace(next);
    setFloor(next.floor);
    setDestination(
      next.room &&
        next.floor &&
        (next.building === 'pjlf' || next.building === 'haroldinho')
        ? {
            kind: 'room',
            building: next.building,
            code: next.room,
            block: next.block,
            floor: next.floor,
          }
        : undefined,
    );
  }
  function selectRoom(next: RoomLocation) {
    Keyboard.dismiss();
    setSearching(false);
    setCategory(undefined);
    setQuery('');
    setPlace(undefined);
    setDestination(next);
    setFloor(next.floor);
    setView('campus');
  }
  function selectBlock(letter: string, nextView = view) {
    const next = atlas.places.find(
      p => p.id === `bloco-${letter.toLowerCase()}`,
    )!;
    if (destination && (!destination.block || destination.block === letter)) {
      selectRoom({ ...destination, block: next.block });
    } else {
      selectPlace({ ...next, floor });
    }
    setView(nextView);
    setSheet(null);
  }
  function openDirections() {
    if (!pavilion && !orientation && activePlace) {
      openLink(
        `https://www.google.com/maps/dir/?api=1&destination=${activePlace.coordinate.join(',')}&travelmode=walking`,
      );
    } else {
      setSheet(pavilion && !block && destination ? 'blocks' : 'directions');
    }
  }
  useBackHandler(() => {
    if (searching) {
      Keyboard.dismiss();
      setSearching(false);
      setQuery('');
      setCategory(undefined);
    } else reset();
  }, searching || selected);

  const message =
    parsed.kind === 'invalid'
      ? parsed.message
      : parsed.kind === 'virtual'
        ? 'Aula virtual · não há local físico.'
        : parsed.kind === 'empty' && query
          ? 'O local da aula não foi informado.'
          : 'Nenhum lugar encontrado. Tente o nome ou a sala com o bloco.';

  return (
    <ScreenPanel scroll={false} padded={false} testID="campus-map-screen">
      <View
        style={[
          styles.search,
          {
            paddingTop: theme.layout.panelPaddingTop,
            paddingHorizontal: theme.layout.gutter,
          },
        ]}
      >
        {view !== 'floor' || searching ? (
          <View style={styles.row}>
            {searching ? (
              <IconButton
                icon="arrow_back"
                accessibilityLabel="Voltar ao mapa"
                onPress={() => {
                  Keyboard.dismiss();
                  setSearching(false);
                  setQuery('');
                  setCategory(undefined);
                }}
              />
            ) : null}
            <TextField
              containerStyle={styles.grow}
              leadingIcon="search"
              placeholder="Sala ou lugar"
              accessibilityLabel="Buscar sala ou lugar"
              value={query}
              clearable
              autoCorrect={false}
              returnKeyType="search"
              onFocus={() => setSearching(true)}
              onChangeText={text => {
                setQuery(text);
                setSearching(true);
                setCategory(undefined);
              }}
              onSubmitEditing={() => {
                if (parsed.kind === 'room') selectRoom(parsed);
                else if (matches.length === 1) selectPlace(matches[0]);
                else Keyboard.dismiss();
              }}
            />
          </View>
        ) : null}
        {!selected || searching ? (
          <ChipGroup layout="scroll">
            {categories.map(([id, name]) => (
              <FilterChip
                key={id}
                label={name}
                selected={category === id}
                onPress={() => {
                  setQuery('');
                  setCategory(category === id ? undefined : id);
                  setSearching(true);
                  Keyboard.dismiss();
                }}
              />
            ))}
          </ChipGroup>
        ) : null}
        {pavilion && !searching ? (
          <>
            <SegmentedControl
              accessibilityLabel="Vista do mapa"
              options={[
                { value: 'campus', label: 'Campus' },
                { value: 'floor', label: 'Andar' },
              ]}
              value={view}
              onChange={setView}
            />
            {view === 'floor' ? (
              <View style={styles.row}>
                <Button
                  label={block ? `Bloco ${block}` : 'Bloco'}
                  accessibilityLabel="Escolher bloco"
                  icon="expand_more"
                  iconPosition="end"
                  variant="outline"
                  size="sm"
                  style={styles.floorControl}
                  onPress={() => setSheet('blocks')}
                />
                <Button
                  label={floor ? floorLabel(floor) : 'Andar'}
                  accessibilityLabel="Escolher andar"
                  icon="expand_more"
                  iconPosition="end"
                  variant="outline"
                  size="sm"
                  style={styles.floorControl}
                  onPress={() => setSheet('floors')}
                />
              </View>
            ) : null}
          </>
        ) : null}
      </View>
      {searching ? (
        <FlatList
          data={matches}
          keyExtractor={p => p.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          ListHeaderComponent={
            parsed.kind === 'room' && !category ? (
              <ListRow
                title={`Sala ${parsed.code}${parsed.block ? ` ${parsed.block}` : ''}`}
                subtitle={`${floorLabel(parsed.floor)} · ${parsed.building === 'haroldinho' ? 'Haroldinho' : parsed.block ? `Bloco ${parsed.block}` : 'Selecione o bloco'}`}
                leadingIcon="location_on"
                chevron
                onPress={() => selectRoom(parsed)}
                testID="room-result"
              />
            ) : undefined
          }
          ListEmptyComponent={
            parsed.kind !== 'room' ? (
              <View style={styles.empty}>
                <Text
                  variant="body"
                  tone="muted"
                  accessibilityLiveRegion="polite"
                >
                  {message}
                </Text>
              </View>
            ) : undefined
          }
          renderItem={({ item }) => (
            <ListRow
              title={item.name}
              subtitle={item.subtitle || undefined}
              leadingIcon={
                item.category === 'bibliotecas' ? 'menu_book' : 'location_on'
              }
              chevron
              onPress={() => selectPlace(item)}
            />
          )}
        />
      ) : (
        <>
          <CampusCanvas
            key={`${view}-${activePlace?.id ?? 'campus'}-${block ?? ''}-${floor ?? ''}-${destination?.code ?? ''}-${entrance}`}
            atlas={atlas}
            place={activePlace}
            block={block}
            floor={floor}
            room={roomPlan}
            pavilion={pavilion}
            view={view}
            destination={destination}
            orientation={orientation}
            onSelect={next => {
              if (next.block && !next.floor) selectBlock(next.block);
              else if (next.id !== 'pjlf' || !destination) selectPlace(next);
            }}
          />
          <View
            style={[
              styles.details,
              {
                paddingBottom: Math.max(12, insets.bottom + 8),
                borderTopColor: c.rule,
                backgroundColor: c.surface,
              },
            ]}
          >
            <View style={styles.row}>
              <View style={styles.grow}>
                <Text
                  variant="titleS"
                  accessibilityRole="header"
                  numberOfLines={2}
                >
                  {label}
                </Text>
                {detail ? (
                  <Text variant="meta" tone="muted">
                    {detail}
                  </Text>
                ) : (
                  <Text variant="meta" tone="muted">
                    Rua São Francisco Xavier, 524
                  </Text>
                )}
              </View>
              {selected && view === 'floor' ? (
                <Button
                  label="Trajeto"
                  accessibilityLabel="Como chegar"
                  size="sm"
                  style={styles.routeAction}
                  onPress={openDirections}
                />
              ) : selected ? (
                <IconButton
                  icon="close"
                  accessibilityLabel="Ver campus inteiro"
                  onPress={reset}
                />
              ) : (
                <IconButton
                  icon="info"
                  accessibilityLabel="Fontes e precisão do mapa"
                  onPress={() => setSheet('sources')}
                />
              )}
            </View>
            {selected && view !== 'floor' ? (
              <View style={styles.row}>
                <Button
                  label={
                    pavilion && !block && destination
                      ? 'Escolher bloco'
                      : 'Como chegar'
                  }
                  icon={
                    pavilion || orientation ? 'arrow_forward' : 'open_in_new'
                  }
                  iconPosition="end"
                  style={styles.grow}
                  onPress={openDirections}
                />
                <IconButton
                  icon="info"
                  accessibilityLabel="Fontes e precisão do mapa"
                  onPress={() => setSheet('sources')}
                />
              </View>
            ) : null}
            <Text variant="caption" tone="muted">
              {view === 'floor'
                ? orientation?.room?.certainty === 'official'
                  ? 'Planta DAENG · 2024'
                  : orientation?.room?.certainty === 'zone'
                    ? 'Área da biblioteca'
                    : 'Posição pela numeração'
                : 'IPP / Data.Rio · © OpenStreetMap'}
            </Text>
          </View>
        </>
      )}
      <BottomSheet
        visible={sheet === 'blocks'}
        title="Escolher bloco"
        onClose={() => setSheet(null)}
      >
        {atlas.blocks
          .slice()
          .sort((a, b) => a.id.localeCompare(b.id))
          .filter(b => floor !== 'SE' || b.id === 'F')
          .map(b => (
            <ListRow
              key={b.id}
              title={`Bloco ${b.id}`}
              accessibilityLabel={`Selecionar Bloco ${b.id}`}
              subtitle={
                b.id === 'C'
                  ? 'Hall dos elevadores'
                  : b.id === 'F'
                    ? 'Ao longo da Rua São Francisco Xavier'
                    : undefined
              }
              highlighted={block === b.id}
              onPress={() => selectBlock(b.id)}
            />
          ))}
      </BottomSheet>
      <BottomSheet
        visible={sheet === 'directions'}
        title="Como chegar"
        onClose={() => setSheet(null)}
        footer={
          pavilion ? (
            <Button
              label="Ver andar"
              onPress={() => {
                setSheet(null);
                setView('floor');
              }}
            />
          ) : activePlace ? (
            <Button
              label="Abrir trajeto externo"
              icon="open_in_new"
              onPress={() =>
                openLink(
                  `https://www.google.com/maps/dir/?api=1&destination=${activePlace.coordinate.join(',')}&travelmode=walking`,
                )
              }
            />
          ) : undefined
        }
      >
        <View style={styles.directions}>
          <View style={styles.destination}>
            <Text variant="headline">{label}</Text>
            {detail ? (
              <Text variant="meta" tone="muted">
                {detail}
              </Text>
            ) : null}
          </View>
          {pavilion ? (
            <SegmentedControl
              accessibilityLabel="Entrada no campus"
              options={[
                { value: 'metro', label: 'Portão 1' },
                { value: 'sfx', label: 'Portão 5' },
              ]}
              value={entrance}
              onChange={setEntrance}
            />
          ) : null}
          {orientation?.steps.map((step, index) => (
            <View key={`${entrance}-${index}`} style={styles.step}>
              <Text
                variant="headline"
                color={c.accent}
                style={styles.stepNumber}
                accessibilityLabel={`Passo ${index + 1}`}
              >
                {index + 1}
              </Text>
              <View style={[styles.grow, styles.destination]}>
                <Text weight="semibold">{step.title}</Text>
                {step.detail ? (
                  <Text variant="callout" tone="muted">
                    {step.detail}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
          {!orientation && activePlace ? (
            <Text>
              {activePlace.subtitle ||
                'Veja o trajeto a pé até este lugar no mapa externo.'}
            </Text>
          ) : null}
          {orientation?.confidence ? (
            <Text variant="caption" tone="muted">
              {orientation.confidence}
            </Text>
          ) : null}
        </View>
      </BottomSheet>
      <BottomSheet
        visible={sheet === 'floors'}
        title="Escolher andar"
        onClose={() => setSheet(null)}
      >
        {floors.map(f => (
          <ListRow
            key={f}
            title={floorLabel(f)}
            highlighted={floor === f}
            trailing={
              floor === f ? <Text color={c.accent}>Atual</Text> : undefined
            }
            onPress={() => {
              setFloor(f);
              setDestination(undefined);
              setPlace({
                ...atlas.places.find(
                  p =>
                    p.id === (block ? `bloco-${block.toLowerCase()}` : 'pjlf'),
                )!,
                floor: f,
              });
              setSheet(null);
            }}
          />
        ))}
      </BottomSheet>
      <BottomSheet
        visible={sheet === 'sources'}
        title="Sobre este mapa"
        onClose={() => setSheet(null)}
      >
        <View style={styles.about}>
          <Text>
            Mapa salvo no app · {atlas.version.split('-').reverse().join('/')}
          </Text>
          <Text tone="muted">
            Contornos e proporções seguem as medidas do IPP. O trecho do 9º
            andar do Bloco D segue a planta DAENG de 2024.
          </Text>
          <Text tone="muted">
            Nos demais andares, a posição das salas é calculada pela numeração.
            Essas divisões aparecem tracejadas; a sinalização local prevalece.
          </Text>
          <Text variant="caption" tone="muted">
            Geometrias do IPP adaptadas; dados do OpenStreetMap transformados
            para a vista do campus. Fontes históricas não confirmam alterações
            posteriores.
          </Text>
        </View>
        {[
          ...new Map(
            [...(activePlace?.sources ?? []).slice(0, 3), ...sources].map(s => [
              s.url,
              s,
            ]),
          ).values(),
        ].map(s => (
          <ListRow
            key={s.url}
            title={s.title}
            external
            onPress={() => openLink(s.url)}
          />
        ))}
      </BottomSheet>
    </ScreenPanel>
  );
}

const styles = StyleSheet.create({
  search: { gap: 8, paddingBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  grow: { flex: 1, minWidth: 0 },
  floorControl: { flex: 1, minWidth: 0, paddingHorizontal: 8 },
  routeAction: { minWidth: 88, paddingHorizontal: 8 },
  details: { paddingHorizontal: 16, paddingTop: 12, gap: 8, borderTopWidth: 1 },
  directions: { paddingTop: 8, gap: 20 },
  destination: { gap: 4 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepNumber: { minWidth: 24 },
  empty: { padding: 24 },
  about: { padding: 20, gap: 12 },
});
