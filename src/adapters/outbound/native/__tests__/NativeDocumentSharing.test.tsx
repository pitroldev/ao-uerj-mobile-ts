import Share from 'react-native-share';
import type { DocumentPdf } from '@root/modules/documents/domain/models';
import { NativeDocumentSharing } from '../NativeDocumentSharing';

jest.mock('react-native-share', () => ({
  __esModule: true,
  default: { open: jest.fn() },
}));

const document: DocumentPdf = {
  base64: 'JVBERi0xLjQK',
  filename: '../../matricula-209912345678-Estudante.pdf',
  mimeType: 'application/pdf',
};

beforeEach(() => {
  jest
    .mocked(Share.open)
    .mockResolvedValue({ success: true, message: 'reader' });
});

it('shares the PDF bytes through private cache with an anonymous, safe filename', async () => {
  await new NativeDocumentSharing().share(document);
  expect(Share.open).toHaveBeenCalledWith({
    url: `data:application/pdf;base64,${document.base64}`,
    type: 'application/pdf',
    filename: expect.stringMatching(/^documento-uerj-\d+-\d+$/),
    useInternalStorage: true,
    failOnCancel: false,
  });
  expect(jest.mocked(Share.open).mock.calls[0][0]?.filename).not.toContain(
    '209912345678',
  );
});

it('does not overwrite a file still being read by another receiver', async () => {
  const sharing = new NativeDocumentSharing();
  await sharing.share(document);
  await sharing.share(document);
  const filenames = jest
    .mocked(Share.open)
    .mock.calls.map(([options]) => options?.filename);
  expect(new Set(filenames).size).toBe(2);
});

it('does not fail when the student cancels and propagates a native sharing failure', async () => {
  const sharing = new NativeDocumentSharing();
  jest
    .mocked(Share.open)
    .mockResolvedValueOnce({ success: false, message: 'CANCELED' });
  await expect(sharing.share(document)).resolves.toBeUndefined();
  const failure = new Error('No receiver available');
  jest.mocked(Share.open).mockRejectedValueOnce(failure);
  await expect(sharing.share(document)).rejects.toBe(failure);
});
