import React, { useState, useEffect } from 'react';
import Modal from 'react-native-modal';

import { ErrorReportBody } from '../types';
import { sendErrorReport } from '../core';

import FeatureSelectionStep from '../FeatureSelectionStep';
import ExplanationStep from '../ExplanationStep';

import Text from '@atoms/Text';
import Spinner from '@atoms/Spinner';
import { Container } from './ErrorReportModal.styles';

type Props = {
  visible: boolean;
  setVisibility: React.Dispatch<React.SetStateAction<boolean>>;
};

const STEPS = [
  {
    component: FeatureSelectionStep,
    order: 0,
  },
  {
    component: ExplanationStep,
    order: 1,
  },
];

const INITIAL_STEP = 0;
const EXPLANATION_STEP = 1;
const LAST_STEP = STEPS.length - 1;

const ErrorReportModal = ({ visible, setVisibility }: Props) => {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(INITIAL_STEP);
  const [body, setBody] = useState<ErrorReportBody>({
    page: '',
    description: '',
    html: [],
  });

  useEffect(() => {
    if (!visible) {
      return;
    }
    setLoading(false);
    setStep(INITIAL_STEP);
    setBody({
      page: '',
      description: '',
      html: [],
    });
  }, [visible]);

  const handleSendReport = async () => {
    setLoading(true);
    await sendErrorReport(body);
    setVisibility(false);
  };

  const handleNextStep = () => {
    if (step >= LAST_STEP) {
      handleSendReport();
    }

    setStep(EXPLANATION_STEP);
  };

  const { component: CurrentComponent } = STEPS[step];

  return (
    <Modal
      isVisible={visible}
      onBackdropPress={() => setVisibility(false)}
      onBackButtonPress={() => setVisibility(false)}
      useNativeDriver
      animationIn={'fadeInDown'}
      animationInTiming={150}
      animationOut={'fadeOutUp'}
      animationOutTiming={150}
    >
      <Container>
        <Text weight="bold" alignSelf="center" textAlign="center">
          Reportar Problema
        </Text>
        {loading ? (
          <Spinner loading size="large" />
        ) : (
          <CurrentComponent setBody={setBody} nextStep={handleNextStep} />
        )}
      </Container>
    </Modal>
  );
};

export default ErrorReportModal;
