import styled from 'styled-components/native';

import { Divider, List, PropertyList } from '@components/ui';

/** Propriedades logo abaixo do nome (".props" margin-top 14). */
export const Properties = styled(PropertyList)`
  margin-top: 14px;
`;

/** "Grupo 1 ————" (".req-gl"). */
export const GroupLabel = styled(Divider)`
  margin-top: ${({ theme }) => theme.spacing.xxs}px;
`;

/** Requisitos de um grupo (".req-gl + .rows" margin-bottom 10). */
export const GroupList = styled(List)`
  margin-bottom: 10px;
`;

/** Código + "✓ Aprovado em 2025.2" (".req-meta"). */
export const RequirementMeta = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  column-gap: 10px;
  row-gap: ${({ theme }) => theme.spacing.xxs}px;
`;

/**
 * "Acessar ementa" (".subj-foot" margin-top 24). Abaixo de um estado vazio,
 * que já tem 40 de respiro, não soma margem.
 */
export const SyllabusFoot = styled.View<{ $afterState?: boolean }>`
  margin-top: ${({ theme, $afterState }) =>
    $afterState ? 0 : theme.spacing.xxl}px;
`;
