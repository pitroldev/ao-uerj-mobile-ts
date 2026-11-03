import React, { useState } from 'react';
import styled from 'styled-components/native';

import {
  BottomSheet,
  Button,
  OptionList,
  Text,
  snackbar,
} from '@components/ui';
import { useAppServices } from '@root/app/providers/AppServicesProvider';
import {
  REPORT_REASONS,
  type ReportReason,
} from '@root/modules/companion/domain/companion';
import {
  companionErrorMessage,
  REASON_TEXT,
} from '@root/modules/companion/presentation/companionText';

const Lede = styled(Text)`
  margin-top: ${({ theme }) => theme.spacing.xs}px;
  margin-bottom: ${({ theme }) => theme.spacing.lg}px;
`;

type Props = {
  visible: boolean;
  callId: string;
  title: string;
  /** Quem está dentro denuncia pela chave; de fora, gasta um token. */
  member: boolean;
  onClose: () => void;
  onReported: () => void;
};

/**
 * Denunciar a chamada: vai para a moderação do app, sem o nome de quem
 * denuncia. Três denúncias tiram a chamada do ar.
 */
export function ReportSheet({
  visible,
  callId,
  title,
  member,
  onClose,
  onReported,
}: Props) {
  const { companion } = useAppServices();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [sending, setSending] = useState(false);

  async function send() {
    if (!reason) return;
    setSending(true);
    try {
      await companion.report(callId, reason);
      snackbar.success(
        'Denúncia enviada',
        'Três denúncias tiram a chamada do ar até a moderação olhar.',
      );
      onReported();
    } catch (error) {
      snackbar.error(companionErrorMessage(error));
    } finally {
      setSending(false);
    }
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Denunciar"
      meta={title}
      swipeToClose={!sending}
      footer={[
        <Button
          key="cancel"
          variant="outline"
          label="Cancelar"
          disabled={sending}
          onPress={onClose}
        />,
        <Button
          key="send"
          label="Enviar"
          loading={sending}
          loadingLabel="Enviando…"
          disabled={!reason}
          onPress={() => {
            void send();
          }}
        />,
      ]}
    >
      <Lede tone="muted">
        A denúncia vai para a moderação do app, sem o seu nome.
        {member
          ? ' Depois, se quiser, saia da chamada.'
          : ' Você não precisa entrar na chamada.'}{' '}
        Se for urgente, procure a segurança do campus.
      </Lede>
      <OptionList
        accessibilityLabel="Motivo"
        options={REPORT_REASONS.map(value => ({
          value,
          label: REASON_TEXT[value],
        }))}
        value={reason}
        onSelect={setReason}
      />
    </BottomSheet>
  );
}
