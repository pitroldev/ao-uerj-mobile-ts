import type { AttendedClassesSchedule } from '@root/modules/academics/domain/models';

const DAY = 24 * 60 * 60 * 1000;
const DAY_MINUTES = 24 * 60;

/**
 * Sem atualizar a grade por três semanas, o widget pede para abrir o app (o
 * mesmo prazo dos lembretes de aula): o período pode ter acabado.
 */
export const WIDGET_VALIDITY = 21 * DAY;

/** Textos de uma aula no widget, como no card "Próxima aula" do Início. */
export type WidgetClassText = {
  title: string;
  /** "T3–T4 · Sala 6019 B". */
  detail: string;
  /** "Pav. João Lyra Filho · 6º andar" (vazio quando o portal não informa). */
  place: string;
};

type WidgetClass = WidgetClassText & {
  /** 1 = segunda … 7 = domingo (o portal usa 1–6). */
  weekday: number;
  /** Minutos desde 0h. */
  start: number;
  end: number;
  /** "14:20" e "16:00", como o portal escreve. */
  startLabel: string;
  endLabel: string;
};

/**
 * Grade entregue ao widget do Android, que escolhe a próxima aula na hora de
 * desenhar (sem o app aberto e sem acessar o portal).
 */
export type WidgetSchedule = {
  /** Leitura da grade no portal (ms). */
  updatedAt: number;
  /** Depois deste instante (ms), o widget pede para abrir o app. */
  expiresAt: number;
  classes: WidgetClass[];
};

/** As aulas da semana, sem as canceladas, horários desconhecidos e repetições. */
export function buildWidgetSchedule(
  schedule: readonly AttendedClassesSchedule[],
  {
    fetchedAt,
    text,
  }: {
    fetchedAt: number;
    text: (item: AttendedClassesSchedule) => WidgetClassText;
  },
): WidgetSchedule {
  const seen = new Set<string>();
  const classes = schedule
    .flatMap(item => {
      const start = item.start_time_in_minutes;
      const end = item.end_time_in_minutes;
      if (
        item.class?.status === 'CANCELED' ||
        !Number.isInteger(item.dayNumber) ||
        item.dayNumber < 1 ||
        item.dayNumber > 7 ||
        !Number.isFinite(start) ||
        !Number.isFinite(end) ||
        start < 0 ||
        end <= start ||
        end > DAY_MINUTES
      )
        return [];
      const key = `${item.class?.id ?? item.subject_id}#${item.class?.class ?? ''}@${
        item.dayNumber
      }:${start}`;
      if (seen.has(key)) return [];
      seen.add(key);
      return [
        {
          weekday: item.dayNumber,
          start,
          end,
          startLabel: item.startTimeAlias,
          endLabel: item.endTimeAlias,
          ...text(item),
        },
      ];
    })
    .sort((a, b) => a.weekday - b.weekday || a.start - b.start);
  return {
    updatedAt: fetchedAt,
    expiresAt: fetchedAt + WIDGET_VALIDITY,
    classes,
  };
}
