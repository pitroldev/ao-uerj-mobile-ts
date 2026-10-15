import React, { useState } from 'react';
import { Linking, useWindowDimensions } from 'react-native';
import { useTheme } from 'styled-components/native';

import { ErrorReportModal } from '@features/ErrorReport/ErrorReportModal';
import { AoLogo, Icon, Section, Text, snackbar } from '@components/ui';
import { ScreenPanel } from '@templates/ScreenPanel';

import {
  AppName,
  Bio,
  Callout,
  Creator,
  Hero,
  SocialLabel,
  SocialLink,
  SocialLinks,
  SupportList,
  SupportRow,
  Version,
  WebsiteCopy,
  WebsiteLink,
} from './About.styles';
import { BrandIcon } from './BrandIcon';

import { version } from '@/package.json';

const LINKEDIN_PROFILE_URL = 'https://www.linkedin.com/in/petrocardoso/';
const GITHUB_PROFILE_URL = 'https://github.com/pitroldev';
const GITHUB_REPO_URL = 'https://github.com/pitroldev/ao-uerj-mobile-ts';
const WEBSITE_URL = 'https://pitrol.dev/';
const CREATOR_EMAIL = 'mailto:contato@pitrol.dev?subject=AO UERJ';

const DEV_LINKS = [
  { label: 'GitHub', icon: 'github', url: GITHUB_PROFILE_URL },
  { label: 'LinkedIn', icon: 'linkedin', url: LINKEDIN_PROFILE_URL },
  { label: 'E-mail', icon: 'mail', url: CREATOR_EMAIL },
] as const;

export const AboutPage = () => {
  const theme = useTheme();
  const { fontScale } = useWindowDimensions();
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);

  const openUrl = (url: string) => {
    Linking.openURL(url).catch((err: Error) => {
      console.log('AboutOpenURL error', err);
      snackbar.error('Não foi possível abrir este link.');
    });
  };

  return (
    <ScreenPanel>
      <ErrorReportModal
        visible={isErrorModalOpen}
        setVisibility={setIsErrorModalOpen}
      />

      <Hero>
        <AoLogo
          width={84}
          color={theme.colors.logo}
          accessibilityLabel={null}
        />
        <AppName variant="titleXL" align="center" accessibilityRole="header">
          AO UERJ
        </AppName>
        <Version variant="meta" tone="muted" align="center">
          Versão {version}
        </Version>
      </Hero>

      <Callout tone="neutral" icon="info" iconColor={theme.colors.accent}>
        <Text variant="meta" tone="muted">
          App de código aberto, sem vínculo com a UERJ. Usa sua conta do Aluno
          Online.
        </Text>
      </Callout>

      <Creator>
        <Text variant="titleM" accessibilityRole="header">
          Fala! Sou o Petro.
        </Text>
        <Bio variant="body" tone="muted">
          Criei o AO UERJ pra facilitar seu dia a dia na faculdade.
        </Bio>
        <WebsiteLink
          accessibilityRole="link"
          accessibilityLabel="pitrol.dev"
          accessibilityHint="Abre o site de Petro no navegador"
          onPress={() => openUrl(WEBSITE_URL)}
          style={({ pressed }) => ({
            backgroundColor: pressed
              ? theme.colors.surfacePressed
              : theme.colors.surfaceMuted,
          })}
        >
          <WebsiteCopy>
            <Text variant="appBar" tone="accent">
              pitrol.dev
            </Text>
            <Text variant="meta" tone="muted">
              O que ando fazendo e escrevendo
            </Text>
          </WebsiteCopy>
          <Icon name="open_in_new" size={20} color={theme.colors.inkMuted} />
        </WebsiteLink>
        <SocialLinks>
          {DEV_LINKS.map(link => (
            <SocialLink
              key={link.label}
              $expanded={fontScale > 1}
              accessibilityRole="link"
              accessibilityLabel={link.label}
              accessibilityHint="Abre fora do app"
              onPress={() => openUrl(link.url)}
              style={({ pressed }) => ({
                backgroundColor: pressed
                  ? theme.colors.surfacePressed
                  : 'transparent',
              })}
            >
              {link.icon === 'mail' ? (
                <Icon name="mail" size={22} color={theme.colors.accent} />
              ) : (
                <BrandIcon name={link.icon} />
              )}
              <SocialLabel variant="meta" weight="medium">
                {link.label}
              </SocialLabel>
            </SocialLink>
          ))}
        </SocialLinks>
      </Creator>

      <Section title="Ajude a melhorar">
        <SupportList bleed={false}>
          <SupportRow
            inset={0}
            leading={
              <Icon name="bug_report" size={24} color={theme.colors.accent} />
            }
            title="Reportar problema"
            titleWeight="medium"
            meta="Conte o que aconteceu"
            chevron
            onPress={() => setIsErrorModalOpen(true)}
          />
          <SupportRow
            inset={0}
            leading={
              <Icon name="lightbulb" size={24} color={theme.colors.accent} />
            }
            title="Sugerir melhoria"
            titleWeight="medium"
            meta="Deixe sua ideia no GitHub"
            external
            accessibilityRole="link"
            accessibilityHint="Abre no navegador"
            onPress={() => openUrl(`${GITHUB_REPO_URL}/issues`)}
          />
          <SupportRow
            inset={0}
            leading={<BrandIcon name="github" />}
            title="Ver código no GitHub"
            titleWeight="medium"
            meta="Dá pra contribuir por lá também"
            external
            accessibilityRole="link"
            accessibilityHint="Abre no navegador"
            onPress={() => openUrl(GITHUB_REPO_URL)}
          />
        </SupportList>
      </Section>
    </ScreenPanel>
  );
};
