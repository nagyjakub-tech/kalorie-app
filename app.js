// ---- Storage helpers -------------------------------------------------

const STORAGE_KEY = 'kalorie_entries_v1';
const GOAL_KEY = 'kalorie_goal_v1';

function loadEntries() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function loadGoal() {
  return Number(localStorage.getItem(GOAL_KEY)) || 2000;
}

function saveGoal(goal) {
  localStorage.setItem(GOAL_KEY, String(goal));
}

function dateKey(ts) {
  const d = new Date(ts);
  return d.toISOString().slice(0, 10);
}

function todayKey() {
  return dateKey(Date.now());
}

// ---- Image handling ----------------------------------------------------

function resizeImage(file, maxDim, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => { img.src = reader.result; };
    reader.onerror = reject;
    img.onload = () => {
      let { width, height } = img;
      if (width > height && width > maxDim) {
        height = Math.round(height * (maxDim / width));
        width = maxDim;
      } else if (height > maxDim) {
        width = Math.round(width * (maxDim / height));
        height = maxDim;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ---- App state -----------------------------------------------------

let entries = loadEntries();
let goal = loadGoal();
let pendingFullImage = null; // dataURL used for API call
let pendingThumb = null;     // smaller dataURL stored in history
let lastResult = null;

// ---- DOM refs --------------------------------------------------------

const $ = (id) => document.getElementById(id);

const todayKcalEl = $('todayKcal');
const goalLabelEl = $('goalLabel');
const ringFg = $('ringFg');
const todayProteinEl = $('todayProtein');
const todayCarbsEl = $('todayCarbs');
const todayFatEl = $('todayFat');
const weekChartEl = $('weekChart');
const todayListEl = $('todayList');
const historyListEl = $('historyList');

const fabBtn = $('fabBtn');
const fileInput = $('fileInput');
const analyzeModal = $('analyzeModal');
const previewImg = $('previewImg');
const analyzeStatus = $('analyzeStatus');
const resultForm = $('resultForm');
const errorBox = $('errorBox');
const errorText = $('errorText');
const resName = $('resName');
const resKcal = $('resKcal');
const resProtein = $('resProtein');
const resCarbs = $('resCarbs');
const resFat = $('resFat');
const resNote = $('resNote');

const settingsBtn = $('settingsBtn');
const settingsModal = $('settingsModal');
const goalInput = $('goalInput');

// ---- Rendering ---------------------------------------------------------

const RING_CIRC = 264;

function render() {
  const tKey = todayKey();
  const todays = entries.filter(e => dateKey(e.ts) === tKey);
  const totals = sumEntries(todays);

  todayKcalEl.textContent = Math.round(totals.kcal);
  goalLabelEl.textContent = goal;
  todayProteinEl.textContent = Math.round(totals.protein);
  todayCarbsEl.textContent = Math.round(totals.carbs);
  todayFatEl.textContent = Math.round(totals.fat);

  const pct = Math.min(1, totals.kcal / goal || 0);
  ringFg.style.strokeDashoffset = String(RING_CIRC * (1 - pct));

  renderList(todayListEl, todays, 'Zatiaľ žiadny záznam. Odfoť jedlo tlačidlom nižšie 👇');
  renderHistory();
  renderWeekChart();
}

function sumEntries(list) {
  return list.reduce((acc, e) => {
    acc.kcal += e.kcal || 0;
    acc.protein += e.protein || 0;
    acc.carbs += e.carbs || 0;
    acc.fat += e.fat || 0;
    return acc;
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0 });
}

function renderList(container, list, emptyText) {
  container.innerHTML = '';
  if (list.length === 0) {
    const p = document.createElement('p');
    p.className = 'empty-hint';
    p.textContent = emptyText;
    container.appendChild(p);
    return;
  }
  list.slice().sort((a, b) => b.ts - a.ts).forEach(e => {
    container.appendChild(renderEntryItem(e));
  });
}

function renderEntryItem(e) {
  const div = document.createElement('div');
  div.className = 'entry-item';

  const img = document.createElement('img');
  img.className = 'entry-thumb';
  img.src = e.thumb;
  img.alt = e.name;

  const info = document.createElement('div');
  info.className = 'entry-info';
  const name = document.createElement('div');
  name.className = 'entry-name';
  name.textContent = e.name;
  const meta = document.createElement('div');
  meta.className = 'entry-meta';
  const time = new Date(e.ts).toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' });
  meta.textContent = `${time} · B ${Math.round(e.protein)} / S ${Math.round(e.carbs)} / T ${Math.round(e.fat)} g`;
  info.appendChild(name);
  info.appendChild(meta);

  const kcal = document.createElement('div');
  kcal.className = 'entry-kcal';
  kcal.textContent = `${Math.round(e.kcal)} kcal`;

  const del = document.createElement('button');
  del.className = 'entry-del';
  del.textContent = '✕';
  del.setAttribute('aria-label', 'Zmazať záznam');
  del.onclick = () => deleteEntry(e.id);

  const right = document.createElement('div');
  right.style.display = 'flex';
  right.style.alignItems = 'center';
  right.appendChild(kcal);
  right.appendChild(del);

  div.appendChild(img);
  div.appendChild(info);
  div.appendChild(right);
  return div;
}

function renderHistory() {
  const tKey = todayKey();
  const older = entries.filter(e => dateKey(e.ts) !== tKey);
  historyListEl.innerHTML = '';
  if (older.length === 0) {
    const p = document.createElement('p');
    p.className = 'empty-hint';
    p.textContent = 'Žiadna staršia história.';
    historyListEl.appendChild(p);
    return;
  }
  const byDay = {};
  older.forEach(e => {
    const k = dateKey(e.ts);
    (byDay[k] = byDay[k] || []).push(e);
  });
  Object.keys(byDay).sort((a, b) => b.localeCompare(a)).forEach(day => {
    const label = document.createElement('div');
    label.className = 'history-day-label';
    const dayTotals = sumEntries(byDay[day]);
    label.textContent = `${formatDayLabel(day)} · ${Math.round(dayTotals.kcal)} kcal`;
    historyListEl.appendChild(label);
    byDay[day].sort((a, b) => b.ts - a.ts).forEach(e => {
      historyListEl.appendChild(renderEntryItem(e));
    });
  });
}

function formatDayLabel(dayKey) {
  const d = new Date(dayKey + 'T00:00:00');
  return d.toLocaleDateString('sk-SK', { weekday: 'short', day: 'numeric', month: 'numeric' });
}

function renderWeekChart() {
  weekChartEl.innerHTML = '';
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(dateKey(d.getTime()));
  }
  const maxVal = Math.max(goal, ...days.map(k => sumEntries(entries.filter(e => dateKey(e.ts) === k)).kcal), 1);
  days.forEach(k => {
    const total = sumEntries(entries.filter(e => dateKey(e.ts) === k)).kcal;
    const wrap = document.createElement('div');
    wrap.className = 'week-bar-wrap';
    const bar = document.createElement('div');
    bar.className = 'week-bar' + (total > goal ? ' over' : '');
    const h = Math.max(3, Math.round((total / maxVal) * 74));
    bar.style.height = h + 'px';
    const label = document.createElement('div');
    label.className = 'week-day-label';
    label.textContent = new Date(k + 'T00:00:00').toLocaleDateString('sk-SK', { weekday: 'narrow' });
    wrap.appendChild(bar);
    wrap.appendChild(label);
    weekChartEl.appendChild(wrap);
  });
}

// ---- Entry actions -------------------------------------------------

function deleteEntry(id) {
  entries = entries.filter(e => e.id !== id);
  saveEntries(entries);
  render();
}

function addEntry(data) {
  entries.push({
    id: 'e' + Date.now() + Math.random().toString(36).slice(2, 7),
    ts: Date.now(),
    thumb: pendingThumb,
    name: data.name,
    kcal: data.kcal,
    protein: data.protein,
    carbs: data.carbs,
    fat: data.fat,
  });
  saveEntries(entries);
  render();
}

// ---- Photo capture + analysis flow -------------------------------------

fabBtn.onclick = () => fileInput.click();

fileInput.onchange = async () => {
  const file = fileInput.files[0];
  fileInput.value = '';
  if (!file) return;

  openAnalyzeModal();
  showAnalyzing();

  try {
    const [fullImg, thumb] = await Promise.all([
      resizeImage(file, 1024, 0.7),
      resizeImage(file, 300, 0.55),
    ]);
    pendingFullImage = fullImg;
    pendingThumb = thumb;
    previewImg.src = thumb;
    await runAnalysis(fullImg);
  } catch (err) {
    showError('Nepodarilo sa spracovať fotku. Skús to znova.');
    console.error(err);
  }
};

async function runAnalysis(imageDataUrl) {
  showAnalyzing();
  try {
    const base64 = imageDataUrl.split(',')[1];
    const res = await fetch('/api/estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64, mimeType: 'image/jpeg' }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`API error ${res.status}: ${t}`);
    }
    const data = await res.json();
    lastResult = data;
    showResult(data);
  } catch (err) {
    console.error(err);
    showError('Analýza sa nepodarila. Skontroluj internet a skús znova.');
  }
}

function openAnalyzeModal() {
  analyzeModal.classList.remove('hidden');
}
function closeAnalyzeModal() {
  analyzeModal.classList.add('hidden');
  pendingFullImage = null;
  pendingThumb = null;
  lastResult = null;
}

function showAnalyzing() {
  analyzeStatus.classList.remove('hidden');
  resultForm.classList.add('hidden');
  errorBox.classList.add('hidden');
}

function showResult(data) {
  analyzeStatus.classList.add('hidden');
  errorBox.classList.add('hidden');
  resultForm.classList.remove('hidden');

  resName.value = data.name || 'Jedlo';
  resKcal.value = Math.round(data.calories || 0);
  resProtein.value = Math.round(data.protein_g || 0);
  resCarbs.value = Math.round(data.carbs_g || 0);
  resFat.value = Math.round(data.fat_g || 0);
  resNote.textContent = data.note ? `ℹ️ ${data.note}` : 'Hodnoty sú odhad z fotky — pred uložením ich môžeš upraviť.';
}

function showError(msg) {
  analyzeStatus.classList.add('hidden');
  resultForm.classList.add('hidden');
  errorBox.classList.remove('hidden');
  errorText.textContent = msg;
}

$('cancelBtn').onclick = closeAnalyzeModal;
$('errorCancelBtn').onclick = closeAnalyzeModal;
$('retryBtn').onclick = () => { if (pendingFullImage) runAnalysis(pendingFullImage); };

$('saveBtn').onclick = () => {
  addEntry({
    name: resName.value.trim() || 'Jedlo',
    kcal: Number(resKcal.value) || 0,
    protein: Number(resProtein.value) || 0,
    carbs: Number(resCarbs.value) || 0,
    fat: Number(resFat.value) || 0,
  });
  closeAnalyzeModal();
};

// ---- Settings -------------------------------------------------------

settingsBtn.onclick = () => {
  goalInput.value = goal;
  settingsModal.classList.remove('hidden');
};
$('settingsCloseBtn').onclick = () => settingsModal.classList.add('hidden');
$('settingsSaveBtn').onclick = () => {
  const v = Number(goalInput.value);
  if (v > 0) {
    goal = v;
    saveGoal(goal);
    render();
  }
  settingsModal.classList.add('hidden');
};
$('clearHistoryBtn').onclick = () => {
  if (confirm('Naozaj vymazať celú históriu záznamov? Táto akcia sa nedá vrátiť späť.')) {
    entries = [];
    saveEntries(entries);
    render();
    settingsModal.classList.add('hidden');
  }
};

// ---- Service worker ---------------------------------------------------

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(console.error);
  });
}

// ---- Init --------------------------------------------------------------

render();
