import React from 'react';
import Share from 'react-native-share';
import { captureRef } from 'react-native-view-shot';
import { TouchableOpacity, View } from 'react-native';
import { useTheme } from 'styled-components/native';
import Carousel from 'react-native-reanimated-carousel';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Buffer } from 'buffer';

import { window } from '@utils/constants/info';
import { TIME_VALUES } from '@utils/constants/time';
import { AttendedClassesSchedule } from '@features/AttendedClassesSchedule/types';

import Text from '@atoms/Text';
import { buildWeekSvgDataUri } from '../svgExport';
import {
  useSvgToImage,
  convertSvgToImageFallback,
} from '../svgToImageConverter';

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
  const { convertSvgToImage, SvgRenderer } = useSvgToImage();

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
        key={`${item.class.name}:${item.class.id}`}
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

  const currentDay = new Date().getDay();

  const [closestWeekday] = weekDays
    .map(({ number }) => ({ diff: Math.abs(number - currentDay), number }))
    .sort((a, b) => a.diff - b.diff);

  const defaultIndex =
    weekDays.findIndex(w => w.number === closestWeekday.number) ?? 0;

  const qttyItemsPerWeekDay = weekDays.map(
    w => safeData.filter(c => c.dayAlias === w.name).length,
  );
  const maxQttyOfItemsInAWeekDay = Math.max(...qttyItemsPerWeekDay);
  const maxPossibleHeight =
    60 * maxQttyOfItemsInAWeekDay + 12 * maxQttyOfItemsInAWeekDay + 80;

  const [_currentIndex, setCurrentIndex] = React.useState<number>(defaultIndex);
  const [exporting, setExporting] = React.useState<boolean>(false);

  const handleExport = async () => {
    try {
      setExporting(true);

      try {
        const imageUri = await convertSvgToImage(safeData, theme.COLORS);
        await Share.open({
          url: imageUri,
          type: 'image/png',
          failOnCancel: false,
        });
      } catch (svgError) {
        console.log(
          'Erro na conversão SVG para PNG, tentando fallback:',
          svgError,
        );

        try {
          const fallbackUri = await convertSvgToImageFallback(
            safeData,
            theme.COLORS,
          );
          await Share.open({
            url: fallbackUri,
            type: 'image/png',
            failOnCancel: false,
          });
        } catch (fallbackError) {
          console.log('Erro no fallback, usando SVG original:', fallbackError);

          const dataUri = buildWeekSvgDataUri(safeData, theme.COLORS);
          await Share.open({
            url: dataUri,
            type: 'image/svg+xml',
            failOnCancel: false,
          });
        }
      }
    } catch (e) {
      console.log('Erro no compartilhamento:', e);
    } finally {
      setExporting(false);
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
          onSnapToItem={index => setCurrentIndex(index)}
          renderItem={({ item }) => renderBoard(item)}
        />
      </CarouselContainer>

      <SvgRenderer svgString={svgString} />
    </>
  );
};

export default React.memo(ClassScheduleBoard, (prev, next) => {
  if (JSON.stringify(prev) === JSON.stringify(next)) {
    return true;
  }
  return false;
});
