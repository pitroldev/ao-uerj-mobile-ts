import React from 'react';
import Modal from 'react-native-modal';
import { useDispatch } from 'react-redux';

import { useAppSelector } from '@root/store';
import * as infoReducer from '@reducers/userInfo';

import { APP_INFO } from './info';

import Text from '@atoms/Text';
import {
  Container,
  FeatureContainer,
  Row,
  ScrollView,
} from './AppInfoModal.styles';

const AppInfoModal = () => {
  const dispatch = useDispatch();

  const { wasPreviouslyLogged } = useAppSelector(infoReducer.selectUserInfo);

  const handleClose = () => {
    dispatch(infoReducer.setFirstLogin());
  };

  return (
    <Modal
      isVisible={!wasPreviouslyLogged}
      onBackdropPress={handleClose}
      onBackButtonPress={handleClose}
      useNativeDriver
      animationIn={'fadeInDown'}
      animationInTiming={150}
      animationOut={'fadeOutUp'}
      animationOutTiming={150}
    >
      <Container>
        <Text weight="bold" size="LG" marginBottom="16px">
          Funcionalidades exclusivas
        </Text>
        <ScrollView>
          {APP_INFO.map((info, index) => (
            <FeatureContainer key={index}>
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
