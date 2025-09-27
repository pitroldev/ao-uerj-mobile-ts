import React from 'react';
import { ScrollView } from 'react-native';

import Text from '@atoms/Text';
import Spinner from '@atoms/Spinner';
import {
  Container,
  StatCard,
  StatTitle,
  StatValue,
  SectionTitle,
  Row,
  Col,
  ProgressContainer,
  ProgressTrack,
  ProgressFill,
  InlineStats,
  Pill,
} from './MyProgress.styles';
import CraLineChart from './CraLineChart';
import { useMyProgress } from './useMyProgress';
import { SUBJECT_TYPE } from '@utils/constants/subjectDictionary';

export default function MyProgressPage() {
  const {
    initialLoading,
    isEmpty,
    approvedCount,
    currentCRA,
    pointsOverTime,
    byType,
  } = useMyProgress();

  return (
    <Container>
      <ScrollView showsVerticalScrollIndicator={false}>
        {initialLoading && isEmpty && (
          <StatCard>
            <StatTitle>Carregando dados…</StatTitle>
            <Spinner size={32} />
          </StatCard>
        )}
        <Row>
          <Col>
            <StatCard>
              <StatTitle>Disciplinas concluídas</StatTitle>
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

        <SectionTitle>Seu caminho no currículo</SectionTitle>
        {byType.order.map(key => {
          const label = SUBJECT_TYPE[key];
          const tot = byType.totals[key];
          const comp = byType.completed[key];
          const rem = byType.remaining[key];
          const pct = byType.percent[key];
          const compCred = byType.completedCredits[key];
          const totCred = byType.totalCredits[key];

          const isBarMeaningful = key === 'MANDATORY';
          return (
            <StatCard key={key}>
              <Pill>
                <Text size="XS" color="TEXT_PRIMARY" weight="600">
                  {label}
                </Text>
              </Pill>
              {isBarMeaningful ? (
                <>
                  <StatTitle>Progresso</StatTitle>
                  <ProgressContainer>
                    <ProgressTrack>
                      <ProgressFill percent={pct} color={'#004891'} />
                    </ProgressTrack>
                    <InlineStats>
                      <Text size="XS" color="TEXT_PRIMARY">
                        Concluídas: {comp}/{tot}
                      </Text>
                      <Text size="XS" color="TEXT_PRIMARY">
                        Restantes: {rem}
                      </Text>
                    </InlineStats>
                  </ProgressContainer>
                </>
              ) : (
                <>
                  <InlineStats>
                    <Text size="XS" color="TEXT_PRIMARY">
                      Concluídas: {comp}
                    </Text>
                    <Text size="XS" color="TEXT_PRIMARY">
                      Créditos concl.: {compCred}
                    </Text>
                  </InlineStats>
                  <InlineStats>
                    <Text size="XS" color="TEXT_PRIMARY">
                      Ofertadas no currículo: {tot}
                    </Text>
                    {totCred > 0 && (
                      <Text size="XS" color="TEXT_PRIMARY">
                        Créditos ofertados: {totCred}
                      </Text>
                    )}
                  </InlineStats>
                </>
              )}
            </StatCard>
          );
        })}
      </ScrollView>
    </Container>
  );
}
