import React from 'react';
import { Alert } from 'react-native';
import { nextWeekdayIndex } from '@root/modules/academics/domain/rules/schedule';
import { useScheduleSharing } from '@root/modules/academics/presentation/useScheduleSharing';
import { TouchableOpacity } from 'react-native';
import { useTheme } from 'styled-components/native';
import Carousel from 'react-native-reanimated-carousel';
import { MaterialDesignIcons as Icon } from '@react-native-vector-icons/material-design-icons';
import { Buffer } from 'buffer';

import { window } from '@utils/constants/info';
import { TIME_VALUES } from '@utils/constants/time';
import { AttendedClassesSchedule } from '@root/modules/academics/domain/models';

import Text from '@atoms/Text';
import { buildWeekSvgDataUri } from '@root/modules/academics/presentation/scheduleSvg';

import {
  TimeInfoColumn,
  WeekDayContainer,
  Row,
  SubjectInfoColumn,
  ClassBox,
  CarouselContainer,
  ActionsRow,
  ShareButton,
} from './ClassScheduleBoard.styles';

type Props = {
  data: AttendedClassesSchedule[];
  onSubjectPress: (item?: AttendedClassesSchedule) => void;
};

const ClassScheduleBoard = ({ data, onSubjectPress }: Props) => {
  const theme = useTheme();
  const safeData = data ?? [];
  const { share, exporting, SvgRenderer } = useScheduleSharing();

  const weekDays = [] as { number: number; name: string }[];
  safeData.forEach(
    c =>
      !weekDays.some(w => w.number === c.dayNumber) &&
      weekDays.push({ number: c.dayNumber, name: c.dayAlias }),
  );

  const getBoxColor = (start: number) => {
    if (start < 740) {
      return 'MORNING';
    }
    if (start < 1070) {
      return 'AFTERNOON';
    }
    return 'NIGHT';
  };

  const renderClasses = (item: AttendedClassesSchedule) => {
    const { start_time_in_minutes, end_time_in_minutes } = item;

    const { periodAlias: startPeriod, startTimeAlias } = TIME_VALUES.find(
      t => start_time_in_minutes === t.start_time_in_minutes,
    ) ?? { periodAlias: '??' };

    const { periodAlias: endPeriod, endTimeAlias } = TIME_VALUES.find(
      t => t.end_time_in_minutes === end_time_in_minutes,
    ) ?? { periodAlias: '??' };

    const boxColor = getBoxColor(start_time_in_minutes);
    return (
      <TouchableOpacity
        key={`${item.class.id}:${item.start_time_in_minutes}`}
        onPress={() => onSubjectPress(item)}
      >
        <ClassBox color={boxColor}>
          <Row>
            <TimeInfoColumn>
              <Text
                weight="500"
                size="XS"
                italic
                textAlign="center"
                alignSelf="center"
              >
                {startPeriod} - {endPeriod}
              </Text>
              <Text
                weight="500"
                size="XS"
                italic
                textAlign="center"
                alignSelf="center"
              >
                {startTimeAlias} - {endTimeAlias}
              </Text>
            </TimeInfoColumn>
            <SubjectInfoColumn>
              <Text size="XS" textAlign="center" alignSelf="center">
                {item.class.name}
              </Text>
            </SubjectInfoColumn>
          </Row>
        </ClassBox>
      </TouchableOpacity>
    );
  };

  const renderBoard = (weekDay: string) => {
    const classesInThisDay = safeData.filter(c => c.dayAlias === weekDay);

    return (
      <WeekDayContainer>
        <Text
          size="LG"
          textAlign="center"
          alignSelf="center"
          weight="300"
          marginBottom="8px"
        >
          {weekDay}
        </Text>
        {classesInThisDay.map(renderClasses)}
      </WeekDayContainer>
    );
  };

  weekDays.sort((left, right) => left.number - right.number);
  const defaultIndex = nextWeekdayIndex(
    weekDays.map(day => day.number),
    new Date().getDay(),
  );

  const qttyItemsPerWeekDay = weekDays.map(
    w => safeData.filter(c => c.dayAlias === w.name).length,
  );
  const maxQttyOfItemsInAWeekDay = Math.max(0, ...qttyItemsPerWeekDay);
  const maxPossibleHeight =
    60 * maxQttyOfItemsInAWeekDay + 12 * maxQttyOfItemsInAWeekDay + 80;

  const handleExport = async () => {
    try {
      await share(buildWeekSvgDataUri(safeData, theme.COLORS));
    } catch {
      Alert.alert(
        'Compartilhamento',
        'Não foi possível compartilhar a grade. Tente novamente.',
      );
    }
  };

  if (weekDays.length === 0) {
    return null;
  }

  const svgDataUri = buildWeekSvgDataUri(safeData, theme.COLORS);
  const base64Svg = svgDataUri.replace('data:image/svg+xml;base64,', '');
  const svgString = Buffer.from(base64Svg, 'base64').toString('utf8');

  return (
    <>
      <CarouselContainer>
        <ActionsRow>
          <ShareButton
            onPress={handleExport}
            accessibilityRole="button"
            accessibilityLabel="Compartilhar grade da semana"
            disabled={exporting}
          >
            <Icon
              name="share-variant"
              size={18}
              color={theme.COLORS.TEXT_PRIMARY}
            />
          </ShareButton>
        </ActionsRow>
        <Carousel
          loop
          defaultIndex={defaultIndex}
          width={window.width}
          height={maxPossibleHeight}
          data={weekDays.map(w => w.name)}
          scrollAnimationDuration={500}
          renderItem={({ item }) => renderBoard(item)}
        />
      </CarouselContainer>

      <SvgRenderer svgString={svgString} />
    </>
  );
};

export default React.memo(ClassScheduleBoard);
