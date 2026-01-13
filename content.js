// content.js
const ncode = location.pathname.split('/')[1];
let isPlaying = false;
let config = null;
let targetLines = [];
let userSettings = { rate: 1.2, pitch: 1.0, volume: 1.0 }; // デフォルト値

/**
 * 1. 漢数字変換（千の位まで・音変化対応）
 */
function numberToJapaneseYomi(numStr) {
    const n = parseInt(numStr, 10);
    if (isNaN(n) || n === 0) return n === 0 ? "ぜろ" : numStr;
    const units = ["", "いち", "に", "さん", "よん", "ご", "ろく", "なな", "はち", "きゅう"];
    const positions = ["", "じゅう", "ひゃく", "せん"];
    let result = "";
    let digits = n.toString().split('').map(Number).reverse();
    for (let i = 0; i < digits.length; i++) {
        let d = digits[i];
        let pos = positions[i];
        if (d === 0) continue;
        let yomi = units[d];
        if (d === 1 && i > 0) yomi = ""; 
        if (i === 2) {
            if (d === 3) { yomi = "さん"; pos = "びゃく"; }
            else if (d === 6) { yomi = "ろっ"; pos = "ぴゃく"; }
            else if (d === 8) { yomi = "はっ"; pos = "ぴゃく"; }
        } else if (i === 3) {
            if (d === 3) { yomi = "さん"; pos = "ぜん"; }
            else if (d === 8) { yomi = "はっ"; pos = "せん"; }
        }
        result = yomi + pos + result;
    }
    return result;
}

/**
 * 2. 第n話の置換
 */
function replaceChapterNumbers(text) {
    let t = text.replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
    return t.replace(/第(\d+)話/g, (m, p1) => `だい ${numberToJapaneseYomi(p1)} わ。`);
}

/**
 * 3. 辞書適用と送信
 */
function sendLineToTTS(el, index, isLast, dict, keys) {
    let text = el.innerText.trim();
    if (!text) return;

    let processed = replaceChapterNumbers(text);
    
    // 辞書適用
    keys.forEach(key => {
        processed = processed.split(key).join(dict[key]);
    });

    // 「話」の誤読防止
    processed = processed.replace(/話/g, "わ");

    chrome.runtime.sendMessage({ 
        action: "speak", 
        text: processed, 
        index: index, 
        isLast: isLast,
        settings: userSettings // 設定サイトで保存した値を渡す
    });
}

/**
 * 4. 読み上げ開始（ローカル辞書・設定をロード）
 */
async function startReading() {
    if (!config) await loadConfig();

    // ローカルストレージから「設定」と「この作品のローカル辞書」を取得
    const storageData = await chrome.storage.local.get(['user_settings', ncode, 'common_dict']);
    
    // 設定の更新
    if (storageData.user_settings) {
        userSettings = storageData.user_settings;
    }

    const subtitle = document.querySelector(config.SELECTORS.subtitle);
    const lines = Array.from(document.querySelectorAll('p[id^="L"]')).filter(el => el.innerText.trim().length > 0);
    
    targetLines = subtitle ? [subtitle, ...lines] : lines;
    if (targetLines.length === 0) return;

    updateUI(true);

    // 辞書の統合（優先順位：作品別ローカル > 共通 > 固定）
    const combinedDict = { 
        ...(storageData.common_dict || {}), 
        ...config.FIXED_DICT, 
        ...(storageData[ncode] || {}) 
    };
    const sortedKeys = Object.keys(combinedDict).sort((a, b) => b.length - a.length);

    targetLines.forEach((el, index) => {
        sendLineToTTS(el, index, index === targetLines.length - 1, combinedDict, sortedKeys);
    });
}

/**
 * 5. UI管理
 */
function updateUI(playing) {
    isPlaying = playing;
    const btn = document.getElementById('tss-play-button');
    if (btn) {
        btn.innerText = playing ? "■ 停止" : "▶ TSS再生開始";
        btn.style.backgroundColor = playing ? "#f44336" : "#2196F3";
    }
    if (!playing) clearAllHighlights();
}

function clearAllHighlights() {
    targetLines.forEach(el => { if (el) el.style.backgroundColor = "transparent"; });
}

function highlightLine(index) {
    clearAllHighlights();
    if (targetLines[index]) {
        const el = targetLines[index];
        el.style.backgroundColor = "#fff9c4";
        el.style.transition = "background-color 0.2s";
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

async function loadConfig() {
    try {
        const url = chrome.runtime.getURL('dictionary.json');
        const response = await fetch(url);
        config = await response.json();
    } catch (e) {
        config = { SELECTORS: { subtitle: ".p-novel__title", honbun: ".js-novel-text" }, FIXED_DICT: {} };
    }
}

function createPlayButton() {
    if (document.getElementById('tss-play-button')) return;
    const btn = document.createElement('button');
    btn.id = "tss-play-button";
    btn.style = "position:fixed; bottom:20px; right:20px; z-index:2147483647; padding:15px 25px; border:none; border-radius:50px; cursor:pointer; font-weight:bold; color:white; box-shadow:0 4px 10px rgba(0,0,0,0.3); font-size:16px;";
    document.body.appendChild(btn);
    btn.onclick = () => isPlaying ? (chrome.runtime.sendMessage({action:"stop"}), updateUI(false)) : startReading();
    updateUI(false);
}

// メッセージ待機（行完了通知）
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "lineCompleted") {
        highlightLine(msg.index + 1);
        if (msg.isLast) updateUI(false);
    }
});

// 初期化
(async () => {
    await loadConfig();
    createPlayButton();

    // 既存のルビ学習（ローカル辞書への自動登録）
    const data = await chrome.storage.local.get(ncode);
    let dict = data[ncode] || {};
    let updated = false;
    document.querySelectorAll('ruby').forEach(r => {
        const k = r.childNodes[0]?.textContent?.trim();
        const y = r.querySelector('rt')?.textContent?.trim();
        if (k && y && dict[k] !== y) { dict[k] = y; updated = true; }
    });
    if (updated) await chrome.storage.local.set({ [ncode]: dict });
})();