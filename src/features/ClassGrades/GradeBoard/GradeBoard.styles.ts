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
