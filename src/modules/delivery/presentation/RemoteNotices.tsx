import React from 'react';
import { Linking, type StyleProp, type ViewStyle } from 'react-native';
import styled from 'styled-components/native';

import {
  Button,
  Notice,
  snackbar,
  Text,
  type IconName,
  type NoticeTone,
} from '@components/ui';
import { noticeLinkHost, type NoticeLevel } from '../domain/appStatus';
import {
  useDelivery,
  useRemoteNotices,
  useUpdateSnapshot,
} from './DeliveryProvider';

const LEVELS: Record<NoticeLevel, { tone: NoticeTone; icon: IconName }> = {
  info: { tone: 'info', icon: 'campaign' },
  warning: { tone: 'warn', icon: 'warning' },
  critical: { tone: 'bad', icon: 'error' },
};

/** Mesmo recuo da ação do `Notice` (alvo de 48dp sem empurrar o aviso). */
const Actions = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  margin: -6px 0px -12px -8px;
`;

/**
 * Topo do Início: atualização baixada esperando o reinício, a versão nova da
 * App Store (onde a loja não instala dentro do app) e os avisos do aviso
 * remoto (dispensáveis por id). Cada aviso recebe `style` (margem).
 */
export function RemoteNotices({ style }: { style?: StyleProp<ViewStyle> }) {
  const delivery = useDelivery();
  const { phase, offer } = useUpdateSnapshot();
  const { notices, dismiss } = useRemoteNotices();
  const storeName = delivery?.storeListing.name ?? 'loja';

  return (
    <>
      {offer ? (
        <Notice tone="info" icon="new_releases" style={style}>
          <Text variant="meta" weight="semibold" accessibilityRole="header">
            {`Versão ${offer} na ${storeName}`}
          </Text>
          <Actions>
            <Button
              variant="text"
              size="xs"
              icon="open_in_new"
              iconPosition="end"
              label="Atualizar"
              accessibilityRole="link"
              accessibilityLabel={`Atualizar para a versão ${offer} na ${storeName}`}
              onPress={() => {
                delivery?.updates.openStore().catch(() => {
                  snackbar.error(`Não foi possível abrir a ${storeName}.`);
                });
              }}
            />
            <Button
              variant="text"
              size="xs"
              label="Agora não"
              accessibilityLabel={`Agora não: versão ${offer} na ${storeName}`}
              onPress={() => {
                void delivery?.updates.dismissOffer();
              }}
            />
          </Actions>
        </Notice>
      ) : null}
      {phase === 'downloaded' ? (
        <Notice
          tone="good"
          icon="new_releases"
          text="Nova versão baixada. Reinicie o app para instalar."
          action={{
            label: 'Reiniciar',
            accessibilityLabel: 'Reiniciar e instalar a nova versão',
            onPress: () => {
              void delivery?.updates.restart().then(restarted => {
                if (!restarted)
                  snackbar.error(
                    'Não foi possível instalar a atualização agora.',
                  );
              });
            },
          }}
          style={style}
        />
      ) : null}
      {notices.map(notice => {
        const { tone, icon } = LEVELS[notice.level];
        const { url } = notice;
        // o domínio fica à vista antes de abrir (o validador só aceita os da lista)
        const host = url ? noticeLinkHost(url) : null;
        const urgent = notice.level !== 'info';
        return (
          <Notice key={notice.id} tone={tone} icon={icon} style={style}>
            <Text
              variant="meta"
              weight="semibold"
              accessibilityRole={urgent ? 'alert' : 'header'}
              accessibilityLiveRegion="polite"
            >
              {notice.title}
            </Text>
            <Text variant="meta">{notice.message}</Text>
            <Actions>
              {url && host ? (
                <Button
                  variant="text"
                  size="xs"
                  icon="open_in_new"
                  iconPosition="end"
                  label={`Saiba mais em ${host}`}
                  accessibilityRole="link"
                  accessibilityLabel={`Saiba mais em ${host}: ${notice.title}`}
                  onPress={() => {
                    void Linking.openURL(url);
                  }}
                />
              ) : null}
              <Button
                variant="text"
                size="xs"
                label="Dispensar"
                accessibilityLabel={`Dispensar aviso: ${notice.title}`}
                onPress={() => dismiss(notice.id)}
              />
            </Actions>
          </Notice>
        );
      })}
    </>
  );
}
