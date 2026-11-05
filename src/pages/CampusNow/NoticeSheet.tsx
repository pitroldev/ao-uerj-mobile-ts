import React, { useState } from 'react';
import styled from 'styled-components/native';

import {
  BottomSheet,
  Button,
  FootNote,
  List,
  ListRow,
  PropertyList,
  snackbar,
} from '@components/ui';
import type { CampusNotice } from '@root/modules/campus-now/domain/campusNow';
import {
  campusNowErrorMessage,
  clockText,
  noticeTitle,
  placeText,
  stateText,
} from '@root/modules/campus-now/presentation/campusNowText';

const Notes = styled.View`
  margin-top: ${({ theme }) => theme.spacing.lg}px;
  gap: ${({ theme }) => theme.spacing.sm}px;
`;

/**
 * O aviso por dentro: onde, desde quando, até quando, quantos responderam, e
 * as ações que não cabem na linha: "Ver no Mapa" e "Não é verdade" (três
 * tiram o aviso do ar; quem avisou perde pontos).
 */
export function NoticeSheet({
  notice,
  now,
  onClose,
  onMap,
  onFlag,
}: {
  notice: CampusNotice | null;
  now: number;
  onClose: () => void;
  onMap: (notice: CampusNotice) => void;
  onFlag: (notice: CampusNotice) => Promise<void>;
}) {
  const [flagging, setFlagging] = useState(false);
  // a folha segue desenhada com o último aviso enquanto desce
  const [shown, setShown] = useState(notice);
  if (notice && notice !== shown) setShown(notice);
  const current = notice ?? shown;

  const flag = async (target: CampusNotice) => {
    setFlagging(true);
    try {
      await onFlag(target);
      snackbar.success(
        'Obrigado',
        'Com três "Não é verdade", o aviso sai do ar e quem avisou perde pontos.',
      );
      onClose();
    } catch (error) {
      snackbar.error(campusNowErrorMessage(error));
    } finally {
      setFlagging(false);
    }
  };

  return (
    <BottomSheet
      visible={notice !== null}
      onClose={onClose}
      title={current ? noticeTitle(current) : 'Aviso'}
      swipeToClose={!flagging}
      footer={
        current ? (
          <Button
            variant="outline"
            icon="location_on"
            label="Ver no Mapa"
            onPress={() => onMap(current)}
          />
        ) : null
      }
    >
      {current ? (
        <>
          <PropertyList
            items={[
              { label: 'Onde', value: placeText(current.place) },
              {
                label: 'Avisado às',
                value: clockText(current.createdAt),
                tabular: true,
              },
              {
                label: 'Some sozinho',
                value: `às ${clockText(current.expiresAt)}`,
                tabular: true,
              },
              { label: 'Agora', value: stateText(current, now) },
            ]}
          />
          {!current.mine ? (
            <List>
              <ListRow
                leadingIcon="flag"
                title={
                  current.flagged
                    ? 'Você disse que não é verdade'
                    : 'Não é verdade'
                }
                subtitle={
                  current.flagged
                    ? 'Com três, o aviso sai do ar.'
                    : 'Para aviso falso ou de brincadeira. Se só acabou, use "Acabou".'
                }
                disabled={current.flagged || flagging}
                onPress={() => {
                  void flag(current);
                }}
                accessibilityRole="button"
                accessibilityState={{
                  disabled: current.flagged || flagging,
                  busy: flagging,
                }}
              />
            </List>
          ) : null}
          <Notes>
            <FootNote
              icon="schedule"
              text='Cada "Continua" empurra o fim do aviso. Três "Acabou" encerram antes.'
            />
            <FootNote icon="lock" text="Ninguém vê quem avisou." />
          </Notes>
        </>
      ) : null}
    </BottomSheet>
  );
}
