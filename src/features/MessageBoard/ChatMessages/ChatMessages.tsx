import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  ScrollView,
  StyleSheet,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
} from 'react-native';
import { useTheme } from 'styled-components/native';

import type { Message } from '@root/modules/community/domain/models';
import { Skeleton, Text } from '@components/ui';
import { ChatBubble } from '@features/MessageBoard/ChatBubble';

import type { DayGroup } from '../chatFormat';
import {
  Area,
  CONTENT_TOP,
  Day,
  DaySeparator,
  Messages,
  SEPARATOR_HEIGHT,
  SEPARATOR_TOP,
  STICKY_GAP,
  STICKY_TOP,
  SkeletonList,
  SkeletonRow,
  StickyPill,
  StickySlot,
} from './ChatMessages.styles';

type Props = {
  groups: DayGroup[];
  isMine: (message: Message) => boolean;
  /**
   * Conteúdo no lugar das mensagens (esqueleto, erro, dica de conversa vazia).
   * Quando definido, as mensagens não são exibidas.
   */
  placeholder?: React.ReactNode;
  /**
   * Sempre que muda (outro período, mensagem enviada), a conversa volta a
   * acompanhar o fim, como ao abrir.
   */
  followKey?: string | number;
};

type Sticky = { label: string; top: number } | null;
type StickyHandle = (next: Sticky) => void;

const sameSticky = (a: Sticky, b: Sticky) =>
  a?.label === b?.label && a?.top === b?.top;

/** Distância do fim em que a conversa continua "presa" à mensagem mais recente. */
const PIN_SLACK = 24;

/**
 * Etiqueta da data que gruda no topo quando o separador do dia sai da tela,
 * como nos apps de conversa: nunca fica cortada sob o cabeçalho fixo e sai
 * junto com o fim do seu dia. Fica numa faixa opaca da largura da conversa,
 * para que o separador original e os balões passem por baixo dela sem
 * aparecer cortados em volta. Tem estado próprio para que a rolagem não
 * renderize a conversa inteira de novo.
 */
function StickyDay({ ref }: { ref: React.Ref<StickyHandle> }) {
  const [sticky, setSticky] = useState<Sticky>(null);
  useImperativeHandle(
    ref,
    () => next => setSticky(prev => (sameSticky(prev, next) ? prev : next)),
    [],
  );
  if (!sticky) return null;
  return (
    <StickySlot
      testID="chat-sticky-day"
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ transform: [{ translateY: sticky.top - STICKY_TOP }] }}
    >
      <StickyPill>
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {sticky.label}
        </Text>
      </StickyPill>
    </StickySlot>
  );
}

/** Esqueleto da conversa: balões alternados enquanto as mensagens carregam. */
export function ChatSkeleton() {
  const shapes = [
    { mine: false, width: '72%', height: 64 },
    { mine: false, width: '56%', height: 44 },
    { mine: true, width: '64%', height: 64 },
    { mine: false, width: '68%', height: 44 },
  ] as const;
  return (
    <SkeletonList
      accessible
      accessibilityLabel="Carregando mensagens…"
      accessibilityState={{ busy: true }}
    >
      {shapes.map((shape, i) => (
        <SkeletonRow key={i} $mine={shape.mine}>
          <Skeleton width={shape.width} height={shape.height} radius={12} />
        </SkeletonRow>
      ))}
    </SkeletonList>
  );
}

/**
 * Lista rolável da conversa: separadores de data com fio, balões, etiqueta
 * da data grudada no topo e rolagem que abre (e continua) na mensagem mais
 * recente enquanto o aluno não rolar para cima.
 */
export function ChatMessages({
  groups,
  isMine,
  placeholder,
  followKey,
}: Props) {
  const theme = useTheme();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const pinned = useRef(true);
  const offset = useRef(0);
  const layouts = useRef(new Map<string, { y: number; height: number }>());
  const sticky = useRef<StickyHandle>(null);
  const frame = useRef<number | null>(null);
  const groupsRef = useRef(groups);
  useLayoutEffect(() => {
    groupsRef.current = placeholder ? [] : groups;
  });

  /**
   * Vai para a mensagem mais recente. O comando pode chegar à view nativa
   * antes do novo tamanho do conteúdo ou da área visível (mensagem nova,
   * teclado) e parar no fim antigo: repete no quadro seguinte, já montado.
   */
  const scrollToEnd = useCallback(() => {
    scrollRef.current?.scrollToEnd({ animated: false });
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      if (pinned.current) scrollRef.current?.scrollToEnd({ animated: false });
    });
  }, []);

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  useEffect(() => {
    pinned.current = true;
    scrollToEnd();
  }, [followKey, scrollToEnd]);

  const updateSticky = useCallback(() => {
    const y = offset.current;
    let active: { label: string; y: number; height: number } | null = null;
    for (const group of groupsRef.current) {
      const layout = layouts.current.get(group.key);
      if (!layout) continue;
      // o separador do dia chegou à posição da etiqueta: ela assume o lugar dele
      if (layout.y + SEPARATOR_TOP > y + STICKY_TOP) break;
      active = { label: group.label, ...layout };
    }
    if (!active) {
      sticky.current?.(null);
      return;
    }
    // sobe junto com o fim do dia, até sumir sob o separador seguinte
    const top = Math.min(
      STICKY_TOP,
      Math.round(active.y + active.height - y - SEPARATOR_HEIGHT),
    );
    sticky.current?.(
      top < -(SEPARATOR_HEIGHT + STICKY_GAP)
        ? null
        : { label: active.label, top },
    );
  }, []);

  useEffect(() => {
    updateSticky();
  }, [groups, placeholder, updateSticky]);

  const toEnd = () => {
    if (pinned.current) scrollToEnd();
  };

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    // só a rolagem decide se a conversa acompanha o fim; conteúdo que cresce
    // ou área que encolhe (teclado) com o mesmo deslocamento não soltam
    if (contentOffset.y !== offset.current) {
      pinned.current =
        contentSize.height - contentOffset.y - layoutMeasurement.height <
        PIN_SLACK;
    }
    offset.current = contentOffset.y;
    updateSticky();
  };

  const onDayLayout = (key: string) => (event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    // `y` é relativo à lista; a rolagem conta a partir do topo do conteúdo
    layouts.current.set(key, { y: y + CONTENT_TOP, height });
    updateSticky();
  };

  return (
    <Area>
      <ScrollView
        ref={scrollRef}
        testID="chat-scroll"
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingHorizontal: theme.layout.gutter },
        ]}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScroll={onScroll}
        onContentSizeChange={toEnd}
        onLayout={toEnd}
      >
        {placeholder ?? (
          <Messages>
            {groups.map(group => (
              <Day
                key={group.key}
                testID="chat-day"
                onLayout={onDayLayout(group.key)}
              >
                <DaySeparator label={group.label} labelAlign="center" />
                {group.messages.map(message => (
                  <ChatBubble
                    key={message.id}
                    message={message}
                    mine={isMine(message)}
                  />
                ))}
              </Day>
            ))}
          </Messages>
        )}
      </ScrollView>
      <StickyDay ref={sticky} />
    </Area>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { flexGrow: 1, paddingTop: CONTENT_TOP, paddingBottom: 16 },
});
