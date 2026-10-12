import styled from 'styled-components/native';

import { Divider } from '@components/ui';

/** Espaço do topo da conversa até a primeira data (".panel.chat .panel-scroll"). */
export const CONTENT_TOP = 8;
/** Margem acima do separador de data (".day-sep" margin-top 12). */
export const SEPARATOR_TOP = 12;
/** Altura da faixa da data (no fluxo e grudada). */
export const SEPARATOR_HEIGHT = 20;
/** Distância da etiqueta grudada até o fio do cabeçalho fixo. */
export const STICKY_TOP = 4;
/**
 * Folga opaca abaixo da etiqueta grudada. Quando a etiqueta assume o lugar
 * do separador, o primeiro balão do dia ainda fica 8 abaixo da faixa
 * (separador 20 + 4 + gap 8, contra 20 + esta folga).
 */
export const STICKY_GAP = 4;

/** Área das mensagens: recorta a etiqueta quando ela sai pelo topo. */
export const Area = styled.View`
  flex: 1;
  overflow: hidden;
`;

export const Messages = styled.View`
  gap: 8px;
`;

/** Um dia: a data seguida das mensagens dele (".msgs" gap 8). */
export const Day = styled.View`
  gap: 8px;
`;

/** ".day-sep": fio, data, fio (12 acima, 4 abaixo, 20 de altura). */
export const DaySeparator = styled(Divider)`
  min-height: ${SEPARATOR_HEIGHT}px;
  margin-top: ${SEPARATOR_TOP}px;
  margin-bottom: 4px;
`;

/**
 * Faixa opaca da etiqueta grudada, da largura da conversa: cobre do topo até
 * logo abaixo da etiqueta, então o separador original do dia e os balões
 * passam por baixo dela inteiros, sem restos cortados em volta da etiqueta.
 */
export const StickySlot = styled.View`
  position: absolute;
  top: 0px;
  left: 0px;
  right: 0px;
  align-items: center;
  padding-top: ${STICKY_TOP}px;
  padding-bottom: ${STICKY_GAP}px;
  background-color: ${({ theme }) => theme.colors.surface};
`;

/** Etiqueta da data grudada no topo (12/16, fio forte, 20 de altura). */
export const StickyPill = styled.View`
  min-height: ${SEPARATOR_HEIGHT}px;
  justify-content: center;
  padding: 1px 9px;
  border-width: ${({ theme }) => theme.borders.hairline}px;
  border-color: ${({ theme }) => theme.colors.ruleStrong};
  border-radius: ${({ theme }) => theme.radii.pill}px;
  background-color: ${({ theme }) => theme.colors.surface};
`;

/** Esqueleto de um balão enquanto a conversa carrega. */
export const SkeletonRow = styled.View<{ $mine: boolean }>`
  flex-direction: row;
  justify-content: ${({ $mine }) => ($mine ? 'flex-end' : 'flex-start')};
`;

export const SkeletonList = styled.View`
  gap: 8px;
  padding-top: ${SEPARATOR_TOP + SEPARATOR_HEIGHT + 4}px;
`;
