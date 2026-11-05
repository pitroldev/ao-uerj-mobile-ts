import React, { useState } from 'react';
import { Keyboard } from 'react-native';
import styled from 'styled-components/native';

import {
  BottomSheet,
  Button,
  ChipGroup,
  FilterChip,
  Notice,
  NumberStepper,
  OptionList,
  Text,
  TextField,
  TimeField,
  snackbar,
} from '@components/ui';
import type { AttendedClassesSchedule } from '@root/modules/academics/domain/models';
import { useAppServices } from '@root/app/providers/AppServicesProvider';
import {
  CAPACITY,
  CompanionError,
  DESTINATION_IDS,
  hasContact,
  NOTE_MAX,
  similarCall,
  SPOTS_BY_KIND,
  type CallKind,
  type CompanionCall,
  type DestinationId,
  type MemberCall,
  type Membership,
  type SpotId,
} from '@root/modules/companion/domain/companion';
import {
  classAt,
  customTime,
  latestMinute,
  timeOptions,
  type FreeWindow,
} from '@root/modules/companion/domain/window';
import {
  callTitle,
  clockText,
  companionErrorMessage,
  DESTINATION_TEXT,
  goingText,
  KIND_TEXT,
  LIFETIME_TEXT,
  SPOT_TEXT,
} from '@root/modules/companion/presentation/companionText';
import { minuteText, windowText } from './WindowCard';

const Field = styled.View`
  margin-top: ${({ theme }) => theme.spacing.xl}px;
`;

const FirstField = styled.View`
  margin-top: ${({ theme }) => theme.spacing.xs}px;
`;

const Label = styled(Text)`
  margin-bottom: ${({ theme }) => theme.spacing.sm}px;
`;

const Help = styled(Text)`
  margin-top: ${({ theme }) => theme.spacing.sm}px;
`;

const Below = styled.View`
  margin-top: ${({ theme }) => theme.spacing.md}px;
`;

/** O horário digitado ocupa metade da largura, como na folha de avaliação. */
const TimeSlot = styled.View`
  width: 50%;
  padding-right: ${({ theme }) => theme.spacing.sm - 2}px;
`;

const minuteOf = (ms: number) => {
  const date = new Date(ms);
  return date.getHours() * 60 + date.getMinutes();
};

const CONTACT_ERROR =
  'Telefone, @ e links ficam fora: combine aqui só o encontro.';

type Props = {
  visible: boolean;
  kind: CallKind;
  window: FreeWindow;
  /** A grade salva: avisa quando o horário digitado cai numa aula. */
  schedule: readonly AttendedClassesSchedule[];
  now: Date;
  /** O primeiro nome que vai na chamada. */
  name: string;
  /** A chamada aberta agora, que abrir outra encerra. */
  current: Membership | null;
  /** As chamadas da lista em que o aluno não está: a parecida vira convite. */
  calls: readonly CompanionCall[];
  /** Entrar na chamada parecida em vez de abrir outra. */
  onJoin: (call: CompanionCall) => void;
  onClose: () => void;
  onOpened: (call: MemberCall) => void;
};

/** A ajuda do horário: o que a grade diz. */
function timeHelp(kind: CallKind, window: FreeWindow): string {
  if (kind === 'lunch') {
    if (window.kind === 'free')
      return `Os horários terminam 40 minutos antes da aula das ${minuteText(window.next.start)}.`;
    if (window.kind === 'class')
      return `Você está em aula até ${minuteText(window.current.end)}: os horários começam depois dela.`;
    return 'Escolha quando a mesa começa.';
  }
  if (window.kind === 'done')
    return `Sua última aula acabou às ${minuteText(window.last.end)}.`;
  if (window.kind === 'class' || window.kind === 'free')
    return `Sua última aula de hoje acaba às ${minuteText(window.last.end)}.`;
  return 'Escolha quando sair.';
}

/**
 * Abrir uma mesa ou chamar para voltar junto: o horário que a grade sugere,
 * o ponto de encontro (só lugares do Mapa, dentro do campus), o destino da
 * volta, um recado curto sem contato e as vagas.
 */
export function CreateCallSheet({
  visible,
  kind,
  window,
  schedule,
  now,
  name,
  current,
  calls,
  onJoin,
  onClose,
  onOpened,
}: Props) {
  const { companion } = useAppServices();
  const text = KIND_TEXT[kind];
  const [times] = useState(() => timeOptions(kind, window, now));
  const [chosen, setChosen] = useState<number | null>(times[0] ?? null);
  // "Outro horário": sem sugestão da grade, o campo já vem aberto
  const [custom, setCustom] = useState(times.length === 0);
  const [minute, setMinute] = useState(() =>
    times.length
      ? minuteOf(times[0])
      : Math.min(
          latestMinute(now),
          Math.floor((now.getHours() * 60 + now.getMinutes()) / 5) * 5 + 15,
        ),
  );
  const picked = custom ? customTime(now, minute) : null;
  const at = picked ? ('at' in picked ? picked.at : null) : chosen;
  const busy = custom ? classAt(schedule, now, minute) : null;
  const [spot, setSpot] = useState<SpotId>(SPOTS_BY_KIND[kind][0]);
  const [destination, setDestination] = useState<DestinationId>('metro');
  const [note, setNote] = useState('');
  const [capacity, setCapacity] = useState(String(CAPACITY[kind].initial));
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);

  const limits = CAPACITY[kind];
  const seats = Number(capacity);
  const seatsValid =
    Number.isInteger(seats) && seats >= limits.min && seats <= limits.max;
  const contact = hasContact(note);
  const valid = at !== null && seatsValid && !contact;
  // a mesma mesa já aberta: entrar junta gente em vez de duas meio vazias
  const similar =
    at === null
      ? null
      : similarCall(
          calls,
          { kind, spot, at, destination: kind === 'home' ? destination : null },
          now.getTime(),
        );

  async function submit() {
    if (!valid || at === null) {
      // o teclado cobriria o erro abaixo do recado
      Keyboard.dismiss();
      setTried(true);
      return;
    }
    setSaving(true);
    try {
      const call = await companion.open({
        kind,
        at,
        spot,
        destination: kind === 'home' ? destination : null,
        note,
        capacity: seats,
        name,
      });
      onOpened(call);
    } catch (error) {
      if (error instanceof CompanionError && error.refusal === 'contact')
        setTried(true);
      else snackbar.error(companionErrorMessage(error, kind));
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={text.sheetTitle}
      swipeToClose={!saving}
      footer={[
        <Button
          key="cancel"
          variant="outline"
          label="Cancelar"
          disabled={saving}
          onPress={onClose}
        />,
        <Button
          key="open"
          label={text.cta}
          loading={saving}
          loadingLabel="Abrindo…"
          disabled={at === null}
          onPress={() => {
            void submit();
          }}
        />,
      ]}
    >
      <FirstField>
        <Text tone="muted">{windowText(window).title}</Text>
      </FirstField>
      {current ? (
        <Field>
          <Notice
            tone="warn"
            icon="info"
            text={`Você já abriu: ${callTitle(current)}. Abrir outra encerra essa, e quem ia vê o aviso.`}
          />
        </Field>
      ) : null}

      <Field>
        <Label variant="meta" weight="medium">
          {kind === 'lunch' ? 'Horário' : 'Saída'}
        </Label>
        <ChipGroup
          layout="wrap"
          accessibilityLabel={kind === 'lunch' ? 'Horário' : 'Saída'}
        >
          {times.map(option => (
            <FilterChip
              key={option}
              label={clockText(option)}
              selected={!custom && option === chosen}
              onPress={() => {
                setCustom(false);
                setChosen(option);
              }}
            />
          ))}
          <FilterChip
            label="Outro horário"
            icon="schedule"
            selected={custom}
            onPress={() => setCustom(true)}
          />
        </ChipGroup>
        {custom ? (
          <Below>
            <TimeSlot>
              <TimeField
                label={kind === 'lunch' ? 'Começa às' : 'Sai às'}
                value={minute}
                onChange={setMinute}
              />
            </TimeSlot>
          </Below>
        ) : null}
        {picked && 'refused' in picked ? (
          <Help variant="meta" tone="bad">
            {picked.refused === 'past'
              ? 'Esse horário já passou. Escolha um a partir de agora.'
              : `Dá para abrir até 3 horas à frente, no mesmo dia: escolha até as ${minuteText(latestMinute(now))}.`}
          </Help>
        ) : busy ? (
          <Help variant="meta" tone="warn">
            Nesse horário você está em aula: {busy.name}, até{' '}
            {minuteText(busy.end)}.
          </Help>
        ) : (
          <Help variant="meta" tone="muted">
            {custom
              ? 'Aparece na lista 1 hora antes do horário.'
              : timeHelp(kind, window)}
          </Help>
        )}
      </Field>

      <Field>
        <Label variant="meta" weight="medium">
          Ponto de encontro
        </Label>
        <OptionList
          accessibilityLabel="Ponto de encontro"
          options={SPOTS_BY_KIND[kind].map(id => ({
            value: id,
            label: SPOT_TEXT[id].name,
            description: SPOT_TEXT[id].detail,
          }))}
          value={spot}
          onSelect={setSpot}
        />
        <Help variant="meta" tone="muted">
          Só lugares do Mapa, dentro do campus e movimentados.
        </Help>
      </Field>

      {kind === 'home' ? (
        <Field>
          <Label variant="meta" weight="medium">
            Para onde
          </Label>
          <OptionList
            accessibilityLabel="Para onde"
            options={DESTINATION_IDS.map(id => ({
              value: id,
              label: DESTINATION_TEXT[id].name,
              description: `Saída pelo ${SPOT_TEXT[DESTINATION_TEXT[id].exit].short}`,
            }))}
            value={destination}
            onSelect={setDestination}
          />
          <Help variant="meta" tone="muted">
            Nunca o bairro nem o endereço: cada um segue o seu caminho dali.
          </Help>
        </Field>
      ) : null}

      {similar ? (
        <Field>
          <Notice
            tone="info"
            icon="groups"
            text={`${callTitle(similar)} já está ${text.opened}: ${similar.host} abriu, ${goingText(similar.going)}. ${
              kind === 'lunch'
                ? 'Sentar junto enche a mesma mesa, em vez de duas meio vazias.'
                : 'Entrar nele deixa o grupo maior, em vez de dois pequenos.'
            }`}
            action={{ label: text.join, onPress: () => onJoin(similar) }}
          />
        </Field>
      ) : null}

      <Field>
        <TextField
          label="Recado (opcional)"
          value={note}
          onChangeText={setNote}
          maxLength={NOTE_MAX}
          placeholder={
            kind === 'lunch'
              ? 'Ex.: mesa perto da entrada'
              : 'Ex.: vamos a pé pelo portão'
          }
          autoCorrect
          error={tried && contact ? CONTACT_ERROR : undefined}
          helper={tried && contact ? undefined : `${note.length}/${NOTE_MAX}`}
        />
      </Field>

      <Field>
        <Label variant="meta" weight="medium">
          Até quantas pessoas, com você
        </Label>
        <NumberStepper
          value={capacity}
          onChangeText={setCapacity}
          min={limits.min}
          max={limits.max}
          unit="pessoas"
          accessibilityLabel="Até quantas pessoas"
          invalid={tried && !seatsValid}
        />
        <Help variant="meta" tone="muted">
          De {limits.min} a {limits.max}.
        </Help>
      </Field>

      <Field>
        <Text variant="meta" tone="muted">
          Você aparece como{' '}
          <Text variant="meta" weight="semibold" tone="ink">
            {name}
          </Text>
          . {LIFETIME_TEXT[kind]}
        </Text>
      </Field>
    </BottomSheet>
  );
}
