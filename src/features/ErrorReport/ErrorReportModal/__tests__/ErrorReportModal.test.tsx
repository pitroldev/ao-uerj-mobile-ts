import React from 'react';
import { screen, userEvent } from '@testing-library/react-native';
import { useAppServices } from '@root/app/providers/AppServicesProvider';
import { renderWithProviders } from '@root/test-utils/render';
import { ErrorReportModal } from '../ErrorReportModal';

jest.mock('@root/app/providers/AppServicesProvider', () => ({
  useAppServices: jest.fn(),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const DESCRIPTION = 'Descreva o que aconteceu e o resultado esperado';
const SUBJECT_CODE = 'Insira o código da disciplina';

describe('support submission', () => {
  const execute = jest.fn();
  const setVisibility = jest.fn();
  let user: ReturnType<typeof userEvent.setup>;

  const button = (label: string) => screen.getByRole('button', { name: label });
  const press = (label: string) => user.press(button(label));

  beforeEach(async () => {
    // o userEvent espera o tempo de cada toque e tecla; com timers falsos ele
    // avança o relógio sozinho e o teste não fica lento
    jest.useFakeTimers();
    jest.clearAllMocks();
    execute.mockResolvedValue(undefined);
    jest
      .mocked(useAppServices)
      .mockReturnValue({ support: { execute } } as unknown as ReturnType<
        typeof useAppServices
      >);
    user = userEvent.setup();
    await renderWithProviders(
      <ErrorReportModal visible setVisibility={setVisibility} />,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // os passos são os de verdade: o relato é preenchido como o aluno faria
  async function selectFeature() {
    expect(button('Próximo')).toBeDisabled();
    await user.press(screen.getByRole('radio', { name: 'Quadro de Notas' }));
    await press('Próximo');
  }
  async function describeProblem(description: string) {
    await user.type(screen.getByLabelText(DESCRIPTION), description);
  }

  it('submits the current description atomically with the selected feature', async () => {
    await selectFeature();
    await describeProblem('Notas não aparecem.');
    await press('Enviar relato');
    expect(execute).toHaveBeenCalledWith({
      page: 'Quadro de Notas',
      description: 'Notas não aparecem.',
    });
    expect(setVisibility).toHaveBeenCalledWith(false);
    // o aviso aparece no host de avisos da própria folha
    expect(
      await screen.findByText('Relato enviado. Obrigado!'),
    ).toBeOnTheScreen();
  });

  it('preserves the report and leaves loading after a failed submission', async () => {
    execute.mockRejectedValue(new Error('offline'));
    await selectFeature();
    await describeProblem('Notas não aparecem.');
    await press('Enviar relato');
    expect(setVisibility).not.toHaveBeenCalled();
    // por cima da folha, que continua aberta
    expect(
      await screen.findByText('Não foi possível concluir. Tente novamente.'),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText(DESCRIPTION)).toHaveDisplayValue(
      'Notas não aparecem.',
    );
    expect(button('Enviar relato')).not.toBeBusy();
    expect(screen.getByLabelText(DESCRIPTION)).toBeEnabled();
  });

  it('asks for a valid subject code before leaving the first step', async () => {
    await user.press(
      screen.getByRole('radio', {
        name: 'Informações de uma disciplina específica',
      }),
    );
    await user.type(screen.getByLabelText(SUBJECT_CODE), 'ime02');
    expect(button('Próximo')).toBeDisabled();
    await user.clear(screen.getByLabelText(SUBJECT_CODE));
    await user.type(screen.getByLabelText(SUBJECT_CODE), ' ime02-01388 ');
    await press('Próximo');
    await describeProblem('Turmas vazias.');
    await press('Enviar relato');
    expect(execute).toHaveBeenCalledWith({
      page: 'Informações de uma disciplina específica',
      subjectCode: 'IME02-01388',
      description: 'Turmas vazias.',
    });
  });
});
