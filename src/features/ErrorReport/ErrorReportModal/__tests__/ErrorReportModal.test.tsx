import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useAppServices } from '@root/app/providers/AppServicesProvider';
import ErrorReportModal from '../ErrorReportModal';

jest.mock('@root/app/providers/AppServicesProvider', () => ({
  useAppServices: jest.fn(),
}));
jest.mock('react-native-modal', () => 'Modal');
jest.mock('react-native-toast-message', () => ({ show: jest.fn() }));
jest.mock('@atoms/Text', () => 'Text');
jest.mock('@atoms/Spinner', () => 'Spinner');
jest.mock('../../FeatureSelectionStep', () => 'FeatureStep');
jest.mock('../../ExplanationStep', () => 'ExplanationStep');
jest.mock('../ErrorReportModal.styles', () => ({ Container: 'Container' }));

describe('support submission', () => {
  let renderer: TestRenderer.ReactTestRenderer;
  const execute = jest.fn();
  const setVisibility = jest.fn();

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
        <ErrorReportModal visible setVisibility={setVisibility} />,
      );
    });
  });
  afterEach(async () => {
    await act(async () => renderer.unmount());
  });

  async function selectFeature() {
    await act(async () =>
      renderer.root
        .findByType('FeatureStep' as never)
        .props.nextStep({ page: 'Quadro de Notas' }),
    );
  }

  it('submits the current description atomically with the selected feature', async () => {
    await selectFeature();
    await act(async () =>
      renderer.root
        .findByType('ExplanationStep' as never)
        .props.nextStep({ description: 'Notas não aparecem.' }),
    );
    expect(execute).toHaveBeenCalledWith({
      page: 'Quadro de Notas',
      description: 'Notas não aparecem.',
    });
    expect(setVisibility).toHaveBeenCalledWith(false);
  });

  it('preserves the report and leaves loading after a failed submission', async () => {
    execute.mockRejectedValue(new Error('offline'));
    await selectFeature();
    await act(async () =>
      renderer.root
        .findByType('ExplanationStep' as never)
        .props.nextStep({ description: 'Notas não aparecem.' }),
    );
    expect(setVisibility).not.toHaveBeenCalled();
    expect(
      renderer.root.findByType('ExplanationStep' as never).props.body
        .description,
    ).toBe('Notas não aparecem.');
    expect(renderer.root.findAllByType('Spinner' as never)).toHaveLength(0);
  });
});
