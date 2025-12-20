import React, { useState, useEffect } from 'react';
import {
  Modal,
  TouchableOpacity,
  Alert,
  TextInput as RNTextInput,
} from 'react-native';
import Icon from '@react-native-vector-icons/material-icons';

import Text from '@atoms/Text';
import { SUBJECT_TYPE } from '@utils/constants/subjectDictionary';
import {
  ElectiveType,
  ElectiveCreditsConfig,
} from '@hooks/useElectiveCreditsConfig';

import {
  ModalOverlay,
  ModalContainer,
  ModalHeader,
  ModalTitle,
  ModalContent,
  ConfigSection,
  ConfigLabel,
  ConfigInput,
  ButtonRow,
  CancelButton,
  SaveButton,
  CloseIcon,
} from './ElectiveCreditsModal.styles';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: (config: ElectiveCreditsConfig) => Promise<boolean>;
  initialConfig: ElectiveCreditsConfig;
}

export default function ElectiveCreditsModal({
  visible,
  onClose,
  onSave,
  initialConfig,
}: Props) {
  const [tempConfig, setTempConfig] =
    useState<ElectiveCreditsConfig>(initialConfig);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setTempConfig(initialConfig);
    }
  }, [visible, initialConfig]);

  const saveConfig = async () => {
    try {
      setSaving(true);
      const success = await onSave(tempConfig);
      if (success) {
        onClose();
      } else {
        Alert.alert('Erro', 'Não foi possível salvar as configurações');
      }
    } catch (error) {
      console.error('Erro ao salvar configuração de créditos:', error);
      Alert.alert('Erro', 'Não foi possível salvar as configurações');
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (type: ElectiveType, value: string) => {
    const numericValue = parseInt(value) || 0;
    setTempConfig(prev => ({
      ...prev,
      [type]: Math.max(0, numericValue),
    }));
  };

  const resetConfig = () => {
    Alert.alert(
      'Resetar Configurações',
      'Deseja resetar todas as configurações de créditos para 0?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Resetar',
          style: 'destructive',
          onPress: () => {
            setTempConfig({
              RESTRICTED: 0,
              DEFINED: 0,
              UNIVERSAL: 0,
            });
          },
        },
      ],
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <ModalOverlay>
        <ModalContainer>
          <ModalHeader>
            <ModalTitle>Configurar Créditos Faltantes</ModalTitle>
          </ModalHeader>

          <ModalContent>
            <Text size="SM" color="TEXT_PRIMARY" style={{ marginBottom: 16 }}>
              Configure quantos créditos ainda faltam para cada tipo de eletiva
            </Text>

            {(['RESTRICTED', 'DEFINED', 'UNIVERSAL'] as ElectiveType[]).map(
              type => (
                <ConfigSection key={type}>
                  <ConfigLabel>
                    <Text size="SM" weight="600" color="TEXT_PRIMARY">
                      {SUBJECT_TYPE[type]}
                    </Text>
                  </ConfigLabel>
                  <ConfigInput>
                    <RNTextInput
                      value={tempConfig[type].toString()}
                      onChangeText={value => handleInputChange(type, value)}
                      keyboardType="numeric"
                      placeholder="0"
                      maxLength={3}
                      style={{
                        flex: 1,
                        fontSize: 16,
                        color: '#333',
                        paddingVertical: 12,
                      }}
                    />
                    <Text
                      size="XS"
                      color="TEXT_SECONDARY"
                      style={{ marginLeft: 8 }}
                    >
                      créditos
                    </Text>
                  </ConfigInput>
                </ConfigSection>
              ),
            )}

            <ButtonRow>
              <TouchableOpacity onPress={resetConfig}>
                <Text size="SM" color="ERROR" weight="600">
                  Resetar
                </Text>
              </TouchableOpacity>
            </ButtonRow>

            <ButtonRow style={{ marginTop: 20 }}>
              <CancelButton onPress={onClose}>
                <Text
                  size="SM"
                  color="TEXT_PRIMARY"
                  weight="600"
                  alignSelf="center"
                >
                  Cancelar
                </Text>
              </CancelButton>
              <SaveButton onPress={saveConfig}>
                <Text
                  size="SM"
                  color="BACKGROUND"
                  weight="600"
                  alignSelf="center"
                >
                  Salvar
                </Text>
              </SaveButton>
            </ButtonRow>
          </ModalContent>
        </ModalContainer>
      </ModalOverlay>
    </Modal>
  );
}
