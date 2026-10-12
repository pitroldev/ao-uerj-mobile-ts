import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { ThemeProvider } from 'styled-components/native';
import { useAppServices } from '@root/app/providers/AppServicesProvider';
import { LIGHT } from '@root/themes';
import { Button } from '@components/ui';
import ErrorReportModal from '../ErrorReportModal';

jest.mock('@root/app/providers/AppServicesProvider', () => ({
  useAppServices: jest.fn(),
}));
jest.mock('react-native-modal', () => 'Modal');
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('react-native-toast-message', () => ({ show: jest.fn() }));
jest.mock('../../FeatureSelectionStep', () => 'FeatureStep');
jest.mock('../../ExplanationStep', () => 'ExplanationStep');

describe('support submission', () => {
  let renderer: TestRenderer.ReactTestRenderer;
  const execute = jest.fn();
  const setVisibility = jest.fn();

  const button = (label: string) =>
    renderer.root.findAllByType(Button).find(b => b.props.label === label)!;
  const press = async (label: string) => {
    await act(async () => button(label).props.onPress());
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    execute.mockResolvedValue(undefined);
    jest
      .mocked(useAppServices)
      .mockReturnValue({ support: { execute } } as unknown as ReturnType<
        typeof useAppServices
      >);
    await act(async () => {
      renderer = TestRenderer.create(
        <ThemeProvider theme={LIGHT}>
          <ErrorReportModal visible setVisibility={setVisibility} />
        </ThemeProvider>,
      );
    });
  });
  afterEach(async () => {
    await act(async () => renderer.unmount());
  });

  async function selectFeature() {
    expect(button('Próximo').props.disabled).toBe(true);
    await act(async () =>
      renderer.root
        .findByType('FeatureStep' as never)
        .props.onChangePage('Quadro de Notas'),
    );
    await press('Próximo');
  }
  async function describeProblem(description: string) {
    await act(async () =>
      renderer.root
        .findByType('ExplanationStep' as never)
        .props.onChangeDescription(description),
    );
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
  });

  it('preserves the report and leaves loading after a failed submission', async () => {
    execute.mockRejectedValue(new Error('offline'));
    await selectFeature();
    await describeProblem('Notas não aparecem.');
    await press('Enviar relato');
    expect(setVisibility).not.toHaveBeenCalled();
    expect(
      renderer.root.findByType('ExplanationStep' as never).props.description,
    ).toBe('Notas não aparecem.');
    expect(button('Enviar relato').props.loading).toBe(false);
    expect(
      renderer.root.findByType('ExplanationStep' as never).props.editable,
    ).toBe(true);
  });

  it('asks for a valid subject code before leaving the first step', async () => {
    const step = () => renderer.root.findByType('FeatureStep' as never);
    await act(async () =>
      step().props.onChangePage('Informações de uma disciplina específica'),
    );
    await act(async () => step().props.onChangeSubjectCode('ime02'));
    expect(button('Próximo').props.disabled).toBe(true);
    await act(async () => step().props.onChangeSubjectCode(' ime02-01388 '));
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
