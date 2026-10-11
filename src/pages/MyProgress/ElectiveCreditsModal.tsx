import React, { useState, useEffect } from 'react';
import {
  Modal,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput as RNTextInput,
} from 'react-native';

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
    const numericValue = parseInt(value, 10) || 0;
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
            <ModalTitle>Configurar Créditos Exigidos</ModalTitle>
          </ModalHeader>

          <ModalContent>
            <Text size="SM" color="TEXT_PRIMARY" style={styles.description}>
              Configure o total de créditos exigidos pelo currículo para cada
              tipo de eletiva
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
                      style={styles.input}
                    />
                    <Text
                      size="XS"
                      color="TEXT_SECONDARY"
                      style={styles.creditUnit}
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

            <ButtonRow style={styles.actions}>
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
              <SaveButton onPress={saveConfig} disabled={saving}>
                <Text
                  size="SM"
                  color="BACKGROUND"
                  weight="600"
                  alignSelf="center"
                >
                  {saving ? 'Salvando…' : 'Salvar'}
                </Text>
              </SaveButton>
            </ButtonRow>
          </ModalContent>
        </ModalContainer>
      </ModalOverlay>
    </Modal>
  );
}

const styles = StyleSheet.create({
  description: { marginBottom: 16 },
  creditUnit: { marginLeft: 8 },
  actions: { marginTop: 20 },
  input: { flex: 1, fontSize: 16, color: '#333', paddingVertical: 12 },
});
