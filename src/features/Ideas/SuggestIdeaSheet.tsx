import React, { useLayoutEffect, useReducer, useRef, useState } from 'react';
import { Keyboard } from 'react-native';
import styled, { useTheme } from 'styled-components/native';

import {
  BottomSheet,
  Button,
  Card,
  ChipGroup,
  FieldError,
  FilterChip,
  Icon,
  IconTile,
  Notice,
  SegmentedControl,
  Tag,
  Text,
  TextField,
  snackbar,
} from '@components/ui';
import {
  IDEA_AREAS,
  IDEA_LIMITS,
  IdeaError,
  PORTAL_ANSWERS,
  cleanTitle,
  type IdeaField,
  type MyIdea,
  type SimilarIdea,
} from '@root/modules/ideas/domain/ideas';
import {
  AREA_TEXT,
  fieldErrorText,
  ideasErrorMessage,
  ISSUE_SECTIONS,
  issueTitle,
  LIMIT_TEXT,
  PORTAL_TEXT,
  requestsText,
  SERVER_CONTACT_TEXT,
  STATUS_TEXT,
} from '@root/modules/ideas/presentation/ideasText';
import { useIdeaActions } from '@root/modules/ideas/presentation/useIdeas';

import {
  ideaFlow,
  INITIAL_IDEA,
  STEP_NUMBER,
  visibleProblems,
  type IdeaFlow,
} from './ideaFlow';

const STEPS = 3;

/** O aviso de que fica pública, numa frase, antes de mandar. */
export const PUBLIC_TEXT =
  'Fica pública no GitHub, sem seu nome, matrícula ou e-mail.';

const Bar = styled.View`
  flex-direction: row;
  gap: ${({ theme }) => theme.spacing.xs}px;
  margin: ${({ theme }) => theme.spacing.xxs}px 0px
    ${({ theme }) => theme.spacing.lg}px;
`;

const Segment = styled.View<{ $tone: 'done' | 'current' | 'next' }>`
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background-color: ${({ theme, $tone }) =>
    $tone === 'done'
      ? theme.status.good.ink
      : $tone === 'current'
        ? theme.colors.fill
        : theme.colors.surfaceStrong};
`;

const Field = styled.View`
  margin-bottom: ${({ theme }) => theme.spacing.xl}px;
`;

const Label = styled(Text)`
  margin-bottom: ${({ theme }) => theme.spacing.sm}px;
`;

const Stack = styled.View`
  gap: ${({ theme }) => theme.spacing.md}px;
`;

const Row = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm}px;
`;

const PreviewBar = styled.View`
  flex-direction: row;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm - 2}px;
  padding: ${({ theme }) => theme.spacing.sm}px
    ${({ theme }) => theme.spacing.md}px;
  border-bottom-width: ${({ theme }) => theme.borders.hairline}px;
  border-bottom-color: ${({ theme }) => theme.colors.rule};
  background-color: ${({ theme }) => theme.colors.surfaceMuted};
`;

const PreviewBody = styled.View`
  gap: ${({ theme }) => theme.spacing.xs}px;
  padding: ${({ theme }) => theme.spacing.md}px;
`;

/** O título de uma seção do issue na prévia. */
const Heading = styled(Text)`
  margin-top: ${({ theme }) => theme.spacing.sm}px;
`;

const Done = styled.View`
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md}px;
  padding: ${({ theme }) => theme.spacing.lg}px 0px;
`;

const Gap = styled.View`
  height: ${({ theme }) => theme.spacing.md}px;
`;

/** Os 3 passos, como traços: feitos em verde, o atual no azul. */
function StepBar({ current }: { current: number }) {
  return (
    <Bar
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {Array.from({ length: STEPS }, (_, index) => (
        <Segment
          key={index}
          $tone={
            index + 1 < current
              ? 'done'
              : index + 1 === current
                ? 'current'
                : 'next'
          }
        />
      ))}
    </Bar>
  );
}

type Props = {
  visible: boolean;
  onClose: () => void;
  /** "Minhas sugestões" na confirmação (fora dela, a folha só fecha). */
  onShowMine?: () => void;
};

/**
 * "Sugerir uma ideia": a ideia (os campos do formulário de sugestão do
 * GitHub), as parecidas que já existem (somar o pedido em vez de repetir) e
 * a prévia de como fica pública. Cada abertura começa um rascunho novo.
 */
export function SuggestIdeaSheet({ visible, onClose, onShowMine }: Props) {
  const [session, setSession] = useState({ visible, id: 0 });
  if (session.visible !== visible) {
    setSession({ visible, id: session.id + (visible ? 1 : 0) });
  }
  // a nova abertura desmonta o rascunho antigo e invalida os callbacks dele
  return (
    <IdeaForm
      key={session.id}
      visible={visible}
      onClose={onClose}
      onShowMine={onShowMine}
    />
  );
}

function IdeaForm({ visible, onClose, onShowMine }: Props) {
  const theme = useTheme();
  const actions = useIdeaActions();
  const [flow, dispatch] = useReducer(ideaFlow, INITIAL_IDEA);
  // o limite do dia, se a lista já foi lida (somar o pedido não conta)
  const [remaining] = useState(() => actions.remainingToday());
  const active = useRef(false);
  useLayoutEffect(() => {
    active.current = visible;
    return () => {
      active.current = false;
    };
  }, [visible]);

  const busy = flow.busy !== null;
  const problems = visibleProblems(flow);
  const errorOf = (field: IdeaField) => {
    const problem = problems[field];
    if (!problem) return undefined;
    return problem === 'refused'
      ? SERVER_CONTACT_TEXT
      : fieldErrorText(field, problem);
  };

  const next = async () => {
    Keyboard.dismiss();
    const after = ideaFlow(flow, { type: 'next' });
    dispatch({ type: 'next' });
    if (after.busy !== 'searching') return;
    try {
      const similar = await actions.similar(flow.draft);
      if (active.current) dispatch({ type: 'found', similar });
    } catch (error) {
      if (!active.current) return;
      // sem o GitHub, a ideia ainda vai: só não dá para ver as parecidas
      if (error instanceof IdeaError && error.refusal === 'github')
        dispatch({ type: 'found', similar: [] });
      else {
        dispatch({ type: 'failed' });
        snackbar.error(ideasErrorMessage(error));
      }
    }
  };

  const send = async () => {
    if (busy) return;
    dispatch({ type: 'send' });
    try {
      const idea = await actions.submit(flow.draft, flow.seenSimilar);
      if (active.current) dispatch({ type: 'done', idea });
    } catch (error) {
      if (!active.current) return;
      if (error instanceof IdeaError && error.refusal === 'contact')
        dispatch({ type: 'refused', field: error.field });
      else dispatch({ type: 'failed' });
      snackbar.error(ideasErrorMessage(error));
    }
  };

  const join = async (issue: number) => {
    if (busy) return;
    dispatch({ type: 'join', issue });
    try {
      const idea = await actions.vote(issue);
      if (active.current) dispatch({ type: 'done', idea });
    } catch (error) {
      if (!active.current) return;
      if (error instanceof IdeaError && error.refusal === 'gone')
        dispatch({ type: 'gone', issue });
      else dispatch({ type: 'failed' });
      snackbar.error(ideasErrorMessage(error));
    }
  };

  const close = () => {
    if (!busy) onClose();
  };

  let title: string;
  let meta: string | undefined;
  let body: React.ReactNode;
  let footer: React.ReactNode;
  const back = (
    <Button
      key="back"
      variant="outline"
      icon="arrow_back"
      label="Voltar"
      disabled={busy}
      onPress={() => dispatch({ type: 'back' })}
    />
  );

  if (flow.step === 'done' && flow.result) {
    const result = flow.result;
    title = result.kind === 'sent' ? 'Sugestão enviada' : 'Pedido somado';
    body = <Confirmation idea={result} />;
    footer = onShowMine
      ? [
          <Button
            key="close"
            variant="outline"
            label="Fechar"
            onPress={onClose}
          />,
          <Button
            key="mine"
            icon="history"
            label="Minhas sugestões"
            onPress={onShowMine}
          />,
        ]
      : [<Button key="close" label="Fechar" onPress={onClose} />];
  } else if (flow.step === 'similar') {
    title = 'Já sugeriram algo parecido?';
    meta = `Passo ${STEP_NUMBER.similar} de ${STEPS}`;
    body = (
      <>
        <StepBar current={STEP_NUMBER.similar} />
        <Stack>
          {flow.similar.map(item => (
            <SimilarCard
              key={item.number}
              idea={item}
              joining={
                typeof flow.busy === 'object' &&
                flow.busy?.joining === item.number
              }
              disabled={busy}
              onJoin={() => {
                void join(item.number);
              }}
            />
          ))}
        </Stack>
      </>
    );
    footer = [
      back,
      <Button
        key="other"
        variant="outline"
        label="A minha é outra"
        icon="arrow_forward"
        iconPosition="end"
        disabled={busy}
        onPress={() => dispatch({ type: 'other' })}
      />,
    ];
  } else if (flow.step === 'review') {
    title = 'Vai ficar pública assim';
    meta = `Passo ${STEP_NUMBER.review} de ${STEPS}`;
    body = (
      <>
        <StepBar current={STEP_NUMBER.review} />
        <Preview flow={flow} />
        <Gap />
        <Notice
          tone="neutral"
          icon="lock"
          iconColor={theme.colors.inkMuted}
          text={PUBLIC_TEXT}
        />
      </>
    );
    footer = [
      back,
      <Button
        key="send"
        icon="send"
        label="Enviar sugestão"
        loading={flow.busy === 'sending'}
        loadingLabel="Enviando…"
        disabled={busy}
        onPress={() => {
          void send();
        }}
      />,
    ];
  } else {
    title = 'Sugerir uma ideia';
    meta = `Passo ${STEP_NUMBER.write} de ${STEPS}`;
    const { draft } = flow;
    body = (
      <>
        <StepBar current={STEP_NUMBER.write} />
        {remaining === 0 ? (
          <Field>
            <Notice tone="warn" icon="schedule" text={LIMIT_TEXT} />
          </Field>
        ) : null}
        <Field>
          <TextField
            label="Sua ideia em uma frase"
            value={draft.title}
            onChangeText={value =>
              dispatch({ type: 'text', field: 'title', value })
            }
            maxLength={IDEA_LIMITS.title.max}
            placeholder="Ex.: avisar quando abrir vaga no RID"
            autoCorrect
            editable={!busy}
            error={errorOf('title')}
          />
        </Field>
        <Field>
          <Label variant="meta" weight="medium">
            Onde no app?
          </Label>
          <ChipGroup layout="wrap" accessibilityLabel="Onde no app?">
            {IDEA_AREAS.map(area => (
              <FilterChip
                key={area}
                label={AREA_TEXT[area]}
                selected={draft.area === area}
                disabled={busy}
                onPress={() => dispatch({ type: 'area', value: area })}
              />
            ))}
          </ChipGroup>
          {problems.area ? (
            <FieldError message={fieldErrorText('area', 'short')} />
          ) : null}
        </Field>
        <Field>
          <TextField
            label="Que problema ela resolve?"
            multiline
            value={draft.problem}
            onChangeText={value =>
              dispatch({ type: 'text', field: 'problem', value })
            }
            maxLength={IDEA_LIMITS.problem.max}
            placeholder="Ex.: fico abrindo o portal toda hora pra ver se abriu vaga."
            autoCorrect
            editable={!busy}
            error={errorOf('problem')}
          />
        </Field>
        <Field>
          <Label variant="meta" weight="medium">
            O Aluno Online já faz isso?
          </Label>
          <SegmentedControl
            accessibilityLabel="O Aluno Online já faz isso?"
            options={PORTAL_ANSWERS.map(answer => ({
              value: answer,
              label: PORTAL_TEXT[answer].option,
              accessibilityLabel: PORTAL_TEXT[answer].full,
            }))}
            value={draft.portal}
            onChange={value => dispatch({ type: 'portal', value })}
          />
        </Field>
        {flow.withIdea || draft.idea ? (
          <Field>
            <TextField
              label="Como você imagina (opcional)"
              multiline
              value={draft.idea}
              onChangeText={value =>
                dispatch({ type: 'text', field: 'idea', value })
              }
              maxLength={IDEA_LIMITS.idea.max}
              autoCorrect
              // aberto agora pelo "+": o teclado já vem
              autoFocus={!draft.idea}
              editable={!busy}
              error={errorOf('idea')}
            />
          </Field>
        ) : (
          <Button
            variant="text"
            size="sm"
            icon="add"
            label="Como você imagina (opcional)"
            disabled={busy}
            onPress={() => dispatch({ type: 'openIdea' })}
          />
        )}
      </>
    );
    footer = [
      <Button
        key="next"
        label="Próximo"
        icon="arrow_forward"
        iconPosition="end"
        loading={flow.busy === 'searching'}
        loadingLabel="Procurando parecidas…"
        disabled={busy}
        onPress={() => {
          void next();
        }}
      />,
    ];
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={close}
      swipeToClose={!busy}
      title={title}
      meta={meta}
      footer={footer}
    >
      {body}
    </BottomSheet>
  );
}

/** Uma parecida: o título, o estado no GitHub, quantos pediram e "somar". */
function SimilarCard({
  idea,
  joining,
  disabled,
  onJoin,
}: {
  idea: SimilarIdea;
  joining: boolean;
  disabled: boolean;
  onJoin: () => void;
}) {
  const status = STATUS_TEXT[idea.status];
  return (
    <Card padding={12}>
      <Stack>
        <Row>
          <Text variant="body" weight="semibold">
            {idea.title}
          </Text>
          <Text variant="meta" tone="muted">
            #{idea.number}
          </Text>
        </Row>
        <Row>
          <Tag tone={status.tone} icon={status.icon} label={status.label} />
          <Text variant="meta" tone="muted">
            {requestsText(idea.requests)}
          </Text>
        </Row>
        <Button
          variant="outline"
          size="sm"
          icon="thumb_up"
          label="É essa: somar meu pedido"
          accessibilityLabel={`É essa: somar meu pedido em ${idea.title}`}
          loading={joining}
          loadingLabel="Somando…"
          disabled={disabled}
          onPress={onJoin}
        />
      </Stack>
    </Card>
  );
}

/** O issue como vai sair: o título, as seções e a área. */
function Preview({ flow }: { flow: IdeaFlow }) {
  const theme = useTheme();
  const { draft } = flow;
  const idea = draft.idea.trim();
  return (
    <Card padding={0}>
      <PreviewBar>
        <Icon
          name="public"
          size={theme.sizes.icon.sm}
          color={theme.colors.inkMuted}
        />
        <Text variant="caption" tone="muted">
          github.com · ao-uerj-mobile-ts
        </Text>
      </PreviewBar>
      <PreviewBody>
        <Text variant="body" weight="semibold">
          {issueTitle(cleanTitle(draft.title))}
        </Text>
        <Heading variant="caption" tone="muted">
          {ISSUE_SECTIONS.problem}
        </Heading>
        <Text variant="meta">{draft.problem.trim()}</Text>
        {idea ? (
          <>
            <Heading variant="caption" tone="muted">
              {ISSUE_SECTIONS.idea}
            </Heading>
            <Text variant="meta">{idea}</Text>
          </>
        ) : null}
        <Heading variant="caption" tone="muted">
          {ISSUE_SECTIONS.portal}
        </Heading>
        <Text variant="meta">{PORTAL_TEXT[draft.portal].full}</Text>
        {draft.area ? (
          <>
            <Heading variant="caption" tone="muted">
              {ISSUE_SECTIONS.area}
            </Heading>
            <Row>
              <Tag label={AREA_TEXT[draft.area]} />
            </Row>
          </>
        ) : null}
      </PreviewBody>
    </Card>
  );
}

/** Mandada (esperando a moderação) ou o pedido somado, com a contagem nova. */
function Confirmation({ idea }: { idea: MyIdea }) {
  const sent = idea.kind === 'sent';
  return (
    <Done>
      <IconTile icon={sent ? 'task_alt' : 'thumb_up'} tone="good" size="lg" />
      <Text align="center" tone="muted">
        {sent
          ? 'Ela vai para o GitHub depois de uma olhada.'
          : idea.requests > 1
            ? `Agora são ${requestsText(idea.requests)}.`
            : 'O seu é o primeiro pedido.'}
      </Text>
    </Done>
  );
}
