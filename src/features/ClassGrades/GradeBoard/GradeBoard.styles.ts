import styled from 'styled-components/native';

/** Nome + "● Bom na P1" na primeira coluna (".gt-name" / ".gt-sub"). */
export const NameCell = styled.View`
  gap: 3px;
`;

/** ".legend": pontos com rótulo, quebrando linha. */
export const Legend = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  column-gap: 14px;
  row-gap: 6px;
  margin-top: 10px;
`;

/** Item da legenda com marcador próprio, no alinhamento do `StatusLabel`. */
export const LegendItem = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 6px;
`;

/** Amostra da nota necessária: a célula tracejada, em miniatura. */
export const TargetSwatch = styled.View`
  width: 14px;
  height: 10px;
  border-width: 1.5px;
  border-style: dashed;
  border-color: ${({ theme }) => theme.colors.inkMuted};
  border-radius: 3px;
  border-top-right-radius: 0px;
`;

export const SimulateButton = styled.View`
  margin-top: ${({ theme }) => theme.spacing.lg}px;
`;

/**
 * Notas embaixo do nome, quando a fonte do sistema não deixa as quatro
 * colunas caberem ao lado dele.
 */
export const GradeStrip = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  row-gap: 8px;
  margin-top: 8px;
`;

/** Rótulo ("P1", "Média") sobre a célula de nota, na largura de uma coluna. */
export const GradeSlot = styled.View<{ $width: number }>`
  width: ${({ $width }) => $width}px;
  align-items: center;
  gap: 4px;
`;
