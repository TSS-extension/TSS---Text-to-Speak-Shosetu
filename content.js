// content.js
const ncode = location.pathname.split('/')[1];
let isPlaying = false;
let config = null;
let targetLines = [];

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
        if (i === 2) { // 百の位の音変化
            if (d === 3) { yomi = "さん"; pos = "びゃく"; }
            else if (d === 6) { yomi = "ろっ"; pos = "ぴゃく"; }
            else if (d === 8) { yomi = "はっ"; pos = "ぴゃく"; }
        } else if (i === 3) { // 千の位の音変化
            if (d === 3) { yomi = "さん"; pos = "ぜん"; }
            else if (d === 8) { yomi = "はっ"; pos = "せん"; }
        }
        result = yomi + pos + result;
    }
    return result;
}

/**
 * 2. 第n話の置換（「話」を消し去り「わ」に固定）
 */
function replaceChapterNumbers(text) {
    let t = text.replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
    // 漢字の「第」と「話」をここで完全に平仮名へ変換する
    return t.replace(/第(\d+)話/g, (m, p1) => {
        return `だい ${numberToJapaneseYomi(p1)} わ。`;
    });
}

/**
 * 3. 1行を整形して送信（ここが最重要：漢字の「話」を抹殺）
 */
function sendLineToTTS(el, index, isLast, dict, keys) {
    let text = el.innerText.trim();
    if (!text) return;

    // A. 第n話を「だい...わ」に変換
    let processed = replaceChapterNumbers(text);
    
    // B. 辞書適用（作品別・固定辞書）
    keys.forEach(key => {
        processed = processed.split(key).join(dict[key]);
    });

    // C. 【徹底防御】文中に残った単独の「話」をすべて「わ」に変換
    // これにより、TTSが「はなし」と読む余地をゼロにする
    processed = processed.replace(/話/g, "わ");

    chrome.runtime.sendMessage({ 
        action: "speak", 
        text: processed, 
        index: index, 
        isLast: isLast 
    });
}

/**
 * 4. 読み上げ開始
 */
async function startReading() {
    if (!config) await loadConfig();
    
    const subtitle = document.querySelector(config.SELECTORS.subtitle);
    const lines = Array.from(document.querySelectorAll('p[id^="L"]')).filter(el => el.innerText.trim().length > 0);
    
    targetLines = subtitle ? [subtitle, ...lines] : lines;
    if (targetLines.length === 0) return;

    updateUI(true);

    const [localRes, commonRes] = await Promise.all([
        chrome.storage.local.get(ncode),
        chrome.storage.local.get('common_dict')
    ]);
    const combinedDict = { ...(commonRes.common_dict || {}), ...config.FIXED_DICT, ...(localRes[ncode] || {}) };
    const sortedKeys = Object.keys(combinedDict).sort((a, b) => b.length - a.length);

    targetLines.forEach((el, index) => {
        sendLineToTTS(el, index, index === targetLines.length - 1, combinedDict, sortedKeys);
    });
}

/**
 * 5. UI管理 & ハイライト
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

// 初期設定読み込み
async function loadConfig() {
    try {
        const url = chrome.runtime.getURL('dictionary.json');
        const response = await fetch(url);
        config = await response.json();
    } catch (e) {
        config = { SELECTORS: { subtitle: ".p-novel__title", honbun: ".js-novel-text" }, FIXED_DICT: {} };
    }
}

// ボタン生成
function createPlayButton() {
    if (document.getElementById('tss-play-button')) return;
    const btn = document.createElement('button');
    btn.id = "tss-play-button";
    btn.style = "position:fixed; bottom:20px; right:20px; z-index:2147483647; padding:15px 25px; border:none; border-radius:50px; cursor:pointer; font-weight:bold; color:white; box-shadow:0 4px 10px rgba(0,0,0,0.3); font-size:16px;";
    document.body.appendChild(btn);
    btn.onclick = () => isPlaying ? (chrome.runtime.sendMessage({action:"stop"}), updateUI(false)) : startReading();
    updateUI(false);
}

// イベントリスナー
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "lineCompleted") {
        highlightLine(msg.index + 1);
        if (msg.isLast) updateUI(false);
    }
});

// 起動
(async () => {
    await loadConfig();
    createPlayButton();
    // ルビ学習（既存のロジック）
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