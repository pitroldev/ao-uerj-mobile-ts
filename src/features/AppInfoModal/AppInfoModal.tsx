import React, { useEffect, useState } from 'react';
import Toast from 'react-native-toast-message';
import {
  useAppServices,
  useIdentity,
} from '@root/app/providers/AppServicesProvider';
import { version } from '@/package.json';
import {
  BottomSheet,
  Button,
  IconTile,
  List,
  ListRow,
  Tag,
} from '@components/ui';

import { APP_INFO } from './info';
import { Description } from './AppInfoModal.styles';

/**
 * Folha "Funcionalidades exclusivas", mostrada uma vez por versão do app:
 * o que o AO UERJ faz além do Aluno Online.
 */
const AppInfoModal = () => {
  const { preferences } = useAppServices();
  const { account } = useIdentity();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    let active = true;
    setVisible(false);
    if (account)
      void preferences
        .read<string>(account.scope, 'app-info-version')
        .then(seenVersion => {
          if (active) setVisible(seenVersion !== version);
        })
        .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [account, preferences]);
  const handleClose = () => {
    setVisible(false);
    if (account)
      void preferences
        .write(account.scope, 'app-info-version', version)
        .catch(() =>
          Toast.show({
            type: 'error',
            text1: 'Não foi possível salvar esta preferência.',
          }),
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
        {APP_INFO.map(info => (
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

export default AppInfoModal;
