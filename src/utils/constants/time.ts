export type EnumTempo =
  | 'M1'
  | 'M2'
  | 'M3'
  | 'M4'
  | 'M5'
  | 'M6'
  | 'T1'
  | 'T2'
  | 'T3'
  | 'T4'
  | 'T5'
  | 'T6'
  | 'N1'
  | 'N2'
  | 'N3'
  | 'N4'
  | 'N5';

type TimeDictionary = {
  [key in string]: string[];
};

export const TIME_DICTIONARY: TimeDictionary = {
  M1: ['7:00', '7:50'],
  M2: ['7:50', '8:40'],
  M3: ['8:50', '9:40'],
  M4: ['9:40', '10:30'],
  M5: ['10:40', '11:30'],
  M6: ['11:30', '12:20'],
  T1: ['12:20', '13:20'],
  T2: ['13:20', '14:10'],
  T3: ['14:20', '15:10'],
  T4: ['15:10', '16:00'],
  T5: ['16:10', '17:00'],
  T6: ['17:00', '17:50'],
  N1: ['18:00', '18:50'],
  N2: ['18:50', '19:40'],
  N3: ['19:40', '20:30'],
  N4: ['20:30', '21:20'],
  N5: ['21:20', '22:10'],
  '??': ['??', '??'],
};

export const TIME_VALUES = [
  {
    periodAlias: 'M1',
    startTimeAlias: '7:00',
    endTimeAlias: '7:50',
    start_time_in_minutes: 420,
    end_time_in_minutes: 470,
  },
  {
    periodAlias: 'M2',
    startTimeAlias: '7:50',
    endTimeAlias: '8:40',
    start_time_in_minutes: 470,
    end_time_in_minutes: 520,
  },
  {
    periodAlias: 'M3',
    startTimeAlias: '8:50',
    endTimeAlias: '9:40',
    start_time_in_minutes: 530,
    end_time_in_minutes: 580,
  },
  {
    periodAlias: 'M4',
    startTimeAlias: '9:40',
    endTimeAlias: '10:30',
    start_time_in_minutes: 580,
    end_time_in_minutes: 630,
  },
  {
    periodAlias: 'M5',
    startTimeAlias: '10:40',
    endTimeAlias: '11:30',
    start_time_in_minutes: 640,
    end_time_in_minutes: 690,
  },
  {
    periodAlias: 'M6',
    startTimeAlias: '11:30',
    endTimeAlias: '12:20',
    start_time_in_minutes: 690,
    end_time_in_minutes: 740,
  },
  {
    periodAlias: 'T1',
    startTimeAlias: '12:20',
    endTimeAlias: '13:20',
    start_time_in_minutes: 740,
    end_time_in_minutes: 800,
  },
  {
    periodAlias: 'T2',
    startTimeAlias: '13:20',
    endTimeAlias: '14:10',
    start_time_in_minutes: 800,
    end_time_in_minutes: 850,
  },
  {
    periodAlias: 'T3',
    startTimeAlias: '14:20',
    endTimeAlias: '15:10',
    start_time_in_minutes: 860,
    end_time_in_minutes: 910,
  },
  {
    periodAlias: 'T4',
    startTimeAlias: '15:10',
    endTimeAlias: '16:00',
    start_time_in_minutes: 910,
    end_time_in_minutes: 960,
  },
  {
    periodAlias: 'T5',
    startTimeAlias: '16:10',
    endTimeAlias: '17:00',
    start_time_in_minutes: 970,
    end_time_in_minutes: 1020,
  },
  {
    periodAlias: 'T6',
    startTimeAlias: '17:00',
    endTimeAlias: '17:50',
    start_time_in_minutes: 1020,
    end_time_in_minutes: 1070,
  },
  {
    periodAlias: 'N1',
    startTimeAlias: '18:00',
    endTimeAlias: '18:50',
    start_time_in_minutes: 1080,
    end_time_in_minutes: 1130,
  },
  {
    periodAlias: 'N2',
    startTimeAlias: '18:50',
    endTimeAlias: '19:40',
    start_time_in_minutes: 1130,
    end_time_in_minutes: 1180,
  },
  {
    periodAlias: 'N3',
    startTimeAlias: '19:40',
    endTimeAlias: '20:30',
    start_time_in_minutes: 1180,
    end_time_in_minutes: 1230,
  },
  {
    periodAlias: 'N4',
    startTimeAlias: '20:30',
    endTimeAlias: '21:20',
    start_time_in_minutes: 1230,
    end_time_in_minutes: 1280,
  },
  {
    periodAlias: 'N5',
    startTimeAlias: '21:20',
    endTimeAlias: '22:10',
    start_time_in_minutes: 1280,
    end_time_in_minutes: 1330,
  },
  {
    periodAlias: '??',
    startTimeAlias: '??',
    endTimeAlias: '??',
    start_time_in_minutes: -1,
    end_time_in_minutes: -1,
  },
];
