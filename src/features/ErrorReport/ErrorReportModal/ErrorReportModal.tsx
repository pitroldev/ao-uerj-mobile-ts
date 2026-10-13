import React, { useState } from 'react';

import { useAppServices } from '@root/app/providers/AppServicesProvider';
import { errorMessage } from '@root/shared/errors/AppError';
import type { ErrorReportDraft } from '@root/modules/support/application/ports';
import { BottomSheet, Button, snackbar } from '@components/ui';

import { FeatureSelectionStep } from '../FeatureSelectionStep';
import { ExplanationStep } from '../ExplanationStep';
import { SUBJECT_PAGE, isValidSubjectCode } from '../reportPages';

type Props = {
  visible: boolean;
  setVisibility: React.Dispatch<React.SetStateAction<boolean>>;
};
const emptyDraft = (): ErrorReportDraft => ({ page: '', description: '' });

/**
 * Folha "Reportar problema" em 2 passos: onde o erro aconteceu (com o código
 * da disciplina, quando for o caso) e a descrição. O relato só é enviado com
 * o rascunho completo; uma falha mantém o texto para tentar de novo.
 */
export const ErrorReportModal = ({ visible, setVisibility }: Props) => {
  const { support } = useAppServices();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [body, setBody] = useState(emptyDraft);
  const [page, setPage] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [description, setDescription] = useState('');
  // Cada abertura começa um relato novo; o ajuste é feito no render.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setLoading(false);
      setStep(0);
      setBody(emptyDraft());
      setPage('');
      setSubjectCode('');
      setDescription('');
    }
  }
  // Sem `finally`: o React Compiler 1.0 não compila try/finally, e o catch
  // já trata qualquer falha.
  const sendReport = async (draft: ErrorReportDraft) => {
    setLoading(true);
    try {
      await support.execute(draft);
      setVisibility(false);
      snackbar.success('Relato enviado. Obrigado!');
    } catch (error) {
      snackbar.error(errorMessage(error));
    }
    setLoading(false);
  };
  const nextStep = (updates: Partial<ErrorReportDraft>) => {
    const draft = { ...body, ...updates };
    setBody(draft);
    if (step === 0) setStep(1);
    else if (!loading) void sendReport(draft);
  };
  const close = () => {
    if (!loading) setVisibility(false);
  };

  const withCodeInput = page === SUBJECT_PAGE;
  const canAdvance =
    Boolean(page) && (!withCodeInput || isValidSubjectCode(subjectCode));
  const code = withCodeInput ? subjectCode.trim().toUpperCase() : undefined;

  const footer =
    step === 0
      ? [
          <Button
            key="next"
            label="Próximo"
            icon="arrow_forward"
            iconPosition="end"
            disabled={!canAdvance}
            onPress={() => nextStep({ page, subjectCode: code })}
          />,
        ]
      : [
          <Button
            key="back"
            variant="outline"
            label="Voltar"
            icon="arrow_back"
            disabled={loading}
            onPress={() => setStep(0)}
          />,
          <Button
            key="send"
            label="Enviar relato"
            icon="send"
            loading={loading}
            loadingLabel="Enviando…"
            disabled={!description.trim()}
            onPress={() => nextStep({ description })}
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
          onChangePage={setPage}
          onChangeSubjectCode={setSubjectCode}
        />
      ) : (
        <ExplanationStep
          page={body.page}
          subjectCode={body.subjectCode}
          description={description}
          onChangeDescription={setDescription}
          editable={!loading}
        />
      )}
    </BottomSheet>
  );
};
