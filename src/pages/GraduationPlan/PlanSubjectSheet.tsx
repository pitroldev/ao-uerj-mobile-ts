import React from 'react';

import {
  BottomSheet,
  Button,
  List,
  ListRow,
  Notice,
  Section,
  StatusLabel,
  Text,
} from '@components/ui';
import {
  blocksOf,
  isBottleneck,
  type PlanSubject,
} from '@root/modules/graduation/domain/plan';
import type { GraduationPlanView } from '@root/modules/graduation/presentation/useGraduationPlan';

import {
  blocksText,
  blocksTone,
  plural,
  postponeText,
  reasonText,
  subjectMeta,
} from './planText';
import { Block, Fact, Facts, Status } from './GraduationPlan.styles';

const KIND_LABELS: Record<PlanSubject['kind'], string> = {
  MANDATORY: 'Obrigatória',
  RESTRICTED: 'Eletiva Restrita',
  DEFINED: 'Eletiva Definida',
  UNIVERSAL: 'Eletiva Universal',
  ELECTIVE: 'Eletiva',
};

type Props = {
  view: GraduationPlanView;
  subjectKey: string | null;
  onSelect: (key: string) => void;
  onClose: () => void;
  /** Abre a disciplina na Pesquisa de Disciplinas. */
  onOpenSubject: (subjectId: string) => void;
};

/**
 * Detalhe de uma disciplina do plano: por que ela está naquele período, de
 * que depende, o que libera e o que acontece com a formatura se for adiada.
 */
export function PlanSubjectSheet({
  view,
  subjectKey,
  onSelect,
  onClose,
  onOpenSubject,
}: Props) {
  const subject = view.subjects.find(item => item.key === subjectKey) ?? null;
  const index = subject ? view.plan.periodOf.get(subject.key) : undefined;
  const postponed = subject ? view.postponed.has(subject.key) : false;
  const visible = subject !== null && index !== undefined;
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={
        subject?.placeholder
          ? `${subject.name} (a escolher)`
          : (subject?.name ?? 'Disciplina')
      }
      footer={
        subject
          ? [
              <Button
                key="postpone"
                variant="outline"
                // "Desfazer o adiamento" não cabe ao lado de "Pronto"
                label={postponed ? 'Desfazer' : 'Adiar um período'}
                accessibilityLabel={
                  postponed ? 'Desfazer o adiamento' : 'Adiar um período'
                }
                onPress={() => {
                  void (postponed
                    ? view.undo(subject.key)
                    : view.postpone(subject.key));
                }}
              />,
              <Button key="done" label="Pronto" onPress={onClose} />,
            ]
          : undefined
      }
    >
      {subject && index !== undefined ? (
        <Detail
          view={view}
          subject={subject}
          index={index}
          postponed={postponed}
          onSelect={onSelect}
          onOpenSubject={onOpenSubject}
        />
      ) : null}
    </BottomSheet>
  );
}

function Detail({
  view,
  subject,
  index,
  postponed,
  onSelect,
  onOpenSubject,
}: {
  view: GraduationPlanView;
  subject: PlanSubject;
  index: number;
  postponed: boolean;
  onSelect: (key: string) => void;
  onOpenSubject: (subjectId: string) => void;
}) {
  const { plan, label } = view;
  const blocks = blocksOf(plan.graph, subject.key);
  const bottleneck = isBottleneck(plan.graph, subject.key);
  const period = plan.periods[index];
  const nameOf = (key: string) =>
    view.subjects.find(item => item.key === key)?.name ??
    view.names.get(key) ??
    key;

  // o pré-requisito planejado por último define quando ela pode entrar
  const planned = (subject.prerequisites ?? [])
    .flat()
    .filter(key => plan.periodOf.has(key))
    .sort((a, b) => plan.periodOf.get(b)! - plan.periodOf.get(a)!);
  const lastPrerequisite = planned.length
    ? {
        name: nameOf(planned[0]),
        period: label(plan.periodOf.get(planned[0])!),
      }
    : null;
  const waitedForCredits =
    subject.minimumCredits > 0 &&
    index > 0 &&
    plan.periods[index - 1].creditsBefore < subject.minimumCredits;

  const unlocks = view.subjects.filter(item =>
    (plan.graph.requires.get(item.key) ?? []).includes(subject.key),
  );

  const previewLength = postponed ? null : view.postponePreview(subject.key);
  const effect =
    previewLength === null
      ? null
      : postponeText(
          label(index + 1),
          previewLength - plan.periods.length,
          label(previewLength - 1),
        );

  return (
    <>
      <Text variant="meta" tone="muted">
        {subjectMeta(subject)}
        {subject.placeholder ? '' : ` · ${KIND_LABELS[subject.kind]}`}
      </Text>
      <Status>
        <StatusLabel
          tone={bottleneck ? blocksTone(blocks) : blocks ? 'warn' : 'neutral'}
          icon={bottleneck ? 'warning' : undefined}
          label={
            bottleneck
              ? `Gargalo: ${blocksText(blocks).toLowerCase()}`
              : blocksText(blocks)
          }
        />
      </Status>
      <Facts>
        <Fact>
          <Text variant="caption" tone="muted">
            No plano
          </Text>
          <Text weight="semibold" tabular>
            {label(index)}
          </Text>
        </Fact>
        <Fact>
          <Text variant="caption" tone="muted">
            No currículo
          </Text>
          <Text weight="semibold" tabular>
            {subject.recommendedPeriod
              ? `${subject.recommendedPeriod}º período`
              : '–'}
          </Text>
        </Fact>
      </Facts>
      <Block>
        <Text variant="meta" tone="muted">
          {reasonText({
            subject,
            postponed,
            waitedForCredits,
            lastPrerequisite,
            bottleneck,
          })}
        </Text>
      </Block>

      {subject.prerequisites === null ? (
        <Block>
          <Notice
            tone="warn"
            icon="warning"
            text="Os pré-requisitos desta disciplina não foram lidos. O plano a trata como livre."
          />
        </Block>
      ) : null}

      {!subject.placeholder &&
      (subject.prerequisites?.length || subject.minimumCredits) ? (
        <Section title="Pré-requisitos" dense>
          <List>
            {(subject.prerequisites ?? []).map(group => (
              <ListRow
                key={group.join('|')}
                title={group.map(nameOf).join(' ou ')}
                facts={<PrerequisiteStatus view={view} group={group} />}
              />
            ))}
            {subject.minimumCredits ? (
              <ListRow
                title={`${subject.minimumCredits} créditos obrigatórios aprovados`}
                facts={
                  <StatusLabel
                    tone={
                      period.creditsBefore >= subject.minimumCredits
                        ? 'good'
                        : 'bad'
                    }
                    label={`Você terá ${period.creditsBefore} em ${label(index)}`}
                  />
                }
              />
            ) : null}
          </List>
        </Section>
      ) : null}

      {unlocks.length ? (
        <Section title="Libera" dense>
          <List>
            {unlocks.map(item => {
              const at = plan.periodOf.get(item.key);
              return (
                <ListRow
                  key={item.key}
                  title={item.name}
                  meta={
                    at === undefined
                      ? 'Fora do plano'
                      : `No plano em ${label(at)}`
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

      <Block>
        {effect ? (
          <Notice
            tone={effect.tone}
            icon={effect.tone === 'warn' ? 'warning' : 'check_circle'}
            text={effect.text}
          />
        ) : (
          <Notice
            tone="neutral"
            icon="event_upcoming"
            text={`Adiada por você: entra em ${label(index)} ou depois.`}
          />
        )}
      </Block>

      {!subject.placeholder ? (
        <Block>
          <Button
            variant="text"
            size="sm"
            icon="open_in_new"
            label="Ver na Pesquisa de Disciplinas"
            onPress={() => onOpenSubject(subject.id)}
          />
        </Block>
      ) : null}
    </>
  );
}

/** Situação de um grupo de pré-requisito: cursado, em curso ou no plano. */
function PrerequisiteStatus({
  view,
  group,
}: {
  view: GraduationPlanView;
  group: readonly string[];
}) {
  if (group.some(key => view.inProgress.has(key))) {
    return <StatusLabel tone="info" label="Em curso" />;
  }
  if (group.some(key => view.completed.has(key))) {
    return <StatusLabel tone="good" icon="check_circle" label="Cursada" />;
  }
  const planned = group
    .map(key => view.plan.periodOf.get(key))
    .filter((at): at is number => at !== undefined);
  if (planned.length) {
    return (
      <StatusLabel
        tone="neutral"
        label={`No plano em ${view.label(Math.min(...planned))}`}
      />
    );
  }
  return (
    <StatusLabel
      tone="bad"
      label={`Fora do plano${group.length > 1 ? `: ${plural(group.length, 'opção', 'opções')}` : ''}`}
    />
  );
}
