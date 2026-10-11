import React, { useState, useEffect } from 'react';
import Modal from 'react-native-modal';
import Toast from 'react-native-toast-message';
import { useAppServices } from '@root/app/providers/AppServicesProvider';
import { errorMessage } from '@root/shared/errors/AppError';
import type { ErrorReportDraft } from '@root/modules/support/application/ports';
import FeatureSelectionStep from '../FeatureSelectionStep';
import ExplanationStep from '../ExplanationStep';
import Text from '@atoms/Text';
import Spinner from '@atoms/Spinner';
import { Container } from './ErrorReportModal.styles';

type Props = {
  visible: boolean;
  setVisibility: React.Dispatch<React.SetStateAction<boolean>>;
};
const emptyDraft = (): ErrorReportDraft => ({ page: '', description: '' });

const ErrorReportModal = ({ visible, setVisibility }: Props) => {
  const { support } = useAppServices();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [body, setBody] = useState(emptyDraft);
  useEffect(() => {
    if (visible) {
      setLoading(false);
      setStep(0);
      setBody(emptyDraft());
    }
  }, [visible]);
  const sendReport = async (draft: ErrorReportDraft) => {
    setLoading(true);
    try {
      await support.execute(draft);
      setVisibility(false);
      Toast.show({ type: 'success', text1: 'Relato enviado. Obrigado!' });
    } catch (error) {
      Toast.show({ type: 'error', text1: errorMessage(error) });
    } finally {
      setLoading(false);
    }
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
  return (
    <Modal
      isVisible={visible}
      onBackdropPress={close}
      onBackButtonPress={close}
      useNativeDriver
      animationIn="fadeInDown"
      animationInTiming={150}
      animationOut="fadeOutUp"
      animationOutTiming={150}
    >
      <Container>
        <Text weight="bold" alignSelf="center" textAlign="center">
          Reportar problema
        </Text>
        {loading ? (
          <Spinner loading size="large" />
        ) : step === 0 ? (
          <FeatureSelectionStep body={body} nextStep={nextStep} />
        ) : (
          <ExplanationStep body={body} nextStep={nextStep} />
        )}
      </Container>
    </Modal>
  );
};

export default ErrorReportModal;
