// EcoHealth — Criar 6 Telas MVP
// Plugin Figma — executa e fecha automaticamente
// Arquivo: figma-plugin/code.js

(async () => {
  // ── Carregar fontes ──────────────────────────────────────
  await Promise.all(
    ['Regular', 'Medium', 'Semi Bold', 'Bold'].map(style =>
      figma.loadFontAsync({ family: 'Inter', style })
    )
  );

  const page = figma.currentPage;

  // ── Palette EcoHealth ────────────────────────────────────
  const P = {
    blue:   '#2260FF', bl:   '#CAD6FF', bf:   '#EBF0FF',
    text:   '#1A1C1E', gray: '#6C7278', gl:   '#ACB5BB',
    bg:     '#EDF1F3', white:'#FFFFFF', dark: '#021433',
    green:  '#22C55E', red:  '#EF4444', amber:'#F59E0B',
  };

  // ── Helpers ──────────────────────────────────────────────
  const hexFill = (col, opacity = 1) => {
    const n = parseInt(col.replace('#', '').slice(0, 6), 16);
    return [{ type: 'SOLID', color: { r: (n >> 16 & 255) / 255, g: (n >> 8 & 255) / 255, b: (n & 255) / 255 }, opacity }];
  };

  const mkR = (w, h, col, r = 0) => {
    const n = figma.createRectangle();
    n.resize(w, h); n.fills = hexFill(col);
    if (r) n.cornerRadius = r;
    return n;
  };

  const mkEl = (w, h, col, op = 1) => {
    const n = figma.createEllipse();
    n.resize(w, h); n.fills = hexFill(col, op);
    return n;
  };

  const mkT = (txt, size, col, wt = 'Regular', maxW = null) => {
    const n = figma.createText();
    n.fontName = { family: 'Inter', style: wt };
    n.fontSize = size; n.fills = hexFill(col);
    if (maxW) { n.resize(maxW, size + 8); n.textAutoResize = 'HEIGHT'; }
    n.characters = txt;
    return n;
  };

  const mkF = (name, w, h, col = '#FFFFFF', r = 0) => {
    const f = figma.createFrame();
    f.name = name; f.resize(w, h); f.fills = hexFill(col);
    if (r) f.cornerRadius = r;
    return f;
  };

  const at = (parent, node, x, y) => {
    parent.appendChild(node); node.x = x; node.y = y;
    return node;
  };

  const statusBar = (F) => {
    const sb = mkF('StatusBar', 402, 47, '#FFFFFF');
    sb.fills = []; at(F, sb, 0, 0);
    at(sb, mkT('9:41', 16, P.dark, 'Semi Bold'), 24, 15);
    at(sb, mkR(24, 12, P.dark, 3), 358, 18);
  };

  // Posições: 3 colunas × 2 linhas após o conteúdo existente
  const PX = [3700, 4220, 4740];
  const PY = [0, 960];

  // ════════════════════════════════════════════════════════
  // T20 — DASHBOARD
  // ════════════════════════════════════════════════════════
  const dash = mkF('T20 — Dashboard (/dashboard)', 402, 874);
  dash.x = PX[0]; dash.y = PY[0]; page.appendChild(dash);
  statusBar(dash);

  at(dash, mkT('Boa tarde, Dr. João 👋', 12, P.gray), 24, 58);
  at(dash, mkT('Seus resultados de hoje', 22, P.text, 'Bold', 354), 24, 72);

  // Stats 2×2
  const statsData = [
    { v: '8',      l: 'Consultas hoje',  bg: P.blue, tc: P.white },
    { v: '47',     l: 'Total sprint',    bg: P.bg,   tc: P.text  },
    { v: '2h 20m', l: 'Tempo poupado',   bg: P.bg,   tc: P.text  },
    { v: '8',      l: 'SOAPs gerados',   bg: P.bf,   tc: P.text  },
  ];
  statsData.forEach((s, i) => {
    const c = mkF('Stat', 183, 80, s.bg, 16);
    at(dash, c, 24 + (i % 2) * 195, 120 + Math.floor(i / 2) * 90);
    at(c, mkT(s.v, 22, s.tc, 'Bold'), 14, 10);
    at(c, mkT(s.l, 10, s.tc === P.white ? P.bl : P.gray, 'Regular', 150), 14, 42);
  });

  // Gráfico de barras
  at(dash, mkT('Consultas — últimos 7 dias', 12, P.text, 'Semi Bold'), 24, 314);
  const chart = mkF('Chart', 354, 72, P.bg, 14);
  at(dash, chart, 24, 334);
  const dv = [4, 7, 5, 9, 6, 3, 1];
  const dl = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  dv.forEach((v, i) => {
    const bh = Math.round(v / 9 * 52);
    const bc = v === 9 ? P.blue : (i === 6 ? P.gl : P.bl);
    at(chart, mkR(28, bh, bc, 4), 14 + i * 48, 56 - bh);
    at(chart, mkT(dl[i], 8, P.gray), 14 + i * 48 + 4, 60);
  });

  // Lista de consultas recentes
  at(dash, mkT('Últimas consultas', 12, P.gray, 'Semi Bold'), 24, 420);
  at(dash, mkT('Ver todas →', 12, P.blue, 'Medium'), 318, 420);
  const rP = ['João da Silva', 'Maria Oliveira', 'Carlos Santos', 'Ana Fernandes', 'Pedro Lima'];
  const rQ = ['Cefaleia tensional', 'Diabetes Tipo 2', 'Revisão Geral', 'Asma Brônquica', 'Cefaleia'];
  const rS = ['#22C55E', '#22C55E', '#3B82F6', '#F59E0B', '#22C55E'];
  rP.forEach((p, i) => {
    const c = mkF('Card', 354, 56, P.bl, 14);
    at(dash, c, 24, 442 + i * 64);
    at(c, mkEl(34, 34, P.bf), 10, 11);
    at(c, mkT(p, 13, P.text, 'Medium'), 54, 8);
    at(c, mkT(rQ[i], 11, P.gray, 'Regular', 195), 54, 28);
    at(c, mkEl(8, 8, rS[i]), 322, 24);
  });

  // ════════════════════════════════════════════════════════
  // T19 — HISTÓRICO (timeline)
  // ════════════════════════════════════════════════════════
  const hist = mkF('T19 — Histórico (/historico)', 402, 874);
  hist.x = PX[1]; hist.y = PY[0]; page.appendChild(hist);
  statusBar(hist);

  at(hist, mkT('Histórico', 24, P.text, 'Bold'), 24, 55);
  at(hist, mkT('8 concluídas · 10 total', 12, P.gray), 24, 82);

  const srch = mkF('Search', 354, 46, P.bg, 10);
  at(hist, srch, 24, 102);
  at(srch, mkT('Buscar paciente ou queixa...', 13, P.gl), 36, 14);

  ['Todas', 'Concluídas', 'Pendentes', 'Erros'].forEach((f, i) => {
    const chip = mkF('F', f.length * 7 + 22, 27, i === 0 ? P.blue : P.bl, 14);
    at(hist, chip, 24 + i * 106, 157);
    at(chip, mkT(f, 12, i === 0 ? P.white : P.blue, 'Medium'), 11, 7);
  });

  ['G44.2', 'E11.9', 'M54.5', 'I10'].forEach((cid, i) => {
    const c = mkF('CID', 48, 22, P.bf, 11);
    at(hist, c, 24 + i * 56, 192);
    at(c, mkT(cid, 9, P.blue, 'Semi Bold'), 4, 5);
  });

  const tGroups = [
    {
      date: 'Hoje', items: [
        { n: 'João da Silva',   q: 'Cefaleia tensional', cid: 'G44.2', h: '09:00', sc: '#22C55E' },
        { n: 'Maria Oliveira',  q: 'Diabetes Tipo 2',    cid: 'E11.9', h: '10:30', sc: '#22C55E' },
        { n: 'Carlos Santos',   q: 'Revisão Geral',                    h: '11:45', sc: '#3B82F6' },
      ]
    },
    {
      date: 'Ontem', items: [
        { n: 'Ana Fernandes',   q: 'Asma Brônquica',    cid: 'J45.9', h: '14:00', sc: '#F59E0B' },
        { n: 'Pedro Rodrigues', q: 'Cefaleia',           cid: 'G44.2', h: '15:30', sc: '#22C55E' },
      ]
    },
  ];

  let gy = 224;
  tGroups.forEach(g => {
    at(hist, mkEl(10, 10, P.blue), 24, gy + 1);
    at(hist, mkT(g.date, 11, P.gray, 'Semi Bold'), 40, gy);
    at(hist, mkR(268, 1, P.bg), 92, gy + 5);
    gy += 22;
    at(hist, mkR(2, g.items.length * 64 + 4, P.bl), 28, gy);
    g.items.forEach(item => {
      at(hist, mkEl(10, 10, item.sc), 24, gy + 15);
      const card = mkF('Card', 340, 56, P.white, 14);
      card.strokes = [{ type: 'SOLID', color: { r: 0.93, g: 0.94, b: 0.95 } }];
      card.strokeWeight = 1;
      at(hist, card, 44, gy + 2);
      at(card, mkEl(32, 32, P.bf), 10, 12);
      at(card, mkT(item.n, 13, P.text, 'Semi Bold', 160), 52, 8);
      at(card, mkT(item.q, 11, P.gray, 'Regular', 160), 52, 28);
      at(card, mkT(item.h, 10, P.gl), 52, 42);
      if (item.cid) {
        const cb = mkF('cb', 46, 18, P.bf, 9);
        at(card, cb, 282, 8);
        at(cb, mkT(item.cid, 9, P.blue, 'Semi Bold'), 3, 3);
      }
      gy += 64;
    });
    gy += 12;
  });

  // ════════════════════════════════════════════════════════
  // T16 — SOAP EDITOR
  // ════════════════════════════════════════════════════════
  const soapF = mkF('T16 — SOAP Editor (/historico/[id])', 402, 874);
  soapF.x = PX[2]; soapF.y = PY[0]; page.appendChild(soapF);
  statusBar(soapF);

  at(soapF, mkR(20, 2, P.text, 1), 24, 66);
  at(soapF, mkT('João da Silva', 20, P.text, 'Bold'), 56, 55);
  at(soapF, mkT('04/06/2026 · 09:00 · 18 min', 12, P.gray), 56, 78);
  at(soapF, mkEl(8, 8, P.green), 338, 61);
  at(soapF, mkT('Salvo', 10, P.green, 'Medium'), 350, 59);

  const meta = mkF('Meta', 354, 72, P.bf, 16);
  meta.strokes = [{ type: 'SOLID', color: { r: 0.79, g: 0.84, b: 1 } }];
  meta.strokeWeight = 1;
  at(soapF, meta, 24, 100);
  at(meta, mkT('Queixa principal', 10, P.gray), 16, 10);
  at(meta, mkT('Cefaleia frontal há 3 dias', 13, P.text, 'Semi Bold', 180), 16, 26);
  at(meta, mkT('Confiança', 10, P.gray), 248, 10);
  at(meta, mkT('93%', 18, P.blue, 'Bold'), 256, 26);
  const cidB = mkF('CID', 50, 20, P.blue, 10);
  at(meta, cidB, 16, 48);
  at(cidB, mkT('G44.2', 10, P.white, 'Bold'), 8, 4);
  at(meta, mkT('gpt-4o', 10, P.gl), 310, 50);

  // Tabs S/O/A/P
  [['S', '97%', true], ['O', '94%', false], ['A', '89%', false], ['P', '91%', false]].forEach(([k, pct, active], i) => {
    const tab = mkF('Tab' + k, 84, 50, active ? P.blue : P.bg, 12);
    at(soapF, tab, 24 + i * 88, 186);
    at(tab, mkT(k, 14, active ? P.white : P.gray, 'Bold'), 34, 8);
    at(tab, mkT(pct, 9, active ? P.bl : P.gl, 'Medium'), 28, 28);
  });

  at(soapF, mkT('Subjetivo', 12, '#2563EB', 'Bold'), 24, 248);
  at(soapF, mkT('97% confiança', 10, P.green, 'Medium'), 282, 250);

  const editA = mkF('EditArea', 354, 170, '#EFF6FF', 16);
  editA.strokes = [{ type: 'SOLID', color: { r: 0.7, g: 0.8, b: 1 } }];
  editA.strokeWeight = 1;
  at(soapF, editA, 24, 268);
  at(editA, mkT('Paciente refere cefaleia frontal há 3 dias, EVA 7/10, pulsátil. Piora com luminosidade e barulho. Nega febre ou trauma craniano.', 12, P.text, 'Regular', 322), 16, 16);

  at(soapF, mkT('Toque para editar · Auto-save em 2s', 10, P.gl), 80, 448);

  const expB = mkF('Export', 354, 48, P.blue, 24);
  at(soapF, expB, 24, 468);
  at(expB, mkT('Exportar PDF', 14, P.white, 'Semi Bold'), 135, 15);

  const n1 = mkF('B1', 171, 40, P.bg, 16);
  at(soapF, n1, 24, 528);
  at(n1, mkT('Nova consulta', 13, P.text, 'Medium'), 32, 12);

  const n2 = mkF('B2', 171, 40, P.white, 16);
  n2.strokes = [{ type: 'SOLID', color: { r: 0.93, g: 0.94, b: 0.95 } }];
  n2.strokeWeight = 1;
  at(soapF, n2, 207, 528);
  at(n2, mkT('Assinar nota', 13, P.gray, 'Medium'), 37, 12);

  // ════════════════════════════════════════════════════════
  // T21 — CONFIGURAÇÕES
  // ════════════════════════════════════════════════════════
  const cfg = mkF('T21 — Configurações (/configuracoes)', 402, 874);
  cfg.x = PX[0]; cfg.y = PY[1]; page.appendChild(cfg);
  statusBar(cfg);

  at(cfg, mkT('Configurações', 24, P.text, 'Bold'), 24, 55);

  const plan = mkF('PlanCard', 354, 108, P.blue, 16);
  at(cfg, plan, 24, 88);
  at(plan, mkT('TRIAL', 10, P.white, 'Bold'), 16, 12);
  at(plan, mkT('12 dias restantes', 10, P.bl, 'Regular'), 56, 12);
  at(plan, mkT('Plano Gratuito', 16, P.white, 'Bold'), 16, 30);
  at(plan, mkT('Mocks ativos · 20 consultas/mês', 11, P.bl, 'Regular'), 16, 52);
  at(plan, mkR(322, 6, P.bl, 3), 16, 70);
  at(plan, mkR(Math.round(322 * 12 / 30), 6, P.white, 3), 16, 70);
  const upB = mkF('UpBtn', 322, 28, P.white, 8);
  at(plan, upB, 16, 80);
  at(upB, mkT('Fazer upgrade para Pro →', 13, P.blue, 'Bold'), 48, 6);

  const mkSec = (y, label) => {
    at(cfg, mkT(label, 10, P.gray, 'Semi Bold'), 24, y);
    return y + 22;
  };
  const mkRow = (y, label, sub, toggleOn) => {
    const ib = mkF('IB', 36, 36, P.bf, 10);
    at(cfg, ib, 24, y + 10);
    at(cfg, mkT(label, 13, P.text, 'Medium'), 72, y + 10);
    if (sub) at(cfg, mkT(sub, 11, P.gl, 'Regular', 232), 72, y + 28);
    if (toggleOn !== undefined) {
      const tr = mkF('Tr', 44, 24, toggleOn ? P.blue : P.gl, 12);
      at(cfg, tr, 342, y + 18);
      const th = mkF('Th', 20, 20, P.white, 10);
      at(tr, th, toggleOn ? 22 : 2, 2);
    } else {
      at(cfg, mkR(6, 10, P.gl, 2), 366, y + 26);
    }
    at(cfg, mkR(354, 1, P.bg), 24, y + 55);
    return y + 56;
  };

  let sy = 212;
  sy = mkSec(sy, 'CONTA');
  sy = mkRow(sy, 'Dados pessoais', 'Dr. Nome · CRM/SP-123456', undefined);
  sy = mkRow(sy, 'E-mail', 'medico@hospital.com', undefined);
  sy = mkRow(sy, 'Alterar senha', null, undefined);
  sy = mkSec(sy + 8, 'NOTIFICAÇÕES');
  sy = mkRow(sy, 'Nova consulta', 'Aviso quando transcrição concluir', true);
  sy = mkRow(sy, 'SOAP gerado', 'Aviso quando nota estiver pronta', true);
  sy = mkRow(sy, 'Resumo semanal por e-mail', null, false);
  sy = mkSec(sy + 8, 'SESSÃO');
  at(cfg, mkF('RedIB', 36, 36, '#FEF2F2', 10), 24, sy + 10);
  at(cfg, mkT('Sair da conta', 13, P.red, 'Medium'), 72, sy + 18);

  // ════════════════════════════════════════════════════════
  // T22 — PERFIL
  // ════════════════════════════════════════════════════════
  const prof = mkF('T22 — Perfil (/perfil)', 402, 874);
  prof.x = PX[1]; prof.y = PY[1]; page.appendChild(prof);
  statusBar(prof);

  const av = mkEl(80, 80, P.blue);
  at(prof, av, 24, 56);
  at(prof, mkT('JS', 24, P.white, 'Bold'), 51, 80);
  at(prof, mkEl(16, 16, P.green), 88, 119);

  at(prof, mkT('Dr. João da Silva', 20, P.text, 'Bold'), 116, 62);
  at(prof, mkT('CRM/SP-123456', 12, P.gray), 116, 86);

  const spB = mkF('Spec', 94, 22, P.bf, 11);
  at(prof, spB, 116, 104);
  at(spB, mkT('Clínica Geral', 10, P.blue, 'Medium'), 8, 5);

  const stB = mkF('State', 82, 22, P.bg, 11);
  at(prof, stB, 218, 104);
  at(stB, mkT('São Paulo · SP', 10, P.gray), 8, 5);

  const edB = mkF('Edit', 60, 32, P.bl, 10);
  at(prof, edB, 318, 76);
  at(edB, mkT('Editar', 12, P.blue, 'Medium'), 10, 9);

  const trialB = mkF('Trial', 354, 36, P.bf, 12);
  at(prof, trialB, 24, 148);
  at(trialB, mkT('Plano Trial · 12 dias restantes', 12, P.blue, 'Medium'), 32, 10);
  at(trialB, mkT('Upgrade', 11, P.blue, 'Semi Bold'), 302, 12);

  // Stats 2×2
  [
    { v: '127', l: 'Total consultas', bg: P.bf     },
    { v: '50h', l: 'Horas poupadas',  bg: '#F0FDF4'},
    { v: '119', l: 'SOAPs gerados',   bg: '#FAF5FF'},
    { v: '94%', l: 'Acurácia IA',     bg: '#FFFBEB'},
  ].forEach((s, i) => {
    const c = mkF('Stat', 167, 72, s.bg, 16);
    at(prof, c, 24 + (i % 2) * 189, 198 + Math.floor(i / 2) * 82);
    at(c, mkT(s.v, 22, P.text, 'Bold'), 14, 10);
    at(c, mkT(s.l, 11, P.gray, 'Regular', 140), 14, 42);
  });

  at(prof, mkT('DADOS PROFISSIONAIS', 10, P.gray, 'Semi Bold'), 24, 380);
  [['CRM', 'CRM/SP-123456'], ['Especialidade', 'Clínica Geral'], ['Estado', 'São Paulo — SP'], ['CFM', 'Ativo']].forEach(([l, v], i) => {
    at(prof, mkT(l, 11, P.gl), 24, 402 + i * 42);
    at(prof, mkT(v, 13, P.text, 'Medium'), 200, 402 + i * 42);
    at(prof, mkR(354, 1, P.bg), 24, 423 + i * 42);
  });

  at(prof, mkT('CIDS MAIS FREQUENTES', 10, P.gray, 'Semi Bold'), 24, 576);
  [['G44.2', 'Cefaleia tensional', 8], ['I10', 'HAS', 5], ['E11.9', 'Diabetes T2', 4]].forEach(([cid, desc, n], i) => {
    const row = mkF('CRow', 354, 36, P.bg, 12);
    at(prof, row, 24, 598 + i * 44);
    at(row, mkT(String(i + 1), 11, P.gl), 12, 12);
    const cb = mkF('cb', 46, 20, P.bf, 10);
    at(row, cb, 28, 8);
    at(cb, mkT(cid, 9, P.blue, 'Bold'), 3, 5);
    at(row, mkT(desc, 12, P.text), 84, 12);
    at(row, mkT(n + '×', 12, P.gray, 'Semi Bold'), 322, 12);
  });

  const cfgLnk = mkF('CfgLnk', 354, 44, P.white, 16);
  cfgLnk.strokes = [{ type: 'SOLID', color: { r: 0.93, g: 0.94, b: 0.95 } }];
  cfgLnk.strokeWeight = 1;
  at(prof, cfgLnk, 24, 732);
  at(cfgLnk, mkT('Configurações avançadas', 13, P.gray, 'Medium'), 88, 14);

  // ════════════════════════════════════════════════════════
  // T15 — GRAVAÇÃO
  // ════════════════════════════════════════════════════════
  const recF = mkF('T15 — Gravação (/gravacao)', 402, 874);
  recF.x = PX[2]; recF.y = PY[1]; page.appendChild(recF);
  statusBar(recF);

  at(recF, mkT('Gravação', 20, P.text, 'Bold'), 24, 55);
  at(recF, mkT('Grave a consulta para transcrever', 12, P.gray), 24, 78);

  const clB = mkF('CloseBtn', 32, 32, P.bg, 8);
  at(recF, clB, 346, 52);

  // Ripple rings
  const rp3 = mkEl(164, 164, P.blue, 0.08);
  rp3.strokes = [{ type: 'SOLID', color: { r: 0.79, g: 0.84, b: 1 } }];
  rp3.strokeWeight = 1;
  at(recF, rp3, 119, 120);

  const rp2 = mkEl(130, 130, P.blue, 0.14);
  rp2.strokes = [{ type: 'SOLID', color: { r: 0.79, g: 0.84, b: 1 } }];
  rp2.strokeWeight = 1.5;
  at(recF, rp2, 136, 137);

  const rp1 = mkEl(98, 98, P.blue, 0.22);
  rp1.strokes = [{ type: 'SOLID', color: { r: 0.133, g: 0.376, b: 1 }, opacity: 0.5 }];
  rp1.strokeWeight = 2;
  at(recF, rp1, 152, 153);

  // Botão REC (vermelho = gravando)
  const micE = mkEl(162, 162, P.red);
  at(recF, micE, 120, 121);
  at(recF, mkR(44, 44, P.white, 10), 180, 183);

  // Timer
  at(recF, mkT('00:47', 22, P.red, 'Bold'), 166, 300);
  at(recF, mkEl(8, 8, P.red), 164, 330);
  at(recF, mkT('Gravando...', 12, P.red, 'Medium'), 178, 327);

  // Waveform
  const wH = [10, 16, 32, 50, 42, 26, 58, 70, 46, 30, 62, 76, 54, 38, 64, 74, 50, 34, 60, 70, 44, 28, 52, 66, 40, 26, 50, 36, 20, 13];
  wH.forEach((h, i) => {
    at(recF, mkR(7, h, P.blue, 3), 24 + i * 12, 357 + (64 - h));
  });

  // Card de transcrição ao vivo
  const txC = mkF('Tx', 354, 88, P.bg, 16);
  at(recF, txC, 24, 432);
  at(txC, mkT('Transcrição ao vivo', 11, P.gl, 'Medium'), 16, 10);
  at(txC, mkT('Paciente relata dor de cabeça há 3 dias, de forte intensidade, localizada na região frontal...', 12, P.gray, 'Regular', 322), 16, 28);

  // Botões de ação
  const stpB = mkF('StopBtn', 354, 48, P.red, 24);
  at(recF, stpB, 24, 534);
  at(stpB, mkT('Finalizar Gravação', 14, P.white, 'Semi Bold'), 117, 15);

  const soapBt = mkF('SOAPBtn', 354, 48, P.blue, 24);
  at(recF, soapBt, 24, 594);
  at(soapBt, mkT('Gerar Nota SOAP com IA', 14, P.white, 'Semi Bold'), 104, 15);

  const nwB = mkF('NewBtn', 354, 40, P.white, 20);
  nwB.strokes = [{ type: 'SOLID', color: { r: 0.93, g: 0.94, b: 0.95 } }];
  nwB.strokeWeight = 1;
  at(recF, nwB, 24, 652);
  at(nwB, mkT('Nova consulta', 13, P.gray, 'Medium'), 130, 11);

  // ── Zoom para as novas telas ─────────────────────────────
  figma.viewport.scrollAndZoomIntoView([dash, hist, soapF, cfg, prof, recF]);
  figma.notify('✅ 6 telas EcoHealth criadas com sucesso!', { timeout: 5000 });
  figma.closePlugin();
})();
