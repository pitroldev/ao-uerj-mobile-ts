import React from 'react';
import styled from 'styled-components/native';

import { Avatar, Button, IconTile, ListRow, Tag, Text } from '@components/ui';
import {
  canJoin,
  type CompanionCall,
} from '@root/modules/companion/domain/companion';
import {
  callTitle,
  DESTINATION_TEXT,
  goingText,
  KIND_TEXT,
  relativeText,
  SPOT_TEXT,
} from '@root/modules/companion/presentation/companionText';

const Acts = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.sm}px;
  margin-top: ${({ theme }) => theme.spacing.xs}px;
`;

const Who = styled.View`
  flex-direction: row;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm}px;
  flex-shrink: 1;
`;

/** O tamanho do avatar ao lado do nome de quem chamou. */
const AVATAR = 24;

type Props = {
  call: CompanionCall;
  now: number;
  /** A chamada é do aluno (abriu) ou ele já está nela (entrou). */
  role: 'host' | 'member' | null;
  joining: boolean;
  onOpen: (call: CompanionCall) => void;
  onJoin: (call: CompanionCall) => void;
};

/**
 * Uma chamada da lista: o que e quando, o ponto de encontro, o recado,
 * quem chamou (só o primeiro nome) e quantos vão. A ação ao lado entra na
 * hora; o toque na linha abre a chamada.
 */
export function CallRow({ call, now, role, joining, onOpen, onJoin }: Props) {
  const kind = KIND_TEXT[call.kind];
  const spot = SPOT_TEXT[call.spot];
  const icon = call.destination
    ? DESTINATION_TEXT[call.destination].icon
    : kind.icon;
  const host = role === 'host' ? 'Você' : call.host;
  const open = canJoin(call, now);
  let action: React.ReactNode;
  if (role === 'host') action = <Tag tone="info" label={kind.yours} />;
  else if (role === 'member')
    action = <Tag tone="good" icon="check" label="Você vai" />;
  else if (!open)
    action = (
      <Tag label={call.going >= call.capacity ? kind.full : 'Já saiu'} />
    );
  else
    action = (
      <Button
        label={kind.join}
        variant="outline"
        size="xs"
        loading={joining}
        loadingLabel="Entrando…"
        accessibilityLabel={`${kind.join}: ${callTitle(call)}`}
        onPress={() => onJoin(call)}
      />
    );
  const title = callTitle(call);
  const when = relativeText(call.at, now);
  return (
    <ListRow
      leading={
        <IconTile
          icon={icon}
          tone={call.kind === 'lunch' ? 'accent' : 'neutral'}
        />
      }
      leadingAlign="start"
      title={title}
      subtitle={call.kind === 'home' ? `${spot.short} · ${when}` : when}
      meta={call.note ? `“${call.note}”` : undefined}
      highlighted={role !== null}
      onPress={() => onOpen(call)}
      accessibilityLabel={`${title}, ${spot.name}, ${when}. ${host} abriu, ${goingText(call.going)}.${call.note ? ` Recado: ${call.note}.` : ''}`}
      accessibilityHint="Abre os detalhes"
    >
      <Acts>
        <Who>
          <Avatar name={host} tone="accent" size={AVATAR} />
          <Text variant="meta" tone="muted" numberOfLines={1}>
            {host} · {goingText(call.going)}
          </Text>
        </Who>
        {action}
      </Acts>
    </ListRow>
  );
}
