import React, { useState } from 'react';
import { Linking, useWindowDimensions } from 'react-native';
import { useTheme } from 'styled-components/native';

import { ErrorReportModal } from '@features/ErrorReport/ErrorReportModal';
import {
  AoLogo,
  Avatar,
  Button,
  IconTile,
  List,
  ListRow,
  Section,
  Text,
  snackbar,
  type IconName,
} from '@components/ui';
import { ScreenPanel } from '@templates/ScreenPanel';

import {
  AppName,
  Callout,
  DevLink,
  DevLinks,
  Developer,
  Hero,
  Version,
} from './About.styles';

import { version } from '@/package.json';

const LINKEDIN_PROFILE_URL = 'https://www.linkedin.com/in/petrocardoso/';
const GITHUB_REPO_URL = 'https://github.com/pitroldev/ao-uerj-mobile-ts';
const CREATOR_EMAIL = 'mailto:contato@pitrol.dev?subject=AO UERJ';
const DEVELOPER = 'Petro Cardoso';

const DEV_LINKS: { label: string; icon: IconName; url: string }[] = [
  { label: 'GitHub', icon: 'code', url: GITHUB_REPO_URL },
  { label: 'LinkedIn', icon: 'work', url: LINKEDIN_PROFILE_URL },
  { label: 'Email', icon: 'mail', url: CREATOR_EMAIL },
];

/** Largura base de cada link do desenvolvedor (3 lado a lado no tamanho padrão). */
const DEV_LINK_BASIS = 96;

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
          width={108}
          color={theme.colors.logo}
          accessibilityLabel={null}
        />
        <AppName variant="titleL" align="center" accessibilityRole="header">
          AO UERJ
        </AppName>
        <Version tone="muted" align="center">
          Versão {version}
        </Version>
      </Hero>

      <Callout
        tone="neutral"
        icon="info"
        iconColor={theme.colors.accent}
        text="Aplicativo não oficial e de código aberto. A UERJ não mantém este app; ele apenas lê o Aluno Online com a sua conta."
      />

      <Section title="Suporte">
        <List>
          <ListRow
            leading={<IconTile icon="bug_report" />}
            title="Reportar problema"
            meta="Conte o que aconteceu e em qual tela"
            chevron
            onPress={() => setIsErrorModalOpen(true)}
          />
          <ListRow
            leading={<IconTile icon="lightbulb" />}
            title="Sugerir melhoria"
            meta="Abre as sugestões no GitHub"
            external
            accessibilityRole="link"
            accessibilityHint="Abre no navegador"
            onPress={() => openUrl(`${GITHUB_REPO_URL}/issues`)}
          />
        </List>
      </Section>

      <Section
        title="Contribua"
        description="Este projeto é open source e aceita contribuições!"
      >
        <List>
          <ListRow
            leading={<IconTile icon="code" />}
            title="Ver repositório"
            meta="github.com/pitroldev/ao-uerj-mobile-ts"
            external
            accessibilityRole="link"
            accessibilityHint="Abre no navegador"
            onPress={() => openUrl(GITHUB_REPO_URL)}
          />
        </List>
      </Section>

      <Section title="Desenvolvedor">
        <Developer>
          <Avatar name={DEVELOPER} />
          <Text variant="body" weight="semibold">
            {DEVELOPER}
          </Text>
        </Developer>
        <DevLinks>
          {DEV_LINKS.map(link => (
            <DevLink
              key={link.label}
              $basis={Math.round(DEV_LINK_BASIS * Math.max(1, fontScale))}
            >
              <Button
                variant="outline"
                size="sm"
                icon={link.icon}
                label={link.label}
                accessibilityRole="link"
                accessibilityHint="Abre fora do app"
                onPress={() => openUrl(link.url)}
              />
            </DevLink>
          ))}
        </DevLinks>
      </Section>
    </ScreenPanel>
  );
};
