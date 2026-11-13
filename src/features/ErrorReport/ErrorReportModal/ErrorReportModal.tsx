import React, { useLayoutEffect, useReducer, useRef, useState } from 'react';

import {
  useAppServices,
  useIdentity,
} from '@root/app/providers/AppServicesProvider';
import { errorMessage } from '@root/shared/errors/AppError';
import { BottomSheet, Button, snackbar } from '@components/ui';

import { FeatureSelectionStep } from '../FeatureSelectionStep';
import { ExplanationStep } from '../ExplanationStep';
import {
  canExplain,
  INITIAL_REPORT,
  reportDraft,
  reportFlow,
} from './reportFlow';

type Props = {
  visible: boolean;
  setVisibility: React.Dispatch<React.SetStateAction<boolean>>;
};

/**
 * Folha "Reportar problema" em 2 passos: onde o erro aconteceu (com o código
 * da disciplina, quando for o caso) e a descrição. O relato só é enviado com
 * o rascunho completo; uma falha mantém o texto para tentar de novo.
 */
export const ErrorReportModal = ({ visible, setVisibility }: Props) => {
  const [session, setSession] = useState({ visible, id: 0 });
  if (session.visible !== visible) {
    setSession({ visible, id: session.id + (visible ? 1 : 0) });
  }
  // A nova abertura desmonta o formulário antigo e invalida seus callbacks.
  return (
    <ReportForm
      key={session.id}
      visible={visible}
      setVisibility={setVisibility}
    />
  );
};

function ReportForm({ visible, setVisibility }: Props) {
  const { support, generatorRuns } = useAppServices();
  const scope = useIdentity().account?.scope;
  const [state, dispatch] = useReducer(reportFlow, INITIAL_REPORT);
  // lida ao abrir a folha: a última tentativa no gerador, em contagens
  const [generator] = useState(() => generatorRuns.read(scope));
  const { page, subjectCode, description } = state.fields;
  const step = state.phase === 'selecting' ? 0 : 1;
  const loading = state.phase === 'submitting';
  const locked = loading || state.phase === 'submitted';
  const pending = useRef<object | null>(null);
  const active = useRef(false);
  useLayoutEffect(() => {
    active.current = visible;
    return () => {
      active.current = false;
      pending.current = null;
    };
  }, [visible]);

  const sendReport = async () => {
    if (
      !active.current ||
      pending.current ||
      reportFlow(state, { type: 'submit' }) === state
    )
      return;
    const request = {};
    pending.current = request;
    dispatch({ type: 'submit' });
    try {
      await support.execute(reportDraft(state, generator));
      if (!active.current || pending.current !== request) return;
      dispatch({ type: 'sent' });
      setVisibility(false);
      snackbar.success('Relato enviado. Obrigado!');
    } catch (error) {
      if (!active.current || pending.current !== request) return;
      dispatch({ type: 'failed' });
      snackbar.error(errorMessage(error));
    }
    pending.current = null;
  };
  const close = () => {
    if (!pending.current) setVisibility(false);
  };
  const draft = reportDraft(state, generator);

  const footer =
    step === 0
      ? [
          <Button
            key="next"
            label="Próximo"
            icon="arrow_forward"
            iconPosition="end"
            disabled={!canExplain(state)}
            onPress={() => dispatch({ type: 'next' })}
          />,
        ]
      : [
          <Button
            key="back"
            variant="outline"
            label="Voltar"
            icon="arrow_back"
            disabled={locked}
            onPress={() => dispatch({ type: 'back' })}
          />,
          <Button
            key="send"
            label="Enviar relato"
            icon="send"
            loading={loading}
            loadingLabel="Enviando…"
            disabled={locked || !description.trim()}
            onPress={() => {
              void sendReport();
            }}
          />,
        ];

  return (
    <BottomSheet
      visible={visible}
      onClose={close}
      swipeToClose={!loading}
      title="Reportar problema"
      meta={`Passo ${step + 1} de 2`}
      footer={footer}
    >
      {step === 0 ? (
        <FeatureSelectionStep
          page={page}
          subjectCode={subjectCode}
          onChangePage={value =>
            dispatch({ type: 'edit', field: 'page', value })
          }
          onChangeSubjectCode={value =>
            dispatch({ type: 'edit', field: 'subjectCode', value })
          }
        />
      ) : (
        <ExplanationStep
          page={draft.page}
          subjectCode={draft.subjectCode}
          withGeneratorSummary={Boolean(draft.generator)}
          description={description}
          onChangeDescription={value =>
            dispatch({ type: 'edit', field: 'description', value })
          }
          editable={!locked}
        />
      )}
    </BottomSheet>
  );
}
