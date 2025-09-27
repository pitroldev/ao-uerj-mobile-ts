import React, { useState } from 'react';
import { Linking } from 'react-native';

import ErrorReportModal from '@features/ErrorReport/ErrorReportModal';

import RoundedButton from '@atoms/RoundedButton';
import Text from '@atoms/Text';
import {
  Column,
  Icon,
  MainContainer,
  Row,
  AOUerjLogo,
  AOLogoContainer,
  SectionContainer,
  ActionButton,
  Divider,
  ButtonIcon,
  ButtonContent,
} from './About.styles';

import { version } from '@/package.json';

const LINKEDIN_PROFILE_URL = 'https://www.linkedin.com/in/petrocardoso/';
const GITHUB_REPO_URL = 'https://github.com/pitroldev/ao-uerj-mobile-ts';
const CREATOR_EMAIL = 'mailto:contato@pitrol.dev?subject=AO UERJ';

const AboutPage = () => {
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);

  const handleBtnPress = (url: string) => {
    Linking.openURL(url).catch((err: Error) =>
      console.log('AboutOpenURL error', err),
    );
  };

  return (
    <MainContainer>
      <ErrorReportModal
        visible={isErrorModalOpen}
        setVisibility={setIsErrorModalOpen}
      />

      <SectionContainer>
        <AOLogoContainer>
          <AOUerjLogo />
        </AOLogoContainer>
        <Text
          weight="bold"
          size="XXL"
          alignSelf="center"
          textAlign="center"
          marginBottom="4px"
        >
          AO UERJ
        </Text>
        <Text
          weight="300"
          size="SM"
          alignSelf="center"
          textAlign="center"
          marginBottom="8px"
        >
          Versão {version}
        </Text>
      </SectionContainer>

      <Divider />

      <SectionContainer>
        <Text
          weight="bold"
          size="LG"
          alignSelf="center"
          textAlign="center"
          marginBottom="12px"
        >
          Suporte
        </Text>

        <Row>
          <ActionButton onPress={() => setIsErrorModalOpen(true)}>
            <ButtonContent>
              <ButtonIcon name="bug" />
              <Text
                weight="600"
                size="SM"
                alignSelf="center"
                textAlign="center"
              >
                Reportar Problema
              </Text>
            </ButtonContent>
          </ActionButton>

          <ActionButton
            onPress={() => handleBtnPress(`${GITHUB_REPO_URL}/issues`)}
          >
            <ButtonContent>
              <ButtonIcon name="lightbulb-o" />
              <Text
                weight="600"
                size="SM"
                alignSelf="center"
                textAlign="center"
              >
                Sugerir Melhoria
              </Text>
            </ButtonContent>
          </ActionButton>
        </Row>
      </SectionContainer>

      <Divider />

      <SectionContainer>
        <Text
          weight="bold"
          size="LG"
          alignSelf="center"
          textAlign="center"
          marginBottom="4px"
        >
          Contribua
        </Text>
        <Text
          weight="300"
          size="SM"
          alignSelf="center"
          textAlign="center"
          marginBottom="12px"
        >
          Este projeto é open source e aceita contribuições!
        </Text>

        <ActionButton onPress={() => handleBtnPress(GITHUB_REPO_URL)}>
          <ButtonContent>
            <ButtonIcon name="github" />
            <Text weight="600" size="SM" alignSelf="center" textAlign="center">
              Ver Repositório
            </Text>
          </ButtonContent>
        </ActionButton>
      </SectionContainer>

      <Divider />

      <SectionContainer>
        <Text
          weight="bold"
          size="LG"
          alignSelf="center"
          textAlign="center"
          marginBottom="4px"
        >
          Desenvolvedor
        </Text>
        <Text
          weight="300"
          size="MD"
          alignSelf="center"
          textAlign="center"
          marginBottom="12px"
        >
          Petro Cardoso
        </Text>

        <Row>
          <Column>
            <RoundedButton
              variant="TEXT_PRIMARY"
              onPress={() => handleBtnPress(GITHUB_REPO_URL)}
            >
              <Icon name="github-alt" />
            </RoundedButton>
            <Text weight="bold" size="XS" alignSelf="center" textAlign="center">
              Github
            </Text>
          </Column>
          <Column>
            <RoundedButton
              variant="TEXT_PRIMARY"
              onPress={() => handleBtnPress(LINKEDIN_PROFILE_URL)}
            >
              <Icon name="linkedin" />
            </RoundedButton>
            <Text weight="bold" size="XS" alignSelf="center" textAlign="center">
              LinkedIn
            </Text>
          </Column>
          <Column>
            <RoundedButton
              variant="TEXT_PRIMARY"
              onPress={() => handleBtnPress(CREATOR_EMAIL)}
            >
              <Icon name="envelope" />
            </RoundedButton>
            <Text weight="bold" size="XS" alignSelf="center" textAlign="center">
              Email
            </Text>
          </Column>
        </Row>
      </SectionContainer>
    </MainContainer>
  );
};

export default AboutPage;
