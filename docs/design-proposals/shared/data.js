/*
 * AO UERJ — dados de demonstração compartilhados pelas 3 propostas visuais.
 *
 * TUDO AQUI É FICTÍCIO. Nomes, matrícula, notas, códigos de disciplina, salas,
 * professores e mensagens foram inventados para a demonstração. Os formatos
 * seguem os modelos reais do app (src/modules/academics/domain/models.ts):
 * tempos M1–N5, períodos 2026.2, P1/P2/PF/Média, RID parcial, tipos de disciplina.
 *
 * As regras de cálculo (CR aproximado, progresso por tipo) espelham
 * src/modules/academics/domain/rules/progress.ts.
 */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ tempo */

  var SLOTS = [
    { id: 'M1', from: '7:00', to: '7:50', start: 420, end: 470 },
    { id: 'M2', from: '7:50', to: '8:40', start: 470, end: 520 },
    { id: 'M3', from: '8:50', to: '9:40', start: 530, end: 580 },
    { id: 'M4', from: '9:40', to: '10:30', start: 580, end: 630 },
    { id: 'M5', from: '10:40', to: '11:30', start: 640, end: 690 },
    { id: 'M6', from: '11:30', to: '12:20', start: 690, end: 740 },
    { id: 'T1', from: '12:20', to: '13:20', start: 740, end: 800 },
    { id: 'T2', from: '13:20', to: '14:10', start: 800, end: 850 },
    { id: 'T3', from: '14:20', to: '15:10', start: 860, end: 910 },
    { id: 'T4', from: '15:10', to: '16:00', start: 910, end: 960 },
    { id: 'T5', from: '16:10', to: '17:00', start: 970, end: 1020 },
    { id: 'T6', from: '17:00', to: '17:50', start: 1020, end: 1070 },
    { id: 'N1', from: '18:00', to: '18:50', start: 1080, end: 1130 },
    { id: 'N2', from: '18:50', to: '19:40', start: 1130, end: 1180 },
    { id: 'N3', from: '19:40', to: '20:30', start: 1180, end: 1230 },
    { id: 'N4', from: '20:30', to: '21:20', start: 1230, end: 1280 },
    { id: 'N5', from: '21:20', to: '22:10', start: 1280, end: 1330 },
  ];

  var WEEKDAYS = [
    { n: 1, name: 'Segunda', short: 'Seg' },
    { n: 2, name: 'Terça', short: 'Ter' },
    { n: 3, name: 'Quarta', short: 'Qua' },
    { n: 4, name: 'Quinta', short: 'Qui' },
    { n: 5, name: 'Sexta', short: 'Sex' },
    { n: 6, name: 'Sábado', short: 'Sáb' },
  ];

  function slot(id) {
    for (var i = 0; i < SLOTS.length; i++) if (SLOTS[i].id === id) return SLOTS[i];
    return null;
  }

  /** Turno pela hora de início, como em ClassScheduleBoard.getBoxColor. */
  function shiftOf(startMinutes) {
    if (startMinutes < 740) return 'MORNING';
    if (startMinutes < 1070) return 'AFTERNOON';
    return 'NIGHT';
  }

  var SHIFT_LABEL = { MORNING: 'Manhã', AFTERNOON: 'Tarde', NIGHT: 'Noite' };

  /* --------------------------------------------------------- dicionários */

  var SUBJECT_TYPE = {
    MANDATORY: 'Obrigatória',
    RESTRICTED: 'Eletiva Restrita',
    DEFINED: 'Eletiva Definida',
    UNIVERSAL: 'Universal',
  };

  var SUBJECT_STATUS = {
    APPROVED: 'Aprovado',
    FAILED_BY_GRADE: 'Reprovado por Nota',
    FAILED_BY_ATTENDANCE: 'Reprovado por Frequência',
    CANCELED: 'Cancelado',
    EXEMPT: 'Isento',
    IN_PROGRESS: 'Em Preparo',
  };

  /** Mesma regra de src/utils/numberToColor.ts: GOOD ≥ 70%, BAD ≥ 50%, CRITICAL abaixo. */
  function health(current, base, inverse) {
    if (typeof current !== 'number') return 'NONE';
    base = base == null ? 10 : base;
    var target = inverse ? base - current : current;
    var pct = target / base;
    if (pct >= 0.7) return 'GOOD';
    if (pct >= 0.5) return 'BAD';
    return 'CRITICAL';
  }

  /* ------------------------------------------------------------- aluno */

  var student = {
    name: 'Marina Albuquerque Teixeira',
    firstName: 'Marina',
    matricula: '202310045612',
    course: 'Ciência da Computação',
    period: '2026.2',
  };

  /** "Agora" congelado para a demonstração: terça, 13/10/2026, 11:58. */
  var now = { weekday: 2, minutes: 11 * 60 + 58, label: 'Terça, 13 de outubro', time: '11:58' };

  /* ------------------------------------------- disciplinas em curso 2026.2 */

  var LOC = {
    F6037: 'Pav. João Lyra Filho · 6º andar · Sala 6037 F',
    D6113: 'Pav. João Lyra Filho · 6º andar · Sala 6113 D',
    B6019: 'Pav. João Lyra Filho · 6º andar · Sala 6019 B',
    LAB: 'Pav. João Lyra Filho · 6º andar · Laboratório LIG',
    NONE: '',
  };

  /** Uma entrada por disciplina inscrita; `meetings` vira AttendedClassesSchedule. */
  var enrolled = [
    {
      id: 'IME04-10933', name: 'Otimização Combinatória', class: '1',
      location: LOC.B6019, ava: '', status: 'ACTIVE',
      meetings: [{ day: 2, from: 'T1', to: 'T2' }, { day: 4, from: 'T1', to: 'T2' }],
    },
    {
      id: 'IME02-10871', name: 'Compiladores', class: '1',
      location: LOC.D6113, ava: 'SALA12IMECOMP', status: 'ACTIVE',
      meetings: [{ day: 2, from: 'M3', to: 'M4' }, { day: 4, from: 'M3', to: 'M4' }],
    },
    {
      id: 'IME02-10892', name: 'Sistemas Distribuídos', class: '2',
      location: LOC.F6037, ava: '', status: 'ACTIVE',
      meetings: [{ day: 1, from: 'T3', to: 'T4' }, { day: 3, from: 'T3', to: 'T4' }],
    },
    {
      id: 'IME02-11024', name: 'Aprendizado de Máquina', class: '1',
      location: LOC.LAB, ava: '', status: 'ACTIVE',
      meetings: [{ day: 1, from: 'N1', to: 'N2' }, { day: 3, from: 'N1', to: 'N2' }],
    },
    {
      id: 'IME02-10905', name: 'Ética e Computação', class: '3',
      location: LOC.NONE, ava: '', status: 'ACTIVE',
      meetings: [{ day: 5, from: 'M5', to: 'M6' }],
    },
    {
      id: 'IME02-10950', name: 'Projeto Final I', class: '1',
      location: LOC.F6037, ava: '', status: 'ACTIVE',
      meetings: [{ day: 5, from: 'T3', to: 'T4' }],
    },
    {
      id: 'IME02-10880', name: 'Computação Gráfica', class: '1',
      location: '', ava: '', status: 'CANCELED',
      meetings: [],
    },
  ];

  /** Achatado no formato do app: uma linha por encontro (dia + intervalo). */
  var schedule = [];
  enrolled.forEach(function (s) {
    s.meetings.forEach(function (m) {
      var a = slot(m.from), b = slot(m.to);
      var wd = WEEKDAYS[m.day - 1];
      schedule.push({
        subjectId: s.id, name: s.name, class: s.class,
        location: s.location, status: s.status,
        day: m.day, dayName: wd.name, dayShort: wd.short,
        fromSlot: a.id, toSlot: b.id, fromTime: a.from, toTime: b.to,
        start: a.start, end: b.end, shift: shiftOf(a.start),
      });
    });
  });
  schedule.sort(function (x, y) { return x.day - y.day || x.start - y.start; });

  /** Próxima aula a partir do "agora" congelado. */
  function nextClass() {
    var later = schedule.filter(function (c) {
      return c.day > now.weekday || (c.day === now.weekday && c.end > now.minutes);
    });
    var c = later[0] || schedule[0];
    var inMinutes = c.day === now.weekday ? c.start - now.minutes : null;
    return Object.assign({}, c, { inMinutes: inMinutes, ongoing: inMinutes !== null && inMinutes <= 0 });
  }

  /* --------------------------------------------------- quadro de notas */

  var grades = [
    { id: 'IME02-10892', name: 'Sistemas Distribuídos', class: 2, p1: 8.5, p2: null, pf: null, result: null },
    { id: 'IME02-11024', name: 'Aprendizado de Máquina', class: 1, p1: 9.2, p2: null, pf: null, result: null },
    { id: 'IME02-10871', name: 'Compiladores', class: 1, p1: 6.0, p2: null, pf: null, result: null },
    { id: 'IME04-10933', name: 'Otimização Combinatória', class: 1, p1: 4.5, p2: null, pf: null, result: null },
    { id: 'IME02-10905', name: 'Ética e Computação', class: 3, p1: null, p2: null, pf: null, result: 9.0 },
  ];

  /* ------------------------------------------------------- RID parcial */

  var rid = {
    updatedAt: '12/08/2026 às 14:32',
    subjects: [
      { id: 'IME02-10892', name: 'Sistemas Distribuídos', classNumber: 2, available: 40, requested: 38, position: 12, status: 'Deferida' },
      { id: 'IME04-10933', name: 'Otimização Combinatória', classNumber: 1, available: 35, requested: 30, position: 8, status: 'Deferida' },
      { id: 'IME02-10871', name: 'Compiladores', classNumber: 1, available: 45, requested: 52, position: 41, status: 'Em processamento' },
      { id: 'IME02-11024', name: 'Aprendizado de Máquina', classNumber: 1, available: 30, requested: 61, position: 27, status: 'Em processamento' },
      { id: 'IME02-10880', name: 'Computação Gráfica', classNumber: 1, available: 30, requested: 44, position: 0, status: 'Indeferida: choque de horário' },
    ],
  };

  /* ---------------------------------------------------------- currículo */

  function c(id, name, period, type, credits, workload, extra) {
    return Object.assign({ id: id, name: name, period: period, type: type, credits: credits, workload: workload, branch: null, minimum_credits: null }, extra || {});
  }

  var curriculum = [
    c('IME01-10012', 'Cálculo Diferencial e Integral I', 1, 'MANDATORY', 6, 90),
    c('IME01-10015', 'Geometria Analítica', 1, 'MANDATORY', 4, 60),
    c('IME02-10801', 'Matemática Discreta', 1, 'MANDATORY', 4, 60),
    c('IME02-10802', 'Fundamentos da Computação', 1, 'MANDATORY', 4, 60),
    c('IME02-10803', 'Linguagem de Programação I', 1, 'MANDATORY', 4, 75),
    c('IME01-10022', 'Cálculo Diferencial e Integral II', 2, 'MANDATORY', 6, 90),
    c('IME01-10031', 'Álgebra Linear', 2, 'MANDATORY', 4, 60),
    c('FIS01-10120', 'Física I', 2, 'MANDATORY', 4, 75),
    c('IME02-10811', 'Linguagem de Programação II', 2, 'MANDATORY', 4, 75),
    c('IME02-10812', 'Estruturas de Dados I', 2, 'MANDATORY', 4, 60),
    c('IME01-10041', 'Cálculo Diferencial e Integral III', 3, 'MANDATORY', 4, 60),
    c('IME03-10210', 'Probabilidade e Estatística', 3, 'MANDATORY', 4, 60),
    c('IME02-10821', 'Estruturas de Dados II', 3, 'MANDATORY', 4, 60),
    c('IME02-10822', 'Arquitetura de Computadores I', 3, 'MANDATORY', 4, 60),
    c('IME02-10823', 'Lógica para Computação', 3, 'MANDATORY', 4, 60),
    c('IME04-10901', 'Cálculo Numérico', 4, 'MANDATORY', 4, 60),
    c('IME02-10841', 'Teoria dos Grafos', 4, 'MANDATORY', 4, 60),
    c('IME02-10842', 'Banco de Dados I', 4, 'MANDATORY', 4, 60),
    c('IME02-10843', 'Arquitetura de Computadores II', 4, 'MANDATORY', 4, 60),
    c('IME02-10844', 'Linguagens Formais e Autômatos', 4, 'MANDATORY', 4, 60),
    c('IME02-10838', 'Engenharia de Software', 5, 'MANDATORY', 4, 60),
    c('IME02-10860', 'Sistemas Operacionais I', 5, 'MANDATORY', 4, 60),
    c('IME02-10862', 'Redes de Computadores I', 5, 'MANDATORY', 4, 60),
    c('IME02-10863', 'Banco de Dados II', 5, 'MANDATORY', 4, 60),
    c('IME02-10864', 'Análise de Algoritmos', 5, 'MANDATORY', 4, 60),
    c('IME02-10871', 'Compiladores', 6, 'MANDATORY', 4, 60),
    c('IME02-10872', 'Inteligência Artificial', 6, 'MANDATORY', 4, 60),
    c('IME02-10873', 'Sistemas Operacionais II', 6, 'MANDATORY', 4, 60),
    c('IME02-10874', 'Interação Humano-Computador', 6, 'MANDATORY', 4, 60),
    c('IME02-10880', 'Computação Gráfica', 6, 'MANDATORY', 4, 60),
    c('IME02-10892', 'Sistemas Distribuídos', 7, 'MANDATORY', 4, 60),
    c('IME04-10933', 'Otimização Combinatória', 7, 'MANDATORY', 4, 60),
    c('IME02-10905', 'Ética e Computação', 7, 'MANDATORY', 2, 30),
    c('IME02-10950', 'Projeto Final I', 7, 'MANDATORY', 4, 60, { minimum_credits: 140 }),
    c('IME02-10951', 'Projeto Final II', 8, 'MANDATORY', 4, 60, { minimum_credits: 150 }),
    c('IME02-10960', 'Estágio Supervisionado', 8, 'MANDATORY', 6, 180, { minimum_credits: 120 }),
    c('IME02-11024', 'Aprendizado de Máquina', null, 'RESTRICTED', 4, 60, { branch: 'A' }),
    c('IME02-11025', 'Processamento de Imagens', null, 'RESTRICTED', 4, 60, { branch: 'A' }),
    c('IME02-11031', 'Segurança da Informação', null, 'RESTRICTED', 4, 60, { branch: 'B' }),
    c('IME02-11032', 'Computação em Nuvem', null, 'RESTRICTED', 4, 60, { branch: 'B' }),
    c('IME02-11040', 'Desenvolvimento para Dispositivos Móveis', null, 'RESTRICTED', 4, 60, { branch: 'C' }),
    c('IME02-11041', 'Visão Computacional', null, 'RESTRICTED', 4, 60, { branch: 'A' }),
    c('IME03-10260', 'Inferência Estatística', null, 'DEFINED', 4, 60),
    c('ILE02-10115', 'Inglês Instrumental', null, 'DEFINED', 2, 30),
    c('ICS01-10230', 'Empreendedorismo e Inovação', null, 'DEFINED', 2, 30),
    c('IFC03-10440', 'Filosofia da Ciência', null, 'DEFINED', 4, 60),
  ];

  /* ----------------------------------------------------------- histórico */

  function h(period, id, status, grade, frequency) {
    var cur = curriculum.filter(function (x) { return x.id === id; })[0];
    var uni = universals.filter(function (x) { return x.id === id; })[0];
    var base = cur || uni;
    return {
      period: period, id: id, name: base.name,
      type: cur ? cur.type : 'UNIVERSAL',
      credits: base.credits, workload: base.workload,
      status: status, grade: grade, frequency: frequency,
    };
  }

  var universals = [
    { id: 'ILE01-10301', name: 'Língua Brasileira de Sinais (Libras)', dept: 'Instituto de Letras', credits: 2, workload: 30 },
    { id: 'ILE01-10322', name: 'Leitura e Produção de Textos Acadêmicos', dept: 'Instituto de Letras', credits: 4, workload: 60 },
    { id: 'EDU03-10118', name: 'Educação e Diversidade', dept: 'Faculdade de Educação', credits: 4, workload: 60 },
    { id: 'EDU05-10204', name: 'Tecnologias Digitais na Educação', dept: 'Faculdade de Educação', credits: 2, workload: 30 },
    { id: 'IFC02-10507', name: 'História do Rio de Janeiro', dept: 'Instituto de Filosofia e Ciências Humanas', credits: 4, workload: 60 },
    { id: 'IFC04-10612', name: 'Introdução à Antropologia', dept: 'Instituto de Filosofia e Ciências Humanas', credits: 4, workload: 60 },
    { id: 'FCE01-10077', name: 'Introdução à Economia', dept: 'Faculdade de Ciências Econômicas', credits: 4, workload: 60 },
    { id: 'FCE02-10093', name: 'Finanças Pessoais', dept: 'Faculdade de Ciências Econômicas', credits: 2, workload: 30 },
    { id: 'IART01-10150', name: 'Fotografia e Imagem', dept: 'Instituto de Artes', credits: 4, workload: 60 },
    { id: 'IART02-10188', name: 'Música Popular Brasileira', dept: 'Instituto de Artes', credits: 2, workload: 30 },
    { id: 'IBRAG01-10044', name: 'Biologia e Sociedade', dept: 'Instituto de Biologia Roberto Alcantara Gomes', credits: 2, workload: 30 },
  ];

  var history = [
    h('2023.1', 'IME01-10012', 'APPROVED', 7.0, 92),
    h('2023.1', 'IME01-10015', 'APPROVED', 8.4, 96),
    h('2023.1', 'IME02-10801', 'APPROVED', 7.8, 90),
    h('2023.1', 'IME02-10802', 'APPROVED', 9.1, 100),
    h('2023.1', 'IME02-10803', 'APPROVED', 9.6, 100),

    h('2023.2', 'IME01-10022', 'FAILED_BY_GRADE', 3.8, 88),
    h('2023.2', 'IME01-10031', 'APPROVED', 6.9, 86),
    h('2023.2', 'FIS01-10120', 'FAILED_BY_ATTENDANCE', 2.0, 58),
    h('2023.2', 'IME02-10811', 'APPROVED', 8.8, 94),
    h('2023.2', 'IME02-10812', 'APPROVED', 8.2, 92),

    h('2024.1', 'IME01-10022', 'APPROVED', 6.4, 90),
    h('2024.1', 'FIS01-10120', 'APPROVED', 7.1, 84),
    h('2024.1', 'IME03-10210', 'APPROVED', 7.6, 88),
    h('2024.1', 'IME02-10821', 'APPROVED', 8.7, 96),
    h('2024.1', 'IME02-10823', 'APPROVED', 9.0, 100),

    h('2024.2', 'IME01-10041', 'APPROVED', 6.2, 82),
    h('2024.2', 'IME02-10822', 'APPROVED', 7.9, 90),
    h('2024.2', 'IME02-10841', 'APPROVED', 8.5, 94),
    h('2024.2', 'IME02-10842', 'APPROVED', 9.3, 98),
    h('2024.2', 'ILE01-10301', 'APPROVED', 9.5, 100),

    h('2025.1', 'IME04-10901', 'APPROVED', 7.3, 88),
    h('2025.1', 'IME02-10843', 'APPROVED', 8.1, 92),
    h('2025.1', 'IME02-10844', 'APPROVED', 7.7, 90),
    h('2025.1', 'IME02-10838', 'APPROVED', 9.4, 100),
    h('2025.1', 'IME03-10260', 'CANCELED', null, null),

    h('2025.2', 'IME02-10860', 'APPROVED', 8.0, 92),
    h('2025.2', 'IME02-10862', 'APPROVED', 8.6, 96),
    h('2025.2', 'IME02-10863', 'APPROVED', 8.9, 94),
    h('2025.2', 'IME02-10864', 'APPROVED', 7.2, 86),
    h('2025.2', 'ILE02-10115', 'APPROVED', 9.8, 100),

    h('2026.1', 'IME02-10872', 'APPROVED', 8.8, 96),
    h('2026.1', 'IME02-10873', 'APPROVED', 7.5, 90),
    h('2026.1', 'IME02-10874', 'APPROVED', 9.2, 100),
    h('2026.1', 'IME02-11031', 'APPROVED', 8.3, 92),
    h('2026.1', 'ICS01-10230', 'APPROVED', 9.0, 96),

    h('2026.2', 'IME02-10892', 'IN_PROGRESS', null, null),
    h('2026.2', 'IME04-10933', 'IN_PROGRESS', null, null),
    h('2026.2', 'IME02-10871', 'IN_PROGRESS', null, null),
    h('2026.2', 'IME02-11024', 'IN_PROGRESS', null, null),
    h('2026.2', 'IME02-10905', 'IN_PROGRESS', null, null),
    h('2026.2', 'IME02-10950', 'IN_PROGRESS', null, null),
  ];

  /* Marca o que já foi aprovado no currículo (como o parser faz). */
  var approvedIds = {};
  history.forEach(function (s) {
    if (s.status === 'APPROVED' || s.status === 'EXEMPT') approvedIds[s.id] = true;
  });
  curriculum.forEach(function (s) { s.alreadyTaken = !!approvedIds[s.id]; });

  /* ------------------------------------ regras de progresso (progress.ts) */

  function cumulativeAverage(list) {
    var w = 0, cr = 0;
    list.forEach(function (s) {
      if (s.status === 'IN_PROGRESS' || s.grade == null || !s.credits) return;
      w += s.grade * s.credits; cr += s.credits;
    });
    return cr > 0 ? Number((w / cr).toFixed(2)) : 0;
  }

  var periods = [];
  history.forEach(function (s) { if (periods.indexOf(s.period) < 0) periods.push(s.period); });
  periods.sort(function (a, b) { return a.localeCompare(b, 'pt-BR', { numeric: true }); });

  var closedPeriods = periods.filter(function (p) { return p !== student.period; });

  var craPoints = closedPeriods.map(function (p, i) {
    var upTo = closedPeriods.slice(0, i + 1);
    var periodAvg = cumulativeAverage(history.filter(function (s) { return s.period === p; }));
    return {
      label: p,
      cra: cumulativeAverage(history.filter(function (s) { return upTo.indexOf(s.period) >= 0; })),
      periodAverage: periodAvg,
    };
  });

  /** Lista do seletor de período em "Disciplinas Realizadas" (mais recente primeiro). */
  var periodList = periods.map(function (p, i) {
    var upTo = periods.slice(0, i + 1);
    var avg = cumulativeAverage(history.filter(function (s) { return upTo.indexOf(s.period) >= 0; }));
    var current = p === closedPeriods[closedPeriods.length - 1];
    return { value: p, cra: avg, isCurrentCra: current, inProgress: p === student.period, label: p + ' - CR' + (current ? ' Atual' : '') + ': ' + avg };
  }).reverse();

  var electiveConfig = { RESTRICTED: 16, DEFINED: 8, UNIVERSAL: 4 };

  function academicProgress(config) {
    var types = ['MANDATORY', 'RESTRICTED', 'DEFINED', 'UNIVERSAL'];
    function zero() { return { MANDATORY: 0, RESTRICTED: 0, DEFINED: 0, UNIVERSAL: 0 }; }
    var totals = zero(), completed = zero(), totalCredits = zero(), completedCredits = zero();
    curriculum.forEach(function (s) { totals[s.type] += 1; totalCredits[s.type] += s.credits || 0; });
    var seen = {};
    history.forEach(function (s) {
      if ((s.status === 'APPROVED' || s.status === 'EXEMPT') && !seen[s.id]) {
        seen[s.id] = true; completed[s.type] += 1; completedCredits[s.type] += s.credits || 0;
      }
    });
    var required = {
      MANDATORY: totalCredits.MANDATORY,
      RESTRICTED: config.RESTRICTED || null,
      DEFINED: config.DEFINED || null,
      UNIVERSAL: config.UNIVERSAL || null,
    };
    var remaining = zero(), percent = zero();
    types.forEach(function (t) {
      remaining[t] = Math.max(0, totals[t] - completed[t]);
      var den = t === 'MANDATORY' ? totals[t] : required[t];
      var num = t === 'MANDATORY' ? completed[t] : completedCredits[t];
      percent[t] = den ? Math.min(100, Math.round((num / den) * 100)) : 0;
    });
    return {
      approvedCount: Object.keys(seen).length,
      order: types, totals: totals, completed: completed, remaining: remaining,
      totalCredits: totalCredits, completedCredits: completedCredits,
      requiredCredits: required, percent: percent,
    };
  }

  /* -------------------------------------------- pesquisa de disciplinas */

  var subjectDetails = {
    'IME02-10892': {
      id: 'IME02-10892', name: 'Sistemas Distribuídos', credits: 4, workload: 60, duration: 'Semestral',
      prerequisite: [
        [{ id: 'IME02-10860', name: 'Sistemas Operacionais I' }],
        [{ id: 'IME02-10862', name: 'Redes de Computadores I' }],
      ],
      classes: [
        {
          classNumber: 1, hasPreference: true,
          teachers: ['Ricardo Moura Lemos'],
          vacancies: { uerj: { requestedTaken: 38, requestedAvailable: 40, taken: 36, available: 40 } },
          schedule: [{ day: 'Segunda', slots: ['M3', 'M4'] }, { day: 'Quarta', slots: ['M3', 'M4'] }],
        },
        {
          classNumber: 2, hasPreference: false,
          teachers: ['Helena Duarte Viana'],
          vacancies: { uerj: { requestedTaken: 22, requestedAvailable: 40, taken: 20, available: 40 } },
          schedule: [{ day: 'Segunda', slots: ['T3', 'T4'] }, { day: 'Quarta', slots: ['T3', 'T4'] }],
        },
        {
          classNumber: 3, hasPreference: false,
          teachers: ['Paulo César Antunes', 'Lívia Moraes Prado'],
          vacancies: { uerj: { requestedTaken: 40, requestedAvailable: 40, taken: 40, available: 40 } },
          schedule: [{ day: 'Terça', slots: ['N1', 'N2'] }, { day: 'Quinta', slots: ['N1', 'N2'] }],
        },
      ],
    },
  };

  var searchHistory = [
    { id: 'IME02-10892', name: 'Sistemas Distribuídos', credits: 4, workload: 60 },
    { id: 'IME02-10871', name: 'Compiladores', credits: 4, workload: 60 },
    { id: 'IME02-11041', name: 'Visão Computacional', credits: 4, workload: 60 },
    { id: 'IME04-10933', name: 'Otimização Combinatória', credits: 4, workload: 60 },
  ];

  /* -------------------------------------------------------------- mural */

  var messages = {
    'IME02-10892': [
      { author: 'Lucas Ferreira', at: '09/10/2026', time: '21:14', text: 'Galera, criei o grupo da turma 2: https://chat.whatsapp.com/exemplo-turma2', mine: false },
      { author: 'Beatriz Nunes', at: '10/10/2026', time: '08:02', text: 'A professora confirmou a P2 para 24/11, mesma sala.', mine: false },
      { author: 'Marina Albuquerque', at: '10/10/2026', time: '08:15', text: 'Alguém tem os slides da aula de consenso (Raft)? Perdi a de quarta.', mine: true },
      { author: 'Thiago Rocha', at: '10/10/2026', time: '09:40', text: 'Subi na pasta da turma: https://drive.google.com/exemplo-sd', mine: false },
      { author: 'Beatriz Nunes', at: '12/10/2026', time: '19:22', text: 'Lista 3 vale ponto extra se entregar até sexta.', mine: false },
    ],
  };

  /* ----------------------------------------------------- gerador de grade */

  var generator = {
    minSubjects: 4,
    maxSubjects: 6,
    busyPresets: [
      { key: 'M', label: 'Manhã ocupada' },
      { key: 'T', label: 'Tarde ocupada' },
      { key: 'N', label: 'Noite ocupada' },
    ],
    priorityPresets: [
      { label: 'Poucas lacunas (recomendado)', keys: ['MIN_GAPS', 'MANDATORY_CLASSES', 'MOST_SUBJECTS_POSSIBLE'] },
      { label: 'Moro longe', keys: ['LIVES_FAR_AWAY', 'MIN_GAPS', 'MIN_DAY_WORKLOAD'] },
      { label: 'Acelerar curso', keys: ['CRITICAL_FIRST', 'MAX_CREDITS', 'MAX_WORKLOAD'] },
      { label: 'Carga leve no dia', keys: ['MIN_DAY_WORKLOAD', 'MIN_WORKLOAD', 'MIN_GAPS'] },
    ],
    /* Grupos: dentro de um grupo, só uma opção fica ligada (como no PriorityStep). */
    priorities: [
      [{ key: 'LIVES_FAR_AWAY', label: 'Evitar muito deslocamento, moro longe da UERJ' }],
      [{ key: 'MIN_GAPS', label: 'Evitar intervalos grandes entre matérias' }],
      [{ key: 'MANDATORY_CLASSES', label: 'Matérias obrigatórias' }],
      [{ key: 'MOST_SUBJECTS_POSSIBLE', label: 'Mais disciplinas possíveis' }],
      [{ key: 'CRITICAL_FIRST', label: 'Matérias críticas (que travam outras matérias)' }],
      [{ key: 'MAX_CREDITS', label: 'Máximo de créditos possíveis' }],
      [{ key: 'MIN_DAY_WORKLOAD', label: 'Pouca carga horária diária' }, { key: 'MAX_DAY_WORKLOAD', label: 'Muita carga horária diária' }],
      [{ key: 'MIN_WORKLOAD', label: 'Pouca carga horária semanal' }, { key: 'MAX_WORKLOAD', label: 'Muita carga horária semanal' }],
    ],
    defaultBusy: [
      /* Estágio fictício: terça e quinta à tarde. */
      { day: 2, slot: 'T3' }, { day: 2, slot: 'T4' }, { day: 2, slot: 'T5' }, { day: 2, slot: 'T6' },
      { day: 4, slot: 'T3' }, { day: 4, slot: 'T4' }, { day: 4, slot: 'T5' }, { day: 4, slot: 'T6' },
    ],
    /* Passo 5: resultado da busca de dados por disciplina. */
    fetchResults: [
      { id: 'IME02-10951', name: 'Projeto Final II', eligible: false, reason: 'requer Projeto Final I concluída' },
      { id: 'IME02-10880', name: 'Computação Gráfica', eligible: true },
      { id: 'IME02-11025', name: 'Processamento de Imagens', eligible: true },
      { id: 'IME02-11032', name: 'Computação em Nuvem', eligible: true },
      { id: 'IME02-11040', name: 'Desenvolvimento para Dispositivos Móveis', eligible: true },
      { id: 'IME03-10260', name: 'Inferência Estatística', eligible: true },
    ],
    /* Passo 6: turmas encontradas. */
    classes: [
      { subjectId: 'IME02-10880', subject: 'Computação Gráfica', classNumber: 1, teachers: ['Ana Beatriz Coelho'], meetings: 'Seg e Qua · M3–M4' },
      { subjectId: 'IME02-10880', subject: 'Computação Gráfica', classNumber: 2, teachers: ['Ana Beatriz Coelho'], meetings: 'Ter e Qui · N1–N2' },
      { subjectId: 'IME02-11025', subject: 'Processamento de Imagens', classNumber: 1, teachers: ['Fernando Lisboa Reis'], meetings: 'Seg e Qua · T1–T2' },
      { subjectId: 'IME02-11032', subject: 'Computação em Nuvem', classNumber: 1, teachers: ['Ricardo Moura Lemos'], meetings: 'Sex · M1–M4' },
      { subjectId: 'IME02-11040', subject: 'Desenvolvimento para Dispositivos Móveis', classNumber: 1, teachers: ['Juliana Prates', 'Otávio Saldanha'], meetings: 'Ter e Qui · M3–M4' },
      { subjectId: 'IME03-10260', subject: 'Inferência Estatística', classNumber: 1, teachers: ['Cláudia Ventura'], meetings: 'Seg e Qua · N1–N2' },
      { subjectId: 'IME03-10260', subject: 'Inferência Estatística', classNumber: 2, teachers: ['Marcos Teles'], meetings: 'Ter e Qui · T1–T2' },
    ],
    maxClasses: 30,
    /* Passo 7: grades geradas. */
    results: [
      {
        hash: 'g1', credits: 20, workload: 300,
        items: [
          { id: 'IME02-10880', name: 'Computação Gráfica', class: 1, teacher: 'Ana Beatriz Coelho', meetings: [{ day: 1, from: 'M3', to: 'M4' }, { day: 3, from: 'M3', to: 'M4' }] },
          { id: 'IME02-11025', name: 'Processamento de Imagens', class: 1, teacher: 'Fernando Lisboa Reis', meetings: [{ day: 1, from: 'T1', to: 'T2' }, { day: 3, from: 'T1', to: 'T2' }] },
          { id: 'IME02-11040', name: 'Desenvolvimento para Dispositivos Móveis', class: 1, teacher: 'Juliana Prates', meetings: [{ day: 2, from: 'M3', to: 'M4' }, { day: 4, from: 'M3', to: 'M4' }] },
          { id: 'IME02-11032', name: 'Computação em Nuvem', class: 1, teacher: 'Ricardo Moura Lemos', meetings: [{ day: 5, from: 'M1', to: 'M4' }] },
          { id: 'IME03-10260', name: 'Inferência Estatística', class: 2, teacher: 'Marcos Teles', meetings: [{ day: 2, from: 'T1', to: 'T2' }, { day: 4, from: 'T1', to: 'T2' }] },
        ],
      },
      {
        hash: 'g2', credits: 16, workload: 240,
        items: [
          { id: 'IME02-10880', name: 'Computação Gráfica', class: 2, teacher: 'Ana Beatriz Coelho', meetings: [{ day: 2, from: 'N1', to: 'N2' }, { day: 4, from: 'N1', to: 'N2' }] },
          { id: 'IME02-11025', name: 'Processamento de Imagens', class: 1, teacher: 'Fernando Lisboa Reis', meetings: [{ day: 1, from: 'T1', to: 'T2' }, { day: 3, from: 'T1', to: 'T2' }] },
          { id: 'IME02-11032', name: 'Computação em Nuvem', class: 1, teacher: 'Ricardo Moura Lemos', meetings: [{ day: 5, from: 'M1', to: 'M4' }] },
          { id: 'IME03-10260', name: 'Inferência Estatística', class: 1, teacher: 'Cláudia Ventura', meetings: [{ day: 1, from: 'N1', to: 'N2' }, { day: 3, from: 'N1', to: 'N2' }] },
        ],
      },
      {
        hash: 'g3', credits: 16, workload: 240,
        items: [
          { id: 'IME02-10880', name: 'Computação Gráfica', class: 1, teacher: 'Ana Beatriz Coelho', meetings: [{ day: 1, from: 'M3', to: 'M4' }, { day: 3, from: 'M3', to: 'M4' }] },
          { id: 'IME02-11040', name: 'Desenvolvimento para Dispositivos Móveis', class: 1, teacher: 'Juliana Prates', meetings: [{ day: 2, from: 'M3', to: 'M4' }, { day: 4, from: 'M3', to: 'M4' }] },
          { id: 'IME02-11032', name: 'Computação em Nuvem', class: 1, teacher: 'Ricardo Moura Lemos', meetings: [{ day: 5, from: 'M1', to: 'M4' }] },
          { id: 'IME03-10260', name: 'Inferência Estatística', class: 1, teacher: 'Cláudia Ventura', meetings: [{ day: 1, from: 'N1', to: 'N2' }, { day: 3, from: 'N1', to: 'N2' }] },
        ],
      },
    ],
  };

  /* --------------------------------------------------------- miscelânea */

  var appInfo = [
    { title: 'Gerador de Grade', description: 'Crie grades de horários personalizadas com base nas suas preferências e disponibilidade.' },
    { title: 'Meu Progresso', description: 'Acompanhe seu desempenho acadêmico com estatísticas detalhadas, evolução do CR e progresso no currículo.' },
    { title: 'Mural de mensagens', description: 'Canal de comunicação exclusivo entre alunos da mesma turma com total privacidade.' },
  ];

  var reportPages = [
    'Login e Sessão', 'Quadro de Horários', 'Gerador de Grade', 'Meu Progresso',
    'Mural de Mensagens', 'Quadro de Notas', 'RID Parcial', 'Disciplinas do Currículo',
    'Disciplinas Universais', 'Disciplinas Realizadas', 'Pesquisa de Disciplinas',
    'Informações de uma disciplina específica', 'Sobre',
  ];

  /** Textos reais do app para os estados de dados (QueryNotice, DummyMessage). */
  var copy = {
    loading: 'Aguarde um momento enquanto carregamos os dados...',
    offlineWithData: 'Sem conexão. Exibindo os últimos dados salvos. Última atualização: 13/10/2026, 07:41:12.',
    offlineNoData: 'Sem conexão. A consulta será retomada quando você se conectar.',
    refreshFailed: 'Não foi possível atualizar. O Aluno Online demorou para responder. Exibindo os últimos dados salvos. Última atualização: 13/10/2026, 07:41:12.',
    updating: 'Atualizando dados…',
    blocked: 'O Aluno Online está temporariamente bloqueado.',
    blockedFull: 'Parece que o Aluno Online está temporariamente bloqueado. Tente novamente mais tarde.',
    notStarted: 'Parece que o período não se iniciou ainda.',
    homeError: 'Ops, parece que houve um erro nos seguintes componentes: Grade de Horários, Quadro de notas. Toque aqui para tentar novamente.',
    tooManyErrors: {
      title: 'Caso o erro persista',
      steps: ['Verifique se o aplicativo está atualizado', 'Saia e entre novamente no aplicativo', 'Tente novamente mais tarde'],
      note: 'Às vezes a UERJ atualiza o sistema e isso pode causar problemas no aplicativo. Normalmente esses problemas são resolvidos em pouco tempo, mas caso continue vendo essa mensagem contate-nos pela página Sobre.',
    },
    loginEmpty: 'Preencha a matrícula e a senha.',
    loginWrong: 'Matrícula ou senha incorretas.',
    listError: 'Ops, ocorreu um erro ao buscar as disciplinas. Toque aqui para tentar novamente.',
    historyEmpty: 'Parece que não há disciplinas cursadas no período selecionado.',
    searchEmpty: 'Parece que você não pesquisou nenhuma disciplina ainda, use a caixa acima para realizar a suas buscas.',
    universalEmpty: 'Nenhuma disciplina encontrada com os filtros selecionados.',
    boardEmpty: 'Parece que você não está inscrito em nenhuma disciplina no momento.',
    boardHint: 'Compartilhe informações da turma, como grupos, links, materiais e datas de prova.',
    progressEmpty: 'Ainda não há histórico ou currículo disponível.',
    curriculumUnavailable: 'Currículo indisponível. Os totais e o progresso serão exibidos após o carregamento.',
    configureCredits: 'Configure os créditos necessários para ver o progresso',
    copied: 'Copiado com sucesso!',
    copiedDetail: 'O texto foi copiado para a área de transferência.',
    invalidCode: 'Parece que esse código não é válido :(',
    invalidCodeDetail: 'Certifique-se de que escreveu o código corretamente.',
    generatorEmpty: 'Não foi possível gerar nenhuma grade com os dados informados, clique aqui para gerar outra grade',
  };

  var links = {
    passwordRecovery: 'https://www.alunoonline.uerj.br/requisicaoaluno/',
    repo: 'https://github.com/pitroldev/ao-uerj-mobile-ts',
    issues: 'https://github.com/pitroldev/ao-uerj-mobile-ts/issues',
    linkedin: 'https://www.linkedin.com/in/petrocardoso/',
    email: 'mailto:contato@pitrol.dev?subject=AO UERJ',
    syllabus: function (code) { return 'https://www.ementario.uerj.br/ementa.php?cdg_disciplina=' + String(code).split('-').pop(); },
  };

  window.AO_DATA = {
    note: 'Dados fictícios para demonstração.',
    version: '1.3.5',
    developer: 'Petro Cardoso',
    student: student,
    now: now,
    SLOTS: SLOTS,
    WEEKDAYS: WEEKDAYS,
    SUBJECT_TYPE: SUBJECT_TYPE,
    SUBJECT_STATUS: SUBJECT_STATUS,
    SHIFT_LABEL: SHIFT_LABEL,
    slot: slot,
    shiftOf: shiftOf,
    health: health,
    enrolled: enrolled,
    schedule: schedule,
    nextClass: nextClass,
    grades: grades,
    rid: rid,
    curriculum: curriculum,
    universals: universals,
    departments: universals.map(function (u) { return u.dept; }).filter(function (d, i, a) { return a.indexOf(d) === i; }),
    history: history,
    periods: periods,
    periodList: periodList,
    craPoints: craPoints,
    currentCRA: cumulativeAverage(history),
    electiveConfig: electiveConfig,
    academicProgress: academicProgress,
    subjectDetails: subjectDetails,
    searchHistory: searchHistory,
    messages: messages,
    generator: generator,
    appInfo: appInfo,
    reportPages: reportPages,
    copy: copy,
    links: links,
  };
})();
