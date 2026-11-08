import { IDLE_DOWNLOAD, updateDownload } from '../updateDownload';

it.each([
  [25, 100, 0.25],
  [-1, 100, 0],
  [150, 100, 1],
  [0, 0, null],
  [NaN, 100, null],
  [Infinity, 100, null],
])(
  'normalizes progress %s / %s to %s',
  (bytesDownloaded, totalBytes, expected) => {
    const state = updateDownload(IDLE_DOWNLOAD, {
      type: 'progress',
      status: 'downloading',
      bytesDownloaded,
      totalBytes,
    });
    expect(state).toEqual({ phase: 'downloading', progress: expected });
  },
);

it('requires a reset or store event to leave the downloaded state', () => {
  const downloaded = updateDownload(IDLE_DOWNLOAD, {
    type: 'progress',
    status: 'downloaded',
    bytesDownloaded: 0,
    totalBytes: 0,
  });
  expect(downloaded).toEqual({ phase: 'downloaded', progress: 1 });
  expect(updateDownload(downloaded, { type: 'accepted' })).toBe(downloaded);
  expect(
    updateDownload(downloaded, {
      type: 'progress',
      status: 'installing',
      bytesDownloaded: 0,
      totalBytes: 0,
    }),
  ).toBe(downloaded);
  expect(updateDownload(downloaded, { type: 'reset' })).toEqual(IDLE_DOWNLOAD);
});
