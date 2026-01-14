// content.js - V1.2 (Stability + New Features)
const ncode = location.pathname.split('/')[1];
let isPlaying = false, isPaused = false, currentIdx = 0, config = null, targetLines = [];

// --- 1. キーボード操作 (行スキップ・ポーズ) ---
document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
    if (e.code === 'ArrowRight') { e.preventDefault(); jumpTo(currentIdx + 1); }
    if (e.code === 'ArrowLeft') { e.preventDefault(); jumpTo(currentIdx - 1); }
});

// --- 2. UI制御 (ポーズボタン対応) ---
function updateUI(playing, paused = false) {
    isPlaying = playing;
    isPaused = paused;
    const btn = document.getElementById('tss-play-button');
    if (btn) {
        if (!playing) {
            btn.innerText = "▶ TSS再生開始";
            btn.style.backgroundColor = "#2196F3";
        } else if (paused) {
            btn.innerText = "⏵ 再開";
            btn.style.backgroundColor = "#4CAF50";
        } else {
            btn.innerText = "⏸ 一時停止";
            btn.style.backgroundColor = "#f44336";
        }
    }
    if (!playing) clearHighlights();
}

function createController() {
    if (document.getElementById('tss-controller')) return;
    const container = document.createElement('div');
    container.id = "tts-controller";
    container.style = "position:fixed; bottom:20px; right:20px; z-index:2147483647;";
    container.innerHTML = `<button id="tss-play-button" style="color:white; background-color:#2196F3; border:none; padding:12px 24px; border-radius:4px; cursor:pointer; font-size:16px; font-weight:bold; box-shadow:0 4px 10px rgba(0,0,0,0.3);">▶ TSS再生開始</button>`;
    document.body.appendChild(container);
    document.getElementById('tss-play-button').onclick = togglePlay;
}

// --- 3. 再生ロジック (自動再生・一時停止対応) ---
async function startReading(startIndex = 0) {
    if (!config) await loadConfig();
    const data = await chrome.storage.local.get(['user_settings', ncode, 'common_dict']);
    const settings = data.user_settings || { rate: 1.2, pitch: 1.0, volume: 1.0 };

    const lines = Array.from(document.querySelectorAll('p[id^="L"]')).filter(el => el.innerText.trim().length > 0);
    const subtitle = document.querySelector(config.SELECTORS?.subtitle);
    targetLines = subtitle ? [subtitle, ...lines] : lines;
    
    if (targetLines.length === 0) return;
    currentIdx = startIndex;
    updateUI(true, false);

    const dict = { ...(data.common_dict || {}), ...config.FIXED_DICT, ...(data[ncode] || {}) };
    const keys = Object.keys(dict).sort((a, b) => b.length - a.length);

    for (let i = startIndex; i < targetLines.length; i++) {
        let txt = targetLines[i].innerText.trim();
        txt = txt.replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
        keys.forEach(k => txt = txt.split(k).join(dict[k]));
        chrome.runtime.sendMessage({ action: "speak", text: txt, index: i, isLast: i === targetLines.length - 1, settings });
    }
    highlightLine(startIndex);
}

function togglePlay() {
    if (!isPlaying) {
        startReading(currentIdx);
    } else if (!isPaused) {
        chrome.runtime.sendMessage({ action: "pause" });
        updateUI(true, true);
    } else {
        chrome.runtime.sendMessage({ action: "resume" });
        updateUI(true, false);
    }
}

function stopReading() {
    chrome.runtime.sendMessage({ action: "stop" });
    updateUI(false);
}

function jumpTo(idx) {
    if (idx >= 0 && idx < targetLines.length) {
        stopReading();
        startReading(idx);
    }
}

async function loadConfig() {
    try {
        const response = await fetch(chrome.runtime.getURL('dictionary.json'));
        config = await response.json();
    } catch (e) { config = { SELECTORS: { subtitle: ".p-novel__title" }, FIXED_DICT: {} }; }
}

function highlightLine(idx) {
    clearHighlights();
    if (targetLines[idx]) {
        targetLines[idx].style.backgroundColor = "#fff9c4";
        targetLines[idx].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}
function clearHighlights() { targetLines.forEach(el => { if(el) el.style.backgroundColor = "transparent"; }); }

chrome.runtime.onMessage.addListener((m) => {
    if (m.action === "lineCompleted") {
        currentIdx = m.index + 1;
        highlightLine(currentIdx);
        if (m.isLast) stopReading();
    }
});

// 初期化（自動再生対応）
(async () => {
    await loadConfig();
    createController();
    const data = await chrome.storage.local.get('auto_play_enabled');
    if (data.auto_play_enabled) setTimeout(() => startReading(0), 1000);
})();