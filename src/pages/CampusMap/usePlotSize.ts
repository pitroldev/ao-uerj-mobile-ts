import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentRef,
} from 'react';
import type { LayoutChangeEvent, View } from 'react-native';
import { useKeyboardState } from 'react-native-keyboard-controller';

type PlotSize = { width: number; height: number };

/** O que o Fabric expõe no ref de uma view (DOM Node APIs). */
type Measurable = {
  getBoundingClientRect?: () => { width: number; height: number };
  offsetWidth?: number;
  offsetHeight?: number;
};

/** Menos de meio dp não muda o enquadramento. */
const same = (a: number, b: number) => Math.abs(a - b) < 0.5;
/** Uma animação de layout manda uma medida por quadro: vale a última. */
const SETTLE_MS = 80;
/** Com o teclado preso na tela, o desenho não espera para sempre. */
const KEYBOARD_PATIENCE_MS = 1200;

/**
 * A medida da área do desenho, antes de desenhar.
 *
 * O desenho depende da medida (o enquadramento e os rótulos), e ela só existe
 * depois do layout. Com um palpite, o mapa era montado e rasterizado duas
 * vezes: no palpite e, depois do `onLayout`, na medida real. Aqui a medida
 * sai no `useLayoutEffect`: o Fabric já calculou o layout desse commit e
 * aplica a atualização antes de pintar, então o nativo monta e rasteriza uma
 * vez só, já no tamanho certo. Vale também quando o rodapé muda de altura
 * junto com a seleção.
 *
 * A medida é `null` até a primeira (quem usa desenha só a moldura). O
 * `onLayout` cobre o que acontece fora de um render: girar o aparelho, a
 * janela dividida, ou um ambiente sem a medida síncrona (os testes).
 *
 * Duas esperas evitam desenhar num tamanho de passagem:
 * - com o teclado na tela, a área ainda vai crescer. Quem escolhe um
 *   resultado da busca monta o mapa com o teclado descendo, e o painel
 *   acompanha a animação quadro a quadro: o mapa era desenhado pequeno e
 *   refeito a cada medida até o teclado sumir;
 * - uma mudança de medida que chega pelo `onLayout` só vale quando para de
 *   mudar (a primeira vale na hora).
 */
export function usePlotSize() {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const [size, setSize] = useState<PlotSize | null>(null);
  const typing = useKeyboardState(state => state.isVisible);
  const [impatient, setImpatient] = useState(false);
  const waiting = typing && !impatient;
  // o que os temporizadores leem depois do render
  const live = useRef({ waiting, sized: false });
  const latest = useRef<PlotSize | null>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const adopt = ({ width, height }: PlotSize) => {
    if (!(width > 0 && height > 0)) return;
    live.current.sized = true;
    setSize(current =>
      current && same(current.width, width) && same(current.height, height)
        ? current
        : { width, height },
    );
  };

  useLayoutEffect(() => {
    live.current.waiting = waiting;
    if (waiting) return;
    const node = ref.current as Measurable | null;
    const rect = node?.getBoundingClientRect?.();
    if (!node || !rect) {
      // sem a medida síncrona: a última que o `onLayout` trouxe na espera
      if (latest.current) adopt(latest.current);
      return;
    }
    // a medida síncrona leva as transformações dos ancestrais; no meio de
    // uma transição com escala ela não é o layout, e a medida fica para o
    // `onLayout`
    if (
      node.offsetWidth !== undefined &&
      node.offsetHeight !== undefined &&
      (Math.abs(rect.width - node.offsetWidth) > 1 ||
        Math.abs(rect.height - node.offsetHeight) > 1)
    )
      return;
    adopt(rect);
  });

  useEffect(() => {
    if (!typing) return;
    const timer = setTimeout(() => setImpatient(true), KEYBOARD_PATIENCE_MS);
    return () => clearTimeout(timer);
  }, [typing]);
  useEffect(() => () => clearTimeout(settle.current), []);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    latest.current = { width, height };
    clearTimeout(settle.current);
    if (live.current.waiting) return;
    if (!live.current.sized) {
      adopt(latest.current);
      return;
    }
    settle.current = setTimeout(() => {
      if (!live.current.waiting && latest.current) adopt(latest.current);
    }, SETTLE_MS);
  };
  // em lista, e não num objeto: com o ref dentro de um objeto, o React
  // Compiler trata o objeto todo como ref e desiste de quem lê a medida
  return [ref, size, onLayout] as const;
}
