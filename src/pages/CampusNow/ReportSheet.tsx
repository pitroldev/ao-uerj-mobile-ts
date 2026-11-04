import React, { useState } from 'react';
import { Pressable } from 'react-native';
import styled, { useTheme } from 'styled-components/native';

import {
  BottomSheet,
  Button,
  ChipGroup,
  FilterChip,
  Icon,
  List,
  ListRow,
  Notice,
  Radio,
  Text,
  TextField,
  snackbar,
} from '@components/ui';
import {
  floorsOf,
  isLive,
  NOTICE_BLOCKS,
  NOTICE_GATES,
  NOTICE_KINDS,
  placeKey,
  placeTypeOf,
  STATUSES_BY_KIND,
  type CampusNotice,
  type NoticeBlock,
  type NoticeKind,
  type NoticePlace,
  type NoticeRequest,
  type NoticeResult,
  type NoticeStatus,
  type PlaceType,
} from '@root/modules/campus-now/domain/campusNow';
import {
  suggestedPlace,
  type ClassSpot,
} from '@root/modules/campus-now/domain/nearby';
import { pointsToNext } from '@root/modules/campus-now/domain/progress';
import {
  campusNowErrorMessage,
  floorText,
  GATE_TEXT,
  KIND_TEXT,
  levelName,
  levelText,
  minuteText,
  optionText,
  placeText,
  pointsText,
} from '@root/modules/campus-now/presentation/campusNowText';

const Lead = styled(Text)`
  margin-top: ${({ theme }) => theme.spacing.xxs}px;
`;

const Grid = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm + 2}px;
  margin-top: ${({ theme }) => theme.spacing.lg}px;
`;

const Tile = styled(Pressable)`
  flex-basis: 30%;
  flex-grow: 1;
  min-height: 96px;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.sm}px;
  padding: ${({ theme }) => theme.spacing.sm}px
    ${({ theme }) => theme.spacing.xs}px;
  border-width: ${({ theme }) => theme.borders.hairline}px;
  border-color: ${({ theme }) => theme.colors.rule};
  border-radius: ${({ theme }) => theme.radii.xl}px;
  border-top-right-radius: ${({ theme }) => theme.radii.xs}px;
  background-color: ${({ theme }) => theme.colors.surfaceMuted};
`;

const Options = styled.View`
  gap: ${({ theme }) => theme.spacing.sm}px;
  margin-top: ${({ theme }) => theme.spacing.lg}px;
`;

const Option = styled(Pressable)`
  flex-direction: row;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md}px;
  min-height: 56px;
  padding: ${({ theme }) => theme.spacing.sm}px
    ${({ theme }) => theme.spacing.lg}px;
  border-width: ${({ theme }) => theme.borders.hairline}px;
  border-color: ${({ theme }) => theme.colors.ruleStrong};
  border-radius: ${({ theme }) => theme.radii.xl}px;
  border-top-right-radius: 0px;
  background-color: ${({ theme }) => theme.colors.surface};
`;

const OptionText = styled.View`
  flex: 1;
`;

const Where = styled.View`
  flex-direction: row;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.sm + 2}px;
  margin-top: ${({ theme }) => theme.spacing.lg}px;
  padding: ${({ theme }) => theme.spacing.md}px
    ${({ theme }) => theme.spacing.md + 2}px;
  border-width: ${({ theme }) => theme.borders.hairline}px;
  border-color: ${({ theme }) => theme.colors.rule};
  border-radius: ${({ theme }) => theme.radii.lg}px;
  background-color: ${({ theme }) => theme.colors.surfaceMuted};
`;

const WhereBody = styled.View`
  flex: 1;
  gap: ${({ theme }) => theme.spacing.xxs}px;
`;

const WhereAction = styled.View`
  align-items: flex-start;
  margin-left: -${({ theme }) => theme.spacing.md}px;
  margin-bottom: -${({ theme }) => theme.spacing.sm}px;
`;

const Help = styled(Text)`
  margin-top: ${({ theme }) => theme.spacing.lg}px;
`;

const Label = styled(Text)`
  margin-top: ${({ theme }) => theme.spacing.lg}px;
  margin-bottom: ${({ theme }) => theme.spacing.sm}px;
`;

const Gap = styled.View`
  height: ${({ theme }) => theme.spacing.md}px;
`;

const Done = styled.View`
  align-items: center;
  padding-top: ${({ theme }) => theme.spacing.md}px;
`;

const Burst = styled.View`
  width: 72px;
  height: 72px;
  border-radius: 36px;
  align-items: center;
  justify-content: center;
  margin-bottom: ${({ theme }) => theme.spacing.lg}px;
  background-color: ${({ theme }) => theme.status.good.bg};
`;

const Pill = styled.View`
  flex-direction: row;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs + 2}px;
  margin-top: ${({ theme }) => theme.spacing.lg}px;
  min-height: 32px;
  padding: ${({ theme }) => theme.spacing.xs}px
    ${({ theme }) => theme.spacing.md + 2}px;
  border-radius: 16px;
  background-color: ${({ theme }) => theme.colors.accentSoft};
`;

const Centered = styled(Text)`
  margin-top: ${({ theme }) => theme.spacing.sm}px;
  max-width: 320px;
`;

type Step =
  | { name: 'kind' }
  | { name: 'status'; kind: NoticeKind }
  | {
      name: 'place';
      kind: NoticeKind;
      /** A situação escolhida que esperava o lugar (o portão, a sala). */
      status: NoticeStatus | null;
      type: PlaceType;
    }
  | {
      name: 'done';
      result: NoticeResult;
      /** O nível antes de avisar (para "você subiu"). */
      before: number | null;
    };

/** Um andar escolhido à mão, ou o portão, ou a sala. */
type Chosen = Partial<Record<PlaceType, NoticePlace>>;

const ROOM = /^\d{3,5}$/;

/** O andar de uma sala pelo número (6019 → 6º; 12002 → 12º). */
function floorOfRoom(code: string): string | null {
  if (!ROOM.test(code)) return null;
  const floor = Number(code.slice(0, -3));
  return floor >= 1 && floor <= 12 ? String(floor) : null;
}

/** Por que o lugar veio assim. */
function whyText(
  place: NoticePlace,
  spot: ClassSpot | undefined,
  chosen: boolean,
): string {
  if (place.type === 'elevators')
    return 'Os 10 elevadores do Pavilhão ficam todos no hall do bloco C.';
  if (place.type === 'ru') return 'O bandejão fica no Centro Cultural.';
  if (chosen || !spot) return 'Escolhido por você.';
  return spot.live
    ? `Pela sua grade: sua aula de agora, na Sala ${spot.room} ${spot.block}.`
    : `Pela sua grade: sua aula das ${minuteText(spot.start)}, na Sala ${spot.room} ${spot.block}.`;
}

type Props = {
  visible: boolean;
  onClose: () => void;
  spots: readonly ClassSpot[];
  /** Os avisos de agora (o repetido vira confirmação). */
  notices: readonly CampusNotice[];
  now: number;
  onReport: (
    request: NoticeRequest,
  ) => Promise<NoticeResult & { before: number | null }>;
  /** "Ver no mapa" do fim: fecha e mostra o aviso na lista. */
  onSee: (notice: CampusNotice) => void;
};

/**
 * Avisar em dois toques: o que é e como está. O lugar já vem da grade (a
 * aula de agora ou a próxima) e só muda se o aluno quiser; elevador é
 * sempre o hall do C, e o bandejão, o RU. Se alguém já avisou a mesma coisa
 * no mesmo lugar, a situação aparece marcada e o toque vira a confirmação.
 */
export function ReportSheet({
  visible,
  onClose,
  spots,
  notices,
  now,
  onReport,
  onSee,
}: Props) {
  const theme = useTheme();
  const [step, setStep] = useState<Step>({ name: 'kind' });
  const [chosen, setChosen] = useState<Chosen>({});
  const [sending, setSending] = useState<NoticeStatus | null>(null);
  const spot = spots[0];

  const placeFor = (
    kind: NoticeKind,
    status: NoticeStatus,
  ): NoticePlace | null =>
    chosen[placeTypeOf(kind, status)] ?? suggestedPlace(kind, status, spots);

  const existing = (request: NoticeRequest) =>
    notices.find(
      notice =>
        isLive(notice, now) &&
        notice.kind === request.kind &&
        notice.status === request.status &&
        placeKey(notice.place) === placeKey(request.place),
    ) ?? null;

  const send = async (kind: NoticeKind, status: NoticeStatus) => {
    const place = placeFor(kind, status);
    if (!place) {
      setStep({
        name: 'place',
        kind,
        status,
        type: placeTypeOf(kind, status),
      });
      return;
    }
    setSending(status);
    try {
      const result = await onReport({ kind, status, place });
      setStep({ name: 'done', result, before: result.before });
    } catch (error) {
      snackbar.error(campusNowErrorMessage(error));
    } finally {
      setSending(null);
    }
  };

  const back = () => {
    if (step.name === 'place')
      setStep(
        step.status ? { name: 'status', kind: step.kind } : { name: 'kind' },
      );
    else setStep({ name: 'kind' });
  };

  let title = 'Avisar';
  let meta: string | undefined;
  let body: React.ReactNode;
  let footer: React.ReactNode;

  if (step.name === 'kind') {
    meta = 'Passo 1 de 2';
    body = (
      <>
        <Text variant="titleM" accessibilityRole="header">
          O que está acontecendo?
        </Text>
        <Lead variant="meta" tone="muted">
          {spot
            ? spot.live
              ? `Você está em aula na Sala ${spot.room} ${spot.block}: o lugar já vem daí.`
              : `Você deve estar a caminho da aula das ${minuteText(spot.start)}, na Sala ${spot.room} ${spot.block}: o lugar já vem daí.`
            : 'Escolha o tipo; o lugar vem em seguida.'}
        </Lead>
        <Grid>
          {NOTICE_KINDS.map(kind => (
            <Tile
              key={kind}
              onPress={() => setStep({ name: 'status', kind })}
              accessibilityRole="button"
              accessibilityLabel={KIND_TEXT[kind].label}
              style={({ pressed }) =>
                pressed
                  ? {
                      backgroundColor: theme.colors.accentSoft,
                      borderColor: theme.colors.accentLine,
                    }
                  : undefined
              }
            >
              <Icon
                name={KIND_TEXT[kind].icon}
                size={theme.sizes.icon.empty}
                color={theme.colors.accent}
              />
              <Text weight="semibold" align="center">
                {KIND_TEXT[kind].label}
              </Text>
            </Tile>
          ))}
        </Grid>
        <Help variant="meta" tone="muted">
          Seu aviso aparece como novo até mais alguém confirmar. Do nível 3 em
          diante, vale direto.
        </Help>
      </>
    );
    footer = <Button variant="outline" label="Cancelar" onPress={onClose} />;
  } else if (step.name === 'status') {
    const { kind } = step;
    const statuses = STATUSES_BY_KIND[kind];
    const types = [
      ...new Set(statuses.map(status => placeTypeOf(kind, status))),
    ];
    const shared = types.length === 1 ? types[0] : null;
    const sharedPlace = shared ? placeFor(kind, statuses[0]) : null;
    meta = `Passo 2 de 2 · ${KIND_TEXT[kind].label}`;
    body = (
      <>
        <Text variant="titleM" accessibilityRole="header">
          Como está?
        </Text>
        <Options>
          {statuses.map(status => {
            const place = placeFor(kind, status);
            const same = place ? existing({ kind, status, place }) : null;
            const waiting = sending === status;
            return (
              <Option
                key={status}
                disabled={sending !== null}
                onPress={() => {
                  void send(kind, status);
                }}
                accessibilityRole="button"
                accessibilityLabel={
                  same
                    ? `${optionText(kind, status)}: já avisado, confirmar`
                    : optionText(kind, status)
                }
                accessibilityState={{
                  busy: waiting,
                  disabled: sending !== null,
                }}
                style={({ pressed }) =>
                  pressed || same
                    ? {
                        backgroundColor: theme.colors.accentSoft,
                        borderColor: theme.colors.accentLine,
                      }
                    : undefined
                }
              >
                <Icon
                  name={waiting ? 'progress_activity' : KIND_TEXT[kind].icon}
                  size={theme.sizes.icon.xl}
                  color={theme.colors.accent}
                />
                <OptionText>
                  <Text variant="body" weight="semibold">
                    {optionText(kind, status)}
                  </Text>
                  {same ? (
                    <Text variant="meta" tone="accent">
                      {same.mine
                        ? 'Você já avisou isso'
                        : same.answer
                          ? 'Já avisado; você já respondeu'
                          : 'Já avisado: toque para confirmar'}
                    </Text>
                  ) : null}
                </OptionText>
              </Option>
            );
          })}
        </Options>
        {shared && shared !== 'elevators' && shared !== 'ru' ? (
          <Where>
            <Icon
              name="location_on"
              size={theme.sizes.icon.lg}
              color={theme.colors.accent}
            />
            <WhereBody>
              <Text weight="semibold">
                {sharedPlace ? placeText(sharedPlace) : 'Falta o lugar'}
              </Text>
              <Text variant="meta" tone="muted">
                {sharedPlace
                  ? whyText(sharedPlace, spot, Boolean(chosen[shared]))
                  : 'Sem aula por perto agora: escolha o bloco e o andar.'}
              </Text>
              <WhereAction>
                <Button
                  variant="text"
                  size="sm"
                  icon="swap_horiz"
                  label={sharedPlace ? 'Outro lugar' : 'Escolher o lugar'}
                  onPress={() =>
                    setStep({ name: 'place', kind, status: null, type: shared })
                  }
                />
              </WhereAction>
            </WhereBody>
          </Where>
        ) : sharedPlace ? (
          <Where>
            <Icon
              name="location_on"
              size={theme.sizes.icon.lg}
              color={theme.colors.accent}
            />
            <WhereBody>
              <Text weight="semibold">{placeText(sharedPlace)}</Text>
              <Text variant="meta" tone="muted">
                {whyText(sharedPlace, spot, false)}
              </Text>
            </WhereBody>
          </Where>
        ) : (
          <Help variant="meta" tone="muted">
            O portão você escolhe em seguida. A rampa e a sala vêm da sua grade,
            quando há aula por perto.
          </Help>
        )}
        <Help variant="meta" tone="muted">
          Sem foto e sem nome de ninguém. Crime e segurança não entram aqui:
          para isso, os canais oficiais da UERJ.
        </Help>
      </>
    );
    footer = (
      <Button
        variant="outline"
        icon="arrow_back"
        label="Voltar"
        disabled={sending !== null}
        onPress={back}
      />
    );
  } else if (step.name === 'place') {
    title = step.type === 'gate' ? 'Qual portão?' : 'Outro lugar';
    body = (
      <PlacePicker
        key={`${step.kind}-${step.type}`}
        type={step.type}
        initial={
          chosen[step.type] ??
          (step.status
            ? suggestedPlace(step.kind, step.status, spots)
            : suggestedPlace(
                step.kind,
                STATUSES_BY_KIND[step.kind].find(
                  status => placeTypeOf(step.kind, status) === step.type,
                ) ?? STATUSES_BY_KIND[step.kind][0],
                spots,
              ))
        }
        sending={sending !== null}
        confirmLabel={step.status ? 'Avisar aqui' : 'Usar este lugar'}
        onBack={back}
        onPick={place => {
          setChosen(current => ({ ...current, [step.type]: place }));
          if (step.status) {
            const status = step.status;
            const kind = step.kind;
            setSending(status);
            onReport({ kind, status, place })
              .then(result =>
                setStep({ name: 'done', result, before: result.before }),
              )
              .catch(error => snackbar.error(campusNowErrorMessage(error)))
              .finally(() => setSending(null));
          } else setStep({ name: 'status', kind: step.kind });
        }}
      />
    );
    footer = null;
  } else {
    const { result, before } = step;
    const { notice, you, merged, replaced } = result;
    const up = before !== null && you.level > before;
    const left = pointsToNext(you);
    title = 'Aviso enviado';
    body = (
      <Done accessibilityLiveRegion="polite">
        <Burst>
          <Icon
            name="check_circle"
            filled
            size={40}
            color={theme.status.good.ink}
          />
        </Burst>
        <Text variant="titleL" align="center" accessibilityRole="header">
          {merged ? 'Valeu por confirmar!' : 'Valeu por avisar!'}
        </Text>
        <Centered tone="muted" align="center">
          {merged
            ? notice.mine
              ? 'Você já tinha avisado isso: o aviso continua no mapa.'
              : 'Já tinham avisado isso: você confirmou o aviso, que ganha força para todo mundo.'
            : notice.confirmed
              ? 'Seu aviso já vale para todo mundo, pelo seu nível.'
              : 'Seu aviso já está no mapa como novo. Quando mais alguém confirmar, ele vale para todo mundo.'}
          {replaced ? ' A situação anterior no mesmo lugar saiu do mapa.' : ''}
        </Centered>
        <Pill>
          <Icon
            name="verified"
            size={theme.sizes.icon.sm}
            color={theme.colors.accent}
          />
          <Text weight="semibold" tone="accent" tabular>
            {you.earned
              ? `${pointsText(you.earned)} · ${levelText(you.level)}`
              : levelText(you.level)}
          </Text>
        </Pill>
        {up ? (
          <Centered weight="semibold" align="center">
            {`Você subiu para o nível ${you.level}: ${levelName(you.level)}!`}
          </Centered>
        ) : null}
        {left !== null ? (
          <Centered variant="meta" tone="muted" align="center" tabular>
            {`Faltam ${left} ${left === 1 ? 'ponto' : 'pontos'} para ${levelName(you.level + 1)}.`}
          </Centered>
        ) : null}
        {!you.earned && !merged ? (
          <Centered variant="meta" tone="muted" align="center">
            Os pontos de avisar valem para os 5 primeiros avisos do dia.
          </Centered>
        ) : null}
      </Done>
    );
    footer = [
      <Button
        key="again"
        variant="outline"
        label="Outro aviso"
        onPress={() => setStep({ name: 'kind' })}
      />,
      <Button key="see" label="Ver na lista" onPress={() => onSee(notice)} />,
    ];
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={title}
      meta={meta}
      footer={footer}
      swipeToClose={sending === null}
    >
      {body}
    </BottomSheet>
  );
}

/** O lugar escolhido à mão: o portão, o bloco e o andar, ou a sala. */
function PlacePicker({
  type,
  initial,
  sending,
  confirmLabel,
  onBack,
  onPick,
}: {
  type: PlaceType;
  initial: NoticePlace | null;
  sending: boolean;
  confirmLabel: string;
  onBack: () => void;
  onPick: (place: NoticePlace) => void;
}) {
  const [gate, setGate] = useState(
    initial?.type === 'gate' ? initial.gate : null,
  );
  const [block, setBlock] = useState<NoticeBlock | null>(
    initial && 'block' in initial ? initial.block : null,
  );
  const [floor, setFloor] = useState<string | null>(
    initial && 'floor' in initial ? initial.floor : null,
  );
  const [room, setRoom] = useState(
    initial?.type === 'room' ? initial.room : '',
  );

  let place: NoticePlace | null = null;
  if (type === 'gate' && gate) place = { type: 'gate', gate };
  if (type === 'floor' && block && floor && floorsOf(block).includes(floor))
    place = { type: 'floor', block, floor };
  const roomFloor = floorOfRoom(room.trim());
  if (type === 'room' && block && roomFloor)
    place = { type: 'room', block, floor: roomFloor, room: room.trim() };

  return (
    <>
      {type === 'gate' ? (
        <>
          <Text variant="meta" tone="muted">
            Os portões do Maracanã, como no Mapa.
          </Text>
          <Gap />
          <List>
            {NOTICE_GATES.map(id => (
              <ListRow
                key={id}
                title={GATE_TEXT[id].name}
                subtitle={GATE_TEXT[id].street}
                leading={<Radio selected={gate === id} />}
                accessibilityRole="radio"
                accessibilityState={{ checked: gate === id }}
                onPress={() => setGate(id)}
              />
            ))}
          </List>
        </>
      ) : (
        <>
          <Label variant="meta" weight="medium">
            Bloco
          </Label>
          <ChipGroup accessibilityLabel="Bloco">
            {NOTICE_BLOCKS.map(id => (
              <FilterChip
                key={id}
                label={id}
                selected={block === id}
                onPress={() => {
                  setBlock(id);
                  if (floor && !floorsOf(id).includes(floor)) setFloor(null);
                }}
                accessibilityLabel={`Bloco ${id}`}
              />
            ))}
          </ChipGroup>
          {type === 'floor' ? (
            <>
              <Label variant="meta" weight="medium">
                Andar
              </Label>
              <ChipGroup accessibilityLabel="Andar">
                {floorsOf(block ?? 'A').map(id => (
                  <FilterChip
                    key={id}
                    label={
                      id === 'T'
                        ? 'Térreo'
                        : id === 'SE'
                          ? 'Semienterrado'
                          : `${id}º`
                    }
                    selected={floor === id}
                    disabled={!block}
                    onPress={() => setFloor(id)}
                    accessibilityLabel={floorText(id)}
                  />
                ))}
              </ChipGroup>
            </>
          ) : (
            <>
              <Gap />
              <TextField
                label="Número da sala"
                placeholder="Ex.: 6019"
                keyboardType="number-pad"
                maxLength={5}
                value={room}
                onChangeText={value => setRoom(value.replace(/\D/g, ''))}
                error={
                  room.trim().length >= 4 && !roomFloor
                    ? 'O Pavilhão tem salas do 1º ao 12º andar.'
                    : undefined
                }
                helper="O número da sala diz o andar: 6019 fica no 6º."
              />
            </>
          )}
        </>
      )}
      {!place ? (
        <>
          <Gap />
          <Notice
            tone="neutral"
            icon="info"
            text={
              type === 'gate'
                ? 'Escolha o portão.'
                : type === 'room'
                  ? 'Escolha o bloco e digite o número da sala.'
                  : 'Escolha o bloco e o andar.'
            }
          />
        </>
      ) : null}
      <Gap />
      <Button
        label={confirmLabel}
        block
        disabled={!place || sending}
        loading={sending}
        loadingLabel="Enviando…"
        onPress={() => {
          if (place) onPick(place);
        }}
      />
      <Button
        variant="text"
        label="Voltar"
        block
        disabled={sending}
        onPress={onBack}
      />
    </>
  );
}
