/* Eixo — um único lugar para o dia inteiro. Sem servidor: os dados ficam neste aparelho. */
(() => {
'use strict';

const KEY = 'eixo.v1';
const AREAS = [
  { id: 'pessoal',  name: 'Pessoal',  emoji: '🧘', color: '#7c6cf0' },
  { id: 'trabalho', name: 'Trabalho', emoji: '💼', color: '#2f7ed8' },
  { id: 'estudos',  name: 'Estudos',  emoji: '📚', color: '#d98a1f' },
  { id: 'familia',  name: 'Família',  emoji: '🏡', color: '#d6557a' },
  { id: 'lazer',    name: 'Lazer',    emoji: '🎈', color: '#2aa775' },
  { id: 'saude',    name: 'Saúde',    emoji: '💪', color: '#e0603c' },
  { id: 'financas', name: 'Finanças', emoji: '💰', color: '#5b8a3a' },
];
const AREA_WORDS = {
  trabalho: 'reuniao cliente relatorio projeto email chefe call apresentacao proposta trabalho entrega sprint',
  estudos: 'estudar estudo aula prova curso ler leitura ingles faculdade revisar livro exercicios',
  familia: 'filho filha filhos esposa marido mae pai familia crianca criancas escola sogra irmao irma',
  lazer: 'filme cinema jogo jogar passeio praia churrasco viagem serie amigos bar show pedalar',
  saude: 'academia treino correr corrida medico dentista consulta remedio caminhada exame agua alongar',
  financas: 'pagar boleto fatura banco imposto investir conta aluguel',
};
const CATS_OUT = ['Mercado', 'Casa', 'Contas', 'Transporte', 'Alimentação', 'Saúde', 'Lazer', 'Educação', 'Outros'];
const CATS_IN = ['Salário', 'Extra'];
const CAT_WORDS = {
  Mercado: 'mercado supermercado feira acougue padaria',
  Casa: 'aluguel condominio casa reforma movel',
  Contas: 'luz agua internet celular telefone energia fatura boleto',
  Transporte: 'gasolina combustivel uber onibus estacionamento carro oficina pedagio',
  'Alimentação': 'almoco jantar lanche restaurante ifood pizza cafe',
  'Saúde': 'farmacia remedio medico dentista academia exame',
  Lazer: 'cinema bar show viagem jogo passeio presente',
  'Educação': 'curso livro faculdade escola mensalidade',
  'Salário': 'salario pagamento',
};
const MOODS = ['😞', '😕', '😐', '🙂', '😄'];
const WD_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const WD_LONG = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MONTHS_LONG = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/* ---------- utilidades ---------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const pd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const today = () => ymd(new Date());
const addDays = (s, n) => { const d = pd(s); d.setDate(d.getDate() + n); return ymd(d); };
const diffDays = (a, b) => Math.round((pd(a) - pd(b)) / 864e5);
const mondayOf = s => { const d = pd(s); return addDays(s, -((d.getDay() + 6) % 7)); };
const mins = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const hhmm = m => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const durLabel = m => m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? pad(m % 60) : ''}` : `${m}min`;
const brl = n => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const deacc = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const area = id => AREAS.find(a => a.id === id) || AREAS[0];
const dayLabel = s => { const d = pd(s); return `${WD_SHORT[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`; };
const relLabel = s => { const n = diffDays(s, today()); return n === 0 ? 'Hoje' : n === 1 ? 'Amanhã' : n === -1 ? 'Ontem' : dayLabel(s); };
const parseMoney = s => {
  s = String(s).replace(/[^\d.,]/g, '');
  if (/,/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else if (!/^\d+\.\d{1,2}$/.test(s)) s = s.replace(/\./g, '');
  return Math.round(parseFloat(s) * 100) / 100 || 0;
};
const monthDay = (ym, day) => { const [y, m] = ym.split('-').map(Number); return `${ym}-${pad(Math.min(day, new Date(y, m, 0).getDate()))}`; };

/* ---------- estado ---------- */
const blank = () => ({
  v: 1,
  settings: { name: '', wake: '06:30', sleep: '22:30', budget: 0, onboarded: false, lastOpen: null },
  items: [], focus: {}, days: {}, tx: [], bills: [], goals: [],
});
let S = load();
const ui = { view: 'hoje', date: today(), week: mondayOf(today()), month: today().slice(0, 7) };

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw && Array.isArray(raw.items)) return Object.assign(blank(), raw, { settings: Object.assign(blank().settings, raw.settings) });
  } catch (e) { /* começa do zero */ }
  return blank();
}
function saveLocal() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch (e) { toast('Não consegui salvar neste aparelho. Faça um backup em Ajustes.'); }
}
function save(force) {
  saveLocal();
  if ((sync.on || sync.rev) && (S.settings.onboarded || force)) { sync.dirty = true; sync.seq++; saveMeta(); clearTimeout(sync.timer); sync.timer = setTimeout(push, 600); }
}

/* ---------- sincronização com o servidor (quando o app é servido pelo server.py) ---------- */
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* sem armazenamento */ } };
const sync = Object.assign({ on: false, rev: 0, dirty: false, seq: 0, timer: null, busy: false, key: lsGet('eixo.key') || '' }, JSON.parse(lsGet('eixo.sync') || '{}'));
const saveMeta = () => lsSet('eixo.sync', JSON.stringify({ rev: sync.rev, dirty: sync.dirty }));
const api = (method, body) => fetch('api/state', { method, cache: 'no-store', headers: { 'X-Eixo-Key': sync.key, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
const CONFLICT = 'Outro aparelho salvou dados mais novos no servidor.\n\nOK: usar os dados do servidor.\nCancelar: manter os deste aparelho.';
function adopt(data) {
  S = Object.assign(blank(), data.state, { settings: Object.assign(blank().settings, data.state.settings) });
  sync.rev = data.rev; sync.dirty = false; saveLocal(); saveMeta(); render();
}
function askKey(wrong) {
  openSheet(`<form data-form="key"><h3>Chave de acesso</h3><p>${wrong ? 'Chave incorreta. ' : ''}Este Eixo está num servidor. Digite a chave que aparece na instalação (fica em <i>chave.txt</i> na pasta de dados do servidor).</p>
    <label class="field"><span>Chave</span><input name="key" required autocomplete="off" autocapitalize="off"></label>
    <div class="actions"><button class="btn grow" type="submit">Entrar</button></div></form>`);
}
async function pull(first) {
  if (sync.busy) return;
  sync.busy = true;
  try {
    const r = await api('GET');
    if (r.status === 401) { sync.on = true; return askKey(!!sync.key); }
    if (!r.ok || !(r.headers.get('content-type') || '').includes('json')) return;   // hospedagem simples: fica só neste aparelho
    const data = await r.json(), local = S.settings.onboarded;
    sync.on = true;
    if (!data.state) { if (local) { sync.rev = data.rev; sync.dirty = true; push(); } }
    else if (data.rev !== sync.rev || !local) {
      if (sync.dirty && local && !confirm(CONFLICT)) { sync.rev = data.rev; push(); } else adopt(data);
    } else if (sync.dirty) push();
    if (first) render();
  } catch (e) { /* servidor fora do ar: segue com os dados locais */ } finally { sync.busy = false; }
}
async function push() {
  clearTimeout(sync.timer);
  const seq = sync.seq;
  try {
    const r = await api('PUT', { rev: sync.rev, state: S });
    if (r.status === 409) { const data = await r.json(); if (confirm(CONFLICT)) adopt(data); else { sync.rev = data.rev; return push(); } }
    else if (r.status === 401) askKey(!!sync.key);
    else if (r.ok) { sync.rev = (await r.json()).rev; sync.dirty = sync.seq !== seq; saveMeta(); if (sync.dirty) sync.timer = setTimeout(push, 600); }
  } catch (e) { sync.timer = setTimeout(push, 15000); }
}

/* ---------- regras dos itens ---------- */
function occursOn(it, d) {
  if (!it.date) return false;
  if (!it.rec) return it.date === d;
  if (d < it.date || (it.until && d > it.until)) return false;
  const dt = pd(d);
  if (it.rec.t === 'd') return true;
  if (it.rec.t === 'w') return it.rec.days.includes(dt.getDay());
  return d === monthDay(d.slice(0, 7), it.rec.day);
}
const isDone = (it, d) => it.rec ? !!(it.doneOn && it.doneOn[d]) : !!it.done;
const isFocus = (id, d) => (S.focus[d] || []).includes(id);
function itemsFor(d) {
  return S.items.filter(it => occursOn(it, d)).sort((a, b) =>
    (a.time || '99') < (b.time || '99') ? -1 : (a.time || '99') > (b.time || '99') ? 1 : a.created < b.created ? -1 : 1);
}
const overdue = () => { const t = today(); return S.items.filter(it => !it.rec && it.date && it.date < t && !it.done).sort((a, b) => a.date < b.date ? -1 : 1); };
const inbox = () => S.items.filter(it => !it.date && !it.goalId && !it.done);
const billsDue = d => S.bills.filter(b => !b.paid[d.slice(0, 7)] && monthDay(d.slice(0, 7), b.day) === d);
const billsLate = () => { const t = today(), ym = t.slice(0, 7); return S.bills.filter(b => !b.paid[ym] && monthDay(ym, b.day) < t); };
function lastDone(areaId) {
  let last = null;
  for (const it of S.items) {
    if (it.area !== areaId) continue;
    const d = it.rec ? Object.keys(it.doneOn || {}).sort().pop() : it.done;
    if (d && (!last || d > last)) last = d;
  }
  return last;
}
function newItem(o) {
  const it = Object.assign({ id: uid(), title: '', area: 'pessoal', date: null, time: null, dur: null, rec: null, done: null, doneOn: {}, goalId: null, note: '', created: Date.now() }, o);
  S.items.push(it);
  return it;
}

/* ---------- captura em linguagem natural ---------- */
const DAY_TOK = { domingo: 0, dom: 0, segunda: 1, seg: 1, terca: 2, ter: 2, quarta: 3, qua: 3, quinta: 4, qui: 4, sexta: 5, sex: 5, sabado: 6, sab: 6 };
function guess(map, text, fallback) {
  const words = new Set(deacc(text.toLowerCase()).split(/[^a-z0-9]+/));
  for (const k in map) if (map[k].split(' ').some(w => words.has(w))) return k;
  return fallback;
}
function parseCapture(raw, base) {
  let o = raw.normalize('NFC'), n = deacc(o).toLowerCase();
  if (n.length !== o.length) n = o.toLowerCase();
  const take = re => {
    const m = re.exec(n); if (!m) return null;
    const sp = ' '.repeat(m[0].length);
    n = n.slice(0, m.index) + sp + n.slice(m.index + m[0].length);
    o = o.slice(0, m.index) + sp + o.slice(m.index + m[0].length);
    return m;
  };
  const title = () => {
    let t = o.replace(/\s+/g, ' ').trim();
    for (let i = 0; i < 2; i++) t = t.replace(/^(?:às|as|no|na|em|de|com|pra|para)\s+/i, '').replace(/\s+(?:às|as|no|na|em|de|dia|,)$/i, '').trim();
    return t.charAt(0).toUpperCase() + t.slice(1);
  };
  const t = today();
  let date = base, m;
  const dateWords = () => {
    if (take(/\bdepois de amanha\b/)) return addDays(t, 2);
    if (take(/\bamanha\b/)) return addDays(t, 1);
    if (take(/\bhoje\b/)) return t;
    if (take(/\bontem\b/)) return addDays(t, -1);
    if ((m = take(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/))) {
      let y = m[3] ? +m[3] : pd(t).getFullYear(); if (y < 100) y += 2000;
      let d = `${y}-${pad(+m[2])}-${pad(+m[1])}`;
      if (!m[3] && d < t) d = `${y + 1}-${pad(+m[2])}-${pad(+m[1])}`;
      return d;
    }
    return null;
  };

  // dinheiro: "gastei 45 mercado", "recebi 3000 salário"
  if ((m = take(/^\s*(gastei|paguei|comprei|recebi|ganhei)\s+(?:r\$\s*)?(\d[\d.]*(?:,\d{1,2})?)(?:\s*(?:reais|real))?(?![\dh:])/))) {
    const type = /recebi|ganhei/.test(m[1]) ? 'in' : 'out', amount = parseMoney(m[2]);
    const d = dateWords() || t;
    const desc = title();
    return { kind: 'tx', type, amount, date: d, desc, cat: guess(CAT_WORDS, desc, type === 'in' ? 'Extra' : 'Outros') };
  }

  const out = { kind: 'item', area: null, date, time: null, dur: null, rec: null };
  if ((m = take(/#([a-z]+)/))) { const a = AREAS.find(a => deacc(a.name.toLowerCase()).startsWith(m[1]) || a.id.startsWith(m[1])); if (a) out.area = a.id; }

  // recorrência
  const DAYS = '(?:segunda|terca|quarta|quinta|sexta|sabado|domingo|seg|ter|qua|qui|sex|sab|dom)(?:-feira)?s?';
  if ((m = take(/\btodo dia (\d{1,2})\b/))) out.rec = { t: 'm', day: Math.min(31, Math.max(1, +m[1])) };
  else if (take(/\b(?:todo dia|todos os dias|diariamente)\b/)) out.rec = { t: 'd' };
  else if (take(/\b(?:dias uteis|de segunda a sexta|seg a sex)\b/)) out.rec = { t: 'w', days: [1, 2, 3, 4, 5] };
  else if ((m = take(new RegExp(`\\b(?:toda|todo|todas as|todos os)\\s+((?:${DAYS}(?:\\s*,\\s*|\\s+e\\s+|\\s+)?)+)`)))) {
    const days = [...new Set((m[1].match(/[a-z]+/g) || []).map(w => DAY_TOK[w.replace(/s$/, '')] ?? DAY_TOK[w]).filter(x => x !== undefined))].sort();
    if (days.length) out.rec = { t: 'w', days };
  }

  // data
  const dw = dateWords();
  if (dw) out.date = dw;
  else if (take(/\b(?:algum dia|sem data)\b/)) out.date = null;
  else if ((m = take(/\b(?:n[ao]\s+|ness[ae]\s+|proxim[ao]\s+)?(segunda|terca|quarta|quinta|sexta|sabado|domingo|seg|qua|qui|sex|sab|dom)(?:-feira)?\b/))) {
    const diff = (DAY_TOK[m[1]] - pd(t).getDay() + 7) % 7 || 7;
    out.date = addDays(t, diff);
  } else if ((m = take(/\bdia (\d{1,2})\b/))) {
    let d = monthDay(t.slice(0, 7), +m[1]);
    if (d < t) { const nx = pd(t); nx.setDate(1); nx.setMonth(nx.getMonth() + 1); d = monthDay(ymd(nx).slice(0, 7), +m[1]); }
    out.date = d;
  }
  if (out.rec && !out.date) out.date = t;

  // duração e hora
  if ((m = take(/\b(?:por|durante)\s+(\d{1,2})\s*(?:h|horas?)(\d{2})?\b/))) out.dur = +m[1] * 60 + (+m[2] || 0);
  else if ((m = take(/\b(\d{1,3})\s*(?:min|minutos)\b/))) out.dur = +m[1];
  if ((m = take(/(?:\bas\s+)?\b(\d{1,2})(?:h(\d{2})?|:(\d{2}))(?![\w])/)) || (m = take(/\bas\s+(\d{1,2})\b/))) {
    const h = +m[1], mi = +(m[2] || m[3] || 0);
    if (h < 24 && mi < 60) out.time = `${pad(h)}:${pad(mi)}`;
  }

  out.title = title();
  if (!out.area) out.area = guess(AREA_WORDS, out.title, 'pessoal');
  return out;
}
function recLabel(rec) {
  if (!rec) return '';
  if (rec.t === 'd') return 'todo dia';
  if (rec.t === 'm') return `todo dia ${rec.day}`;
  return rec.days.length === 5 && rec.days.join() === '1,2,3,4,5' ? 'dias úteis' : rec.days.map(d => WD_SHORT[d]).join(', ');
}

/* ---------- peças de interface ---------- */
function row(it, d, o = {}) {
  const done = isDone(it, d), a = area(it.area), g = it.goalId && S.goals.find(g => g.id === it.goalId);
  const meta = [
    it.time ? `<b>${it.time}</b>${it.dur ? '–' + hhmm(mins(it.time) + it.dur) : ''}` : (it.dur ? durLabel(it.dur) : ''),
    o.showDate ? (it.date ? relLabel(it.date) : 'sem data') : '',
    `${a.emoji} ${a.name}`, it.rec ? '↻ ' + recLabel(it.rec) : '', g ? '◎ ' + esc(g.title) : '',
  ].filter(Boolean).join(' · ');
  const acts = o.acts ? `<span class="row-acts">${o.acts.map(([act, lbl]) => `<button class="btn ghost sm" data-a="${act}" data-id="${it.id}">${lbl}</button>`).join('')}</span>`
    : o.noStar ? '' : `<button class="star ${isFocus(it.id, d) ? 'on' : ''}" data-a="focus" data-id="${it.id}" data-d="${d}" aria-label="Essencial do dia" aria-pressed="${isFocus(it.id, d)}">★</button>`;
  return `<div class="row ${done ? 'done' : ''}" style="--c:${a.color}">
    <button class="chk" data-a="toggle" data-id="${it.id}" data-d="${d}" aria-label="Concluir ${esc(it.title)}" aria-pressed="${done}"></button>
    <button class="row-main" data-a="edit" data-id="${it.id}"><span class="row-title">${esc(it.title)}</span><span class="row-meta">${meta}</span></button>
    ${acts}</div>`;
}
function billRow(b, late) {
  return `<div class="row" style="--c:${area('financas').color}">
    <button class="chk" data-a="payBill" data-id="${b.id}" aria-label="Marcar ${esc(b.title)} como paga"></button>
    <button class="row-main" data-a="editBill" data-id="${b.id}"><span class="row-title">Pagar ${esc(b.title)}</span>
    <span class="row-meta">${late ? 'venceu dia ' + b.day : 'vence hoje'} · 💰 conta fixa</span></button>
    <span class="amount">${brl(b.amount)}</span></div>`;
}
const list = (html, empty) => html ? `<div class="list">${html}</div>` : (empty ? `<p class="empty">${empty}</p>` : '');
const hbar = (label, val, max, color, shown) => `<div class="hbar" style="--c:${color || 'var(--accent)'}"><span>${label}</span><span class="track"><i style="width:${max ? Math.max(val ? 4 : 0, val / max * 100) : 0}%"></i></span><span class="v">${shown ?? val}</span></div>`;

/* ---------- HOJE ---------- */
function viewHoje() {
  const d = ui.date, t = today(), isToday = d === t, its = itemsFor(d);
  const day = S.days[d] || {}, wake = mins(S.settings.wake), sleep = mins(S.settings.sleep), now = nowMin();
  const done = its.filter(i => isDone(i, d)).length;
  const h = new Date().getHours();
  const greet = h < 5 ? 'Boa madrugada' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  const awake = sleep > wake ? sleep - wake : 1;
  const pct = isToday ? Math.min(100, Math.max(0, (now - wake) / awake * 100)) : d < t ? 100 : 0;
  const left = sleep - now;
  const sub = !isToday ? `${done} de ${its.length} feitos`
    : `${its.length ? `${done} de ${its.length} feitos` : 'Dia em branco'} · ${now < wake ? 'o dia ainda não começou' : left > 0 ? `${durLabel(left)} até dormir` : 'hora de descansar'}`;
  const od = isToday ? overdue() : [], late = isToday ? billsLate() : [], inb = inbox().length;
  const away = S.settings.lastSeen ? diffDays(t, S.settings.lastSeen) : 0;

  let html = `<div class="datenav">
      <button data-a="shiftDay" data-n="-1" aria-label="Dia anterior">‹</button>
      <span class="lbl">${dayLabel(d)}</span>
      <button data-a="shiftDay" data-n="1" aria-label="Próximo dia">›</button>
      ${isToday ? '' : '<button data-a="shiftDay" data-n="0">voltar para hoje</button>'}
    </div>
    <div class="head"><div><h1>${isToday ? `${greet}${S.settings.name ? ', ' + esc(S.settings.name) : ''}` : relLabel(d) === dayLabel(d) ? WD_LONG[pd(d).getDay()].replace(/^./, c => c.toUpperCase()) : relLabel(d)}</h1><p class="sub">${sub}</p></div>
      <div class="head-actions">
        <button class="icon-btn" data-a="openInbox" aria-label="Caixa de entrada">📥${inb ? `<span class="badge">${inb}</span>` : ''}</button>
        <button class="icon-btn" data-a="openSettings" aria-label="Ajustes">⚙</button>
      </div></div>
    <div class="bar" title="Quanto do dia já passou"><i style="width:${pct}%"></i></div>`;

  if (isToday && od.length && (od.length >= 5 || away >= 3))
    html += `<div class="card cta warn"><div class="grow"><b>${away >= 3 ? 'Que bom que você voltou.' : 'Acumulou? Acontece.'}</b><small>${od.length} ${od.length === 1 ? 'item ficou' : 'itens ficaram'} para trás. Comece limpo: eles vão para a Caixa de entrada e você puxa só o que ainda importa.</small></div><button class="btn" data-a="restart">Recomeçar</button></div>`;
  if (isToday && !day.planned)
    html += `<div class="card cta"><div class="grow"><b>Planejar o dia</b><small>1 minuto: escolha até 3 essenciais.</small></div><button class="btn" data-a="openPlan">Planejar</button></div>`;
  if (isToday && !day.closed && (now >= sleep - 240 || h >= 18))
    html += `<div class="card cta"><div class="grow"><b>Fechar o dia</b><small>Como foi? O que não deu vai para amanhã, sem culpa.</small></div><button class="btn" data-a="openClose">Fechar</button></div>`;
  if (day.closed)
    html += `<div class="card cta"><div class="grow"><b>Dia fechado ${day.mood ? MOODS[day.mood - 1] : ''}</b><small>${day.note ? esc(day.note) : 'Bom descanso.'}</small></div><button class="btn ghost sm" data-a="openClose">Editar</button></div>`;

  if (od.length || late.length)
    html += `<h2>Ficou para trás</h2>` + list(late.map(b => billRow(b, true)).join('') + od.map(it => row(it, it.date, { showDate: true, acts: [['toToday', 'Hoje'], ['toInbox', 'Depois']] })).join(''));

  const focus = its.filter(i => isFocus(i.id, d));
  if (focus.length) html += `<h2>Essenciais do dia</h2>` + list(focus.map(i => row(i, d)).join(''));

  // linha do tempo: de acordar a dormir
  const timed = its.filter(i => i.time), free = its.filter(i => !i.time && !isFocus(i.id, d)), due = billsDue(d);
  let tl = '', cur = wake, nowIn = !isToday || now < wake || now >= sleep;
  const nowLine = () => { nowIn = true; return `<div class="tl-now"><span>agora ${hhmm(now)}</span></div>`; };
  const gap = (from, to) => to - from >= 60 && to > (isToday ? now : 0) ? `<button class="tl-gap" data-a="fillGap" data-time="${hhmm(Math.max(from, isToday ? Math.ceil(now / 30) * 30 : from))}">${durLabel(to - Math.max(from, isToday ? now : from))} livres · toque para preencher</button>` : '';
  for (const it of timed) {
    const s = mins(it.time);
    if (!nowIn && now < s) { tl += gap(cur, s) + nowLine(); } else tl += gap(cur, s);
    tl += row(it, d);
    cur = Math.max(cur, s + (it.dur || 30));
  }
  if (!nowIn) tl += nowLine();
  tl += gap(cur, sleep);
  html += `<h2>Linha do tempo</h2><div class="tl-mark">☀ acordar ${S.settings.wake}</div>${list(tl)}<div class="tl-mark">🌙 dormir ${S.settings.sleep}</div>`;

  if (free.length || due.length) html += `<h2>A qualquer hora</h2>` + list(due.map(b => billRow(b)).join('') + free.map(i => row(i, d)).join(''));
  if (!its.length && !due.length) html += `<p class="empty">Nada aqui ainda. Use a barra abaixo: escreva do seu jeito, por exemplo <i>“dentista sexta 9h”</i> ou <i>“gastei 45 mercado”</i>.</p>`;
  return html;
}

/* ---------- SEMANA ---------- */
function viewSemana() {
  const t = today();
  let html = `<div class="datenav"><button data-a="shiftWeek" data-n="-1" aria-label="Semana anterior">‹</button><span class="lbl">${dayLabel(ui.week)} – ${dayLabel(addDays(ui.week, 6))}</span><button data-a="shiftWeek" data-n="1" aria-label="Próxima semana">›</button>${ui.week === mondayOf(t) ? '' : '<button data-a="shiftWeek" data-n="0">esta semana</button>'}</div>
    <div class="head"><div><h1>Semana</h1><p class="sub">Tudo de todas as áreas, dia a dia. Toque num dia para abrir.</p></div></div><div class="week" style="margin-top:14px">`;
  for (let i = 0; i < 7; i++) {
    const d = addDays(ui.week, i), its = itemsFor(d), done = its.filter(x => isDone(x, d)).length, due = billsDue(d), mood = (S.days[d] || {}).mood;
    html += `<section class="card day ${d === t ? 'today' : ''}">
      <button class="day-h" data-a="openDay" data-d="${d}"><b>${WD_LONG[pd(d).getDay()]} <span style="color:var(--mute);font-weight:400">${pd(d).getDate()}</span></b><small>${mood ? MOODS[mood - 1] + ' ' : ''}${its.length ? `${done}/${its.length}` : 'livre'}</small></button>
      ${list(due.map(b => billRow(b)).join('') + its.map(x => row(x, d, { noStar: true })).join(''))}</section>`;
  }
  return html + '</div>';
}

/* ---------- VIDA (áreas + metas) ---------- */
function weekStats(start) {
  const t = today(), by = {}, moods = [], notes = [];
  let total = 0, done = 0, hTotal = 0, hDone = 0;
  AREAS.forEach(a => by[a.id] = 0);
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i);
    const day = S.days[d];
    moods.push(day && day.mood || 0);
    if (day && day.note) notes.push([d, day.note]);
    if (d > t) continue;
    for (const it of itemsFor(d)) {
      const ok = isDone(it, d);
      total++; if (ok) { done++; by[it.area] = (by[it.area] || 0) + 1; }
      if (it.rec) { hTotal++; if (ok) hDone++; }
    }
  }
  const end = addDays(start, 6);
  const tx = S.tx.filter(x => x.date >= start && x.date <= end);
  return { by, total, done, hTotal, hDone, moods, notes, spent: tx.filter(x => x.type === 'out').reduce((s, x) => s + x.amount, 0), earned: tx.filter(x => x.type === 'in').reduce((s, x) => s + x.amount, 0) };
}
function goalProgress(g) {
  const steps = S.items.filter(i => i.goalId === g.id), done = steps.filter(i => i.rec ? Object.keys(i.doneOn || {}).length : i.done).length;
  return { steps, done, pct: steps.length ? Math.round(done / steps.length * 100) : 0 };
}
function viewVida() {
  const t = today(), st = weekStats(addDays(t, -6));
  const sum = Object.values(st.by).reduce((a, b) => a + b, 0);
  const top = AREAS.slice().sort((a, b) => st.by[b.id] - st.by[a.id])[0];
  const stale = AREAS.filter(a => S.items.some(i => i.area === a.id) && (!lastDone(a.id) || diffDays(t, lastDone(a.id)) > 7));
  const never = AREAS.filter(a => !S.items.some(i => i.area === a.id));
  let insight = sum ? `Nos últimos 7 dias, <b>${Math.round(st.by[top.id] / sum * 100)}%</b> do que você concluiu foi de <b>${top.name}</b>.` : 'Conclua itens para ver para onde sua energia está indo.';
  if (stale.length) insight += ` ${stale.map(a => a.name).join(', ')} ${stale.length > 1 ? 'estão parados' : 'está parado'} há mais de uma semana.`;
  if (never.length && S.items.length) insight += ` Nada planejado ainda em ${never.map(a => a.name).join(', ')}.`;

  let html = `<div class="head"><div><h1>Vida</h1><p class="sub">Equilíbrio entre as áreas e as metas que puxam seus dias.</p></div></div>
    <div class="card insight">${insight}</div><h2>Áreas · últimos 7 dias</h2><div class="areas">`;
  for (const a of AREAS) {
    const ld = lastDone(a.id), open = S.items.filter(i => i.area === a.id && !i.rec && !i.done).length;
    const ago = ld ? diffDays(t, ld) : null;
    html += `<button class="card area" style="--c:${a.color}" data-a="openArea" data-id="${a.id}"><span class="em">${a.emoji}</span><b>${a.name}</b>
      <small>${st.by[a.id]} ${st.by[a.id] === 1 ? 'feito' : 'feitos'} · ${open} em aberto</small>
      <small class="${ago === null || ago > 7 ? 'alert' : ''}">${ago === null ? 'sem atividade' : ago === 0 ? 'ativo hoje' : `há ${ago} ${ago === 1 ? 'dia' : 'dias'}`}</small></button>`;
  }
  html += `</div><h2>Metas <button data-a="editGoal">+ Nova meta</button></h2>`;
  html += S.goals.length ? S.goals.map(g => {
    const p = goalProgress(g), a = area(g.area);
    return `<button class="card goal" data-a="openGoal" data-id="${g.id}"><span class="top"><b>${a.emoji} ${esc(g.title)}</b><span>${p.pct}%</span></span>
      <small>${p.done}/${p.steps.length} passos${g.deadline ? ' · até ' + dayLabel(g.deadline) : ''}</small><div class="bar"><i style="width:${p.pct}%;background:${a.color}"></i></div></button>`;
  }).join('') : `<p class="empty">Uma meta é um destino; os passos dela entram no seu dia. Crie a primeira.</p>`;
  return html;
}

/* ---------- DINHEIRO ---------- */
function viewDinheiro() {
  const ym = ui.month, [y, m] = ym.split('-').map(Number);
  const tx = S.tx.filter(x => x.date.startsWith(ym)).sort((a, b) => a.date < b.date ? 1 : -1);
  const inn = tx.filter(x => x.type === 'in').reduce((s, x) => s + x.amount, 0), out = tx.filter(x => x.type === 'out').reduce((s, x) => s + x.amount, 0);
  const cats = {}; tx.filter(x => x.type === 'out').forEach(x => cats[x.cat] = (cats[x.cat] || 0) + x.amount);
  const catList = Object.entries(cats).sort((a, b) => b[1] - a[1]), max = catList.length ? catList[0][1] : 0;
  const pending = S.bills.filter(b => !b.paid[ym]).reduce((s, b) => s + b.amount, 0);
  const bud = S.settings.budget;
  let html = `<div class="datenav"><button data-a="shiftMonth" data-n="-1" aria-label="Mês anterior">‹</button><span class="lbl">${MONTHS_LONG[m - 1]} de ${y}</span><button data-a="shiftMonth" data-n="1" aria-label="Próximo mês">›</button></div>
    <div class="head"><div><h1>Dinheiro</h1><p class="sub">${pending ? `${brl(pending)} em contas fixas ainda por pagar.` : 'Contas fixas do mês em dia.'}</p></div>
    <div class="head-actions"><button class="btn" data-a="editTx">+ Lançar</button></div></div>
    <div class="stats"><div class="card stat"><small>Entradas</small><b>${brl(inn)}</b></div><div class="card stat"><small>Saídas</small><b>${brl(out)}</b></div><div class="card stat"><small>Saldo</small><b class="${inn - out < 0 ? 'neg' : 'pos'}">${brl(inn - out)}</b></div></div>`;
  if (bud) html += `<div class="card" style="margin-top:10px"><small style="color:var(--mute)">Limite do mês: ${brl(out)} de ${brl(bud)} ${out > bud ? '· estourou ' + brl(out - bud) : '· sobram ' + brl(bud - out)}</small><div class="bar ${out > bud ? 'over' : ''}"><i style="width:${Math.min(100, out / bud * 100)}%"></i></div></div>`;
  html += `<h2>Contas fixas <button data-a="editBill">+ Nova conta</button></h2>` + list(S.bills.slice().sort((a, b) => a.day - b.day).map(b => {
    const paid = !!b.paid[ym];
    return `<div class="row ${paid ? 'done' : ''}" style="--c:${area('financas').color}"><button class="chk" data-a="payBill" data-id="${b.id}" aria-label="Paga" aria-pressed="${paid}"></button>
      <button class="row-main" data-a="editBill" data-id="${b.id}"><span class="row-title">${esc(b.title)}</span><span class="row-meta">dia ${b.day} · ${esc(b.cat)}</span></button><span class="amount">${brl(b.amount)}</span></div>`;
  }).join(''), 'Cadastre aluguel, luz, internet… Elas aparecem no seu dia na data de vencimento.');
  if (catList.length) html += `<h2>Para onde foi</h2><div class="card">${catList.map(([c, v]) => hbar(esc(c), v, max, null, brl(v))).join('')}</div>`;
  html += `<h2>Lançamentos</h2>` + list(tx.map(x => `<div class="row"><button class="row-main" data-a="editTx" data-id="${x.id}"><span class="row-title">${esc(x.desc || x.cat)}</span><span class="row-meta">${dayLabel(x.date)} · ${esc(x.cat)}</span></button><span class="amount ${x.type}">${x.type === 'in' ? '+' : '−'} ${brl(x.amount)}</span></div>`).join(''),
    'Nenhum lançamento neste mês. Dica: na barra abaixo, escreva “gastei 45 mercado”.');
  return html;
}

/* ---------- REVISÃO ---------- */
function viewRevisao() {
  const t = today(), st = weekStats(ui.week), max = Math.max(1, ...Object.values(st.by));
  const rate = st.total ? Math.round(st.done / st.total * 100) : 0, hab = st.hTotal ? Math.round(st.hDone / st.hTotal * 100) : null;
  const zero = AREAS.filter(a => !st.by[a.id]);
  const rated = st.moods.filter(Boolean), avg = rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length : 0;
  let html = `<div class="datenav"><button data-a="shiftWeek" data-n="-1" aria-label="Semana anterior">‹</button><span class="lbl">${dayLabel(ui.week)} – ${dayLabel(addDays(ui.week, 6))}</span><button data-a="shiftWeek" data-n="1" aria-label="Próxima semana">›</button>${ui.week === mondayOf(t) ? '' : '<button data-a="shiftWeek" data-n="0">esta semana</button>'}</div>
    <div class="head"><div><h1>Revisão da semana</h1><p class="sub">Cinco minutos no domingo valem mais que qualquer aplicativo.</p></div></div>
    <div class="stats"><div class="card stat"><small>Concluído</small><b>${st.done}/${st.total}</b></div><div class="card stat"><small>Rotinas</small><b>${hab === null ? '—' : hab + '%'}</b></div><div class="card stat"><small>Gastos</small><b>${brl(st.spent)}</b></div></div>
    <div class="card insight">${st.total ? `Você concluiu <b>${rate}%</b> do que planejou.${rate < 50 ? ' Planeje menos na próxima semana: o plano bom é o que cabe.' : rate > 85 ? ' Ritmo sólido.' : ''}` : 'Semana sem itens planejados.'}${zero.length && st.done ? ` Sem nada concluído em: ${zero.map(a => a.name).join(', ')}.` : ''}${avg ? ` Humor médio: ${MOODS[Math.round(avg) - 1]}.` : ''}</div>
    <h2>Onde foi sua energia</h2><div class="card">${AREAS.map(a => hbar(`${a.emoji} ${a.name}`, st.by[a.id], max, a.color)).join('')}</div>
    <h2>Humor</h2><div class="card moods">${st.moods.map((mo, i) => `<div><span>${mo ? MOODS[mo - 1] : '·'}</span>${WD_SHORT[(i + 1) % 7]}</div>`).join('')}</div>`;
  if (st.notes.length) html += `<h2>O que valeu</h2><div class="card">${st.notes.map(([d, n]) => `<div class="quote">${esc(n)}<small>${dayLabel(d)}</small></div>`).join('')}</div>`;
  html += `<h2>Próxima semana</h2><div class="card cta" style="margin-top:0"><div class="grow"><b>Planeje com o que aprendeu</b><small>${inbox().length} na caixa de entrada · ${overdue().length} para trás</small></div><button class="btn" data-a="planNext">Abrir semana</button></div>`;
  return html;
}

/* ---------- boas-vindas ---------- */
function viewWelcome() {
  return `<div class="welcome"><h1><span class="brand-mark">◎</span> Eixo</h1>
    <p class="sub" style="font-size:17px">Sua vida inteira num lugar só — de acordar a ir dormir.</p>
    <ul><li><b>Um dia, uma tela.</b> Trabalho, estudos, família, lazer, saúde e dinheiro na mesma linha do tempo.</li>
    <li><b>Escreva do seu jeito.</b> “reunião amanhã 14h”, “gastei 45 mercado”.</li>
    <li><b>Sem culpa.</b> Sumiu uns dias? Um toque e você recomeça limpo.</li></ul>
    <form data-form="welcome" class="card">
      <label class="field" style="margin-top:0"><span>Como quer ser chamado?</span><input name="name" maxlength="30" autocomplete="given-name"></label>
      <div class="cols"><label class="field"><span>Acordo às</span><input type="time" name="wake" value="06:30" required></label>
      <label class="field"><span>Durmo às</span><input type="time" name="sleep" value="22:30" required></label></div>
      <div class="actions"><button class="btn grow" type="submit">Começar</button><button class="btn ghost" type="button" data-a="demo">Ver com exemplo</button></div>
    </form>
    <p class="sub" style="margin-top:12px">${sync.on ? 'Seus dados ficam guardados no servidor e aparecem em todos os seus aparelhos.' : 'Seus dados ficam só neste aparelho. Faça backup quando quiser em Ajustes.'}</p></div>`;
}

/* ---------- folhas (modais) ---------- */
function openSheet(html) {
  $('#sheet .sheet-body').innerHTML = html;
  $('#sheet').hidden = false;
}
function closeSheet() { $('#sheet').hidden = true; $('#sheet .sheet-body').innerHTML = ''; }
const areaPick = sel => `<div class="pick">${AREAS.map(a => `<label><input type="radio" name="area" value="${a.id}" ${a.id === sel ? 'checked' : ''}><span>${a.emoji} ${a.name}</span></label>`).join('')}</div>`;

function sheetItem(it) {
  const r = it.rec || {};
  return `<form data-form="item" data-id="${it.id}"><h3>Editar</h3>
    <label class="field"><span>O quê</span><input name="title" value="${esc(it.title)}" required></label>
    <div class="field"><span>Área da vida</span>${areaPick(it.area)}</div>
    <div class="cols3"><label class="field"><span>${it.rec ? 'Começa em' : 'Data'}</span><input type="date" name="date" value="${it.date || ''}"></label>
      <label class="field"><span>Hora</span><input type="time" name="time" value="${it.time || ''}"></label>
      <label class="field"><span>Duração (min)</span><input type="number" name="dur" min="0" step="5" inputmode="numeric" value="${it.dur || ''}"></label></div>
    <label class="field"><span>Repetir</span><select name="rec"><option value="">Não repete</option><option value="d" ${r.t === 'd' ? 'selected' : ''}>Todo dia</option><option value="w" ${r.t === 'w' ? 'selected' : ''}>Dias da semana</option><option value="m" ${r.t === 'm' ? 'selected' : ''}>Todo mês, neste dia</option></select></label>
    <div class="field" data-weekdays ${r.t === 'w' ? '' : 'hidden'}><div class="pick">${WD_SHORT.map((w, i) => `<label><input type="checkbox" name="wd" value="${i}" ${r.t === 'w' && r.days.includes(i) ? 'checked' : ''}><span>${w}</span></label>`).join('')}</div></div>
    <label class="field"><span>Meta ligada</span><select name="goalId"><option value="">Nenhuma</option>${S.goals.map(g => `<option value="${g.id}" ${g.id === it.goalId ? 'selected' : ''}>${esc(g.title)}</option>`).join('')}</select></label>
    <label class="field"><span>Anotação</span><textarea name="note" rows="2">${esc(it.note)}</textarea></label>
    <div class="actions"><button class="btn grow" type="submit">Salvar</button>
      ${it.rec ? '' : `<button class="btn ghost" type="button" data-a="toTomorrow" data-id="${it.id}">→ Amanhã</button><button class="btn ghost" type="button" data-a="toInbox" data-id="${it.id}">→ Depois</button>`}
      <button class="btn danger" type="button" data-a="delItem" data-id="${it.id}">Excluir</button></div></form>`;
}
function sheetPlan() {
  const d = today(), its = itemsFor(d).filter(i => !isDone(i, d)), n = (S.focus[d] || []).length;
  return `<h3>Planejar o dia</h3><p>Marque com ★ até 3 essenciais — o que, feito, já faz o dia valer. (${n}/3)</p>
    ${list(its.map(i => row(i, d)).join(''), 'Nenhum item hoje ainda. Adicione abaixo.')}
    <form data-form="planAdd" class="inline-add"><input class="inp" name="q" placeholder="Adicionar: estudar inglês 19h" aria-label="Adicionar item"><button class="btn" type="submit">+</button></form>
    <div class="actions"><button class="btn grow" data-a="planDone">Pronto, bora</button></div>`;
}
function sheetClose() {
  const d = today(), day = S.days[d] || {}, its = itemsFor(d), done = its.filter(i => isDone(i, d)).length;
  const left = its.filter(i => !i.rec && !isDone(i, d)).length;
  return `<form data-form="close"><h3>Fechar o dia</h3><p>${its.length ? `Você concluiu ${done} de ${its.length}.` : 'Dia sem itens.'} ${done ? 'Isso conta.' : ''}</p>
    <div class="field"><span>Como foi o dia?</span><div class="pick big">${MOODS.map((mo, i) => `<label><input type="radio" name="mood" value="${i + 1}" ${day.mood === i + 1 ? 'checked' : ''}><span>${mo}</span></label>`).join('')}</div></div>
    <label class="field"><span>Uma linha: o que valeu hoje?</span><input name="note" maxlength="200" value="${esc(day.note || '')}"></label>
    ${left ? `<label class="field"><span><input type="checkbox" name="carry" checked> Levar ${left} ${left === 1 ? 'pendente' : 'pendentes'} para amanhã</span></label>` : ''}
    <div class="actions"><button class="btn grow" type="submit">Fechar o dia</button></div></form>`;
}
function sheetInbox() {
  const its = inbox();
  return `<h3>Caixa de entrada</h3><p>Ideias e pendências sem data. Puxe para um dia quando fizer sentido — ou apague sem dó.</p>
    ${list(its.map(i => row(i, today(), { acts: [['toToday', 'Hoje'], ['toTomorrow', 'Amanhã']] })).join(''), 'Vazia. Para guardar algo sem data, escreva “… algum dia” na captura.')}
    <div class="actions"><button class="btn ghost grow" data-a="closeSheet">Fechar</button></div>`;
}
function sheetArea(id) {
  const a = area(id), open = S.items.filter(i => i.area === id && !i.rec && !i.done).sort((x, y) => (x.date || '9') < (y.date || '9') ? -1 : 1), rec = S.items.filter(i => i.area === id && i.rec);
  return `<h3>${a.emoji} ${a.name}</h3>
    <h2>Em aberto</h2>${list(open.map(i => row(i, i.date || today(), { showDate: true, noStar: true })).join(''), 'Nada em aberto.')}
    <h2>Rotinas</h2>${list(rec.map(i => `<div class="row" style="--c:${a.color}"><button class="row-main" data-a="edit" data-id="${i.id}"><span class="row-title">${esc(i.title)}</span><span class="row-meta">↻ ${recLabel(i.rec)}${i.time ? ' · ' + i.time : ''}</span></button></div>`).join(''), 'Nenhuma rotina. Ex.: “academia toda seg qua sex 6h”.')}
    <div class="actions"><button class="btn ghost grow" data-a="closeSheet">Fechar</button></div>`;
}
function sheetGoalEdit(g) {
  g = g || { id: '', title: '', area: 'pessoal', deadline: '' };
  return `<form data-form="goal" data-id="${g.id}"><h3>${g.id ? 'Editar meta' : 'Nova meta'}</h3>
    <label class="field"><span>Aonde você quer chegar?</span><input name="title" value="${esc(g.title)}" required placeholder="Ex.: Passar na certificação"></label>
    <div class="field"><span>Área da vida</span>${areaPick(g.area)}</div>
    <label class="field"><span>Prazo (opcional)</span><input type="date" name="deadline" value="${g.deadline || ''}"></label>
    <div class="actions"><button class="btn grow" type="submit">Salvar</button>${g.id ? `<button class="btn danger" type="button" data-a="delGoal" data-id="${g.id}">Excluir</button>` : ''}</div></form>`;
}
function sheetGoal(id) {
  const g = S.goals.find(x => x.id === id), p = goalProgress(g), a = area(g.area);
  return `<h3>${a.emoji} ${esc(g.title)}</h3><p>${p.pct}% · ${p.done}/${p.steps.length} passos${g.deadline ? ' · até ' + dayLabel(g.deadline) : ''}</p>
    ${list(p.steps.map(i => row(i, i.date || today(), i.date || i.done ? { showDate: true, noStar: true } : { showDate: true, acts: [['toToday', 'Hoje']] })).join(''), 'Quebre a meta em passos pequenos. Cada passo pode ir para um dia.')}
    <form data-form="step" data-id="${g.id}" class="inline-add"><input class="inp" name="q" placeholder="Próximo passo…" aria-label="Novo passo" required><button class="btn" type="submit">+</button></form>
    <div class="actions"><button class="btn ghost" data-a="editGoal" data-id="${g.id}">Editar meta</button><button class="btn ghost grow" data-a="closeSheet">Fechar</button></div>`;
}
function sheetTx(x) {
  x = x || { id: '', type: 'out', amount: '', desc: '', cat: 'Outros', date: today() };
  return `<form data-form="tx" data-id="${x.id}"><h3>${x.id ? 'Editar lançamento' : 'Novo lançamento'}</h3>
    <div class="field"><div class="pick"><label><input type="radio" name="type" value="out" ${x.type === 'out' ? 'checked' : ''}><span>Saída</span></label><label><input type="radio" name="type" value="in" ${x.type === 'in' ? 'checked' : ''}><span>Entrada</span></label></div></div>
    <div class="cols"><label class="field"><span>Valor (R$)</span><input name="amount" inputmode="decimal" required value="${x.amount ? String(x.amount).replace('.', ',') : ''}"></label>
    <label class="field"><span>Data</span><input type="date" name="date" value="${x.date}" required></label></div>
    <label class="field"><span>Descrição</span><input name="desc" value="${esc(x.desc)}"></label>
    <label class="field"><span>Categoria</span><select name="cat">${[...CATS_OUT, ...CATS_IN].map(c => `<option ${c === x.cat ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
    <div class="actions"><button class="btn grow" type="submit">Salvar</button>${x.id ? `<button class="btn danger" type="button" data-a="delTx" data-id="${x.id}">Excluir</button>` : ''}</div></form>`;
}
function sheetBill(b) {
  b = b || { id: '', title: '', amount: '', day: 10, cat: 'Contas' };
  return `<form data-form="bill" data-id="${b.id}"><h3>${b.id ? 'Editar conta fixa' : 'Nova conta fixa'}</h3><p>Aparece no seu dia todo mês, na data de vencimento.</p>
    <label class="field"><span>Nome</span><input name="title" value="${esc(b.title)}" required placeholder="Ex.: Internet"></label>
    <div class="cols"><label class="field"><span>Valor (R$)</span><input name="amount" inputmode="decimal" required value="${b.amount ? String(b.amount).replace('.', ',') : ''}"></label>
    <label class="field"><span>Dia do vencimento</span><input type="number" name="day" min="1" max="31" required value="${b.day}"></label></div>
    <label class="field"><span>Categoria</span><select name="cat">${CATS_OUT.map(c => `<option ${c === b.cat ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
    <div class="actions"><button class="btn grow" type="submit">Salvar</button>${b.id ? `<button class="btn danger" type="button" data-a="delBill" data-id="${b.id}">Excluir</button>` : ''}</div></form>`;
}
function sheetSettings() {
  const s = S.settings;
  return `<form data-form="settings"><h3>Ajustes</h3>
    <label class="field"><span>Nome</span><input name="name" value="${esc(s.name)}" maxlength="30"></label>
    <div class="cols"><label class="field"><span>Acordo às</span><input type="time" name="wake" value="${s.wake}" required></label><label class="field"><span>Durmo às</span><input type="time" name="sleep" value="${s.sleep}" required></label></div>
    <label class="field"><span>Limite de gastos por mês (R$, opcional)</span><input name="budget" inputmode="decimal" value="${s.budget ? String(s.budget).replace('.', ',') : ''}"></label>
    <div class="actions"><button class="btn grow" type="submit">Salvar</button></div></form>
    <h2>Seus dados</h2><p>${sync.on ? `<b>Sincronizado com o servidor.</b> Qualquer aparelho que abrir este endereço vê os mesmos dados${sync.dirty ? ' (há alterações aguardando envio)' : ''}. Ainda assim, exporte um backup de vez em quando.` : 'Tudo fica só neste aparelho. Exporte um backup de vez em quando — é também assim que você leva os dados para outro aparelho.'}</p>
    <div class="actions"><button class="btn ghost" data-a="export">Exportar backup</button><label class="btn ghost">Importar backup<input type="file" accept="application/json,.json" data-import hidden></label><button class="btn danger" data-a="wipe">Apagar tudo</button></div>`;
}

/* ---------- ações ---------- */
const byId = id => S.items.find(i => i.id === id);
let sheetFn = null;
const show = fn => { sheetFn = fn; openSheet(fn()); };
const commit = (keepSheet) => { save(); if (keepSheet && sheetFn && !$('#sheet').hidden) openSheet(sheetFn()); else if (!keepSheet) closeSheet(); render(); };

const actions = {
  go: ds => { ui.view = ds.view; if (ds.view === 'hoje') ui.date = today(); closeSheet(); render(); window.scrollTo(0, 0); },
  closeSheet,
  shiftDay: ds => { ui.date = +ds.n ? addDays(ui.date, +ds.n) : today(); render(); },
  shiftWeek: ds => { ui.week = +ds.n ? addDays(ui.week, 7 * ds.n) : mondayOf(today()); render(); },
  shiftMonth: ds => { const d = pd(ui.month + '-01'); d.setMonth(d.getMonth() + +ds.n); ui.month = ymd(d).slice(0, 7); render(); },
  openDay: ds => { ui.date = ds.d; ui.view = 'hoje'; render(); window.scrollTo(0, 0); },
  planNext: () => { ui.week = addDays(mondayOf(today()), 7); ui.view = 'semana'; render(); window.scrollTo(0, 0); },
  toggle: ds => {
    const it = byId(ds.id); if (!it) return;
    if (it.rec) { it.doneOn = it.doneOn || {}; if (it.doneOn[ds.d]) delete it.doneOn[ds.d]; else it.doneOn[ds.d] = true; }
    else it.done = it.done ? null : today();
    commit(true);
  },
  focus: ds => {
    const f = S.focus[ds.d] = S.focus[ds.d] || [], i = f.indexOf(ds.id);
    if (i >= 0) f.splice(i, 1);
    else if (f.length >= 3) return toast('Só 3 essenciais. Se tudo é prioridade, nada é.');
    else f.push(ds.id);
    commit(true);
  },
  edit: ds => { const it = byId(ds.id); if (it) show(() => sheetItem(it)); },
  toToday: ds => { const it = byId(ds.id); it.date = today(); commit(true); },
  toTomorrow: ds => { const it = byId(ds.id); it.date = addDays(today(), 1); commit(sheetFn === sheetInbox); toast('Movido para amanhã.'); },
  toInbox: ds => { const it = byId(ds.id); it.date = null; it.time = null; commit(); toast('Guardado na Caixa de entrada.'); },
  delItem: ds => {
    const it = byId(ds.id);
    if (it.rec && !confirm('Excluir esta rotina e todo o histórico dela?')) return;
    S.items = S.items.filter(i => i.id !== ds.id);
    for (const d in S.focus) S.focus[d] = S.focus[d].filter(x => x !== ds.id);
    commit(); toast('Excluído.');
  },
  restart: () => {
    const od = overdue(); od.forEach(it => { it.date = null; it.time = null; });
    commit(); toast(`Página virada. ${od.length} ${od.length === 1 ? 'item foi' : 'itens foram'} para a Caixa de entrada.`);
  },
  fillGap: ds => { const inp = $('#capture-input'); inp.value = ` ${ds.time.replace(':', 'h')}`; inp.focus(); inp.setSelectionRange(0, 0); preview(); },
  openPlan: () => show(sheetPlan),
  planDone: () => { const d = today(); S.days[d] = Object.assign(S.days[d] || {}, { planned: true }); commit(); toast('Dia planejado. Uma coisa de cada vez.'); },
  openClose: () => show(sheetClose),
  openInbox: () => show(sheetInbox),
  openSettings: () => show(sheetSettings),
  openArea: ds => show(() => sheetArea(ds.id)),
  openGoal: ds => show(() => sheetGoal(ds.id)),
  editGoal: ds => show(() => sheetGoalEdit(S.goals.find(g => g.id === ds.id))),
  delGoal: ds => { if (!confirm('Excluir a meta? Os passos continuam como itens soltos.')) return; S.goals = S.goals.filter(g => g.id !== ds.id); S.items.forEach(i => { if (i.goalId === ds.id) i.goalId = null; }); commit(); },
  editTx: ds => show(() => sheetTx(S.tx.find(x => x.id === ds.id))),
  delTx: ds => { S.tx = S.tx.filter(x => x.id !== ds.id); S.bills.forEach(b => { for (const k in b.paid) if (b.paid[k] === ds.id) delete b.paid[k]; }); commit(); },
  editBill: ds => show(() => sheetBill(S.bills.find(b => b.id === ds.id))),
  delBill: ds => { S.bills = S.bills.filter(b => b.id !== ds.id); commit(); },
  payBill: ds => {
    const b = S.bills.find(x => x.id === ds.id), ym = ui.view === 'dinheiro' ? ui.month : ui.date.slice(0, 7);
    if (b.paid[ym]) { S.tx = S.tx.filter(x => x.id !== b.paid[ym]); delete b.paid[ym]; }
    else {
      const t = today(), tx = { id: uid(), type: 'out', amount: b.amount, desc: b.title, cat: b.cat, date: t.startsWith(ym) ? t : monthDay(ym, b.day) };
      S.tx.push(tx); b.paid[ym] = tx.id; toast(`${b.title} paga: ${brl(b.amount)} lançado.`);
    }
    commit();
  },
  export: () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' }));
    a.download = `eixo-backup-${today()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
  wipe: () => { if (!confirm(sync.on ? 'Apagar TODOS os dados, neste aparelho e no servidor? Não dá para desfazer.' : 'Apagar TODOS os dados deste aparelho? Não dá para desfazer.')) return; S = blank(); save(true); closeSheet(); render(); },
  demo: () => { seedDemo(); commit(); },
};

const forms = {
  key: f => { sync.key = f.key.trim(); lsSet('eixo.key', sync.key); closeSheet(); pull(true); },
  welcome: f => { Object.assign(S.settings, { name: f.name.trim(), wake: f.wake, sleep: f.sleep, onboarded: true }); commit(); },
  settings: f => { Object.assign(S.settings, { name: f.name.trim(), wake: f.wake, sleep: f.sleep, budget: parseMoney(f.budget || '0') }); commit(); toast('Ajustes salvos.'); },
  item: (f, id, form) => {
    const it = byId(id), wd = [...form.querySelectorAll('[name=wd]:checked')].map(x => +x.value);
    Object.assign(it, { title: f.title.trim() || it.title, area: f.area || it.area, date: f.date || null, time: f.time || null, dur: +f.dur || null, goalId: f.goalId || null, note: f.note.trim() });
    it.rec = f.rec === 'd' ? { t: 'd' } : f.rec === 'w' && wd.length ? { t: 'w', days: wd } : f.rec === 'm' && it.date ? { t: 'm', day: pd(it.date).getDate() } : null;
    if (it.rec && !it.date) it.date = today();
    if (!it.date) it.time = null;
    commit();
  },
  planAdd: (f) => { if (!f.q.trim()) return; addFromText(f.q, today(), true); commit(true); $('#sheet [name=q]')?.focus(); },
  close: f => {
    const d = today();
    S.days[d] = Object.assign(S.days[d] || {}, { closed: true, mood: +f.mood || 0, note: (f.note || '').trim() });
    let n = 0;
    if (f.carry) itemsFor(d).forEach(it => { if (!it.rec && !it.done) { it.date = addDays(d, 1); n++; } });
    commit(); toast(n ? `Dia fechado. ${n} ${n === 1 ? 'item foi' : 'itens foram'} para amanhã.` : 'Dia fechado. Bom descanso.');
  },
  goal: (f, id) => {
    const data = { title: f.title.trim(), area: f.area || 'pessoal', deadline: f.deadline || '' };
    let g = S.goals.find(x => x.id === id);
    if (g) Object.assign(g, data); else { g = Object.assign({ id: uid() }, data); S.goals.push(g); }
    save(); render(); show(() => sheetGoal(g.id));
  },
  step: (f, id) => { const g = S.goals.find(x => x.id === id); const p = parseCapture(f.q, null); newItem({ title: p.title || f.q.trim(), area: g.area, goalId: g.id, date: p.date, time: p.date ? p.time : null, dur: p.dur }); commit(true); $('#sheet [name=q]')?.focus(); },
  tx: (f, id) => {
    const amount = parseMoney(f.amount); if (!amount) return toast('Informe um valor.');
    const data = { type: f.type, amount, desc: f.desc.trim(), cat: f.cat, date: f.date };
    const x = S.tx.find(t => t.id === id);
    if (x) Object.assign(x, data); else S.tx.push(Object.assign({ id: uid() }, data));
    ui.month = f.date.slice(0, 7); commit();
  },
  bill: (f, id) => {
    const amount = parseMoney(f.amount); if (!amount) return toast('Informe um valor.');
    const data = { title: f.title.trim(), amount, day: Math.min(31, Math.max(1, +f.day || 1)), cat: f.cat };
    const b = S.bills.find(x => x.id === id);
    if (b) Object.assign(b, data); else S.bills.push(Object.assign({ id: uid(), paid: {} }, data));
    commit();
  },
};

function addFromText(text, base, quiet) {
  const p = parseCapture(text, base);
  if (p.kind === 'tx') {
    if (!p.amount) return false;
    S.tx.push({ id: uid(), type: p.type, amount: p.amount, desc: p.desc, cat: p.cat, date: p.date });
    if (!quiet) toast(`${p.type === 'in' ? 'Entrada' : 'Gasto'} de ${brl(p.amount)} em ${p.cat} registrado.`);
    return true;
  }
  if (!p.title) return false;
  newItem({ title: p.title, area: p.area, date: p.date, time: p.date ? p.time : null, dur: p.dur, rec: p.rec });
  if (!quiet) toast(p.date ? `Adicionado: ${p.rec ? recLabel(p.rec) : relLabel(p.date).toLowerCase()}${p.time ? ' às ' + p.time : ''}.` : 'Guardado na Caixa de entrada.');
  return true;
}
function preview() {
  const v = $('#capture-input').value.trim(), box = $('#capture-preview');
  if (!v) { box.hidden = true; return; }
  const p = parseCapture(v, ui.view === 'hoje' ? ui.date : today());
  let chips;
  if (p.kind === 'tx') chips = [`<span class="chip strong">${p.type === 'in' ? '＋ Entrada' : '− Gasto'} ${brl(p.amount)}</span>`, `<span class="chip">${esc(p.cat)}</span>`, `<span class="chip">📅 ${relLabel(p.date)}</span>`];
  else {
    const a = area(p.area);
    chips = [`<span class="chip">${a.emoji} ${a.name}</span>`, `<span class="chip">${p.date ? '📅 ' + relLabel(p.date) : '📥 Caixa de entrada'}</span>`];
    if (p.time && p.date) chips.push(`<span class="chip">🕑 ${p.time}</span>`);
    if (p.dur) chips.push(`<span class="chip">⏱ ${durLabel(p.dur)}</span>`);
    if (p.rec) chips.push(`<span class="chip">↻ ${recLabel(p.rec)}</span>`);
  }
  box.innerHTML = chips.join(''); box.hidden = false;
}

/* ---------- exemplo ---------- */
function seedDemo() {
  const t = today(), y = addDays(t, -1), name = ($('[data-form=welcome] [name=name]')?.value || '').trim();
  S = blank();
  Object.assign(S.settings, { name, onboarded: true, budget: 3500 });
  const g1 = { id: uid(), title: 'Certificação em gestão de projetos', area: 'estudos', deadline: addDays(t, 60) };
  const g2 = { id: uid(), title: 'Reserva de emergência', area: 'financas', deadline: '' };
  S.goals.push(g1, g2);
  const mk = (title, areaId, o = {}) => newItem(Object.assign({ title, area: areaId, date: t }, o));
  const hist = (it, days) => days.forEach(n => { const d = addDays(t, -n); if (occursOn(it, d)) it.doneOn[d] = true; });
  hist(mk('Treino', 'saude', { time: '06:45', dur: 45, rec: { t: 'w', days: [1, 3, 5] }, date: addDays(t, -30) }), [0, 2, 4, 5, 7]);
  hist(mk('Estudar para a certificação', 'estudos', { time: '19:30', dur: 50, rec: { t: 'w', days: [1, 2, 3, 4] }, goalId: g1.id, date: addDays(t, -30) }), [1, 2, 6, 7]);
  hist(mk('Ler 15 minutos', 'pessoal', { rec: { t: 'd' }, date: addDays(t, -30) }), [1, 2, 3, 5, 6]);
  const a = mk('Reunião de alinhamento do projeto', 'trabalho', { time: '09:00', dur: 60 });
  const b = mk('Enviar proposta ao cliente', 'trabalho', { time: '14:00', dur: 90 });
  mk('Buscar as crianças na escola', 'familia', { time: '17:30', dur: 30 });
  const c = mk('Jantar em família, sem telas', 'familia', { time: '20:30', dur: 60 });
  mk('Marcar dentista', 'saude');
  mk('Simulado 1', 'estudos', { goalId: g1.id, date: addDays(t, 3) });
  mk('Cinema com os amigos', 'lazer', { date: addDays(t, 2), time: '20:00' });
  mk('Revisar orçamento do mês', 'financas', { date: addDays(t, 1) });
  mk('Levar o carro na revisão', 'pessoal', { date: y });
  mk('Pesquisar curso de inglês', 'estudos', { date: null });
  [['Responder e-mails', 'trabalho', 1], ['Relatório semanal', 'trabalho', 2], ['Pedalar no parque', 'lazer', 4], ['Ligar para a mãe', 'familia', 3]].forEach(([ti, ar, n]) => mk(ti, ar, { date: addDays(t, -n), done: addDays(t, -n) }));
  S.focus[t] = [a.id, b.id, c.id];
  S.days[y] = { planned: true, closed: true, mood: 4, note: 'Fechei o relatório e ainda deu tempo de brincar com as crianças.' };
  S.days[addDays(t, -2)] = { closed: true, mood: 3, note: 'Dia corrido, mas treinei.' };
  S.days[addDays(t, -3)] = { closed: true, mood: 5, note: 'Almoço com a família.' };
  const ym = t.slice(0, 7), day = pd(t).getDate();
  S.bills.push({ id: uid(), title: 'Aluguel', amount: 1400, day: 5, cat: 'Casa', paid: {} }, { id: uid(), title: 'Internet', amount: 99.9, day, cat: 'Contas', paid: {} }, { id: uid(), title: 'Energia', amount: 210, day: 20, cat: 'Contas', paid: {} });
  const tx = (type, amount, desc, cat, n) => { const d = addDays(t, -n); if (d.startsWith(ym)) S.tx.push({ id: uid(), type, amount, desc, cat, date: d }); };
  tx('in', 5200, 'Salário', 'Salário', day - 1); tx('out', 386.4, 'Compra do mês', 'Mercado', 3); tx('out', 180, 'Gasolina', 'Transporte', 2); tx('out', 64.9, 'Pizza', 'Alimentação', 1); tx('out', 120, 'Farmácia', 'Saúde', 4);
  if (day >= 5) { const x = { id: uid(), type: 'out', amount: 1400, desc: 'Aluguel', cat: 'Casa', date: monthDay(ym, 5) }; S.tx.push(x); S.bills[0].paid[ym] = x.id; }
}

/* ---------- render e eventos ---------- */
const VIEWS = { hoje: viewHoje, semana: viewSemana, vida: viewVida, dinheiro: viewDinheiro, revisao: viewRevisao };
function render() {
  const fresh = !S.settings.onboarded;
  $('.nav').hidden = fresh; $('#capture').hidden = fresh;
  $('#view').innerHTML = fresh ? viewWelcome() : VIEWS[ui.view]();
  document.querySelectorAll('.nav button').forEach(b => { const on = b.dataset.view === ui.view; b.classList.toggle('on', on); if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
}
let toastTimer;
function toast(msg) {
  const el = $('#toast'); el.textContent = msg; el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.hidden = true, 3200);
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]'); if (!el) return;
  const fn = actions[el.dataset.a]; if (fn) fn(el.dataset, el);
});
document.addEventListener('submit', e => {
  e.preventDefault();
  const form = e.target;
  if (form.id === 'capture') {
    const inp = $('#capture-input'); if (!inp.value.trim()) return;
    if (addFromText(inp.value, ui.view === 'hoje' ? ui.date : today())) { inp.value = ''; preview(); save(); render(); }
    return;
  }
  const fn = forms[form.dataset.form];
  if (fn) fn(Object.fromEntries(new FormData(form)), form.dataset.id, form);
});
document.addEventListener('change', e => {
  if (e.target.name === 'rec') { const w = e.target.form.querySelector('[data-weekdays]'); if (w) w.hidden = e.target.value !== 'w'; }
  if (e.target.matches('[data-import]') && e.target.files[0]) {
    e.target.files[0].text().then(txt => {
      const data = JSON.parse(txt);
      if (!data || !Array.isArray(data.items) || !data.settings) throw new Error('formato');
      if (!confirm('Substituir os dados deste aparelho pelo backup?')) return;
      localStorage.setItem(KEY, JSON.stringify(data)); S = load(); save(true); closeSheet(); render(); toast('Backup restaurado.');
    }).catch(() => toast('Este arquivo não é um backup do Eixo.'));
  }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet(); });
$('#capture-input').addEventListener('input', preview);

// "lastSeen" guarda a visita anterior, para acolher quem ficou dias sem abrir
if (S.settings.lastOpen !== today()) { S.settings.lastSeen = S.settings.lastOpen; S.settings.lastOpen = today(); saveLocal(); }
let lastDay = today();
setInterval(() => {
  if (today() !== lastDay) { if (ui.date === lastDay) ui.date = today(); lastDay = today(); }
  if (ui.view === 'hoje' && $('#sheet').hidden && S.settings.onboarded) render();
  if (sync.on && $('#sheet').hidden && !document.hidden) pull();
}, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && $('#sheet').hidden) { render(); if (sync.on) pull(); } });

render();
if (location.protocol.startsWith('http')) pull(true);
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
window.__eixo = { parseCapture };
})();
