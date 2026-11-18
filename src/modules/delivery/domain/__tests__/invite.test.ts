import {
  APP_STORE_LISTING_URL,
  PLAY_LISTING_URL,
  inviteLink,
  inviteLinks,
} from '../invite';

it('opens the app on the Play with the origin of the invite', () => {
  expect(inviteLink('mural', 'android')).toBe(
    'https://play.google.com/store/apps/details?id=com.aouerjmobile&referrer=utm_source%3Dmural',
  );
  expect(
    new URL(inviteLink('grade', 'android')).searchParams.get('referrer'),
  ).toBe('utm_source=grade');
  expect(inviteLink('qr', 'android').startsWith(PLAY_LISTING_URL)).toBe(true);
});

it('opens the app on the Brazilian App Store, without the origin', () => {
  expect(APP_STORE_LISTING_URL).toBe(
    'https://apps.apple.com/br/app/id6835308883',
  );
  expect(inviteLink('mural', 'ios')).toBe(APP_STORE_LISTING_URL);
  expect(inviteLink('qr', 'ios')).toBe(APP_STORE_LISTING_URL);
});

it('puts both links on their own lines, Android first', () => {
  expect(inviteLinks('menu')).toBe(
    `Android: ${PLAY_LISTING_URL}&referrer=utm_source%3Dmenu\niPhone: ${APP_STORE_LISTING_URL}`,
  );
});
