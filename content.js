// content.js - V1.3.1 行削れ修正・究極レスポンス版
const ncode = location.pathname.split('/')[1];
let isPlaying = false, isPaused = false, currentIdx = 0, config = null, targetLines = [];

chrome.runtime.onMessage.addListener((m) => {
    if (m.action === "lineCompleted") {
        currentIdx = m.index + 1;
        highlightLine(currentIdx);
        if (m.isLast) stopReading();
    }
    if (m.action === "openQuickDic") showTssModal(m.word);
});

document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
    if (e.code === 'ArrowRight') { e.preventDefault(); jumpTo(currentIdx + 1); }
    if (e.code === 'ArrowLeft') { e.preventDefault(); jumpTo(currentIdx - 1); }
});

function jumpTo(idx) {
    if (idx >= 0 && idx < targetLines.length) {
        chrome.runtime.sendMessage({ action: "stop" });
        currentIdx = idx;
        // 1msを狙う即時キューイング
        setTimeout(() => startReading(currentIdx), 0);
    }
}

async function startReading(startIndex = 0) {
    if (!config) await loadConfig();
    const data = await chrome.storage.local.get(['user_settings', ncode, 'common_dict']);
    const settings = data.user_settings || { rate: 1.2, pitch: 1.0, volume: 1.0 };

    // 全ての本文行(L1, L2...)を取得し、空行を除外。削れがないよう再取得を徹底
    const lines = Array.from(document.querySelectorAll('p[id^="L"]')).filter(el => el.innerText.trim().length > 0);
    const subtitle = document.querySelector(config.SELECTORS?.subtitle);
    
    // タイトルがある場合は配列の先頭に追加。ここがstartIndex=0になる
    targetLines = subtitle ? [subtitle, ...lines] : lines;
    
    if (targetLines.length === 0 || startIndex >= targetLines.length) return;
    
    currentIdx = startIndex;
    updateUI(true, false);

    const dict = { ...(data.common_dict || {}), ...config.FIXED_DICT, ...(data[ncode] || {}) };
    const keys = Object.keys(dict).sort((a, b) => b.length - a.length);

    // ループの開始位置をstartIndex(通常は0)に固定
    for (let i = startIndex; i < targetLines.length; i++) {
        let txt = targetLines[i].innerText.trim();
        txt = txt.replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
        keys.forEach(k => txt = txt.split(k).join(dict[k]));
        
        chrome.runtime.sendMessage({ 
            action: "speak", 
            text: txt, 
            index: i, 
            isLast: i === targetLines.length - 1, 
            settings 
        });
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

function showTssModal(selectedWord) {
    if (document.getElementById('tss-modal')) document.getElementById('tss-modal').remove();
    const modal = document.createElement('div');
    modal.id = 'tss-modal';
    modal.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:2147483647; display:flex; align-items:center; justify-content:center; font-family:sans-serif;";
    modal.innerHTML = `
        <div style="background:white; padding:24px; border-radius:12px; width:340px; box-shadow:0 15px 35px rgba(0,0,0,0.4);">
            <h3 style="margin:0 0 15px 0; color:#2196F3; font-size:18px;">TSS 辞書登録</h3>
            <input type="text" id="tss-w" value="${selectedWord}" style="width:100%; padding:8px; margin-bottom:12px; border:1px solid #ddd; border-radius:4px; box-sizing:border-box;">
            <input type="text" id="tss-y" placeholder="よみがなを入力" style="width:100%; padding:8px; margin-bottom:20px; border:1px solid #ddd; border-radius:4px; box-sizing:border-box;">
            <div style="display:flex; gap:10px;">
                <button id="tss-save" style="flex:2; background:#2196F3; color:white; border:none; padding:10px; border-radius:6px; cursor:pointer; font-weight:bold;">登録</button>
                <button id="tss-cancel" style="flex:1; background:#eee; border:none; padding:10px; border-radius:6px; cursor:pointer;">閉じる</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
    const yInput = document.getElementById('tss-y');
    yInput.focus();
    document.getElementById('tss-save').onclick = async () => {
        const w = document.getElementById('tss-w').value.trim(), y = yInput.value.trim();
        if (w && y) {
            const data = await chrome.storage.local.get('common_dict');
            const dict = data.common_dict || {};
            dict[w] = y;
            await chrome.storage.local.set({ common_dict: dict });
            modal.remove();
            if (isPlaying) jumpTo(currentIdx);
        }
    };
    document.getElementById('tss-cancel').onclick = () => modal.remove();
}

function updateUI(playing, paused = false) {
    isPlaying = playing; isPaused = paused;
    const btn = document.getElementById('tss-play-button');
    if (btn) {
        if (!playing) { btn.innerText = "▶ TSS再生開始"; btn.style.backgroundColor = "#2196F3"; }
        else if (paused) { btn.innerText = "⏵ 再開"; btn.style.backgroundColor = "#4CAF50"; }
        else { btn.innerText = "⏸ 一時停止"; btn.style.backgroundColor = "#f44336"; }
    }
    if (!playing) clearHighlights();
}

function createController() {
    if (document.getElementById('tss-controller')) return;
    const container = document.createElement('div');
    container.id = "tss-controller";
    container.style = "position:fixed; bottom:20px; right:20px; z-index:2147483646;";
    container.innerHTML = `<button id="tss-play-button" style="color:white; background-color:#2196F3; border:none; padding:12px 24px; border-radius:4px; cursor:pointer; font-size:16px; font-weight:bold; box-shadow:0 4px 10px rgba(0,0,0,0.3);">▶ TSS再生開始</button>`;
    document.body.appendChild(container);
    document.getElementById('tss-play-button').onclick = togglePlay;
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

(async () => {
    await loadConfig();
    createController();
    const data = await chrome.storage.local.get('auto_play_enabled');
    if (data.auto_play_enabled) setTimeout(() => startReading(0), 1000);
})();