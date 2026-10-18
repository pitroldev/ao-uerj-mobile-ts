import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import {
  useAppServices,
  useIdentity,
} from '@root/app/providers/AppServicesProvider';
import { version } from '@/package.json';
import { useNotificationSettings } from '@root/modules/notifications/presentation/useNotificationSettings';
import {
  BottomSheet,
  Button,
  IconTile,
  List,
  ListRow,
  Tag,
  snackbar,
} from '@components/ui';

import { APP_INFO, APP_INFO_VERSION_KEY } from './info';
import { Description } from './AppInfoModal.styles';

/**
 * Folha "Funcionalidades exclusivas", mostrada uma vez por versão do app:
 * o que o AO UERJ faz além do Aluno Online.
 */
export const AppInfoModal = () => {
  const { preferences } = useAppServices();
  const { account } = useIdentity();
  // sem os avisos no aparelho (iOS) ou com eles desligados pelo aviso remoto
  const { supported, remoteDisabled } = useNotificationSettings().snapshot;
  const items = APP_INFO.filter(
    info =>
      (!info.needsNotifications || (supported && !remoteDisabled)) &&
      (!info.androidOnly || Platform.OS === 'android'),
  );
  // Conta para a qual a folha foi aberta: trocar de conta já a esconde.
  const [shownFor, setShownFor] = useState<typeof account>(null);
  const visible = account != null && shownFor === account;
  useEffect(() => {
    let active = true;
    if (account)
      void preferences
        .read<string>(account.scope, APP_INFO_VERSION_KEY)
        .then(seenVersion => {
          if (active) setShownFor(seenVersion !== version ? account : null);
        })
        .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [account, preferences]);
  const handleClose = () => {
    setShownFor(null);
    if (account)
      void preferences
        .write(account.scope, APP_INFO_VERSION_KEY, version)
        .catch(() =>
          snackbar.error('Não foi possível salvar esta preferência.'),
        );
  };
  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      title="Funcionalidades exclusivas"
      footer={<Button label="Entendi" onPress={handleClose} />}
    >
      <Description tone="muted">
        O que o AO UERJ faz além do Aluno Online:
      </Description>
      <List>
        {items.map(info => (
          <ListRow
            key={info.title}
            leading={<IconTile icon={info.icon ?? 'star'} />}
            title={info.title}
            meta={info.description}
            accessibilityLabel={`${info.title}${info.isNew ? ', novo' : ''}. ${
              info.description
            }`}
          >
            {info.isNew ? <Tag tone="accent" label="Novo" /> : null}
          </ListRow>
        ))}
      </List>
    </BottomSheet>
  );
};
