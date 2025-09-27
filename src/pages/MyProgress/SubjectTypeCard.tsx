import React from 'react';
import Text from '@atoms/Text';
import { SUBJECT_TYPE } from '@utils/constants/subjectDictionary';
import {
  StatCard,
  StatTitle,
  ProgressContainer,
  ProgressTrack,
  ProgressFill,
  InlineStats,
  Pill,
} from './MyProgress.styles';

type SubjectTypeKey = keyof typeof SUBJECT_TYPE;

interface SubjectTypeData {
  totals: Record<SubjectTypeKey, number>;
  completed: Record<SubjectTypeKey, number>;
  remaining: Record<SubjectTypeKey, number>;
  requiredCredits: Record<SubjectTypeKey, number | null>;
  percent: Record<SubjectTypeKey, number>;
  totalCredits: Record<SubjectTypeKey, number>;
  completedCredits: Record<SubjectTypeKey, number>;
}

interface Props {
  type: SubjectTypeKey;
  data: SubjectTypeData;
}

export default function SubjectTypeCard({ type, data }: Props) {
  const label = SUBJECT_TYPE[type];
  const tot = data.totals[type];
  const comp = data.completed[type];
  const rem = data.remaining[type];
  const pct = data.percent[type];
  const compCred = data.completedCredits[type];
  const totCred = data.totalCredits[type];
  const requiredCred = data.requiredCredits[type];

  const isMandatory = type === 'MANDATORY';
  const hasRequiredCredits = requiredCred && requiredCred > 0;
  const showProgressBar = isMandatory || hasRequiredCredits;

  return (
    <StatCard>
      <Pill>
        <Text size="XS" color="TEXT_PRIMARY" weight="600">
          {label}
        </Text>
      </Pill>

      {showProgressBar ? (
        <>
          <StatTitle>Progresso</StatTitle>
          <ProgressContainer>
            <ProgressTrack>
              <ProgressFill percent={pct} color={'#004891'} />
            </ProgressTrack>
            <InlineStats>
              {isMandatory ? (
                <>
                  <Text size="XS" color="TEXT_PRIMARY">
                    Concluídas: {comp}/{tot}
                  </Text>
                  <Text size="XS" color="TEXT_PRIMARY">
                    Restantes: {rem}
                  </Text>
                </>
              ) : (
                <>
                  <Text size="XS" color="TEXT_PRIMARY">
                    Créditos: {compCred}/{requiredCred}
                  </Text>
                  <Text size="XS" color="TEXT_PRIMARY">
                    Restantes: {Math.max(0, (requiredCred || 0) - compCred)}
                  </Text>
                </>
              )}
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
          <Text
            size="XS"
            color="TEXT_SECONDARY"
            style={{ marginTop: 8, fontStyle: 'italic' }}
          >
            Configure os créditos necessários para ver o progresso
          </Text>
        </>
      )}
    </StatCard>
  );
}
