import {
  CAMPUS_INVITE,
  COMPANION_INVITE,
  appInvite,
  inviteMessage,
  muralInvite,
  plannedScheduleCaption,
  scheduleCaption,
} from '../inviteText';

const PLAY = 'https://play.google.com/store/apps/details?id=com.aouerjmobile';
const APPLE = 'https://apps.apple.com/br/app/id6835308883';
const links = (source: string) =>
  `Android: ${PLAY}&referrer=utm_source%3D${source}\niPhone: ${APPLE}`;

it('ends every message with the links of both stores, the Play one with its origin', () => {
  expect(inviteMessage(appInvite('menu'))).toBe(
    `Tô usando o AO UERJ: grade, notas, quanto falta na PF e aviso de nota nova, tudo no celular. É grátis, para Android e iPhone:\n${links('menu')}`,
  );
  expect(inviteMessage(appInvite('sobre'))).toContain(links('sobre'));
  expect(inviteMessage(CAMPUS_INVITE)).toContain(links('campus'));
  expect(inviteMessage(COMPANION_INVITE)).toContain(links('companhia'));
});

it('no longer says the app is only for Android', () => {
  for (const invite of [appInvite('menu'), CAMPUS_INVITE, COMPANION_INVITE])
    expect(invite.text).toMatch(/para Android e iPhone:$/);
});

it('names the class in the mural invite, and leaves the turma out when unknown', () => {
  expect(muralInvite('Cálculo II', 3).text).toBe(
    'Abri o mural de Cálculo II (turma 3) no AO UERJ. Entra lá pra gente trocar material, links e datas de prova:',
  );
  expect(muralInvite('Cálculo II', null).text).toContain(
    'mural de Cálculo II no AO UERJ',
  );
  expect(inviteMessage(muralInvite('Cálculo II', '3'))).toContain(
    links('mural'),
  );
});

it('captions the shared schedule with its period and the links', () => {
  expect(scheduleCaption('2026.2')).toBe(
    `Minha grade de 2026.2, feita no app AO UERJ:\n${links('grade')}`,
  );
  expect(scheduleCaption(null)).toMatch(
    /^Minha grade, feita no app AO UERJ:\n/,
  );
  expect(plannedScheduleCaption()).toBe(
    `Minha grade planejada no gerador do app AO UERJ:\n${links('gerador')}`,
  );
});
