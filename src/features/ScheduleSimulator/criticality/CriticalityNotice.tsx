import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import styled from 'styled-components/native';

import { Notice, ProgressBar, Text } from '@components/ui';

import { plural } from '../format';
import { useCriticality, type Criticality } from './context';

const COPY = {
  checking: 'Conferindo quais matérias travam outras…',
  unavailable:
    'Agora o app não consegue saber quais matérias travam outras: esta prioridade não muda a ordem das grades.',
  stopped:
    'A leitura dos pré-requisitos parou: o Aluno Online pediu uma pausa, saiu do ar ou a conexão caiu. O gerador usa o que já foi lido.',
  offline:
    'Sem conexão com o Aluno Online agora. Sem os pré-requisitos, esta prioridade não muda a ordem das grades.',
  nothing:
    'Nenhuma obrigatória falta: esta prioridade não muda a ordem das grades.',
  ready:
    'Pré-requisitos lidos: as grades com as matérias que travam mais obrigatórias vêm primeiro.',
};

const Bar = styled.View`
  margin: 8px 0px 4px;
`;

/** O pedido de leitura: na primeira vez, ou com parte já lida. */
function missingText({ unread, pending }: Criticality) {
  const share =
    unread < pending
      ? `Faltam os pré-requisitos de ${unread} das ${pending} obrigatórias que você ainda precisa cursar.`
      : `Para saber quais matérias travam outras, o app lê no Aluno Online os pré-requisitos das ${plural(pending, 'obrigatória', 'obrigatórias')} que faltam, uma consulta por disciplina.`;
  return `${share} Fica guardado: depois da primeira vez, vale na hora.`;
}

/**
 * Como está a conta das matérias que travam outras, para a prioridade
 * "Matérias críticas". Nas prioridades (`summary` falso), explica e oferece a
 * leitura; no resumo antes de gerar, só aparece se a conta estiver incompleta.
 */
export function CriticalityNotice({
  summary = false,
  style,
}: {
  summary?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const criticality = useCriticality();
  const { status, done, total, unread, stoppedBy, canRead, read } = criticality;

  if (status === 'off') return null;
  if (status === 'checking') {
    return summary ? null : (
      <Notice kind="updating" text={COPY.checking} style={style} />
    );
  }
  if (status === 'unavailable') {
    return (
      <Notice
        tone="neutral"
        icon="info"
        text={COPY.unavailable}
        style={style}
      />
    );
  }
  if (status === 'reading') {
    // texto sem região ao vivo: anunciar cada página seria barulho demais
    return (
      <Notice tone="info" spin style={style}>
        <Text variant="meta">
          {summary
            ? `Ainda lendo os pré-requisitos (${done} de ${total}). Gerar agora usa o que já foi lido.`
            : `Lendo os pré-requisitos: ${done} de ${total}. Pode seguir: a leitura continua enquanto você escolhe as disciplinas.`}
        </Text>
        <Bar>
          <ProgressBar
            value={total ? done / total : 0}
            accessibilityLabel={`Pré-requisitos lidos: ${done} de ${total}`}
          />
        </Bar>
      </Notice>
    );
  }
  if (status === 'ready') {
    if (summary) return null;
    return criticality.pending ? (
      <Notice tone="good" text={COPY.ready} style={style} />
    ) : (
      <Notice tone="neutral" icon="info" text={COPY.nothing} style={style} />
    );
  }

  // missing: parou, não leu alguma página ou ainda não leu
  const retry = canRead ? read : undefined;
  if (stoppedBy) {
    return (
      <Notice
        tone="warn"
        icon="sync_problem"
        text={COPY.stopped}
        onRetry={retry}
        style={style}
      />
    );
  }
  if (total > 0) {
    return (
      <Notice
        tone="warn"
        icon="warning"
        text={`Não deu para ler os pré-requisitos de ${plural(unread, 'obrigatória', 'obrigatórias')}: o gerador as trata como se não travassem nenhuma.`}
        onRetry={retry}
        style={style}
      />
    );
  }
  if (!canRead) {
    return <Notice kind="portalDown" text={COPY.offline} style={style} />;
  }
  return (
    <Notice
      tone="info"
      icon="account_tree"
      text={missingText(criticality)}
      action={{
        label:
          unread < criticality.pending
            ? 'Ler os que faltam'
            : 'Ler os pré-requisitos',
        onPress: read,
      }}
      style={style}
    />
  );
}
