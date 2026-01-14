// options.js - V1.2 OSS Final Complete Version
// 統合機能: プリセット(デフォルト重複防止・ホバー表示・検索連動), 辞書(検索・入出力), 自動再生

const configs = [
    { range: 'rateRange', num: 'rateNum', key: 'rate', def: 1.2 },
    { range: 'pitchRange', num: 'pitchNum', key: 'pitch', def: 1.0 },
    { range: 'volRange', num: 'volNum', key: 'volume', def: 1.0 }
];

const DEFAULT_DATA = { rate: 1.2, pitch: 1.0, volume: 1.0 };

// --- 1. 初期化処理 ---
document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.local.get(['user_settings', 'presets', 'auto_play_enabled'], (data) => {
        // 設定値の反映
        if (data.user_settings) {
            applyValues(data.user_settings);
        }
        // カスタムプリセットの描画
        if (data.presets) {
            renderPresets(data.presets);
        }
        // 自動再生チェックボックス
        if (document.getElementById('autoPlay')) {
            document.getElementById('autoPlay').checked = !!data.auto_play_enabled;
        }
        
        // デフォルトボタンのツールチップ設定
        const defBtn = document.getElementById('p-default');
        if (defBtn) {
            defBtn.title = getSettingsTooltip(DEFAULT_DATA);
            defBtn.onclick = () => applyValues(DEFAULT_DATA);
        }
    });
    refreshDicTable();
});

// --- 2. タブ切り替え ---
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.tab-btn, .content-section').forEach(el => el.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.target).classList.add('active');
    };
});

// --- 3. スライダー & 数値入力の同期 ---
configs.forEach(c => {
    const rangeEl = document.getElementById(c.range);
    const numEl = document.getElementById(c.num);
    if (rangeEl && numEl) {
        rangeEl.oninput = () => { numEl.value = rangeEl.value; };
        numEl.oninput = () => {
            let val = parseFloat(numEl.value);
            if (val > 10.0) val = 10.0;
            if (val < 0.1) val = 0.1;
            rangeEl.value = val > 3.0 ? 3.0 : val;
        };
    }
});

function applyValues(settings) {
    configs.forEach(c => {
        const val = settings[c.key] || c.def;
        const numEl = document.getElementById(c.num);
        const rangeEl = document.getElementById(c.range);
        if (numEl) numEl.value = val;
        if (rangeEl) rangeEl.value = (val > 3.0) ? 3.0 : val;
    });
}

// --- 4. プリセット機能 (完全重複防止・検索連動・ホバー表示) ---

function getSettingsTooltip(p) {
    return `速度: ${parseFloat(p.rate).toFixed(1)} / ピッチ: ${parseFloat(p.pitch).toFixed(1)} / 音量: ${parseFloat(p.volume).toFixed(1)}`;
}

// 検索ボックス：辞書だけでなくプリセットボタンもフィルタリング
const dicSearch = document.getElementById('dicSearch');
if (dicSearch) {
    dicSearch.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        
        // デフォルトボタンの検索
        const defBtn = document.getElementById('p-default');
        if (defBtn) {
            const isMatch = "デフォルト".includes(query) || "default".includes(query) || defBtn.title.toLowerCase().includes(query);
            defBtn.style.display = isMatch ? "" : "none";
        }
        
        // カスタムプリセットボタンの検索
        document.querySelectorAll('#p-custom-list .p-btn').forEach(btn => {
            const isMatch = btn.innerText.toLowerCase().includes(query) || btn.title.toLowerCase().includes(query);
            btn.style.display = isMatch ? "" : "none";
        });

        // 辞書テーブルの更新
        refreshDicTable(query);
    });
}

document.getElementById('p-add').onclick = () => {
    const rate = parseFloat(document.getElementById('rateNum').value);
    const pitch = parseFloat(document.getElementById('pitchNum').value);
    const volume = parseFloat(document.getElementById('volNum').value);

    // デフォルト設定と同じ値かどうかチェック
    if (rate === DEFAULT_DATA.rate && pitch === DEFAULT_DATA.pitch && volume === DEFAULT_DATA.volume) {
        alert("デフォルト設定と同じ値のため、新規保存は不要です。");
        return;
    }

    chrome.storage.local.get('presets', (data) => {
        const presets = data.presets || [];
        
        // 既存のカスタムプリセットと値が重複していないかチェック
        const isDuplicateValue = presets.some(p => p.rate === rate && p.pitch === pitch && p.volume === volume);
        if (isDuplicateValue) {
            alert("この設定値のプリセットは既に存在します。");
            return;
        }

        const name = prompt("プリセット名を入力してください:");
        if (!name) return;

        // 名前が重複していないかチェック
        if (presets.some(p => p.name === name)) {
            alert("同じ名前のプリセットが既に存在します。");
            return;
        }

        presets.push({ name, rate, pitch, volume });
        chrome.storage.local.set({ presets }, () => renderPresets(presets));
    });
};

function renderPresets(list) {
    const container = document.getElementById('p-custom-list');
    if (!container) return;
    container.innerHTML = '';
    list.forEach((p, index) => {
        const btn = document.createElement('button');
        btn.className = 'p-btn p-btn-custom';
        btn.innerText = p.name;
        btn.title = getSettingsTooltip(p); // ホバー時にステータス表示
        btn.onclick = () => applyValues(p);
        
        // 右クリックで削除
        btn.oncontextmenu = (e) => {
            e.preventDefault();
            if (confirm(`プリセット「${p.name}」を削除しますか？`)) {
                list.splice(index, 1);
                chrome.storage.local.set({ presets: list }, () => renderPresets(list));
            }
        };
        container.appendChild(btn);
    });
}

// --- 5. 辞書管理 ---
async function refreshDicTable(filter = "") {
    const data = await chrome.storage.local.get('common_dict');
    const dict = data.common_dict || {};
    const body = document.getElementById('dicTableBody');
    if (!body) return;
    body.innerHTML = '';

    Object.keys(dict).sort().forEach(k => {
        if (filter && !k.toLowerCase().includes(filter) && !dict[k].toLowerCase().includes(filter)) return;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${k}</td>
            <td>${dict[k]}</td>
            <td><button class="btn-del" data-key="${k}">削除</button></td>
        `;
        body.appendChild(tr);
    });

    body.querySelectorAll('.btn-del').forEach(btn => {
        btn.onclick = async () => {
            const res = await chrome.storage.local.get('common_dict');
            const newDict = res.common_dict || {};
            delete newDict[btn.dataset.key];
            await chrome.storage.local.set({ common_dict: newDict });
            refreshDicTable(dicSearch?.value || "");
        };
    });
}

document.getElementById('addDicBtn').onclick = async () => {
    const kEl = document.getElementById('dicKanji');
    const yEl = document.getElementById('dicYomi');
    const kanji = kEl.value.trim();
    const yomi = yEl.value.trim();

    if (!kanji || !yomi) return;

    const data = await chrome.storage.local.get('common_dict');
    const dict = { ...(data.common_dict || {}), [kanji]: yomi };
    await chrome.storage.local.set({ common_dict: dict });
    
    kEl.value = ''; 
    yEl.value = '';
    refreshDicTable(dicSearch?.value || "");
};

// --- 6. バックアップ機能 (Export / Import) ---
document.getElementById('exportDic')?.addEventListener('click', async () => {
    const data = await chrome.storage.local.get('common_dict');
    const blob = new Blob([JSON.stringify(data.common_dict || {}, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tss_dictionary_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
});

document.getElementById('importDic')?.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                const imported = JSON.parse(ev.target.result);
                const data = await chrome.storage.local.get('common_dict');
                const merged = { ...(data.common_dict || {}), ...imported };
                await chrome.storage.local.set({ common_dict: merged });
                alert("辞書をインポートしました。");
                refreshDicTable();
            } catch (err) {
                alert("インポートに失敗しました。ファイル形式を確認してください。");
            }
        };
        reader.readAsText(file);
    };
    input.click();
});

// --- 7. 保存処理 ---
document.getElementById('saveBtn').onclick = () => {
    const settings = {
        rate: parseFloat(document.getElementById('rateNum').value),
        pitch: parseFloat(document.getElementById('pitchNum').value),
        volume: parseFloat(document.getElementById('volNum').value)
    };
    const autoPlay = document.getElementById('autoPlay')?.checked || false;

    chrome.storage.local.set({ 
        user_settings: settings,
        auto_play_enabled: autoPlay
    }, () => {
        alert("設定を保存しました。");
        window.close();
    });
};