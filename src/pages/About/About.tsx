import React, { useState } from 'react';
import { Linking, TouchableOpacity } from 'react-native';

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
      <AOLogoContainer>
        <AOUerjLogo />
      </AOLogoContainer>
      <Text
        weight="bold"
        size="XS"
        alignSelf="center"
        textAlign="center"
        marginBottom="12px"
      >
        Versão {version}
      </Text>
      <TouchableOpacity onPress={() => setIsErrorModalOpen(true)}>
        <Text
          weight="bold"
          size="XS"
          alignSelf="center"
          textAlign="center"
          marginBottom="12px"
        >
          Reportar Problema
        </Text>
      </TouchableOpacity>
      <Text weight="300" size="XL" alignSelf="center" textAlign="center">
        Desenvolvido por Petro Cardoso
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
    </MainContainer>
  );
};

export default AboutPage;
