import { useCallback, useEffect, useRef, useState } from 'react';
import type { LayoutChangeEvent, ScrollViewInstance } from 'react-native';
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { DrawerNavigationProp } from '@react-navigation/drawer';

import { snackbar } from '@components/ui';
import type { RootDrawerParamList } from '@root/routes';

/**
 * Atalho "Notas" do ícone do app: o Início abre rolado até o quadro de notas.
 * Sem notas no período, fica no topo e diz por quê. O pedido vale uma vez.
 */
export function useGradesFocus({
  available,
  settled,
}: {
  /** O quadro de notas está na tela. */
  available: boolean;
  /** As notas terminaram de carregar (com ou sem resultado). */
  settled: boolean;
}) {
  const route = useRoute<RouteProp<RootDrawerParamList, 'Início'>>();
  const navigation =
    useNavigation<DrawerNavigationProp<RootDrawerParamList, 'Início'>>();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const [offset, setOffset] = useState<number | null>(null);
  const requested = route.params?.focus === 'grades';

  useEffect(() => {
    if (!requested) return;
    if (available && offset !== null) {
      scrollRef.current?.scrollTo({ y: offset, animated: true });
      navigation.setParams({ focus: undefined });
    } else if (settled && !available) {
      snackbar.info(
        'Sem notas no período',
        'Elas aparecem aqui no Início quando o Aluno Online lançar.',
      );
      navigation.setParams({ focus: undefined });
    }
  }, [requested, available, settled, offset, navigation]);

  const onGradesLayout = useCallback((event: LayoutChangeEvent) => {
    setOffset(event.nativeEvent.layout.y);
  }, []);

  return { scrollRef, onGradesLayout };
}
