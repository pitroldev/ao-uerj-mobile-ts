export type NetworkStatus =
  'online' | 'unvalidated_wifi' | 'unvalidated' | 'offline';

export type NetworkReading = {
  type?: string | null;
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
};

/**
 * Classifica a conexão vista pelo sistema operacional.
 *
 * `isInternetReachable === null` aparece enquanto o SO ainda testa a rede:
 * conta como `'online'` até haver resposta, sem exibir falso alerta na
 * abertura. Com `isConnected: true` e `isInternetReachable: false` (o ponto de
 * exclamação no Wi-Fi), o aparelho tem link local sem internet validada —
 * típico de Wi-Fi com portal cativo ou firewall do campus. Se o Aluno Online
 * já respondeu nesta conexão (`portalVerified`), ela passa a valer como
 * `'online'`.
 */
export function classifyNetworkStatus(
  reading: NetworkReading,
  portalVerified = false,
): NetworkStatus {
  if (reading.isConnected === false) return 'offline';
  if (reading.isConnected === true && reading.isInternetReachable === false) {
    if (portalVerified) return 'online';
    return reading.type === 'wifi' ? 'unvalidated_wifi' : 'unvalidated';
  }
  return 'online';
}

export function isUnvalidatedNetwork(status: NetworkStatus): boolean {
  return status === 'unvalidated_wifi' || status === 'unvalidated';
}
