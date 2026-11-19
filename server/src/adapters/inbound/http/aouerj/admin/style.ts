import { trusted } from './html.ts';

/*
 * O visual da administração: escuro, como uma sala de controle. Vermelho só
 * no que os alunos estão vendo agora ("no ar"), verde só no item em prévia,
 * âmbar no que pede atenção; os gráficos usam só cinzas. O app aparece nas
 * cores dele só dentro do quadro "o que os alunos veem".
 */

/** As fontes Inter (OFL), servidas pela própria administração. */
export const fontFaces = (base: string) =>
  trusted(
    [
      ['400', 'inter-regular'],
      ['500', 'inter-medium'],
      ['600', 'inter-semibold'],
    ]
      .map(
        ([weight, file]) =>
          `@font-face{font-family:'Inter';font-style:normal;font-weight:${weight};font-display:swap;src:url(${base}/admin/fonts/${file}.woff2) format('woff2')}`,
      )
      .join(''),
  );

export const STYLE = trusted(`
:root{color-scheme:dark;
--bg:#0c0e11;--panel:#14171b;--panel-2:#1a1e23;--raise:#22272e;--line:#262b32;--line-2:#343a43;
--text:#e7e9ec;--text-2:#a3abb5;--text-3:#808994;
--onair:#f03a2e;--onair-text:#ff6a5e;--pvw:#35c27b;--pvw-soft:rgba(53,194,123,.1);--pvw-line:rgba(53,194,123,.55);
--ask:#f2b33d;--ask-soft:rgba(242,179,61,.14);--umd:#07080a;
--f:'Inter',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;--mono:'Cascadia Mono',Consolas,ui-monospace,monospace;
--ease:cubic-bezier(.16,1,.3,1)}
*,*::before,*::after{box-sizing:border-box}
html,body{height:100%}
body{margin:0;background:var(--bg);color:var(--text);font:400 13.5px/1.45 var(--f);font-feature-settings:'cv11','ss01';-webkit-font-smoothing:antialiased;caret-color:var(--pvw);overflow:hidden}
::selection{background:rgba(53,194,123,.32);color:#fff}
*{scrollbar-width:thin;scrollbar-color:#2e343c transparent}
button,input,select,textarea{font:inherit;color:inherit}
button{cursor:pointer}
a{color:inherit;text-underline-offset:3px;text-decoration-color:var(--line-2)}
a:hover{text-decoration-color:var(--text-2)}
:focus-visible{outline:2px solid var(--text);outline-offset:2px;border-radius:4px}
.ic{width:18px;height:18px;fill:currentColor;flex:none}
.ic.s{width:16px;height:16px}
.num,.tc,.age,.id{font-variant-numeric:tabular-nums}
kbd{font:500 11px/1 var(--f);font-variant-numeric:tabular-nums;color:var(--text-2);border:1px solid var(--line-2);border-bottom-width:2px;border-radius:4px;padding:2px 5px;background:var(--panel-2)}
.code{font:400 12px/1.4 var(--mono);color:var(--text-2);overflow-wrap:anywhere}
.quiet{color:var(--text-3)}
.ask-t{color:var(--ask)}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.lamp{width:8px;height:8px;border-radius:2px;background:#2b3138;flex:none;display:inline-block}
.lamp.on{background:var(--onair)}
.lamp.pvw{background:var(--pvw)}
.lamp.ask{background:var(--ask)}
html:not(.js) .no-js-hide{display:none}

/* moldura: a barra lateral */
.app{height:100vh;display:grid;grid-template-columns:240px minmax(0,1fr)}
.side{display:flex;flex-direction:column;gap:12px;min-height:0;overflow:auto;padding:14px 10px 12px;border-right:1px solid var(--line);background:var(--bg)}
.brand{display:flex;align-items:center;gap:10px;padding:2px 8px;text-decoration:none}
.logo{height:18px;width:auto;fill:currentColor;flex:none}
.brand-t{display:grid;gap:5px;justify-items:start}
.brand b{font-weight:600;font-size:14.5px;line-height:1;letter-spacing:-.01em}
.prod-pill{font:600 9.5px/1 var(--f);letter-spacing:.08em;text-transform:uppercase;color:var(--text-2);border:1px solid var(--line-2);border-radius:999px;padding:3px 6px}
.go{display:flex;align-items:center;gap:8px;width:100%;height:32px;padding:0 8px 0 10px;border:1px solid var(--line-2);border-radius:6px;background:var(--panel);color:var(--text-3);text-align:left}
.go:hover{border-color:#46505b;color:var(--text-2)}
.go span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nav{display:grid;gap:1px}
.nav h2{margin:16px 10px 6px;font:600 10.5px/1 var(--f);letter-spacing:.09em;text-transform:uppercase;color:var(--text-3)}
.nav a{display:flex;align-items:center;gap:10px;height:34px;padding:0 10px;border-radius:6px;color:var(--text-2);font-weight:500;text-decoration:none;white-space:nowrap}
.nav a .ic{color:var(--text-3)}
.nav a:hover{background:var(--panel);color:var(--text)}
.nav a[aria-current='page']{background:var(--panel-2);color:var(--text);box-shadow:inset 2px 0 0 var(--text)}
.nav a[aria-current='page'] .ic{color:var(--text)}
.nav .lbl{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis}
.nav .n{color:var(--ask);font-size:12px;font-weight:600;font-variant-numeric:tabular-nums;min-width:14px;text-align:right}
.side-foot{margin-top:auto;display:grid;gap:10px;padding:12px 4px 0;border-top:1px solid var(--line)}
.tc-row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding-left:6px}
.tc{font-weight:500;font-size:12.5px;color:var(--text-2);letter-spacing:.01em}
.tc b{color:var(--text);font-weight:600}
.icon-btn{display:inline-grid;place-items:center;width:32px;height:32px;border-radius:6px;border:1px solid transparent;background:none;color:var(--text-2);flex:none}
.icon-btn:hover{background:var(--panel-2);color:var(--text)}
.keys-hint{display:flex;flex-wrap:wrap;gap:4px 10px;padding:0 6px;color:var(--text-3);font-size:11.5px}
.keys-hint span{display:inline-flex;gap:4px;align-items:center}

/* a cabeça de cada área */
.main{display:grid;grid-template-rows:auto auto minmax(0,1fr);min-width:0;min-height:0}
.area-head{padding:16px 20px 0;border-bottom:1px solid var(--line)}
.area-head.solo{padding-bottom:16px}
.ah-top{display:flex;align-items:center;flex-wrap:wrap;gap:6px 14px;min-height:28px}
.ah-top>.ic{width:22px;height:22px;color:var(--text-2)}
.ah-top h1{margin:0;font-size:19px;line-height:1.2;font-weight:600;letter-spacing:-.015em}
.ah-sum{display:flex;flex-wrap:wrap;align-items:center;gap:4px 18px;color:var(--text-2);font-size:13px}
.ah-sum>span{display:inline-flex;align-items:center;gap:7px}
.ah-sum .live{color:var(--onair-text)}
.ah-sum .ask{color:var(--ask)}
.tabs{display:flex;gap:2px;margin:10px 0 0 -10px}
.tabs a{position:relative;display:inline-flex;align-items:center;height:40px;padding:0 10px;color:var(--text-2);font-weight:500;white-space:nowrap;text-decoration:none}
.tabs a:hover{color:var(--text)}
.tabs a[aria-current='page']{color:var(--text)}
.tabs a[aria-current='page']::after{content:'';position:absolute;left:10px;right:10px;bottom:-1px;height:2px;background:var(--text)}
.tabs .n{margin-left:7px;color:var(--text-3);font-size:12px;font-weight:600;font-variant-numeric:tabular-nums}
.tabs .n.ask{color:var(--ask)}
.stage{min-height:0;padding:12px;display:grid}
.banner{display:flex;align-items:center;gap:10px;padding:9px 14px;margin:12px 12px 0;border-radius:6px;background:var(--ask-soft);color:var(--ask);font-size:13px}
.banner b{color:var(--text);font-weight:600}
.banner .btn{margin-left:auto;height:28px}

/* painéis e listas */
.desk{display:grid;grid-template-columns:344px minmax(0,1fr);gap:8px;min-height:0}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:8px;display:grid;grid-template-rows:auto minmax(0,1fr) auto;min-height:0;overflow:hidden}
.bar{display:flex;align-items:center;gap:10px;min-height:42px;padding:0 12px;border-bottom:1px solid var(--line)}
.bar h2{margin:0;font-size:14px;font-weight:600;letter-spacing:-.005em}
.bar .count{color:var(--text-3);font-variant-numeric:tabular-nums;font-size:12.5px}
.rundown{overflow:auto;padding-bottom:10px}
.blk{display:flex;align-items:center;gap:8px;margin:14px 12px 4px;font-size:12px;font-weight:600;color:var(--text-2)}
.blk .rule{flex:1;height:1px;background:var(--line)}
.blk .n{color:var(--text-3);font-variant-numeric:tabular-nums;font-weight:500}
.rundown>.row:first-child{margin-top:4px}
.row{display:grid;grid-template-columns:10px minmax(0,1fr) auto;gap:10px;align-items:start;width:100%;padding:8px 12px;color:inherit;text-decoration:none;transition:background .12s}
.row>span{min-width:0}
.row .lamp{margin-top:6px}
.row:hover{background:var(--panel-2)}
.row[aria-current='true']{background:var(--pvw-soft);box-shadow:inset 0 1px 0 var(--pvw-line),inset 0 -1px 0 var(--pvw-line)}
.row-t{display:flex;gap:8px;align-items:baseline;min-width:0}
.row-t .t{font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.row-m{display:block;color:var(--text-2);font-size:12px;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.row-r{display:grid;justify-items:end;gap:3px}
.age{color:var(--text-3);font-size:12px;white-space:nowrap}
.times{font:600 11px/1 var(--f);font-variant-numeric:tabular-nums;color:var(--text);background:var(--raise);border-radius:4px;padding:3px 5px}
.foot-keys{display:flex;flex-wrap:wrap;gap:4px 12px;padding:9px 12px;border-top:1px solid var(--line);color:var(--text-3);font-size:11.5px}
.foot-keys span{display:inline-flex;gap:5px;align-items:center}
.empty{display:grid;justify-items:center;text-align:center;gap:8px;padding:56px 24px;color:var(--text-2)}
.empty .ic{width:28px;height:28px;color:var(--text-3)}
.empty b{color:var(--text);font-size:15px;font-weight:600}
.empty .btn{margin-top:4px}

/* a prévia */
.pv-bar .what{color:var(--text-2);font-size:12.5px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pv-bar .nav-s{margin-left:auto;display:flex;gap:4px;align-items:center;color:var(--text-3);font-size:12px;white-space:nowrap}
.pv-bar .back{margin-left:auto;height:28px}
.pv-body{overflow:auto}
.pv-in{padding:22px 26px 28px;max-width:1080px}
.pv-grid{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:28px;align-items:start}
h1.ttl{margin:0;font-size:22px;line-height:1.25;font-weight:600;letter-spacing:-.02em;text-wrap:balance;overflow-wrap:anywhere}
.sub{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;margin-top:8px;color:var(--text-2);font-size:13px}
.tag{display:inline-flex;align-items:center;gap:6px;min-height:24px;padding:0 8px;border-radius:6px;background:var(--raise);color:var(--text);font-size:12.5px;font-weight:500}
.lede{margin:14px 0 0;color:var(--text-2)}
.lede b{color:var(--text);font-weight:600}
h3.sec{margin:24px 0 12px;padding-top:18px;border-top:1px solid var(--line);font-size:13px;font-weight:600;color:var(--text);display:flex;align-items:center;gap:8px}
h3.sec .quiet{font-weight:400}
.vers{display:flex;height:26px;border-radius:6px;overflow:hidden;gap:2px}
.vers div{display:flex;align-items:center;padding:0 8px;font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;background:#2c333b}
.vers div:first-child{background:#4a5561}
.vers-note{margin:8px 0 0;color:var(--text-3);font-size:12px}
.reports{list-style:none;margin:0;padding:0;border-top:1px solid var(--line)}
.reports li{display:grid;grid-template-columns:96px minmax(0,1fr) auto;gap:12px;padding:10px 0;border-bottom:1px solid var(--line)}
.reports time{color:var(--text-3);font-size:12px;font-variant-numeric:tabular-nums;padding-top:1px}
.reports p{margin:0;text-wrap:pretty;max-width:68ch;overflow-wrap:anywhere}
.pre{white-space:pre-wrap}
.reports p.none{color:var(--text-3)}
.reports form{align-self:start}
.who{display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:5px;color:var(--text-2);font-size:12.5px}
.who a{display:inline-flex;align-items:center;gap:5px}
a.person{display:inline-flex;flex-wrap:wrap;align-items:center;gap:2px 6px;color:var(--text);text-decoration:underline;text-decoration-color:var(--line-2)}
a.person:hover{text-decoration-color:var(--text-2)}
a.person .mat{color:var(--text-3);text-decoration:none}
.page-view{border:1px solid var(--line);border-radius:6px;overflow:hidden}
.page-tabs{display:flex;align-items:center;gap:8px;padding:0 10px;height:34px;background:var(--umd);border-bottom:1px solid var(--line);font-size:12px;color:var(--text-2)}
.page-tabs .on{color:var(--text);font-weight:500}
.page-tabs .btn{margin-left:auto;height:24px;font-size:12px}
.page-view iframe{display:block;width:100%;height:240px;border:0;background:#f6f7f9}
.steps{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.steps span{display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 10px;border-radius:6px;background:var(--raise);font-size:12.5px}
.steps span.stop{background:var(--ask-soft);color:var(--ask);font-weight:500}
.steps .ic{width:14px;height:14px;color:var(--text-3)}
.facts{display:grid;grid-template-columns:max-content 1fr;gap:6px 18px;margin:12px 0 0;font-size:13px}
.facts dt{color:var(--text-3)}
.facts dd{margin:0;overflow-wrap:anywhere}
.tally{display:flex;border:1px solid var(--line);border-radius:6px;overflow:hidden}
.tally div{flex:1;min-width:0;padding:9px 10px;border-right:1px solid var(--line)}
.tally div:last-child{border-right:0;flex:1.4}
.tally b{display:block;font-size:18px;font-weight:600;letter-spacing:-.01em;font-variant-numeric:tabular-nums}
.tally span{color:var(--text-2);font-size:12px;white-space:nowrap}
.tally .flag b{color:var(--ask)}
.rule-line{display:flex;align-items:center;gap:10px;margin-top:12px;color:var(--text-2);font-size:12.5px}
.dots{display:inline-flex;gap:3px}
.dots i{width:14px;height:6px;border-radius:2px;background:#333a42}
.dots i.f{background:var(--ask)}
.person-card{border:1px solid var(--line);border-radius:8px;padding:12px 14px;display:grid;gap:6px}
.person-card+.person-card{margin-top:8px}
.pc-top{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.pc-top .role{color:var(--text-3);font-size:12px}
.hist{display:flex;flex-wrap:wrap;gap:6px}
.hist span{font-size:12px;color:var(--text-2);background:var(--panel-2);border:1px solid var(--line);border-radius:999px;padding:2px 8px}
.hist span.warn{color:var(--ask);border-color:rgba(242,179,61,.35)}
.nicks{display:flex;flex-wrap:wrap;gap:8px}
.nicks span{display:inline-flex;align-items:baseline;gap:6px;padding:6px 10px;border:1px solid var(--line);border-radius:8px;color:var(--text-3);font-size:12px}
.nicks b{color:var(--text);font-size:13px;font-weight:600}
.private{display:flex;align-items:center;gap:8px;margin:12px 0 0;color:var(--text-3);font-size:12.5px}
.calls{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.calls li{display:flex;flex-wrap:wrap;gap:4px 10px;align-items:baseline;font-size:13px}
.calls time{color:var(--text-3);font-size:12px;font-variant-numeric:tabular-nums}

/* o que os alunos veem, no visual do app */
.pgm{border:1px solid var(--line);border-radius:6px;overflow:hidden;background:var(--umd)}
.pgm.live{border-color:var(--onair);box-shadow:0 0 0 1px var(--onair)}
.pgm-screen{background:#eef1f5;padding:16px;min-height:150px;display:grid;align-content:center}
.pgm.off .pgm-screen>*{opacity:.35;filter:grayscale(1)}
.umd{display:flex;align-items:center;gap:7px;height:26px;padding:0 10px;background:var(--umd);border-top:1px solid var(--line);font:600 10.5px/1 var(--f);letter-spacing:.05em;text-transform:uppercase;color:var(--text-2);white-space:nowrap}
.umd.live{color:var(--onair-text)}
.umd .r{margin-left:auto;color:var(--text-3)}
.app-card{background:#fff;color:#1b2430;border-radius:16px 4px 16px 16px;padding:14px 16px;box-shadow:0 1px 2px rgba(16,24,40,.06),0 4px 12px rgba(16,24,40,.06);font:400 13px/1.4 var(--f)}
.app-card .ac-t{display:flex;align-items:center;gap:8px;font-weight:600;font-size:14px;color:#0b2a4f}
.app-card .ac-t .ic{color:#003468;width:20px;height:20px}
.app-card .ac-m{color:#586373;font-size:12px;margin-top:2px}
.app-card .ac-p{margin-top:8px;color:#2a3340}
.app-card .ac-b{display:flex;gap:6px;margin-top:10px}
.app-card .ac-b span{font-size:11.5px;font-weight:500;color:#003468;background:#e5edf7;border-radius:999px;padding:3px 9px}
.pgm-cap{margin:8px 2px 0;color:var(--text-3);font-size:12px}

/* a barra de ações e o corte */
.dock{display:flex;align-items:center;gap:8px;padding:12px 16px;border-top:1px solid var(--line);background:var(--panel)}
.dock form{display:contents}
.dock .gap{flex:1;min-width:40px}
.dock .hint{flex:0 1 auto;min-width:0;max-width:200px;color:var(--text-3);font-size:12px;line-height:1.35}
.btn{display:inline-flex;align-items:center;gap:7px;height:32px;padding:0 12px;border-radius:6px;border:1px solid var(--line-2);background:var(--panel-2);color:var(--text);font-size:13px;font-weight:500;white-space:nowrap;text-decoration:none}
.btn:hover{background:var(--raise);border-color:#46505b}
.btn:active{transform:translateY(1px)}
.btn:disabled{opacity:.45;cursor:not-allowed;transform:none}
.btn kbd{margin-left:2px}
.btn.key{background:var(--text);border-color:var(--text);color:var(--bg)}
.btn.key:hover{background:#fff}
.btn.key kbd{background:rgba(0,0,0,.08);border-color:rgba(0,0,0,.2);color:#2a2f36}
.btn.ghost{background:none;border-color:transparent;color:var(--text-2)}
.btn.ghost:hover{background:var(--panel-2);color:var(--text)}
.btn.small{height:28px;padding:0 10px;font-size:12px}
.take-wrap{display:flex;align-items:center;gap:14px;padding-left:20px;border-left:1px solid var(--line);flex:0 1 auto;min-width:0}
.take-why{flex:1 1 auto;min-width:0;max-width:250px;color:var(--text-2);font-size:12px;line-height:1.4;text-align:right}
.take-why b{color:var(--text);font-weight:600}
.take{--p:0;position:relative;overflow:hidden;display:inline-flex;align-items:center;gap:9px;flex:none;height:40px;padding:0 16px 0 13px;border-radius:6px;border:1px solid #5a636e;background:var(--panel-2);color:var(--text);font-weight:600;font-size:13px;user-select:none;touch-action:none;white-space:nowrap}
.take::before{content:'';position:absolute;inset:0;transform-origin:left;transform:scaleX(var(--p));background:rgba(231,233,236,.18)}
.take>*{position:relative}
.take:hover{border-color:var(--text-2)}
.take.final{border-color:#8a939e}
.take.holding{border-color:var(--text)}
.take:disabled{opacity:.45;cursor:not-allowed}
.take .lamp{width:10px;height:10px}
.dock.stack{display:grid;gap:10px;padding:14px 16px}
.ban-row{display:flex;align-items:center;gap:12px;min-width:0}
.ban-row>b{font-size:13px;font-weight:600;flex:none}
.ban-row .field{flex:1;min-width:0}
.ban-row .consequence{flex:1;min-width:0;margin:0}
.radio{display:flex;gap:6px;flex-wrap:wrap}
.radio label{position:relative}
.radio input{position:absolute;opacity:0;inset:0}
.radio span{display:inline-flex;align-items:center;height:30px;padding:0 12px;border-radius:6px;border:1px solid var(--line-2);color:var(--text-2);font-size:12.5px;font-weight:500;cursor:pointer}
.radio input:checked+span{background:var(--text);border-color:var(--text);color:var(--bg)}
.radio input:focus-visible+span{outline:2px solid var(--text);outline-offset:2px}
.similar{list-style:none;margin:0;padding:0;display:grid;gap:10px;max-width:62ch}
.similar li{display:grid;gap:2px;font-size:13px}
.similar a{color:var(--text);font-weight:500;text-decoration:none}
.similar a:hover{text-decoration:underline}
.reasons{display:flex;gap:6px;flex-wrap:wrap}
.reasons button{height:24px;padding:0 8px;border-radius:999px;border:1px solid var(--line);background:none;color:var(--text-2);font-size:12px}
.reasons button:hover{color:var(--text);border-color:var(--line-2)}
.consequence{color:var(--text-2);font-size:12.5px}
.consequence b{color:var(--text);font-weight:600}
.banned-note{display:flex;gap:10px;align-items:flex-start;margin-top:16px;padding:12px 14px;border-radius:8px;background:var(--ask-soft);color:var(--text)}
.banned-note .ic{color:var(--ask);margin-top:1px}
.banned-note p{margin:0}
.banned-note p+p{color:var(--text-2);font-size:12.5px;margin-top:2px}

/* o Início */
.home{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));column-gap:10px;row-gap:22px;align-content:start;overflow:auto;padding-bottom:4px}
.hgroup{display:grid;grid-template-columns:subgrid;grid-template-rows:auto 1fr;row-gap:8px}
.hgroup.g3{grid-column:span 3}
.hgroup.g2{grid-column:span 2}
.hgroup>h2{grid-column:1/-1;margin:0 2px;font:600 10.5px/1 var(--f);letter-spacing:.09em;text-transform:uppercase;color:var(--text-3)}
.acard{display:grid;grid-template-rows:auto minmax(0,1fr) auto;min-width:0;border:1px solid var(--line);border-radius:8px;background:var(--panel);overflow:hidden}
.acard-h{display:flex;align-items:center;gap:10px;height:46px;padding:0 12px 0 14px;border-bottom:1px solid var(--line);color:inherit;text-decoration:none}
.acard-h:hover{background:var(--panel-2)}
.acard-h>.ic{color:var(--text-2)}
.acard-h>.ic.s{color:var(--text-3)}
.acard-h b{flex:1;min-width:0;font-size:14px;font-weight:600}
.acard-h .n{color:var(--ask);font-size:12.5px;font-weight:500;font-variant-numeric:tabular-nums}
.acard-h .n.zero{color:var(--text-3)}
.acard-b{padding:4px 0;min-height:172px}
.acard .row{padding:8px 14px}
.acard .calm{display:flex;align-items:center;gap:8px;margin:0;padding:16px 14px;color:var(--text-3)}
.acard .more-line{display:block;padding:4px 14px 8px 34px;color:var(--text-3);font-size:12px;text-decoration:none}
.acard .more-line:hover{color:var(--text)}
.acard .facts{margin:10px 14px 12px}
.acard-f:empty{display:none}
.acard-f{display:flex;align-items:center;gap:8px;min-height:34px;padding:6px 14px;background:var(--umd);border-top:1px solid var(--line);color:var(--text-2);font-size:12px}
.acard-f .live{color:var(--onair-text)}

/* números e status */
.nums,.status{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px;min-height:0;overflow:auto;align-content:start;grid-auto-rows:max-content}
.status{grid-template-columns:minmax(0,1.4fr) minmax(0,1fr)}
.nums .panel,.status .panel{grid-template-rows:auto auto;align-self:start;overflow:visible;min-height:auto}
.wide{grid-column:1/-1}
.np-grid{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr)}
.np-grid>.np:first-child{border-right:1px solid var(--line)}
.np-col .np+.np{border-top:1px solid var(--line)}
.np{padding:16px 18px 18px}
.np h3{margin:0 0 2px;font-size:13px;font-weight:600}
.np .hint{margin:0 0 12px;color:var(--text-3);font-size:12px}
.legend{display:flex;flex-wrap:wrap;gap:6px 14px;color:var(--text-2);font-size:12px;margin-bottom:8px}
.legend i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:6px;vertical-align:-1px}
.legend i.dark{background:#4b545e}
.legend i.light{background:#c3cad2}
svg.chart{width:100%;height:auto;display:block;overflow:visible}
svg.chart text{font:500 10.5px var(--f);fill:var(--text-3);font-variant-numeric:tabular-nums}
svg.chart .grid{stroke:var(--line);stroke-width:1}
svg.chart .look{fill:#4b545e}
svg.chart .part{fill:#c3cad2}
svg.chart g.day:hover rect.look{fill:#66707b}
svg.chart g.day:hover rect.part{fill:#e1e5ea}
.funnel{display:grid;gap:8px}
.funnel div{display:grid;grid-template-columns:150px minmax(0,1fr) 90px;gap:12px;align-items:center;font-size:12.5px}
.funnel .l{color:var(--text-2)}
.funnel .v{text-align:right;font-variant-numeric:tabular-nums}
.funnel .v b{font-weight:600}
.funnel .v .quiet{margin-left:6px}
.track{height:12px;background:var(--panel-2);border-radius:3px;overflow:hidden;display:flex}
.track i{display:block;height:100%;background:#4b545e}
.track i.light{background:#c3cad2}
.track i.mid{background:#7d8894}
.hours{display:grid;grid-template-columns:repeat(var(--hours,9),1fr);gap:6px;align-items:end;height:86px}
.hours div{display:grid;grid-template-rows:1fr auto;height:100%;gap:4px}
.hours .bar-h{align-self:end;display:flex;flex-direction:column;justify-content:flex-end;border-radius:3px 3px 0 0;overflow:hidden;background:#4b545e;min-height:4px}
.hours .bar-h i{background:#c3cad2;display:block}
.hours span{text-align:center;font-size:10.5px;color:var(--text-3);font-variant-numeric:tabular-nums}
.kv{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border:1px solid var(--line);border-radius:6px;overflow:hidden}
.kv div{padding:10px 12px;border-right:1px solid var(--line)}
.kv div:last-child{border-right:0}
.kv b{display:block;font-size:18px;font-weight:600;font-variant-numeric:tabular-nums;letter-spacing:-.01em}
.kv span{color:var(--text-2);font-size:12px}
abbr[title]{text-decoration:underline dotted var(--text-3);text-underline-offset:3px;cursor:help}
.mult{display:grid;gap:9px}
.mult div{display:grid;grid-template-columns:150px minmax(0,1fr) 28px 56px;gap:12px;align-items:center;font-size:12.5px}
.mult .l{color:var(--text-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mult .t{text-align:right;font-variant-numeric:tabular-nums;font-weight:600}
.mult .h{color:var(--text-3);font-variant-numeric:tabular-nums}
.facts-line{display:flex;flex-wrap:wrap;gap:6px 22px;margin-top:14px;color:var(--text-2);font-size:12.5px}
.facts-line b{color:var(--text);font-weight:600;font-variant-numeric:tabular-nums}
.st-big{display:flex;align-items:baseline;gap:10px;margin-bottom:6px}
.st-big b{font-size:26px;line-height:1;font-weight:600;letter-spacing:-.02em}
.st-big b.ask{color:var(--ask)}
.st-big span{color:var(--text-2)}
.st-note{display:flex;align-items:center;gap:10px;margin-top:16px;padding:10px 12px;border-radius:6px;background:var(--ask-soft);color:var(--text);font-size:13px}
.st-note .ic{color:var(--ask)}
.st-note .btn{margin-left:auto;height:28px}

/* alunos */
.search-row{padding:10px 12px;border-bottom:1px solid var(--line)}
.search-row form{display:flex;gap:8px}
.field{width:100%;height:34px;padding:0 10px;border-radius:6px;border:1px solid var(--line-2);background:var(--bg);color:var(--text)}
.field:hover{border-color:#46505b}
.field:focus{outline:none;border-color:var(--text-2);box-shadow:0 0 0 3px rgba(231,233,236,.08)}
.field::placeholder{color:var(--text-3)}
.field[aria-invalid='true']{border-color:var(--ask)}
.field-help{margin:6px 0 0;font-size:12px;color:var(--text-3)}
.field-help.err{color:var(--ask)}
.ledger{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border:1px solid var(--line);border-radius:6px;overflow:hidden}
.ledger div{padding:10px 12px;border-right:1px solid var(--line);border-bottom:1px solid var(--line)}
.ledger div:nth-child(3n){border-right:0}
.ledger div:nth-last-child(-n+3){border-bottom:0}
.ledger b{display:block;font-size:17px;font-weight:600;font-variant-numeric:tabular-nums}
.ledger span{color:var(--text-2);font-size:12px}
.ledger .warn b{color:var(--ask)}
.events{list-style:none;margin:0;padding:0}
.events li{display:grid;grid-template-columns:124px minmax(0,1fr);gap:12px;padding:7px 0;border-bottom:1px solid var(--line);font-size:13px}
.events time{color:var(--text-3);font-variant-numeric:tabular-nums;font-size:12px;padding-top:1px}

/* "Ir para", o aviso passageiro e o diagnóstico */
dialog{color:var(--text)}
dialog::backdrop{background:rgba(5,6,8,.6)}
.palette{width:min(620px,92vw);margin:12vh auto 0;padding:0;border:1px solid var(--line-2);border-radius:10px;background:var(--panel);box-shadow:0 24px 60px rgba(0,0,0,.5)}
.palette .field{border:0;border-bottom:1px solid var(--line);border-radius:0;height:48px;font-size:15px;padding:0 16px;background:none;box-shadow:none}
.palette ul{list-style:none;margin:0;padding:6px;max-height:380px;overflow:auto}
.palette li.h{padding:10px 10px 4px;color:var(--text-3);font-size:11.5px;font-weight:600}
.palette li a{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:6px;text-decoration:none}
.palette li a[aria-selected='true']{background:var(--raise)}
.palette li a .m{margin-left:auto;color:var(--text-3);font-size:12px;white-space:nowrap}
.palette .pfoot{display:flex;flex-wrap:wrap;gap:6px 14px;padding:8px 14px;border-top:1px solid var(--line);color:var(--text-3);font-size:11.5px}
.snack{position:fixed;left:calc(50% + 120px);bottom:22px;transform:translateX(-50%);display:flex;align-items:center;gap:14px;padding:10px 10px 10px 16px;border-radius:8px;background:#f1f3f5;color:#14171b;font-weight:500;box-shadow:0 12px 32px rgba(0,0,0,.45);transition:transform .22s var(--ease),opacity .22s var(--ease);z-index:30}
.snack.gone{opacity:0;transform:translate(-50%,16px);pointer-events:none}
.snack.err{background:var(--ask);color:#14171b}
.snack form{display:contents}
.snack button{border:0;background:none;color:#0b3d75;font-weight:600;padding:6px 8px;border-radius:6px}
.snack button:hover{background:rgba(11,61,117,.08)}
.snack .s{color:#59626d;font-weight:400}
.doc{overflow:auto}
.doc-in{padding:22px 26px 40px;max-width:900px}
.sheet{margin-top:18px;display:grid;grid-template-columns:max-content minmax(0,1fr);gap:8px 24px}
.sheet dt{color:var(--text-3)}
.sheet dd{margin:0;overflow-wrap:anywhere}
.raw{margin:20px 0 0;padding:12px;background:var(--umd);border:1px solid var(--line);border-radius:6px;overflow:auto;font:400 12px/1.5 var(--mono);color:var(--text-2)}

/* entrar */
.login{min-height:100vh;display:grid;place-items:center;padding:24px}
.login form{width:min(340px,100%);display:grid;gap:14px}
.login .logo{height:26px;justify-self:start}
.login h1{margin:6px 0 0;font-size:20px;font-weight:600;letter-spacing:-.015em}
.login label{font-size:12.5px;color:var(--text-2);display:block;margin-bottom:6px}
.login .btn.key{height:36px;justify-content:center}
.pass{position:relative}
.pass .icon-btn{position:absolute;right:2px;top:1px}
.login-body{overflow:auto}

@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.001ms!important;transition-duration:.001ms!important}}
@media (max-width:1280px){.desk{grid-template-columns:320px minmax(0,1fr)}.pv-grid{grid-template-columns:minmax(0,1fr)}}
@media (max-width:900px){
body{overflow:auto}
.app{display:block;height:auto}
.side{flex-direction:row;flex-wrap:wrap;align-items:center;gap:10px;overflow:visible;padding:10px 12px 0;border-right:0;border-bottom:1px solid var(--line)}
.brand{padding:0}
.go{flex:1;width:auto;min-width:0}
.nav{display:flex;width:calc(100% + 24px);margin:0 -12px;padding:0 8px;overflow-x:auto;gap:0}
.nav h2{display:none}
.nav a{flex:none;height:40px;border-radius:0;padding:0 10px}
.nav a[aria-current='page']{background:none;box-shadow:inset 0 -2px 0 var(--text)}
.side-foot{display:none}
.main{display:block}
.area-head{padding:14px 12px 0}
.area-head.solo{padding-bottom:14px}
.tabs{overflow-x:auto}
.stage{display:block;padding:10px}
.home{grid-template-columns:minmax(0,1fr);overflow:visible}
.acard-b{min-height:0}
.hgroup.g3,.hgroup.g2{grid-column:auto}
.nums,.status{grid-template-columns:minmax(0,1fr);overflow:visible}
.desk{grid-template-columns:minmax(0,1fr)}
.rundown{max-height:46vh}
.pv-bar .what{display:none}
.reports li{grid-template-columns:minmax(0,1fr);gap:2px}
.events li{grid-template-columns:minmax(0,1fr);gap:0}
.pv-in{padding:18px 16px 24px}
.dock{flex-wrap:wrap}
.take-wrap{border-left:0;padding-left:0;width:100%;flex-direction:column;align-items:flex-end;gap:8px}
.take-why{max-width:none}
.ban-row{flex-wrap:wrap}
.np-grid{grid-template-columns:minmax(0,1fr)}
.np-grid>.np:first-child{border-right:0;border-bottom:1px solid var(--line)}
.kv,.ledger{grid-template-columns:repeat(2,minmax(0,1fr))}
.mult div{grid-template-columns:110px minmax(0,1fr) 24px 48px;gap:8px}
.foot-keys{display:none}
.snack{left:50%}
.sheet{grid-template-columns:minmax(0,1fr);gap:2px}
}
`);
