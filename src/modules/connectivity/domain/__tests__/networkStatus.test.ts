import {
  classifyNetworkStatus,
  isUnvalidatedNetwork,
  type NetworkReading,
} from '../networkStatus';

it.each<[NetworkReading, boolean, string]>([
  [{ isConnected: false, isInternetReachable: false }, false, 'offline'],
  [{ isConnected: false, isInternetReachable: null }, true, 'offline'],
  [{ isConnected: true, isInternetReachable: true }, false, 'online'],
  [{ isConnected: true, isInternetReachable: null }, false, 'online'],
  [{ isConnected: null, isInternetReachable: null }, false, 'online'],
  [
    { type: 'wifi', isConnected: true, isInternetReachable: false },
    false,
    'unvalidated_wifi',
  ],
  [
    { type: 'cellular', isConnected: true, isInternetReachable: false },
    false,
    'unvalidated',
  ],
  [
    { type: 'wifi', isConnected: true, isInternetReachable: false },
    true,
    'online',
  ],
])(
  'classifies %o (portalVerified=%s) as %s',
  (reading, portalVerified, expected) => {
    expect(classifyNetworkStatus(reading, portalVerified)).toBe(expected);
  },
);

it('identifies unvalidated network states', () => {
  expect(isUnvalidatedNetwork('unvalidated_wifi')).toBe(true);
  expect(isUnvalidatedNetwork('unvalidated')).toBe(true);
  expect(isUnvalidatedNetwork('online')).toBe(false);
  expect(isUnvalidatedNetwork('offline')).toBe(false);
});
