import React, { useState } from 'react';
import { Platform, Share } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import styled, { useTheme } from 'styled-components/native';

import {
  BottomSheet,
  Button,
  Icon,
  SegmentedControl,
  Text,
  snackbar,
} from '@components/ui';

import { inviteLink } from '../domain/invite';
import { inviteMessage, type Invite } from './inviteText';
import { QrCode } from './QrCode';

type Mode = 'message' | 'qr';

/** Lado do QR na folha: lido de um palmo de distância, cabe em tela pequena. */
const QR_SIZE = 216;

/** O Android 13 (API 33) mostra a prévia do que foi copiado. */
const systemConfirmsCopy = () =>
  Platform.OS === 'android' && Number(Platform.Version) >= 33;

const Body = styled.View`
  gap: ${({ theme }) => theme.spacing.md}px;
  padding-bottom: ${({ theme }) => theme.spacing.xs}px;
`;

/** A mensagem como ela sai: um balão, na cor do acento. */
const Bubble = styled.View`
  gap: ${({ theme }) => theme.spacing.sm}px;
  padding: ${({ theme }) => theme.spacing.md}px
    ${({ theme }) => theme.spacing.md + 2}px;
  border-radius: ${({ theme }) => theme.radii.xl}px;
  border-top-right-radius: ${({ theme }) => theme.radii.xs}px;
  background-color: ${({ theme }) => theme.colors.accentSoft};
`;

const LinkLine = styled.View`
  flex-direction: row;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs + 2}px;
`;

const QrBlock = styled.View`
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs}px;
  padding-top: ${({ theme }) => theme.spacing.sm}px;
`;

/** O QR sempre sobre branco, com o fio da folha em volta. */
const Plate = styled.View`
  padding: ${({ theme }) => theme.spacing.sm}px;
  margin-bottom: ${({ theme }) => theme.spacing.sm}px;
  border-radius: ${({ theme }) => theme.radii.xl}px;
  border-top-right-radius: ${({ theme }) => theme.radii.xs}px;
  border-width: ${({ theme }) => theme.borders.hairline}px;
  border-color: ${({ theme }) => theme.colors.rule};
  background-color: #ffffff;
`;

type Props = {
  /** `null` fecha a folha. */
  invite: Invite | null;
  onClose: () => void;
};

/**
 * Indicar o app: a mensagem pronta, que vai pelo app que o aluno escolher,
 * ou o QR para o colega do lado apontar a câmera. Todos os convites do app
 * passam por aqui, cada um com o seu texto e a sua origem no link.
 */
export function InviteSheet({ invite, onClose }: Props) {
  const theme = useTheme();
  const [mode, setMode] = useState<Mode>('message');
  // a folha segue desenhada com o último convite enquanto desce
  const [shown, setShown] = useState(invite);
  if (invite && invite !== shown) setShown(invite);
  const current = invite ?? shown;

  const copy = () => {
    if (!current) return;
    Clipboard.setString(inviteLink(current.source));
    // do Android 13 em diante, o próprio sistema mostra o que foi copiado
    if (!systemConfirmsCopy())
      snackbar.success('Link copiado', 'Cole na conversa que quiser.');
  };

  const send = async () => {
    if (!current) return;
    try {
      await Share.share({ message: inviteMessage(current) });
      onClose();
    } catch {
      snackbar.error('Não foi possível abrir o compartilhamento.');
    }
  };

  return (
    <BottomSheet
      visible={invite !== null}
      onClose={onClose}
      onClosed={() => setMode('message')}
      title="Indicar o AO UERJ"
      footer={[
        <Button
          key="copy"
          variant="outline"
          icon="content_copy"
          label="Copiar link"
          onPress={copy}
        />,
        <Button
          key="send"
          icon="share"
          label="Mandar"
          accessibilityHint="Abre a lista de apps para mandar a mensagem"
          onPress={() => {
            void send();
          }}
        />,
      ]}
    >
      {current ? (
        <Body>
          <SegmentedControl
            accessibilityLabel="Como indicar"
            options={[
              { value: 'message', label: 'Mensagem', icon: 'send' },
              { value: 'qr', label: 'QR', icon: 'qr_code_2' },
            ]}
            value={mode}
            onChange={setMode}
          />
          {mode === 'message' ? (
            <>
              <Text variant="meta" tone="muted">
                Vai pelo app que você escolher, e dá para mudar o texto antes de
                mandar.
              </Text>
              <Bubble>
                <Text variant="body">{current.text}</Text>
                <LinkLine>
                  <Icon name="link" size={16} color={theme.colors.accent} />
                  <Text variant="meta" tone="accent" weight="medium">
                    AO UERJ na Google Play
                  </Text>
                </LinkLine>
              </Bubble>
            </>
          ) : (
            <QrBlock>
              <Plate>
                <QrCode
                  value={inviteLink('qr')}
                  size={QR_SIZE}
                  accessibilityLabel="QR com o link do AO UERJ na Play Store"
                />
              </Plate>
              <Text variant="titleS" align="center">
                Aponte a câmera do celular
              </Text>
              <Text variant="meta" tone="muted" align="center">
                Abre o AO UERJ na Play Store. Por enquanto, só para Android.
              </Text>
            </QrBlock>
          )}
        </Body>
      ) : null}
    </BottomSheet>
  );
}
