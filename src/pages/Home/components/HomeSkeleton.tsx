import React from 'react';
import styled from 'styled-components/native';

import { Skeleton } from '@components/ui';

/** Altura de uma hora na régua do esqueleto (igual à agenda: 48). */
const HOUR = 48;
/** Folga acima da primeira hora da régua. */
const PAD = 10;

const Root = styled.View``;

const Sec = styled.View`
  margin-top: ${({ theme }) => theme.layout.sectionGap}px;
`;

const SecHead = styled.View`
  min-height: ${({ theme }) => theme.layout.sectionHeaderMinHeight}px;
  margin-bottom: ${({ theme }) => theme.layout.sectionHeaderGap}px;
  justify-content: center;
`;

/** ".sk-next": o card da próxima aula. */
const NextCard = styled.View`
  flex-direction: row;
  gap: 14px;
  padding: 16px;
  border-width: ${({ theme }) => theme.borders.hairline}px;
  border-color: ${({ theme }) => theme.colors.rule};
  border-radius: ${({ theme }) => theme.radii.xl}px;
  border-top-right-radius: 0px;
`;

const TimeCol = styled.View`
  width: 58px;
  gap: 8px;
`;

const MainCol = styled.View`
  flex: 1;
  gap: 8px;
`;

/** ".sk-row": linha do quadro de notas. */
const GradeRow = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 8px;
  padding: 12px 0px;
  border-bottom-width: ${({ theme }) => theme.borders.hairline}px;
  border-bottom-color: ${({ theme }) => theme.colors.rule};
`;

const GradeName = styled.View`
  flex: 1;
`;

const Days = styled.View`
  flex-direction: row;
  border-width: ${({ theme }) => theme.borders.hairline}px;
  border-color: ${({ theme }) => theme.colors.ruleStrong};
  border-radius: ${({ theme }) => theme.radii.xl}px;
  border-top-right-radius: 0px;
  overflow: hidden;
`;

const Day = styled.View<{ $first: boolean }>`
  flex: 1;
  height: 60px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-left-width: ${({ theme, $first }) =>
    $first ? 0 : theme.borders.hairline}px;
  border-left-color: ${({ theme }) => theme.colors.rule};
`;

const Cal = styled.View`
  position: relative;
  margin-top: 44px;
  height: ${PAD * 2 + 4 * HOUR}px;
`;

/** Fio de hora (sem o rótulo, que fica na coluna de 44 + 8). */
const HourRule = styled.View<{ $top: number }>`
  position: absolute;
  left: 52px;
  right: 0px;
  top: ${({ $top }) => $top}px;
  height: ${({ theme }) => theme.borders.hairline}px;
  background-color: ${({ theme }) => theme.colors.rule};
`;

const Block = styled.View<{ $top: number }>`
  position: absolute;
  left: 56px;
  right: 0px;
  top: ${({ $top }) => $top}px;
  z-index: 1;
`;

/**
 * Esqueleto do Início (".sk-*"): próxima aula, quadro de notas e semana com a
 * régua de horas. Substitui o indicador girando enquanto nada foi carregado.
 */
const HomeSkeleton = () => (
  <Root
    accessible
    accessibilityLabel="Carregando dados…"
    accessibilityState={{ busy: true }}
  >
    <Sec>
      <SecHead>
        <Skeleton width={120} height={18} />
      </SecHead>
      <NextCard>
        <TimeCol>
          <Skeleton width={56} height={22} />
          <Skeleton width={44} height={12} />
        </TimeCol>
        <MainCol>
          <Skeleton width="72%" height={18} />
          <Skeleton width="46%" height={12} />
          <Skeleton width="58%" height={12} />
        </MainCol>
      </NextCard>
    </Sec>

    <Sec>
      <SecHead>
        <Skeleton width={64} height={18} />
      </SecHead>
      {[0, 1, 2, 3, 4].map(i => (
        <GradeRow key={i}>
          <GradeName>
            <Skeleton width={i % 2 ? '62%' : '80%'} height={14} />
          </GradeName>
          <Skeleton width={40} height={28} />
          <Skeleton width={40} height={28} />
          <Skeleton width={40} height={28} />
          <Skeleton width={40} height={28} />
        </GradeRow>
      ))}
    </Sec>

    <Sec>
      <SecHead>
        <Skeleton width={84} height={18} />
      </SecHead>
      <Days>
        {[0, 1, 2, 3, 4, 5].map(i => (
          <Day key={i} $first={i === 0}>
            <Skeleton width={22} height={10} />
            <Skeleton width={18} height={16} />
          </Day>
        ))}
      </Days>
      <Cal>
        {[0, 1, 2, 3, 4].map(h => (
          <HourRule key={h} $top={PAD + h * HOUR} />
        ))}
        <Block $top={PAD + 41}>
          <Skeleton height={78} radius={12} cut />
        </Block>
        <Block $top={PAD + 137}>
          <Skeleton height={86} radius={12} cut />
        </Block>
      </Cal>
    </Sec>
  </Root>
);

export default HomeSkeleton;
