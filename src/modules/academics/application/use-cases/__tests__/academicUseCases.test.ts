import { ShareSchedule } from '../ShareSchedule';
import { ScheduleSharingPort } from '../../ports/ScheduleSharingPort';
import { normalizeSubjectId } from '../../../domain/rules/subjectId';

describe('subject identifiers', () => {
  it('canonicalizes numeric and full IDs into the same resource', () => {
    expect(normalizeSubjectId('IME02-01388')).toBe('1388');
    expect(normalizeSubjectId('01388')).toBe('1388');
    expect(normalizeSubjectId(1388)).toBe('1388');
  });
  it.each(['', '0', 'UERJ00-00000', 'NaN', '1e3', '123abc', '-5', 'TRAVA'])(
    'rejects malformed code %s',
    code => {
      expect(() => normalizeSubjectId(code)).toThrow(
        'Código de disciplina inválido.',
      );
    },
  );
});

describe('schedule sharing', () => {
  let sharing: jest.Mocked<ScheduleSharingPort>;
  beforeEach(() => {
    sharing = {
      capturePng: jest.fn().mockResolvedValue('file:///schedule.png'),
      share: jest.fn().mockResolvedValue(undefined),
    };
  });
  it('shares the native PNG when capture succeeds', async () => {
    const target = {};
    await new ShareSchedule(sharing).execute(
      target,
      'data:image/svg+xml;base64,svg',
    );
    expect(sharing.capturePng).toHaveBeenCalledWith(target);
    expect(sharing.share).toHaveBeenCalledWith({
      url: 'file:///schedule.png',
      type: 'image/png',
    });
  });
  it('retains SVG bytes and MIME when capture fails instead of relabeling as PNG', async () => {
    sharing.capturePng.mockRejectedValue(new Error('capture unavailable'));
    await new ShareSchedule(sharing).execute(
      {},
      'data:image/svg+xml;base64,svg',
    );
    expect(sharing.share).toHaveBeenCalledWith({
      url: 'data:image/svg+xml;base64,svg',
      type: 'image/svg+xml',
    });
  });
  it('does not open another share dialog if sharing fails', async () => {
    sharing.share.mockRejectedValue(new Error('share unavailable'));
    await expect(new ShareSchedule(sharing).execute({}, 'svg')).rejects.toThrow(
      'share unavailable',
    );
    expect(sharing.share).toHaveBeenCalledTimes(1);
  });
});
