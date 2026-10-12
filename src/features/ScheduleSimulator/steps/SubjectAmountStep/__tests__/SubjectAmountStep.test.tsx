import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { FormProvider, useForm } from 'react-hook-form';
import { ThemeProvider } from 'styled-components/native';
import { LIGHT } from '@root/themes';
import StepsProvider from '@hooks/useSteps';
import {
  createScheduleDraft,
  ScheduleCreationParams,
} from '@root/modules/planning/domain/models';
import { Button, NumberStepper } from '@components/ui';
import SubjectAmountStep from '../SubjectAmountStep';

jest.mock('react-native-modal', () => 'Modal');
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const nextStep = jest.fn();
let renderer: ReactTestRenderer;

function Form() {
  const form = useForm<ScheduleCreationParams>({
    mode: 'all',
    defaultValues: {
      ...createScheduleDraft(),
      min_subject_amount: 3,
      max_subject_amount: 3,
    },
  });
  return (
    <ThemeProvider theme={LIGHT}>
      <FormProvider {...form}>
        <StepsProvider
          values={{
            step: 0,
            nextStep,
            prevStep: jest.fn(),
            setStep: jest.fn(),
          }}
        >
          <SubjectAmountStep />
        </StepsProvider>
      </FormProvider>
    </ThemeProvider>
  );
}

beforeEach(async () => {
  nextStep.mockClear();
  await act(async () => {
    renderer = create(<Form />);
  });
});
afterEach(async () => {
  await act(async () => renderer.unmount());
});

const nextButton = () =>
  renderer.root.find(
    node => node.type === Button && node.props.label === 'Próximo',
  );
const enterAmounts = async (minimum: string, maximum: string) => {
  const inputs = renderer.root.findAllByType(NumberStepper);
  await act(async () => {
    inputs[0].props.onChangeText(minimum);
    inputs[1].props.onChangeText(maximum);
  });
};
const submit = async () => {
  await act(async () => {
    await nextButton().props.onPress();
  });
};

it('advances when the student wants exactly one subject', async () => {
  await enterAmounts('1', '1');
  expect(nextButton().props.disabled).toBe(false);
  await submit();
  expect(nextStep).toHaveBeenCalledTimes(1);
});

it('clears both initial quantities and replaces them without restoring the previous digits', async () => {
  const inputValues = () =>
    renderer.root.findAllByType(NumberStepper).map(input => input.props.value);
  expect(inputValues()).toEqual(['3', '3']);
  await enterAmounts('', '');
  expect(inputValues()).toEqual(['', '']);
  expect(nextButton().props.disabled).toBe(true);
  await submit();
  expect(nextStep).not.toHaveBeenCalled();
  await enterAmounts('1', '2');
  expect(inputValues()).toEqual(['1', '2']);
  await submit();
  expect(nextStep).toHaveBeenCalledTimes(1);
});

it.each([
  ['0', '1'],
  ['1', '0'],
])(
  'rejects a zero quantity (%s to %s) and accepts it after correction',
  async (minimum, maximum) => {
    await enterAmounts(minimum, maximum);
    expect(nextButton().props.disabled).toBe(true);
    await submit();
    expect(nextStep).not.toHaveBeenCalled();
    await enterAmounts('1', '2');
    expect(nextButton().props.disabled).toBe(false);
    await submit();
    expect(nextStep).toHaveBeenCalledTimes(1);
  },
);

it('keeps "Anterior" disabled on the first step', () => {
  const previous = renderer.root.find(
    node =>
      node.type === Button && node.props.accessibilityLabel === 'Anterior',
  );
  expect(previous.props.disabled).toBe(true);
});
