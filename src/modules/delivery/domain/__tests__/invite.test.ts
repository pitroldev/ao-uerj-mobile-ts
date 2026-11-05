import { PLAY_LISTING_URL, inviteLink } from '../invite';

it('opens the app on the Play with the origin of the invite', () => {
  expect(inviteLink('mural')).toBe(
    'https://play.google.com/store/apps/details?id=com.aouerjmobile&referrer=utm_source%3Dmural',
  );
  expect(new URL(inviteLink('grade')).searchParams.get('referrer')).toBe(
    'utm_source=grade',
  );
  expect(inviteLink('qr').startsWith(PLAY_LISTING_URL)).toBe(true);
});
