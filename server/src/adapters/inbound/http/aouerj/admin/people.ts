import {
  isBanned,
  type Student,
} from '../../../../../modules/students/domain.ts';
import type { StudentFacts } from './desk.ts';
import { count, dayMonth } from './format.ts';
import { html, type Html } from './html.ts';
import { personLink } from './pieces.ts';

/* Quem é cada um, para a moderação decidir com o contexto. */

/** O histórico do aluno em etiquetas: banimento, denúncias e avisos. */
export function historyChips(student: Student, facts: StudentFacts, now: Date) {
  const chips: Html[] = [];
  if (student.ban && isBanned(student.ban, now))
    chips.push(
      html`<span class="warn"
        >${student.ban.until ? `Banido até ${dayMonth(student.ban.until)}` : 'Banido para sempre'}</span
      >`,
    );
  else if (student.ban)
    chips.push(html`<span class="warn">Já foi banido</span>`);
  if (facts.reported)
    chips.push(
      html`<span class="${facts.reported > 2 ? 'warn' : ''}"
        >${count(facts.reported, 'denúncia recebida', 'denúncias recebidas')}</span
      >`,
    );
  if (facts.reportsMade)
    chips.push(
      html`<span
        >${count(facts.reportsMade, 'denúncia feita', 'denúncias feitas')}</span
      >`,
    );
  if (facts.notices)
    chips.push(
      html`<span
        >${count(facts.notices, 'aviso no campus', 'avisos no campus')}${facts.noticesRemoved ? `, ${facts.noticesRemoved} fora do ar` : ''}</span
      >`,
    );
  if (!chips.length) chips.push(html`<span>Nada antes</span>`);
  return html`<div class="hist">${chips}</div>`;
}

/** O cartão de uma pessoa: o apelido (se houver), o aluno e o histórico. */
export function personCard({
  base,
  student,
  facts,
  now,
  nick,
  role,
  back,
  missing = 'aluno não identificado',
}: {
  base: string;
  student: Student | undefined;
  facts: (id: string) => StudentFacts;
  now: Date;
  nick?: string;
  role?: string;
  back?: string;
  missing?: string;
}) {
  return html`<div class="person-card">
    <div class="pc-top">
      ${nick ? html`<b>${nick}</b>` : null}${role ? html`<span class="role">${role}</span>` : null}${student ? personLink(base, student, back) : html`<span class="quiet">${missing}</span>`}
    </div>
    ${student ? historyChips(student, facts(student.id), now) : null}
  </div>`;
}
