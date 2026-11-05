import {
  CAMPUS_INVITE,
  COMPANION_INVITE,
  appInvite,
  inviteMessage,
  muralInvite,
  scheduleCaption,
} from '../inviteText';

const PLAY = 'https://play.google.com/store/apps/details?id=com.aouerjmobile';

it('ends every message with the Play link of its origin', () => {
  expect(inviteMessage(appInvite('menu'))).toMatch(
    new RegExp(
      `Android: ${PLAY.replace(/[.?]/g, '\\$&')}&referrer=utm_source%3Dmenu$`,
    ),
  );
  expect(inviteMessage(appInvite('sobre'))).toContain('utm_source%3Dsobre');
  expect(inviteMessage(CAMPUS_INVITE)).toContain('utm_source%3Dcampus');
  expect(inviteMessage(COMPANION_INVITE)).toContain('utm_source%3Dcompanhia');
});

it('names the class in the mural invite, and leaves the turma out when unknown', () => {
  expect(muralInvite('Cálculo II', 3).text).toBe(
    'Abri o mural de Cálculo II (turma 3) no AO UERJ. Entra lá pra gente trocar material, links e datas de prova:',
  );
  expect(muralInvite('Cálculo II', null).text).toContain(
    'mural de Cálculo II no AO UERJ',
  );
  expect(inviteMessage(muralInvite('Cálculo II', '3'))).toContain(
    'utm_source%3Dmural',
  );
});

it('captions the shared schedule with its period and the link', () => {
  expect(scheduleCaption('2026.2')).toBe(
    `Minha grade de 2026.2, feita no app AO UERJ: ${PLAY}&referrer=utm_source%3Dgrade`,
  );
  expect(scheduleCaption(null)).toMatch(/^Minha grade, feita no app AO UERJ: /);
});
