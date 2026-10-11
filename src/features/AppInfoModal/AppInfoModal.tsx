import React, { useEffect, useState } from 'react';
import Modal from 'react-native-modal';
import Toast from 'react-native-toast-message';
import {
  useAppServices,
  useIdentity,
} from '@root/app/providers/AppServicesProvider';
import { APP_INFO } from './info';
import { version } from '@/package.json';
import Text from '@atoms/Text';
import {
  Container,
  FeatureContainer,
  Row,
  ScrollView,
} from './AppInfoModal.styles';

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
    <Modal
      isVisible={visible}
      onBackdropPress={handleClose}
      onBackButtonPress={handleClose}
      useNativeDriver
      animationIn="fadeInDown"
      animationInTiming={150}
      animationOut="fadeOutUp"
      animationOutTiming={150}
    >
      <Container>
        <Text weight="bold" size="LG" marginBottom="16px">
          Funcionalidades exclusivas
        </Text>
        <ScrollView>
          {APP_INFO.map(info => (
            <FeatureContainer key={info.title}>
              <Row>
                <Text weight="bold">{info.title}</Text>
                {info.isNew && (
                  <Text italic weight="bold" size="XS">
                    *novo*
                  </Text>
                )}
              </Row>
              <Text italic size="SM" marginLeft="8px">
                • {info.description}
              </Text>
            </FeatureContainer>
          ))}
        </ScrollView>
      </Container>
    </Modal>
  );
};

export default AppInfoModal;
