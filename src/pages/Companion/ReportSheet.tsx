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
  /** Quem está dentro denuncia pela chave; de fora, pela sessão (uma vez por aluno). */
  member: boolean;
  /** Quem chamou: a denúncia dele não tira a chamada do ar. */
  host?: boolean;
  onClose: () => void;
  onReported: () => void;
};

/** O que acontece depois da denúncia, dito a quem denunciou. */
function reportedText(
  reason: ReportReason,
  member: boolean,
  host: boolean,
): string {
  if (!member) return 'A moderação vai olhar e pode tirar do ar.';
  if (host)
    return 'A moderação vai olhar. Se quiser, tire a pessoa em "Quem vai".';
  if (reason === 'harassment')
    return 'Saiu do ar para quem ainda não entrou. A moderação vai olhar.';
  return 'Se mais alguém de dentro denunciar, sai do ar. A moderação vai olhar.';
}

/**
 * Denunciar a chamada: vai para a moderação do app, que vê quem estava e
 * quem denunciou (os outros não). Assédio denunciado por quem foi junto tira
 * a chamada do ar na hora; outro motivo, com duas pessoas de dentro. De
 * fora, só a moderação tira (ninguém de fora derruba a mesa dos outros).
 */
export function ReportSheet({
  visible,
  callId,
  title,
  member,
  host = false,
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
      snackbar.success('Denúncia enviada', reportedText(reason, member, host));
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
        {host
          ? ' Para tirar alguém, use "Tirar" em Quem vai.'
          : member
            ? ' Assédio tira do ar na hora; outro motivo, quando duas pessoas de dentro denunciam. Depois, se quiser, saia.'
            : ' Você não precisa entrar: a moderação lê e decide.'}{' '}
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
