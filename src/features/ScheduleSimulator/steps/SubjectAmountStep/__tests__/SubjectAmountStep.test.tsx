import React from 'react';
import { screen, userEvent } from '@testing-library/react-native';
import { FormProvider, useForm } from 'react-hook-form';
import { renderWithProviders } from '@root/test-utils/render';
import { StepsProvider } from '@hooks/useSteps';
import {
  createScheduleDraft,
  ScheduleCreationParams,
} from '@root/modules/planning/domain/models';
import { SubjectAmountStep } from '../SubjectAmountStep';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const nextStep = jest.fn();

type Amounts = Pick<
  ScheduleCreationParams,
  'min_subject_amount' | 'max_subject_amount'
>;
const FILLED: Amounts = { min_subject_amount: 3, max_subject_amount: 3 };
/** Rascunho novo do gerador: os dois campos começam vazios. */
const EMPTY: Amounts = { min_subject_amount: null, max_subject_amount: null };
const RANGE_MESSAGE = 'Use um número de 1 a 12.';

function StepForm({
  amounts,
  children,
}: {
  amounts: Amounts;
  children: React.ReactNode;
}) {
  // mesmo modo do formulário da tela (ScheduleCreationPage)
  const form = useForm<ScheduleCreationParams>({
    mode: 'all',
    defaultValues: { ...createScheduleDraft(), ...amounts },
  });
  return (
    <FormProvider {...form}>
      <StepsProvider
        values={{
          step: 0,
          nextStep,
          prevStep: jest.fn(),
          setStep: jest.fn(),
        }}
      >
        {children}
      </StepsProvider>
    </FormProvider>
  );
}

let user: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  jest.useFakeTimers();
  nextStep.mockClear();
  user = userEvent.setup();
});
afterEach(() => {
  jest.useRealTimers();
});

const renderStep = (amounts: Amounts = FILLED) =>
  renderWithProviders(
    <StepForm amounts={amounts}>
      <SubjectAmountStep />
    </StepForm>,
  );
const nextButton = () => screen.getByRole('button', { name: 'Próximo' });
const minimumInput = () => screen.getByLabelText('mínimo de matérias');
const maximumInput = () => screen.getByLabelText('máximo de matérias');
const enterAmount = async (
  input: ReturnType<typeof minimumInput>,
  text: string,
) => {
  await user.clear(input);
  if (text) await user.type(input, text);
};
const enterAmounts = async (minimum: string, maximum: string) => {
  await enterAmount(minimumInput(), minimum);
  await enterAmount(maximumInput(), maximum);
};
const submit = () => user.press(nextButton());
const expectRequiredMessages = () => {
  expect(
    screen.getByText('O mínimo de matérias é obrigatório'),
  ).toBeOnTheScreen();
  expect(
    screen.getByText('O máximo de matérias é obrigatório'),
  ).toBeOnTheScreen();
};

it('advances when the student wants exactly one subject', async () => {
  await renderStep();
  await enterAmounts('1', '1');
  expect(nextButton()).toBeEnabled();
  await submit();
  expect(nextStep).toHaveBeenCalledTimes(1);
});

it('validates a fresh draft on "Próximo" before anything is typed', async () => {
  await renderStep(EMPTY);
  // nada digitado ainda: sem erro, o botão fica habilitado e só o envio valida
  expect(minimumInput()).toHaveDisplayValue('');
  expect(maximumInput()).toHaveDisplayValue('');
  expect(nextButton()).toBeEnabled();
  await submit();
  expect(nextStep).not.toHaveBeenCalled();
  expectRequiredMessages();
  expect(nextButton()).toBeDisabled();
  await enterAmounts('2', '3');
  expect(nextButton()).toBeEnabled();
  await submit();
  expect(nextStep).toHaveBeenCalledTimes(1);
});

it('clears both initial quantities and replaces them without restoring the previous digits', async () => {
  await renderStep();
  expect(minimumInput()).toHaveDisplayValue('3');
  expect(maximumInput()).toHaveDisplayValue('3');
  // ao focar, o valor fica selecionado e o que se digita o substitui
  expect(minimumInput()).toHaveProp('selectTextOnFocus', true);
  expect(maximumInput()).toHaveProp('selectTextOnFocus', true);
  await enterAmounts('', '');
  expect(minimumInput()).toHaveDisplayValue('');
  expect(maximumInput()).toHaveDisplayValue('');
  expectRequiredMessages();
  expect(nextButton()).toBeDisabled();
  await enterAmounts('1', '2');
  expect(minimumInput()).toHaveDisplayValue('1');
  expect(maximumInput()).toHaveDisplayValue('2');
  await submit();
  expect(nextStep).toHaveBeenCalledTimes(1);
});

it.each([
  ['0', '1'],
  ['1', '0'],
])(
  'rejects a zero quantity (%s to %s) and accepts it after correction',
  async (minimum, maximum) => {
    await renderStep();
    await enterAmounts(minimum, maximum);
    expect(screen.getByText(RANGE_MESSAGE)).toBeOnTheScreen();
    expect(nextButton()).toBeDisabled();
    await enterAmounts('1', '2');
    expect(screen.queryByText(RANGE_MESSAGE)).not.toBeOnTheScreen();
    expect(nextButton()).toBeEnabled();
    await submit();
    expect(nextStep).toHaveBeenCalledTimes(1);
  },
);

it('swaps a minimum above the maximum before advancing', async () => {
  await renderStep();
  await enterAmounts('4', '2');
  await submit();
  expect(nextStep).toHaveBeenCalledTimes(1);
  expect(minimumInput()).toHaveDisplayValue('2');
  expect(maximumInput()).toHaveDisplayValue('4');
});

it('keeps "Anterior" disabled on the first step', async () => {
  await renderStep();
  expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
});
