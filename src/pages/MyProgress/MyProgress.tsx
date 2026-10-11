import { QueryNotice } from '@root/modules/academics/presentation/QueryNotice';
import DummyMessage from '@molecules/DummyMessage';
import SmallDummyMessage from '@molecules/SmallDummyMessage';
import React, { useState } from 'react';
import { ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons as Icon } from '@react-native-vector-icons/material-icons';

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
    curriculumAvailable,
    approvedCount,
    currentCRA,
    pointsOverTime,
    byType,
    electiveCreditsHook,
    error,
    dataUpdatedAt,
    isPaused,
    isFetching,
    retry,
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
        <QueryNotice
          dataUpdatedAt={dataUpdatedAt}
          isPaused={isPaused}
          isFetching={isFetching}
          error={error}
          hasData={!isEmpty}
          retry={retry}
        />
        {error && isEmpty && (
          <DummyMessage
            type="ERROR"
            text="Não foi possível carregar seu progresso. Toque para tentar novamente."
            onPress={retry}
          />
        )}
        {!error && !isPaused && isEmpty && (
          <DummyMessage
            type="EMPTY"
            text="Ainda não há histórico ou currículo disponível."
          />
        )}
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

        <Row style={styles.heading}>
          <SectionTitle style={styles.title}>
            Seu caminho no currículo
          </SectionTitle>
          <TouchableOpacity
            onPress={() => setModalVisible(true)}
            style={styles.settings}
          >
            <Icon name="settings" size={20} color="#666" />
          </TouchableOpacity>
        </Row>
        {!curriculumAvailable && (
          <SmallDummyMessage
            type="INFO"
            text="Currículo indisponível. Os totais e o progresso serão exibidos após o carregamento."
            onPress={retry}
          />
        )}
        {byType.order.map(key => (
          <SubjectTypeCard
            key={key}
            type={key}
            data={byType}
            curriculumAvailable={curriculumAvailable}
          />
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

const styles = StyleSheet.create({
  title: { margin: 0 },
  settings: { padding: 8 },
  heading: {
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginTop: 12,
  },
});
