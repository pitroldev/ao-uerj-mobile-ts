import styled from 'styled-components/native';

import { Text } from '@components/ui';

/** ".msg": a linha do balão; as mensagens do aluno ficam à direita. */
export const Row = styled.View<{ $mine: boolean }>`
  flex-direction: row;
  justify-content: ${({ $mine }) => ($mine ? 'flex-end' : 'flex-start')};
`;

/**
 * ".bubble": fio de 1px, raio 12 com o canto do remetente marcado (4 no
 * superior esquerdo para os colegas; o canto reto da marca no superior
 * direito para o aluno, sobre o acento suave).
 */
export const Bubble = styled.Pressable<{ $mine: boolean }>`
  max-width: 86%;
  padding: 9px 12px 10px;
  border-width: ${({ theme }) => theme.borders.hairline}px;
  border-color: ${({ theme, $mine }) =>
    $mine ? theme.colors.accentLine : theme.colors.rule};
  border-radius: ${({ theme }) => theme.radii.xl}px;
  border-top-left-radius: ${({ theme, $mine }) =>
    $mine ? theme.radii.xl : theme.radii.xs}px;
  border-top-right-radius: ${({ theme, $mine }) =>
    $mine ? 0 : theme.radii.xl}px;
`;

/** ".msg-h": autor à esquerda, hora à direita. */
export const Head = styled.View`
  flex-direction: row;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 2px;
`;

export const Author = styled(Text)`
  flex-shrink: 1;
`;
