import React, { useCallback, useState } from 'react';
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { DrawerNavigationProp } from '@react-navigation/drawer';

import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  FootNote,
  List,
  ListRow,
  Notice,
  ProgressBar,
  Section,
  SegmentedControl,
  Skeleton,
  StatGroup,
  StatusLabel,
  Tag,
  Text,
} from '@components/ui';
import { ScreenPanel } from '@templates/ScreenPanel';
import { useHeaderBack } from '@templates/Header/headerStore';
import { useBackHandler } from '@hooks/useBackHandler';
import {
  blocksOf,
  isBottleneck,
  PACE_CREDITS,
  type Pace,
  type PlannedPeriod,
} from '@root/modules/graduation/domain/plan';
import {
  useGraduationPlan,
  type GraduationPlanView,
} from '@root/modules/graduation/presentation/useGraduationPlan';
import type { RootDrawerParamList } from '@root/routes';

import { PlanSubjectSheet } from './PlanSubjectSheet';
import {
  blocksText,
  blocksTone,
  chainText,
  deadlineText,
  PACE_LABELS,
  plural,
  subjectMeta,
} from './planText';
import {
  Bar,
  Block,
  Fact,
  Facts,
  Foot,
  PeriodCard,
  PeriodList,
  Row,
  RowStart,
  Status,
} from './GraduationPlan.styles';

const PACES: { value: Pace; label: string }[] = (
  Object.keys(PACE_CREDITS) as Pace[]
).map(value => ({ value, label: PACE_LABELS[value] }));

const COPY = {
  noSynthesis:
    'Sem a Síntese da Formação, o app não sabe o prazo máximo do curso. Os créditos exigidos das eletivas são os que você configurou em Meu Progresso.',
  stopped:
    'A leitura dos pré-requisitos parou: o Aluno Online pediu uma pausa, saiu do ar ou a conexão caiu. O plano usa o que já foi lido.',
  estimate:
    'O plano conta como aprovadas as disciplinas em curso. Não conhece vagas, horários nem a oferta de cada período: a inscrição de verdade pode mudar.',
  privacy:
    'Calculado no aparelho. Os pré-requisitos vêm da Pesquisa de Disciplinas e ficam guardados por versão curricular.',
  done: 'Nada a planejar: as obrigatórias que faltam estão em curso e os créditos de eletivas estão completos.',
  error: 'Não foi possível carregar o currículo e o histórico.',
};

/**
 * Plano até a formatura: as disciplinas que faltam distribuídas pelos
 * próximos períodos, com o prazo da Síntese, o ritmo, os gargalos e cada
 * período. Tocar numa disciplina abre o detalhe, com a opção de adiá-la.
 */
export function GraduationPlanPage() {
  const navigation =
    useNavigation<
      DrawerNavigationProp<RootDrawerParamList, 'Plano até a formatura'>
    >();
  const route =
    useRoute<RouteProp<RootDrawerParamList, 'Plano até a formatura'>>();
  const sourceRoute = route.params?.sourceRoute;
  const goBack = useCallback(() => {
    if (!sourceRoute) return;
    navigation.setParams({ sourceRoute: undefined });
    navigation.navigate(sourceRoute as never);
  }, [navigation, sourceRoute]);
  useHeaderBack(sourceRoute ? goBack : null, 'Voltar para Meu Progresso');
  useBackHandler(goBack, Boolean(sourceRoute));

  const view = useGraduationPlan({ load: true });
  const [selected, setSelected] = useState<string | null>(null);

  let content: React.ReactNode;
  if (view.status === 'loading') content = <PlanSkeleton />;
  else if (view.status === 'error') {
    content = <ErrorState message={COPY.error} onRetry={view.retrySources} />;
  } else if (view.status === 'done') {
    content = <EmptyState icon="school" text={COPY.done} />;
  } else if (view.status === 'reading') {
    content = <Reading done={view.catalog.done} total={view.catalog.total} />;
  } else {
    content = <Plan view={view} onSelect={setSelected} />;
  }

  return (
    <>
      <ScreenPanel>{content}</ScreenPanel>
      <PlanSubjectSheet
        view={view}
        subjectKey={view.status === 'ready' ? selected : null}
        onSelect={setSelected}
        onClose={() => setSelected(null)}
        onOpenSubject={subjectId => {
          setSelected(null);
          navigation.navigate('Pesquisa de Disciplinas', {
            subjectId,
            sourceRoute: 'Plano até a formatura',
          });
        }}
      />
    </>
  );
}

function PlanSkeleton() {
  return (
    <>
      <Skeleton height={88} />
      <Block>
        <Skeleton height={120} />
      </Block>
      <Block>
        <Skeleton height={200} />
      </Block>
    </>
  );
}

/** A primeira leitura dos pré-requisitos, uma página por disciplina. */
function Reading({ done, total }: { done: number; total: number }) {
  return (
    <>
      <StatGroup
        items={[
          { value: '–', label: 'Formatura prevista' },
          { value: '–', label: 'Períodos no plano' },
        ]}
      />
      <Section title="Lendo os pré-requisitos">
        <Card>
          <Row>
            <Text weight="semibold">Pesquisa de Disciplinas</Text>
            <Text variant="meta" tone="muted" tabular>
              {done} de {total}
            </Text>
          </Row>
          <Bar>
            <ProgressBar
              value={total ? done / total : 0}
              accessibilityLabel={`Pré-requisitos lidos: ${done} de ${total}`}
            />
          </Bar>
          <Text variant="meta" tone="muted">
            Uma consulta por disciplina que falta. Fica guardado por versão
            curricular: depois da primeira vez, o plano abre na hora.
          </Text>
        </Card>
        <Block>
          <Skeleton height={160} />
        </Block>
      </Section>
    </>
  );
}

function Plan({
  view,
  onSelect,
}: {
  view: GraduationPlanView;
  onSelect: (key: string) => void;
}) {
  const { plan, label, deadline, synthesis, catalog } = view;
  const length = plan.periods.length;
  const last = length ? label(length - 1) : '–';
  const names = new Map(view.subjects.map(item => [item.key, item.name]));
  const chain = chainText(
    length,
    plan.graph.chain.map(key => names.get(key) ?? key),
    view.pace,
    view.postponed.size,
  );
  const bottlenecks = view.subjects
    .filter(item => isBottleneck(plan.graph, item.key))
    .sort((a, b) => blocksOf(plan.graph, b.key) - blocksOf(plan.graph, a.key));
  const failed = view.unread.filter(item =>
    catalog.failed.some(id => id === item.id),
  );
  const used = synthesis?.periods.used ?? 0;

  return (
    <>
      <StatGroup
        items={[
          { value: last, label: 'Formatura prevista' },
          { value: String(length), label: 'Períodos no plano' },
        ]}
      />

      {deadline ? (
        <Section title="Prazo">
          <Card>
            <Row>
              <Text variant="meta" tone="muted">
                Síntese da Formação
              </Text>
              {deadline.last ? (
                <Tag tone={deadline.level} label={`até ${deadline.last}`} />
              ) : null}
            </Row>
            <Bar>
              <ProgressBar
                value={Math.min(
                  1,
                  (used + length) / Math.max(1, used + deadline.remaining),
                )}
                tone={deadline.level}
                accessibilityLabel={`Prazo: ${deadlineText(deadline.slack)}`}
              />
            </Bar>
            <StatusLabel
              tone={deadline.level}
              icon={deadline.level === 'good' ? 'check_circle' : 'warning'}
              label={deadlineText(deadline.slack)}
              lines={2}
            />
            <Facts>
              <Fact>
                <Text variant="caption" tone="muted">
                  Usados
                </Text>
                <Text weight="semibold" tabular>
                  {synthesis?.periods.used ?? '–'}
                </Text>
              </Fact>
              <Fact>
                <Text variant="caption" tone="muted">
                  No plano
                </Text>
                <Text weight="semibold" tabular>
                  {length}
                </Text>
              </Fact>
              <Fact>
                <Text variant="caption" tone="muted">
                  Restantes
                </Text>
                <Text weight="semibold" tabular>
                  {deadline.remaining}
                </Text>
              </Fact>
            </Facts>
          </Card>
          {deadline.slack < 0 ? (
            <Block>
              <Notice
                tone="bad"
                icon="warning"
                text="Procure a coordenação do curso antes do fim do prazo: o plano não cabe nos períodos que restam."
              />
            </Block>
          ) : null}
        </Section>
      ) : (
        <Section title="Prazo">
          <Notice tone="neutral" icon="info" text={COPY.noSynthesis} />
        </Section>
      )}

      <Section
        title="Ritmo"
        description="Até 20, 26 ou 32 créditos por período."
      >
        <SegmentedControl
          options={PACES}
          value={view.pace}
          onChange={value => {
            void view.setPace(value);
          }}
          accessibilityLabel="Ritmo do plano"
        />
        {chain ? (
          <Block>
            <Notice tone="info" icon="lightbulb" text={chain} />
          </Block>
        ) : null}
        {view.postponed.size ? (
          <Block>
            <Notice
              tone="neutral"
              icon="event_upcoming"
              text={`Você adiou ${plural(view.postponed.size, 'disciplina', 'disciplinas')}.`}
              action={{
                label: 'Restaurar o plano',
                onPress: () => {
                  void view.reset();
                },
              }}
            />
          </Block>
        ) : null}
      </Section>

      {catalog.stoppedBy || failed.length || plan.unplanned.length ? (
        <Section title="Avisos">
          {catalog.stoppedBy ? (
            <Notice
              tone="warn"
              icon="sync_problem"
              text={COPY.stopped}
              onRetry={catalog.retry}
            />
          ) : null}
          {failed.length ? (
            <Block>
              <Notice
                tone="warn"
                icon="warning"
                text={`Não deu para ler os pré-requisitos de ${failed.map(item => item.name).join(', ')}. O plano as trata como livres.`}
                onRetry={catalog.retry}
              />
            </Block>
          ) : null}
          {plan.unplanned.length ? (
            <Block>
              <Notice
                tone="bad"
                icon="error"
                text={`Fora do plano: ${plan.unplanned.map(item => item.name).join(', ')}. Um pré-requisito delas não está entre as disciplinas que faltam.`}
              />
            </Block>
          ) : null}
        </Section>
      ) : null}

      {bottlenecks.length ? (
        <Section
          title="Gargalos"
          description="Disciplinas que travam outras: atrasar uma delas pode atrasar a formatura."
        >
          <List>
            {bottlenecks.map(item => {
              const index = plan.periodOf.get(item.key);
              const blocks = blocksOf(plan.graph, item.key);
              return (
                <ListRow
                  key={item.key}
                  title={item.name}
                  facts={
                    <StatusLabel
                      tone={blocksTone(blocks)}
                      label={`${blocksText(blocks)}${index === undefined ? '' : ` · no plano em ${label(index)}`}`}
                      lines={2}
                    />
                  }
                  chevron
                  onPress={() => onSelect(item.key)}
                  accessibilityHint="Abre o detalhe da disciplina"
                />
              );
            })}
          </List>
        </Section>
      ) : null}

      <Section title="Período a período">
        {plan.periods.map(period => (
          <PeriodBlock
            key={period.index}
            period={period}
            view={view}
            onSelect={onSelect}
          />
        ))}
        <Foot>
          <FootNote icon="info" text={COPY.estimate} />
          <FootNote icon="lock" text={COPY.privacy} />
          <Button
            variant="text"
            size="sm"
            icon="refresh"
            label="Ler os pré-requisitos de novo"
            onPress={() => {
              void catalog.reload();
            }}
          />
        </Foot>
      </Section>
    </>
  );
}

function PeriodBlock({
  period,
  view,
  onSelect,
}: {
  period: PlannedPeriod;
  view: GraduationPlanView;
  onSelect: (key: string) => void;
}) {
  const cap = PACE_CREDITS[view.pace];
  const title = view.label(period.index);
  return (
    <PeriodCard>
      <Card dashed={!period.subjects.length}>
        <Row>
          <RowStart>
            <Text variant="headline" tabular>
              {title}
            </Text>
            {period.index === 0 ? <Tag tone="info" label="Próximo" /> : null}
          </RowStart>
          <Text variant="meta" tone="muted" tabular>
            {period.credits} de {cap} créditos
          </Text>
        </Row>
        {period.subjects.length ? (
          <>
            <Bar>
              <ProgressBar
                thin
                value={Math.min(1, period.credits / cap)}
                accessibilityLabel={`${title}: ${period.credits} de ${cap} créditos`}
              />
            </Bar>
            <Text variant="meta" tone="muted" tabular>
              {plural(period.subjects.length, 'disciplina', 'disciplinas')}
              {period.workload ? ` · ${period.workload} h` : ''}
            </Text>
            <PeriodList bleed={false}>
              {period.subjects.map(item => {
                const blocks = blocksOf(view.plan.graph, item.key);
                return (
                  <ListRow
                    key={item.key}
                    title={item.name}
                    meta={subjectMeta(item)}
                    facts={
                      isBottleneck(view.plan.graph, item.key) ||
                      view.postponed.has(item.key) ? (
                        <Status>
                          {isBottleneck(view.plan.graph, item.key) ? (
                            <StatusLabel
                              tone={blocksTone(blocks)}
                              label={`Gargalo: ${blocksText(blocks).toLowerCase()}`}
                            />
                          ) : null}
                          {view.postponed.has(item.key) ? (
                            <StatusLabel
                              tone="neutral"
                              icon="event_upcoming"
                              label="Adiada por você"
                            />
                          ) : null}
                        </Status>
                      ) : undefined
                    }
                    chevron
                    inset={0}
                    onPress={() => onSelect(item.key)}
                    accessibilityHint="Abre o detalhe da disciplina"
                  />
                );
              })}
            </PeriodList>
          </>
        ) : (
          <Status>
            <Text variant="meta" tone="muted">
              Sem disciplinas: o que sobrou foi adiado ou ainda espera
              pré-requisitos.
            </Text>
          </Status>
        )}
      </Card>
    </PeriodCard>
  );
}
