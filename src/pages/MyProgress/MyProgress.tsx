import React, { useState } from 'react';
import { ScrollView, TouchableOpacity } from 'react-native';
import Icon from '@react-native-vector-icons/material-icons';

import { ElectiveCreditsConfig } from '@hooks/useElectiveCreditsConfig';
import { useMyProgress } from './useMyProgress';

import Spinner from '@atoms/Spinner';
import CraLineChart from './CraLineChart';
import SubjectTypeCard from './SubjectTypeCard';
import ElectiveCreditsModal from './ElectiveCreditsModal';
import {
  Container,
  SectionTitle,
  Row,
  Col,
  StatCard,
  StatTitle,
  StatValue,
} from './MyProgress.styles';

export default function MyProgressPage() {
  const [modalVisible, setModalVisible] = useState(false);

  const {
    initialLoading,
    isEmpty,
    approvedCount,
    currentCRA,
    pointsOverTime,
    byType,
    electiveCreditsHook,
  } = useMyProgress();

  const handleConfigSave = async (config: ElectiveCreditsConfig) => {
    return await electiveCreditsHook.setConfig(config);
  };

  if (initialLoading && isEmpty) {
    return (
      <Container>
        <StatCard>
          <StatTitle>Carregando dados…</StatTitle>
          <Spinner size={32} />
        </StatCard>
      </Container>
    );
  }

  return (
    <Container>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Row>
          <Col>
            <StatCard>
              <StatTitle>Concluídas</StatTitle>
              <StatValue>{approvedCount}</StatValue>
            </StatCard>
          </Col>
          <Col>
            <StatCard>
              <StatTitle>CR atual (aprox.)</StatTitle>
              <StatValue>
                {Number(currentCRA).toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </StatValue>
            </StatCard>
          </Col>
        </Row>

        {pointsOverTime.length > 0 && (
          <>
            <SectionTitle>Progressão de CR</SectionTitle>
            <StatCard>
              <CraLineChart data={pointsOverTime} />
            </StatCard>
          </>
        )}

        <Row
          style={{
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 8,
            marginTop: 12,
          }}
        >
          <SectionTitle style={{ margin: 0 }}>
            Seu caminho no currículo
          </SectionTitle>
          <TouchableOpacity
            onPress={() => setModalVisible(true)}
            style={{ padding: 8 }}
          >
            <Icon name="settings" size={20} color="#666" />
          </TouchableOpacity>
        </Row>
        {byType.order.map(key => (
          <SubjectTypeCard key={key} type={key} data={byType} />
        ))}
      </ScrollView>

      <ElectiveCreditsModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSave={handleConfigSave}
        initialConfig={electiveCreditsHook.config}
      />
    </Container>
  );
}
