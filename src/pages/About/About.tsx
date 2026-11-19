import React, { useState } from 'react';
import { Linking, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { useTheme } from 'styled-components/native';

import { ErrorReportModal } from '@features/ErrorReport/ErrorReportModal';
import { SuggestIdeaSheet } from '@features/Ideas/SuggestIdeaSheet';
import { AoLogo, Icon, Section, Tag, Text, snackbar } from '@components/ui';
import { ScreenPanel } from '@templates/ScreenPanel';
import { useAppServices } from '@root/app/providers/AppServicesProvider';
import { newlyDone } from '@root/modules/ideas/domain/ideas';
import { doneText } from '@root/modules/ideas/presentation/ideasText';
import {
  useIdeasState,
  useMyIdeas,
} from '@root/modules/ideas/presentation/useIdeas';
import type { RootDrawerParamList } from '@root/routes';
import type { RunningUpdate } from '@root/modules/delivery/application/ports';
import {
  useRunningUpdate,
  useStoreListing,
} from '@root/modules/delivery/presentation/DeliveryProvider';
import { InviteSheet } from '@root/modules/delivery/presentation/InviteSheet';
import {
  appInvite,
  type Invite,
} from '@root/modules/delivery/presentation/inviteText';

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
// o mesmo endereço da Play Console: não mova o arquivo
const PRIVACY_POLICY_URL = `${GITHUB_REPO_URL}/blob/main/docs/privacidade.md`;

const DEV_LINKS = [
  { label: 'GitHub', icon: 'github', url: GITHUB_PROFILE_URL },
  { label: 'LinkedIn', icon: 'linkedin', url: LINKEDIN_PROFILE_URL },
  { label: 'E-mail', icon: 'mail', url: CREATOR_EMAIL },
] as const;

/** "Versão 2.16.0"; com uma atualização OTA em uso, também o dia dela. */
function versionLabel(update: RunningUpdate | null) {
  if (!update) return `Versão ${version}`;
  const day = String(update.createdAt.getDate()).padStart(2, '0');
  const month = String(update.createdAt.getMonth() + 1).padStart(2, '0');
  return `Versão ${version} · atualização de ${day}/${month}`;
}

export const AboutPage = () => {
  const theme = useTheme();
  const { fontScale } = useWindowDimensions();
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
  // avaliar e indicar só onde o app está numa loja (a Play ou a App Store)
  const store = useStoreListing();
  const update = useRunningUpdate();
  const [invite, setInvite] = useState<Invite | null>(null);
  const navigation = useNavigation<DrawerNavigationProp<RootDrawerParamList>>();
  // "Sugerir uma ideia" só onde o app entra como aluno; fora disso, o GitHub
  const { ideas } = useAppServices();
  const [suggesting, setSuggesting] = useState(false);
  const ideasState = useIdeasState();
  // as feitas só são lidas de quem já sugeriu (quem nunca sugeriu não
  // passa pela confirmação de aluno ao abrir o Sobre)
  const mine = useMyIdeas({
    enabled: ideasState.known && ideasState.scope !== null,
  });
  const freshDone =
    mine.data && ideasState.scope
      ? newlyDone(mine.data.ideas, ideasState.seenDone).length
      : 0;
  const showMine = () => {
    setSuggesting(false);
    navigation.navigate('Minhas sugestões');
  };

  const openUrl = (url: string) => {
    Linking.openURL(url).catch((err: Error) => {
      console.log('AboutOpenURL error', err);
      snackbar.error('Não foi possível abrir este link.');
    });
  };

  const rate = () => {
    if (!store) return;
    store.open().catch(() => {
      snackbar.error(`Não foi possível abrir a ${store.name}.`);
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
          {versionLabel(update)}
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

      {store?.available ? (
        <Section title="Ajude o app a crescer">
          <SupportList bleed={false}>
            <SupportRow
              inset={0}
              leading={
                <Icon name="star" size={24} color={theme.colors.accent} />
              }
              title={`Avaliar na ${store.name}`}
              titleWeight="medium"
              meta="Sua nota ajuda outros alunos a acharem o app"
              external
              accessibilityRole="link"
              accessibilityHint={`Abre a página do AO UERJ na ${store.name}`}
              onPress={rate}
            />
            <SupportRow
              inset={0}
              leading={
                <Icon name="share" size={24} color={theme.colors.accent} />
              }
              title="Indicar para a turma"
              titleWeight="medium"
              meta="Mande o link no grupo ou mostre o QR"
              chevron
              onPress={() => setInvite(appInvite('sobre'))}
            />
          </SupportList>
        </Section>
      ) : null}

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
          {ideas.supported ? (
            [
              <SupportRow
                key="suggest"
                inset={0}
                leading={
                  <Icon
                    name="lightbulb"
                    size={24}
                    color={theme.colors.accent}
                  />
                }
                title="Sugerir uma ideia"
                titleWeight="medium"
                meta="O que falta no app?"
                chevron
                onPress={() => setSuggesting(true)}
              />,
              <SupportRow
                key="mine"
                inset={0}
                leading={
                  <Icon name="history" size={24} color={theme.colors.accent} />
                }
                title="Minhas sugestões"
                titleWeight="medium"
                meta={freshDone ? undefined : 'Veja o andamento'}
                chevron
                accessibilityLabel={
                  freshDone
                    ? `Minhas sugestões, ${doneText(freshDone)}`
                    : undefined
                }
                onPress={showMine}
              >
                {freshDone ? (
                  <Tag
                    tone="good"
                    icon="check_circle"
                    label={doneText(freshDone)}
                  />
                ) : null}
              </SupportRow>,
            ]
          ) : (
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
          )}
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

      <Section title="Seus dados">
        <SupportList bleed={false}>
          <SupportRow
            inset={0}
            leading={<Icon name="lock" size={24} color={theme.colors.accent} />}
            title="Política de privacidade"
            titleWeight="medium"
            meta="O que fica no celular e o que vai para o servidor"
            external
            accessibilityRole="link"
            accessibilityHint="Abre no navegador"
            onPress={() => openUrl(PRIVACY_POLICY_URL)}
          />
        </SupportList>
      </Section>
      <InviteSheet invite={invite} onClose={() => setInvite(null)} />
      {ideas.supported ? (
        <SuggestIdeaSheet
          visible={suggesting}
          onClose={() => setSuggesting(false)}
          onShowMine={showMine}
        />
      ) : null}
    </ScreenPanel>
  );
};
