/* ============================================================
   osu!taiko Mono Checker — script.js
   同色4連以上のパターンを検出する
   ============================================================ */

const fileInput  = document.getElementById('fileInput');
const browseBtn  = document.getElementById('browseBtn');
const uploadZone = document.getElementById('uploadZone');
const infoSection   = document.getElementById('infoSection');
const resultSection = document.getElementById('resultSection');
const infoTitle  = document.getElementById('infoTitle');
const infoArtist = document.getElementById('infoArtist');
const infoDiff   = document.getElementById('infoDiff');
const infoNotes  = document.getElementById('infoNotes');
const resultCount= document.getElementById('resultCount');
const resultOk   = document.getElementById('resultOk');
const resultList = document.getElementById('resultList');

// ── ファイル選択 UI ──────────────────────────────────────────
browseBtn.addEventListener('click', () => fileInput.click());
uploadZone.addEventListener('click', (e) => {
  if (e.target !== browseBtn) fileInput.click();
});

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) processFile(fileInput.files[0]);
});

// ── ドラッグ&ドロップ ────────────────────────────────────────
uploadZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadZone.classList.add('drag-over');
});

uploadZone.addEventListener('dragleave', () => {
  uploadZone.classList.remove('drag-over');
});

uploadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.name.endsWith('.osu')) {
    processFile(file);
  } else {
    alert('Only .osu files are supported');
  }
});

// ── メイン処理 ───────────────────────────────────────────────
function processFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    // \r\n (CRLF) → \n に正規化してから処理
    const content = e.target.result.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const meta    = parseMetadata(content);
    const notes   = parseHitObjects(content);
    const matches = findMonoRuns(notes, 4);

    renderInfo(meta, notes.length);
    renderResults(matches);
  };
  reader.readAsText(file);
}

// ── .osu メタデータ解析 ──────────────────────────────────────
function parseMetadata(content) {
  const get = (key) => {
    const m = content.match(new RegExp(`^${key}:(.*)`, 'm'));
    return m ? m[1].trim() : '—';
  };
  return {
    title:      get('Title'),
    artist:     get('Artist'),
    difficulty: get('Version'),
  };
}

// ── HitObjects 解析 ──────────────────────────────────────────
/**
 * osu!taiko の HitObjects を読んで {time, color} の配列を返す。
 *
 * HitObject フォーマット:
 *   x,y,time,type,hitSound[,objectParams][,hitSample]
 *
 * type ビット:
 *   bit0 (1) = HitCircle
 *   bit1 (2) = Slider (ドラムロール) → スキップ
 *   bit3 (8) = Spinner → スキップ
 *
 * hitSound ビット:
 *   bit1 (2) = Whistle → KAT
 *   bit3 (8) = Clap    → KAT
 *   それ以外           → DON
 */
function parseHitObjects(content) {
  const notes = [];
  const section = content.split(/\[HitObjects\]/i)[1];
  if (!section) return notes;

  const lines = section.split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    // 別セクション開始で終了
    if (line.startsWith('[')) break;
    // 空行・コメントはスキップ（breakしない）
    if (!line || line.startsWith('//')) continue;

    const parts = line.split(',');
    if (parts.length < 5) continue;

    const time     = parseInt(parts[2], 10);
    const type     = parseInt(parts[3], 10);
    const hitSound = parseInt(parts[4], 10);

    if (isNaN(time) || isNaN(type) || isNaN(hitSound)) continue;

    // Slider / Spinner は除外
    if (type & 2) continue;
    if (type & 8) continue;

    // kat 判定: Whistle(2) または Clap(8)
    const color = (hitSound & 2) || (hitSound & 8) ? 'k' : 'd';

    notes.push({ time, color });
  }

  notes.sort((a, b) => a.time - b.time);
  return notes;
}

// ── 同色連続ラン検出 ─────────────────────────────────────────
/**
 * notes 配列から、同じ color が minRun 回以上連続する区間をすべて返す。
 * 戻り値: Array<{ startTime, endTime, color, length, timestamp }>
 */
function findMonoRuns(notes, minRun = 4) {
  const results = [];
  let i = 0;

  while (i < notes.length) {
    let j = i + 1;
    while (j < notes.length && notes[j].color === notes[i].color) {
      j++;
    }
    const len = j - i;
    if (len >= minRun) {
      results.push({
        startTime: notes[i].time,
        endTime:   notes[j - 1].time,
        color:     notes[i].color,
        length:    len,
        timestamp: msToTimestamp(notes[i].time),
      });
    }
    i = j;
  }

  return results;
}

// ── ms → タイムスタンプ変換 ─────────────────────────────────
function msToTimestamp(ms) {
  const sign    = ms < 0 ? '-' : '';
  const abs     = Math.abs(ms);
  const minutes = Math.floor(abs / 60000);
  const seconds = Math.floor((abs % 60000) / 1000);
  const millis  = abs % 1000;
  return `${sign}${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(millis).padStart(3, '0')}`;
}

// ── UI 描画: メタ情報 ────────────────────────────────────────
function renderInfo(meta, noteCount) {
  infoTitle.textContent  = meta.title;
  infoArtist.textContent = meta.artist;
  infoDiff.textContent   = meta.difficulty;
  infoNotes.textContent  = `${noteCount.toLocaleString()} notes`;
  infoSection.hidden = false;
}

// ── UI 描画: 結果 ────────────────────────────────────────────
function renderResults(matches) {
  resultSection.hidden = false;
  resultOk.hidden    = true;
  resultList.hidden  = true;
  resultList.innerHTML = '';

  if (matches.length === 0) {
    resultCount.textContent = '';
    resultOk.hidden = false;
    return;
  }

  resultCount.textContent = `${matches.length} found`;

  for (const m of matches) {
    const item = document.createElement('div');
    item.className = `result-item is-${m.color === 'd' ? 'don' : 'kat'}`;

    // タイムスタンプ
    const ts = document.createElement('div');
    ts.className = 'result-ts';
    ts.textContent = m.timestamp;

    // ノートチップ列（最大8個 + more表示）
    const pattern = document.createElement('div');
    pattern.className = 'result-pattern';

    const displayMax = 8;
    const showCount  = Math.min(m.length, displayMax);
    for (let n = 0; n < showCount; n++) {
      const chip = document.createElement('div');
      chip.className = `note-chip ${m.color}`;
      chip.textContent = m.color;
      pattern.appendChild(chip);
    }
    if (m.length > displayMax) {
      const more = document.createElement('div');
      more.className = 'note-chip more';
      more.textContent = `+${m.length - displayMax}`;
      pattern.appendChild(more);
    }

    // メタ
    const meta = document.createElement('div');
    meta.className = 'result-meta';
    const runLenEl = document.createElement('span');
    runLenEl.className = `run-len is-${m.color === 'd' ? 'don' : 'kat'}`;
    runLenEl.textContent = `${m.length}x ${m.color === 'd' ? 'DON' : 'KAT'}`;
    meta.appendChild(runLenEl);

    item.append(ts, pattern, meta);
    resultList.appendChild(item);
  }

  resultList.hidden = false;
}
