/* Geometric room and route model. Inputs are measured source data, in metres.
 * Used only while generating the offline atlas; no UI or network dependencies. */
const rooms = require('./data/salas-pavilhao.json');
const SAL = {
  regra: rooms.regra,
  salas: Object.fromEntries(
    Object.entries(rooms.salas).map(([block, floors]) => [
      block,
      Object.fromEntries(
        Object.entries(floors)
          .filter(([, values]) => values.length)
          .map(([floor, values]) => [
            floor,
            values.map(v => [v[0], v[1], v[3]]),
          ]),
      ),
    ]),
  ),
  oficial: rooms.oficial_D9,
};

var Sala = (function () {
  'use strict';
  var RG = SAL.regra,
    P = RG.passo,
    BR = RG.braco,
    FB = RG.F,
    CB = RG.C;
  var r2 = function (v) {
    return Math.round(v * 100) / 100;
  };
  function rect(x0, y0, x1, y1) {
    return [
      r2(Math.min(x0, x1)),
      r2(Math.min(y0, y1)),
      r2(Math.max(x0, x1)),
      r2(Math.max(y0, y1)),
    ];
  }
  function andarN(a) {
    return a === 'T' || a === 'SE' ? a : parseInt(a, 10);
  }

  /* ------------------------------------------------------------------ braços */
  function bModY(L, k) {
    var y0 = RG.bracos[L].y0 + P * (k - 1);
    return [y0, y0 + P];
  }
  function bFaixaX(L, lado) {
    var ax = RG.bracos[L].eixo_x;
    return lado === 'NO'
      ? [ax + BR.parede_sala, ax + BR.fundo_sala]
      : [ax - BR.fundo_sala, ax - BR.parede_sala];
  }
  function bParedeX(L, lado) {
    var ax = RG.bracos[L].eixo_x;
    return lado === 'NO'
      ? [ax + BR.corr_livre, ax + BR.parede_sala]
      : [ax - BR.parede_sala, ax - BR.corr_livre];
  }
  function bLado(i) {
    return i % 2 ? 'NO' : 'SE';
  }
  function bPonta(L) {
    return RG.bracos[L].y0 + BR.comprimento - 0.2;
  }
  function bEstado(L, k, lado) {
    var B = RG.bracos[L];
    if (k === 5 && B.passarela.indexOf(lado) >= 0) return 'passarela';
    if (k === 6 || k === 7) return lado === B.escada ? 'escada' : 'sanitarios';
    return null;
  }
  function bVao(k) {
    return BR.vao_do_modulo[k];
  }
  function bVaoMods(v) {
    return BR.modulos_do_vao[v];
  }
  function excecao(L, a) {
    return BR.andares_excecao.some(function (e) {
      return e[0] === L && e[1] === a;
    });
  }
  function bIndice(k, lado) {
    return lado === 'NO' ? 2 * k - 1 : 2 * k;
  }

  /* ------------------------------------------------------------------ F */
  function fModX(g) {
    var x0 = FB.x0 + P * (g - 1);
    return [x0, x0 + P];
  }
  function fFachada(g) {
    for (var i = 0; i < FB.fachada.length; i++) {
      var f = FB.fachada[i];
      if (g >= f[0] && g <= f[1]) return f[2];
    }
    return null;
  }
  function fFaixaY(lado, g) {
    if (lado === 'NE') return FB.y.sala_NE;
    var t = fFachada(g);
    return [
      t === 'saliencia'
        ? FB.y.fachada_SO_saliencia
        : t === 'recesso'
          ? FB.y.fachada_SO_recesso
          : FB.y.fachada_SO_central,
      FB.y.sala_SO_fim,
    ];
  }
  function fLado(i) {
    return i % 2 ? 'SO' : 'NE';
  }
  /* módulo geométrico g e as alternativas que os dados ainda não excluem (contraprova) */
  function fGeo(i) {
    var m = Math.ceil(i / 2),
      g = i <= FB.limiar_salto || i > FB.limiar_retorno ? m : m - 1,
      cand;
    if (i <= FB.fim_exato) cand = [g];
    else if (i <= 104) cand = [m - 1, m];
    else cand = [m - 1, m, m + 1];
    return {
      m: m,
      g: g,
      alts: cand
        .filter(function (h) {
          return h !== g && h >= 1 && h <= FB.nmod;
        })
        .sort(function (a, b) {
          return a - b;
        }),
    };
  }
  function fVao(g) {
    if (FB.escadas[g]) return [g, g];
    for (var i = 0; i < FB.vaos.length; i++) {
      var a = FB.vaos[i][0],
        b = FB.vaos[i][1];
      if (g >= a && g <= b) {
        var p = a + 2 * Math.floor((g - a) / 2);
        return [p, p + 1];
      }
    }
    return [g, g];
  }
  /* o que ocupa o módulo g do F, do lado dado, no andar a (null = sala possível) */
  function fEstado(g, lado, a) {
    var x = fModX(g),
      k;
    if (lado === 'SO' && FB.escadas[g]) return 'escada';
    if (lado === 'NE' && a !== 'SE') {
      for (k in FB.rampas)
        if (FB.rampas[k][0] <= x[0] && x[1] <= FB.rampas[k][1])
          return 'rampa ' + k;
      if (FB.ligacao_c[0] <= x[0] && x[1] <= FB.ligacao_c[1]) return 'ligacao';
    }
    if (
      a !== 'SE' &&
      FB.sanitarios.some(function (s) {
        return s[0] === lado && s[1] === g;
      })
    )
      return 'sanitarios';
    if (lado === 'SO' && typeof a === 'number' && a >= 1 && a <= 12) {
      for (k in FB.auditorios)
        if (g >= FB.auditorios[k][0] && g <= FB.auditorios[k][1])
          return 'auditorio ' + k;
    }
    /* térreo: o hall da entrada principal no recuo central (com a escada do hall, que desce ao semienterrado);
       semienterrado: a escada do hall */
    if (
      lado === 'SO' &&
      a === 'T' &&
      x[0] >= FB.entrada[0] - 0.2 &&
      x[1] <= FB.entrada[2] + 0.2
    )
      return 'entrada';
    if (
      lado === 'SO' &&
      a === 'SE' &&
      x[0] < FB.escada_hall[2] &&
      x[1] > FB.escada_hall[0]
    )
      return 'escada do hall';
    return null;
  }
  /* índices que a regra põe no módulo g, do lado dado (o inverso de fGeo) */
  function fIndices(g, lado) {
    var out = [];
    for (var i = lado === 'SO' ? 1 : 2; i <= 152; i += 2)
      if (fGeo(i).g === g) out.push(i);
    return out;
  }

  /* ------------------------------------------------------------------ salas conhecidas */
  function conhecidas(L, a) {
    var b = SAL.salas[L],
      lst = b ? b[String(a)] : null;
    return lst || [];
  }
  function inexistente(L, a, i) {
    return RG.inexistentes.some(function (e) {
      return e[0] === L && e[1] === a && e[2] === i;
    });
  }
  /* extensão da sala cuja porta está no módulo k: até o vão (6 m), sem passar de outra porta conhecida nem de estrutura */
  function extBraco(L, lado, k, outros) {
    function livre(j) {
      return j >= 1 && j <= 17 && !bEstado(L, j, lado);
    }
    var lo = k,
      hi = k;
    while (livre(lo - 1) && outros.indexOf(lo - 1) < 0) lo--;
    while (livre(hi + 1) && outros.indexOf(hi + 1) < 0) hi++;
    var v = bVao(k),
      vm = bVaoMods(v),
      pa = Math.max(vm[0], lo),
      pb = Math.min(vm[1], hi);
    if (v === 'passarela') {
      pa = k;
      pb = k;
    }
    return { max: [lo, hi], prov: [pa, pb] };
  }
  function extF(a, lado, g, outros) {
    function livre(j) {
      return j >= 1 && j <= FB.nmod && !fEstado(j, lado, a);
    }
    var lo = g,
      hi = g;
    while (livre(lo - 1) && outros.indexOf(lo - 1) < 0 && g - (lo - 1) < 6)
      lo--;
    while (livre(hi + 1) && outros.indexOf(hi + 1) < 0 && hi + 1 - g < 6) hi++;
    var v = fVao(g);
    return { max: [lo, hi], prov: [Math.max(v[0], lo), Math.min(v[1], hi)] };
  }
  /* polígono da faixa de salas do F, do módulo ga ao gb (o fundo do lado SO acompanha os degraus da fachada) */
  function fFaixaPoly(lado, ga, gb) {
    if (lado === 'NE') {
      var y = FB.y.sala_NE;
      return [
        [fModX(ga)[0], y[0]],
        [fModX(gb)[1], y[0]],
        [fModX(gb)[1], y[1]],
        [fModX(ga)[0], y[1]],
      ];
    }
    var pts = [];
    for (var g = ga; g <= gb; g++) {
      var x = fModX(g),
        y0 = fFaixaY('SO', g)[0];
      var p0 = [r2(x[0]), y0],
        p1 = [r2(x[1]), y0],
        last = pts[pts.length - 1];
      if (!last || last[0] !== p0[0] || last[1] !== p0[1]) pts.push(p0);
      pts.push(p1);
    }
    var simp = pts.filter(function (p, i) {
      var q = pts[i - 1],
        s = pts[i + 1];
      return !(q && s && q[1] === p[1] && s[1] === p[1]);
    });
    return simp.concat([
      [r2(fModX(gb)[1]), FB.y.sala_SO_fim],
      [r2(fModX(ga)[0]), FB.y.sala_SO_fim],
    ]);
  }
  function polyR(r) {
    return [
      [r[0], r[1]],
      [r[2], r[1]],
      [r[2], r[3]],
      [r[0], r[3]],
    ];
  }
  function bbox(p) {
    var x0 = Infinity,
      y0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity;
    p.forEach(function (q) {
      x0 = Math.min(x0, q[0]);
      y0 = Math.min(y0, q[1]);
      x1 = Math.max(x1, q[0]);
      y1 = Math.max(y1, q[1]);
    });
    return [x0, y0, x1, y1];
  }

  /* ------------------------------------------------------------------ planta do andar
   * Cada lado do corredor vira uma lista de salas (as conhecidas, com a extensão provável; as outras, um vão por
   * sala, com o número que a regra dá ao 1º módulo livre) e de estruturas. Com `extra` (o índice procurado), a
   * sala procurada entra no andar mesmo sem registro nos guias. */
  var cache = {};
  function andar(L, a, extra) {
    a = andarN(a);
    var key = L + '|' + a + '|' + (extra || '');
    if (cache[key]) return cache[key];
    var out =
      L === 'F'
        ? andarF(a, extra)
        : L === 'C'
          ? andarC(a, extra)
          : andarBraco(L, a, extra);
    cache[key] = out;
    return out;
  }

  function andarBraco(L, a, extra) {
    var B = RG.bracos[L],
      ax = B.eixo_x,
      yP = bPonta(L),
      res = {
        L: L,
        a: a,
        tipo: 'braco',
        salas: [],
        estr: [],
        fora: [],
        notas: [],
      };
    if (a === 'T' || a === 'SE') {
      res.tipo = 'pilotis';
      return res;
    }
    var exc = excecao(L, a);
    var lista = conhecidas(L, a).map(function (s) {
      return { i: s[0], n: s[1], ano: s[2] };
    });
    if (
      extra &&
      !lista.some(function (s) {
        return s.i === extra;
      })
    )
      lista.push({ i: extra, n: 0, consultada: true });
    var oficial = L === 'D' && a === 9 ? SAL.oficial : null,
      yOf = oficial ? 70.03 : Infinity;
    var conh = { NO: [], SE: [] };
    lista.forEach(function (s) {
      if (s.i >= 1 && s.i <= 34 && !inexistente(L, a, s.i))
        conh[bLado(s.i)].push(Math.ceil(s.i / 2));
    });
    ['NO', 'SE'].forEach(function (lado) {
      var fx = bFaixaX(L, lado),
        usado = {};
      for (let module = 1; module <= 17; module++) {
        if (bEstado(L, module, lado)) usado[module] = true;
      }
      /* estruturas do lado (passarela, núcleo) */
      if (B.passarela.indexOf(lado) >= 0)
        res.estr.push({
          t: 'passarela',
          lado: lado,
          r: rect(fx[0], bModY(L, 5)[0], fx[1], bModY(L, 5)[1]),
        });
      lista.forEach(function (s) {
        if (s.i < 1 || s.i > 34 || bLado(s.i) !== lado) {
          if ((s.i < 1 || s.i > 34) && bLado(s.i) === lado)
            res.fora.push({ i: s.i, motivo: 'fora_da_malha' });
          return;
        }
        if (inexistente(L, a, s.i)) {
          res.fora.push({ i: s.i, motivo: 'inexistente' });
          return;
        }
        var k = Math.ceil(s.i / 2),
          est = bEstado(L, k, lado);
        if (est) {
          res.fora.push({
            i: s.i,
            motivo: exc ? 'excecao_de_andar' : 'modulo_ocupado',
            por: est,
          });
          return;
        }
        var y0 = bModY(L, k)[0];
        if (oficial && y0 >= yOf - 0.01)
          return; /* trecho da planta oficial: as salas vêm dela */
        var e = extBraco(
          L,
          lado,
          k,
          conh[lado].filter(function (m) {
            return m !== k;
          }),
        );
        var pa = e.prov[0],
          pb = e.prov[1];
        if (oficial) {
          while (pb > pa && bModY(L, pb)[0] >= yOf - 0.01) pb--;
        }
        for (var j = pa; j <= pb; j++) usado[j] = true;
        res.salas.push({
          lado: lado,
          ma: pa,
          mb: pb,
          k: k,
          i: s.i,
          conhecida: !s.consultada,
          n: s.n,
          ano: s.ano,
          r: rect(fx[0], bModY(L, pa)[0], fx[1], Math.min(bModY(L, pb)[1], yP)),
          porta: rect(
            bParedeX(L, lado)[0],
            bModY(L, k)[0],
            bParedeX(L, lado)[1],
            bModY(L, k)[1],
          ),
          portaOficial: false,
        });
      });
      if (oficial) {
        oficial.salas.forEach(function (o) {
          if (o.lado !== lado) return;
          var i = o.indice_pela_regra,
            k = Math.ceil(i / 2),
            po = oficial.portas.filter(function (p) {
              return p.lado === lado && p.modulo === k;
            })[0];
          var known = lista.some(function (s) {
            return s.i === i && !s.consultada;
          });
          for (var j = 1; j <= 17; j++) {
            var my = bModY(L, j);
            if (my[0] >= o.r[1] - 0.3 && my[1] <= o.r[3] + 0.3) usado[j] = true;
          }
          /* rótulo fora dos detalhes da planta oficial: no vestíbulo da 9024 e na área plana do auditório 9032 */
          var lab =
            i === 24
              ? [(o.r[0] + o.r[2]) / 2, 76.9]
              : i === 32
                ? [(o.r[0] + o.r[2]) / 2, 90.05]
                : null;
          res.salas.push({
            lado: lado,
            ma: Math.ceil(i / 2),
            mb: Math.ceil(i / 2),
            k: k,
            i: i,
            conhecida: known || !!o.numero,
            oficial: true,
            semNumero: !o.numero,
            r: o.r.slice(),
            area: o.area_m2,
            uso: o.uso,
            porta: po ? po.r.slice() : null,
            portaOficial: !!po,
            lab: lab,
          });
        });
        for (var j2 = 1; j2 <= 17; j2++)
          if (bModY(L, j2)[0] >= yOf - 0.01) usado[j2] = true;
      }
      /* módulos livres: um vão por sala, com o número do 1º módulo livre (sala sem registro nos guias) */
      var k2 = 1;
      while (k2 <= 17) {
        if (usado[k2]) {
          k2++;
          continue;
        }
        var v = bVao(k2),
          vm = bVaoMods(v),
          ka = k2,
          kb = k2;
        while (kb + 1 <= vm[1] && !usado[kb + 1]) kb++;
        res.salas.push({
          lado: lado,
          ma: ka,
          mb: kb,
          k: ka,
          i: bIndice(ka, lado),
          conhecida: false,
          inferida: true,
          r: rect(fx[0], bModY(L, ka)[0], fx[1], Math.min(bModY(L, kb)[1], yP)),
          porta: rect(
            bParedeX(L, lado)[0],
            bModY(L, ka)[0],
            bParedeX(L, lado)[1],
            bModY(L, ka)[1],
          ),
          portaOficial: false,
        });
        k2 = kb + 1;
      }
    });
    /* núcleo (vão 3): escada de um lado, sanitários do outro; o resto do lado da escada, uso desconhecido */
    var ys = bModY(L, 6)[0],
      ye = bModY(L, 7)[1],
      y0n = B.y0;
    var se = B.escada,
      sx =
        se === 'NO'
          ? [ax + BR.parede_sala, ax + 4.5]
          : [ax - 4.5, ax - BR.parede_sala];
    res.estr.push({
      t: 'escada',
      lado: se,
      r: rect(sx[0], y0n + BR.nucleo_y[0], sx[1], y0n + BR.nucleo_y[1]),
    });
    var rx =
      se === 'NO'
        ? [ax + 4.5, ax + BR.fundo_sala]
        : [ax - BR.fundo_sala, ax - 4.5];
    res.estr.push({ t: 'nucleo', lado: se, r: rect(rx[0], ys, rx[1], ye) });
    var fxe = bFaixaX(L, se);
    res.estr.push({
      t: 'nucleo',
      lado: se,
      r: rect(fxe[0], ys, fxe[1], y0n + BR.nucleo_y[0]),
    });
    res.estr.push({
      t: 'nucleo',
      lado: se,
      r: rect(sx[0], y0n + BR.nucleo_y[1], sx[1], ye),
    });
    var sa = B.sanitarios,
      fxs = bFaixaX(L, sa);
    res.estr.push({
      t: 'sanitarios',
      lado: sa,
      r: rect(fxs[0], ys, fxs[1], ye),
    });
    /* nicho ELÉTRICA/QLF na parede SE do corredor, módulo 11 (alto no 9º do D; provável nos outros) */
    var pse = bParedeX(L, 'SE');
    if (!(L === 'D' && a === 9))
      res.estr.push({
        t: 'nicho',
        lado: 'SE',
        r: rect(pse[0], y0n + 30.07, pse[1], y0n + 31.33),
      });
    res.estr.push({
      t: 'sacada',
      r: rect(ax - 1, y0n + BR.sacada_dy[0], ax + 1, y0n + BR.sacada_dy[1]),
    });
    if (exc)
      res.notas.push(
        'andar do IMS: no trecho da passarela e do núcleo a numeração é própria (' +
          res.fora
            .filter(function (f) {
              return f.motivo === 'excecao_de_andar';
            })
            .map(function (f) {
              return a + String(f.i).padStart(3, '0');
            })
            .join(', ') +
          ' ' +
          L +
          ') e essas salas não aparecem no desenho',
      );
    res.salas.sort(function (p, q) {
      return p.lado < q.lado ? -1 : p.lado > q.lado ? 1 : p.r[1] - q.r[1];
    });
    return res;
  }

  function andarF(a, extra) {
    var res = {
      L: 'F',
      a: a,
      tipo: 'F',
      salas: [],
      estr: [],
      fora: [],
      notas: [],
    };
    var lista = conhecidas('F', a).map(function (s) {
      return { i: s[0], n: s[1], ano: s[2] };
    });
    if (
      extra &&
      !lista.some(function (s) {
        return s.i === extra;
      })
    )
      lista.push({ i: extra, n: 0, consultada: true });
    var conh = { SO: [], NE: [] };
    lista.forEach(function (s) {
      if (s.i >= 1 && s.i <= 152) conh[fLado(s.i)].push(fGeo(s.i).g);
    });
    ['SO', 'NE'].forEach(function (lado) {
      var usado = {},
        porMod = {},
        py = lado === 'SO' ? FB.y.parede_SO : FB.y.parede_NE;
      for (let module = 1; module <= FB.nmod; module++)
        if (fEstado(module, lado, a)) usado[module] = true;
      /* estruturas: uma por trecho contínuo do mesmo tipo */
      var g0 = 1;
      while (g0 <= FB.nmod) {
        var structure = fEstado(g0, lado, a);
        if (!structure) {
          g0++;
          continue;
        }
        var g1 = g0;
        while (g1 + 1 <= FB.nmod && fEstado(g1 + 1, lado, a) === structure)
          g1++;
        res.estr.push({
          t: structure,
          lado: lado,
          ma: g0,
          mb: g1,
          p: fFaixaPoly(lado, g0, g1),
          r: bbox(fFaixaPoly(lado, g0, g1)),
        });
        g0 = g1 + 1;
      }
      lista.forEach(function (s) {
        if (fLado(s.i) !== lado) return;
        if (s.i < 1 || s.i > 152) {
          res.fora.push({ i: s.i, motivo: 'fora_da_malha' });
          return;
        }
        var g = fGeo(s.i).g,
          est = fEstado(g, lado, a);
        if (est) {
          res.fora.push({ i: s.i, motivo: 'modulo_ocupado', por: est });
          return;
        }
        (porMod[g] = porMod[g] || []).push(s);
      });
      Object.keys(porMod).forEach(function (gs) {
        var g = +gs,
          ss = porMod[g].sort(function (p, q) {
            return (p.consultada ? 1 : 0) - (q.consultada ? 1 : 0) || p.i - q.i;
          });
        var s = ss[0],
          e = extF(
            a,
            lado,
            g,
            conh[lado].filter(function (m) {
              return m !== g;
            }),
          );
        for (var j = e.prov[0]; j <= e.prov[1]; j++) usado[j] = true;
        var p = fFaixaPoly(lado, e.prov[0], e.prov[1]),
          x = fModX(g);
        res.salas.push({
          lado: lado,
          ma: e.prov[0],
          mb: e.prov[1],
          k: g,
          i: s.i,
          outros: ss.slice(1).map(function (q) {
            return q.i;
          }),
          conhecida: !s.consultada,
          n: s.n,
          ano: s.ano,
          p: p,
          r: bbox(p),
          porta: rect(x[0], py[0], x[1], py[1]),
          portaOficial: false,
        });
      });
      var k2 = 1;
      while (k2 <= FB.nmod) {
        if (usado[k2]) {
          k2++;
          continue;
        }
        var v = fVao(k2),
          kb = k2;
        while (kb + 1 <= v[1] && !usado[kb + 1]) kb++;
        var idx = fIndices(k2, lado),
          p2 = fFaixaPoly(lado, k2, kb),
          x2 = fModX(k2);
        res.salas.push({
          lado: lado,
          ma: k2,
          mb: kb,
          k: k2,
          i: idx.length ? idx[0] : null,
          conhecida: false,
          inferida: true,
          p: p2,
          r: bbox(p2),
          porta: rect(x2[0], py[0], x2[1], py[1]),
          portaOficial: false,
        });
        k2 = kb + 1;
      }
    });
    res.salas.sort(function (p, q) {
      return p.lado < q.lado ? -1 : p.lado > q.lado ? 1 : p.r[0] - q.r[0];
    });
    return res;
  }

  function andarC(a, extra) {
    var res = {
      L: 'C',
      a: a,
      tipo: 'C',
      salas: [],
      estr: [],
      fora: [],
      notas: [],
    };
    var lista = conhecidas('C', a).map(function (s) {
      return s[0];
    });
    if (a !== 'T') {
      var bib = lista.filter(function (i) {
        return CB.zonas_x002_x014.indexOf(i) >= 0;
      })[0];
      if (!bib && extra && CB.zonas_x002_x014.indexOf(extra) >= 0) bib = extra;
      res.salas.push({
        lado: 'fundo',
        i: bib || null,
        conhecida: !!bib && lista.indexOf(bib) >= 0,
        zona: true,
        biblioteca: true,
        r: rect(CB.fundo[0], CB.fundo[1], CB.fundo[2], CB.fundo[3]),
        porta: null,
      });
      res.salas.push({
        lado: 'SE',
        i: null,
        conhecida: false,
        inferida: true,
        semNumero: true,
        r: rect(CB.face_x[0], CB.face_y[0], CB.grupo_SE[0], CB.passarela_y[0]),
      });
      res.salas.push({
        lado: 'NO',
        i: null,
        conhecida: false,
        inferida: true,
        semNumero: true,
        r: rect(CB.grupo_NO[1], CB.face_y[0], CB.face_x[1], CB.passarela_y[0]),
      });
    }
    return res;
  }

  // Only numbered rooms are materialized in the atlas. Occupied modules remain
  // unresolved; the application routes to the block instead of inventing a door.
  function pos(destination) {
    const block = destination.block,
      floor = andarN(destination.floor);
    const index = parseInt(
      String(destination.room).replace(/\D/g, '').slice(-3),
      10,
    );
    if (block === 'C') {
      const room = andar('C', floor, index).salas.find(item => item.biblioteca);
      if (!room || ![2, 14].includes(index) || floor === 'T') return null;
      return {
        i: index,
        sala: room,
        poly: polyR(room.r),
        doorPt: [CB.eixo_x, room.r[1]],
        corrPt: [CB.eixo_x, (CB.passarela_y[0] + CB.passarela_y[1]) / 2],
      };
    }
    let module, side, alternatives;
    if (block === 'F') {
      if (!(index >= 1 && index <= 152)) return null;
      const position = fGeo(index);
      module = position.g;
      side = fLado(index);
      alternatives = position.alts;
      if (fEstado(module, side, floor)) return null;
    } else {
      if (floor === 'T' || floor === 'SE' || !(index >= 1 && index <= 34))
        return null;
      module = Math.ceil(index / 2);
      side = bLado(index);
      if (inexistente(block, floor, index) || bEstado(block, module, side))
        return null;
    }
    const room = andar(block, floor, index).salas.find(
      item => item.i === index || item.outros?.includes(index),
    );
    if (!room) return null;
    const door = room.porta;
    const along =
      block === 'F' ? (door[0] + door[2]) / 2 : (door[1] + door[3]) / 2;
    return {
      i: index,
      k: module,
      lado: side,
      alts: alternatives,
      sala: room,
      poly: room.p || polyR(room.r),
      doorPt:
        block === 'F'
          ? [along, side === 'SO' ? door[3] : door[1]]
          : [side === 'NO' ? door[0] : door[2], along],
      corrPt:
        block === 'F'
          ? [along, (FB.y.corredor[0] + FB.y.corredor[1]) / 2]
          : [RG.bracos[block].eixo_x, along],
    };
  }

  return { pos, andar, bModY, fFaixaY };
})();

var FP = {
  hall: [114.43, 48.72],
  lobbySE: [102.43, 48.72],
  lobbyNO: [126.43, 48.72],
  turnSE: 110.9,
  turnNO: 117.95,
  pasY: 56.35,
  linkX: 114.31,
  corrF: 18.35,
  ent: [114.24, 6.05],
  stairHall: [110.81, 12.55],
};
function floorNum(f) {
  return f === 'T' || f === 'SE' ? f : parseInt(f, 10);
}

/* caminho no andar, em metros: das cabines do hall do C, pela passarela ou pela ligação F–C, até a porta (ou até a
   chegada ao bloco, quando a sala não tem posição) */
function floorRoute(d, p) {
  var L = d.block,
    a = floorNum(d.floor);
  if (!L || !p) return null;
  var door = p.doorPt,
    corr = p.corrPt;
  if (L === 'F' && (a === 'T' || a === 'SE')) {
    var q =
      a === 'SE'
        ? [FP.stairHall.slice(), [FP.stairHall[0], FP.corrF]]
        : [[FP.ent[0], -3.2], FP.ent.slice(), [FP.ent[0], FP.corrF]];
    if (door) q.push([corr[0], FP.corrF], door.slice());
    return { from: a === 'SE' ? 'escada' : 'ent', pts: q, start: q[0][0] };
  }
  if (a === 'T' || a === 'SE') return null;
  if (L === 'F') {
    var r = [FP.hall.slice(), [FP.linkX, FP.hall[1]], [FP.linkX, FP.corrF]];
    if (door) r.push([corr[0], FP.corrF], door.slice());
    return { from: 'elev', pts: r, start: FP.linkX };
  }
  if (L === 'C')
    return door
      ? { from: 'elev', pts: [FP.hall.slice(), [FP.hall[0], door[1]]] }
      : null;
  var B = SAL.regra.bracos[L],
    se = B.eixo_x < FP.hall[0],
    lob = se ? FP.lobbySE : FP.lobbyNO,
    tx = se ? FP.turnSE : FP.turnNO;
  var pts = [lob.slice(), [tx, lob[1]], [tx, FP.pasY], [B.eixo_x, FP.pasY]];
  if (door) pts.push([B.eixo_x, corr[1]], door.slice());
  return { from: 'elev', pts: pts, junction: 3 };
}
function routeLen(pts, i0, i1) {
  var s = 0;
  for (var i = (i0 || 0) + 1; i <= (i1 == null ? pts.length - 1 : i1); i++)
    s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return s;
}

function marcoF(e, todos) {
  var t = e.t,
    L;
  if (t === 'escada' || t.startsWith('rampa')) {
    L = t.startsWith('rampa') ? t.split(' ')[1] : SAL.regra.F.escadas[e.ma];
    var par = todos.some(function (q) {
      return (
        q !== e &&
        q.ma === e.ma &&
        (q.t === 'escada' || q.t.startsWith('rampa'))
      );
    });
    return par
      ? 'a escada e a rampa do Bloco ' + L
      : t === 'escada'
        ? 'a escada do eixo do Bloco ' + L
        : 'a rampa do Bloco ' + L;
  }
  if (t.startsWith('auditorio')) return 'o auditório';
  if (t === 'sanitarios') return 'os sanitários';
  return null;
}
/* fatos do trajeto no andar: para que lado virar, de que lado do corredor fica a sala, quantas salas contar */
function walkInfo(d, p) {
  var L = d.block,
    a = floorNum(d.floor),
    w = { L: L, a: a };
  if (!L || !p) return w;
  var rt = floorRoute(d, p);
  w.rt = rt;
  if ('ABDE'.indexOf(L) >= 0) {
    var B = SAL.regra.bracos[L];
    w.se = B.eixo_x < FP.hall[0];
    w.far = L === 'A' || L === 'E';
    if (rt) w.pas = routeLen(rt.pts, 2, 3);
    if (!p.sala || !p.corrPt) return w;
    var fl = Sala.andar(L, a, p.i),
      s = p.sala,
      ym = Sala.bModY(L, 5);
    w.along = p.corrPt[1] - FP.pasY;
    w.dist = Math.abs(w.along);
    w.atJunction = p.k === 5;
    w.tip = p.k > 5;
    w.turn = w.tip === w.se ? 'esquerda' : 'direita';
    w.side =
      (p.lado === 'NO') === (w.tip || w.atJunction) ? 'esquerda' : 'direita';
    var same = fl.salas.filter(function (q) {
      return q.lado === p.lado && q !== s;
    });
    var bt = w.tip
      ? same.filter(function (q) {
          return q.r[1] >= ym[1] - 0.05 && q.r[3] <= s.r[1] + 0.05;
        })
      : same.filter(function (q) {
          return q.r[3] <= ym[0] + 0.05 && q.r[1] >= s.r[3] - 0.05;
        });
    w.ord = bt.length + 1;
    w.inferidas = bt.some(function (q) {
      return q.inferida;
    });
    w.nucleo = w.tip && p.k >= 8;
    w.mark = w.nucleo ? 'a escada e os sanitários' : null;
    if (w.nucleo)
      w.ord =
        bt.filter(function (q) {
          return q.r[1] >= Sala.bModY(L, 7)[1] - 0.05;
        }).length + 1;
    return w;
  }
  if (L === 'F') {
    if (!p.corrPt) return w;
    var x0 = a === 'T' ? FP.ent[0] : a === 'SE' ? FP.stairHall[0] : FP.linkX,
      xc = p.corrPt[0],
      fl2 = Sala.andar('F', a, p.i),
      s2 = p.sala;
    w.toNO = xc > x0;
    w.dist = Math.abs(xc - x0);
    w.turn =
      a === 'SE' ? null : (a === 'T') === w.toNO ? 'esquerda' : 'direita';
    w.side = (p.lado === 'SO') === w.toNO ? 'esquerda' : 'direita';
    var lo = Math.min(x0, xc),
      hi = Math.max(x0, xc),
      sc = (s2.r[0] + s2.r[2]) / 2;
    var cands = fl2.estr.filter(function (e) {
      var c = (e.r[0] + e.r[2]) / 2;
      return (
        c > lo + 1.5 &&
        c < hi - 0.5 &&
        marcoF(e, fl2.estr) &&
        (s2.r[0] > e.r[2] - 0.05 || s2.r[2] < e.r[0] + 0.05)
      );
    });
    cands.sort(function (e1, e2) {
      return (
        Math.abs((e1.r[0] + e1.r[2]) / 2 - sc) -
        Math.abs((e2.r[0] + e2.r[2]) / 2 - sc)
      );
    });
    var mk = cands[0],
      ref = mk ? (mk.r[0] + mk.r[2]) / 2 : x0;
    if (mk) {
      w.mark = marcoF(mk, fl2.estr);
      w.markX = ref;
    }
    var between = fl2.salas.filter(function (q) {
      var c = (q.r[0] + q.r[2]) / 2;
      return (
        q.lado === p.lado &&
        q !== s2 &&
        c > Math.min(ref, sc) &&
        c < Math.max(ref, sc)
      );
    });
    w.ord = between.length + 1;
    w.inferidas = between.some(function (q) {
      return q.inferida;
    });
    w.passa = cands
      .slice(1)
      .map(function (e) {
        return marcoF(e, fl2.estr);
      })
      .filter(function (t, i, arr) {
        return arr.indexOf(t) === i && t !== w.mark;
      })
      .slice(0, 2);
    return w;
  }
  return w;
}

// Structural axes and pillar extents from the measured room model.
function pillarBounds(block) {
  const { braco: arm, bracos: arms, F: front } = SAL.regra;
  const out = [];
  if (block !== 'F') {
    const { eixo_x: axis, y0 } = arms[block];
    for (const offset of arm.offsets_eixos) {
      const y = y0 + offset;
      for (const side of [-1, 1]) {
        for (const [a, b] of [
          arm.pilares.fachada_dx,
          arm.pilares.corredor_dx,
        ]) {
          const x1 = axis + side * a,
            x2 = axis + side * b;
          out.push([Math.min(x1, x2), y - 0.2, Math.max(x1, x2), y + 0.2]);
        }
      }
    }
    return out;
  }
  const axes = [0];
  for (let module = 1; module <= front.nmod;) {
    module += front.escadas[module] ? 1 : 2;
    axes.push(3 * (module - 1));
  }
  for (const offset of axes) {
    if (offset > 228.01) continue;
    const x = front.x0 + offset;
    const left = Math.max(1, Math.round(offset / 3));
    const right = Math.min(front.nmod, Math.round(offset / 3) + 1);
    for (const [y0, y1] of [
      [16.35, 16.95],
      [19.75, 20.35],
      [27.95, 28.6],
    ]) {
      out.push([x - 0.2, y0, x + 0.2, y1]);
    }
    for (const y of new Set([
      Sala.fFaixaY('SO', left)[0],
      Sala.fFaixaY('SO', right)[0],
    ])) {
      out.push([x - 0.2, y - 0.6, x + 0.2, y]);
    }
  }
  return out;
}
module.exports = { Sala, floorRoute, walkInfo, pillarBounds };
