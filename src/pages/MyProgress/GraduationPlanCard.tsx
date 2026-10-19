import React from 'react';
import styled from 'styled-components/native';
import { useNavigation } from '@react-navigation/native';
import type { DrawerNavigationProp } from '@react-navigation/drawer';

import { Button, Card, IconTile, StatusLabel, Text } from '@components/ui';
import { useDisabledRoutes } from '@root/modules/delivery/presentation/FeatureGate';
import { isBottleneck } from '@root/modules/graduation/domain/plan';
import { useGraduationPlan } from '@root/modules/graduation/presentation/useGraduationPlan';
import type { RootDrawerParamList } from '@root/routes';

const Layout = styled.View`
  flex-direction: row;
  gap: ${({ theme }) => theme.spacing.md}px;
`;

const Body = styled.View`
  flex: 1;
  gap: ${({ theme }) => theme.spacing.xs}px;
  align-items: flex-start;
`;

const Slot = styled.View`
  margin-bottom: ${({ theme }) => theme.spacing.lg}px;
`;

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

/** O botão do cartão: só monta com o cartão na tela. */
function OpenPlan({ label }: { label: string }) {
  const navigation =
    useNavigation<DrawerNavigationProp<RootDrawerParamList, 'Meu Progresso'>>();
  return (
    <Button
      variant="text"
      size="sm"
      icon="arrow_forward"
      label={label}
      onPress={() =>
        navigation.navigate('Plano até a formatura', {
          sourceRoute: 'Meu Progresso',
        })
      }
    />
  );
}

/**
 * Entrada do Plano até a formatura em "Seu caminho no currículo". Com a
 * tela desativada pelo aviso remoto, o cartão some (e não consulta a Síntese).
 */
export function GraduationPlanCard() {
  const disabled = useDisabledRoutes().has('Plano até a formatura');
  return disabled ? null : <PlanSummary />;
}

/**
 * O resumo do plano com os pré-requisitos já guardados: sem eles, convida a
 * montar o plano (a leitura no portal acontece na tela do plano).
 */
function PlanSummary() {
  const view = useGraduationPlan({ load: false });
  if (view.status === 'loading' || view.status === 'error') return null;

  const { plan } = view;
  const ready = view.status === 'ready' && !view.unread.length;
  const length = plan.periods.length;
  const bottlenecks = view.subjects.filter(item =>
    isBottleneck(plan.graph, item.key),
  ).length;
  let text =
    'As disciplinas que faltam distribuídas pelos próximos períodos, com os pré-requisitos e o prazo da Síntese. Na primeira vez, o app lê os pré-requisitos no Aluno Online.';
  if (view.status === 'done') {
    text =
      'Nada a planejar: as obrigatórias que faltam estão em curso e os créditos de eletivas estão completos.';
  } else if (ready && length) {
    text = `Formatura prevista em ${view.label(length - 1)}, em ${plural(length, 'período', 'períodos')}.${
      bottlenecks
        ? ` ${plural(bottlenecks, 'disciplina trava', 'disciplinas travam')} outras.`
        : ''
    }`;
  }

  return (
    <Slot>
      <Card>
        <Layout>
          <IconTile icon="school" />
          <Body>
            <Text weight="semibold">Plano até a formatura</Text>
            <Text variant="meta" tone="muted">
              {text}
            </Text>
            {ready && view.deadline && view.deadline.slack < 0 ? (
              <StatusLabel
                tone="bad"
                icon="warning"
                label="Passa do prazo máximo da Síntese"
              />
            ) : null}
            {view.status !== 'done' ? (
              <OpenPlan label={ready ? 'Ver o plano' : 'Montar o plano'} />
            ) : null}
          </Body>
        </Layout>
      </Card>
    </Slot>
  );
}
