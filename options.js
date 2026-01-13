// options.js - V1.1 完全版 (重複チェック・タブ切り替え・辞書管理統合)

// --- 設定項目の定義 ---
const configs = [
    { range: 'rateRange', num: 'rateNum', key: 'rate', def: 1.2 },
    { range: 'pitchRange', num: 'pitchNum', key: 'pitch', def: 1.0 },
    { range: 'volRange', num: 'volNum', key: 'volume', def: 1.0 }
];

// --- 1. タブ切り替えロジック ---
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.tab-btn, .content-section').forEach(el => el.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.target).classList.add('active');
    };
});

// --- 2. 初期化処理 (データロード) ---
document.addEventListener('DOMContentLoaded', () => {
    // 保存済み設定とプリセットの反映
    chrome.storage.local.get(['user_settings', 'presets'], (data) => {
        if (data.user_settings) {
            applyValues(data.user_settings);
        } else {
            // 初回起動時はデフォルト値を適用
            applyValues({rate: 1.2, pitch: 1.0, volume: 1.0});
        }
        renderPresets(data.presets || []);
    });
    // 辞書テーブルの更新
    refreshDicTable();
});

// 画面上の入力欄に値をセットする共通関数
function applyValues(s) {
    document.getElementById('rateNum').value = s.rate;
    // スライダーは最大3.0までの表示制限（数値入力は10まで可）
    document.getElementById('rateRange').value = s.rate > 3 ? 3 : s.rate;
    document.getElementById('pitchNum').value = s.pitch;
    document.getElementById('pitchRange').value = s.pitch;
    document.getElementById('volNum').value = s.volume;
    document.getElementById('volRange').value = s.volume;
}

// --- 3. スライダーと数値入力の双方向同期 ---
configs.forEach(c => {
    const r = document.getElementById(c.range);
    const n = document.getElementById(c.num);
    
    r.oninput = () => { n.value = r.value; };
    n.oninput = () => {
        let v = Math.round(parseFloat(n.value) * 10) / 10;
        if (!isNaN(v)) r.value = v > 3 ? 3 : v;
    };
});

// --- 4. プリセット機能 (重複防止ロジック搭載) ---

// デフォルトボタン
document.getElementById('p-default').onclick = () => applyValues({rate: 1.2, pitch: 1.0, volume: 1.0});

// プリセットの追加
document.getElementById('p-add').onclick = () => {
    const current = {
        rate: parseFloat(document.getElementById('rateNum').value) || 1.2,
        pitch: parseFloat(document.getElementById('pitchNum').value) || 1.0,
        volume: parseFloat(document.getElementById('volNum').value) || 1.0
    };

    chrome.storage.local.get('presets', data => {
        const list = data.presets || [];

        // 数値設定の重複チェック
        const isDuplicateValue = list.some(p => 
            p.rate === current.rate && 
            p.pitch === current.pitch && 
            p.volume === current.volume
        );

        if (isDuplicateValue) {
            alert("同じ設定のプリセットが既に存在します。");
            return;
        }

        const name = prompt("プリセット名を入力してください:", "カスタム設定");
        if (!name || name.trim() === "") return;

        // 名前の重複チェック
        const isDuplicateName = list.some(p => p.name === name.trim());
        if (isDuplicateName) {
            alert("その名前は既に使用されています。");
            return;
        }

        current.name = name.trim();
        list.push(current);
        chrome.storage.local.set({presets: list}, () => renderPresets(list));
    });
};

// プリセットボタンの描画
function renderPresets(list) {
    const container = document.getElementById('p-custom-list');
    container.innerHTML = '';
    list.forEach((p, i) => {
        const btn = document.createElement('button');
        btn.className = 'p-btn p-btn-custom';
        btn.innerText = p.name;
        btn.title = `速度:${p.rate} 高音:${p.pitch} 音量:${p.volume}`;
        
        btn.onclick = () => applyValues(p);
        
        // 右クリックで削除
        btn.oncontextmenu = (e) => {
            e.preventDefault();
            if (confirm(`プリセット「${p.name}」を削除しますか？`)) {
                list.splice(i, 1);
                chrome.storage.local.set({presets: list}, () => renderPresets(list));
            }
        };
        container.appendChild(btn);
    });
}

// --- 5. 設定保存 (メイン) ---
document.getElementById('saveBtn').onclick = () => {
    const s = {
        rate: Math.min(Math.max(parseFloat(document.getElementById('rateNum').value), 0.1), 10.0),
        pitch: Math.min(Math.max(parseFloat(document.getElementById('pitchNum').value), 0.1), 2.0),
        volume: Math.min(Math.max(parseFloat(document.getElementById('volNum').value), 0.1), 1.0)
    };
    
    chrome.storage.local.set({ user_settings: s }, () => {
        const btn = document.getElementById('saveBtn');
        btn.innerText = "保存しました！";
        btn.style.backgroundColor = "#4CAF50";
        setTimeout(() => window.close(), 700);
    });
};

// --- 6. 辞書管理ロジック ---

function refreshDicTable() {
    chrome.storage.local.get('common_dict', data => {
        const dict = data.common_dict || {};
        const body = document.getElementById('dicTableBody');
        body.innerHTML = '';
        
        // 単語を辞書順に並べて表示
        Object.keys(dict).sort().forEach(k => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${k}</td>
                <td>${dict[k]}</td>
                <td><button class="btn-del" data-key="${k}">削除</button></td>
            `;
            body.appendChild(tr);
        });

        // 削除ボタンのイベント紐付け
        document.querySelectorAll('.btn-del').forEach(b => {
            b.onclick = () => {
                const key = b.dataset.key;
                chrome.storage.local.get('common_dict', d => {
                    const newDict = d.common_dict || {};
                    delete newDict[key];
                    chrome.storage.local.set({common_dict: newDict}, refreshDicTable);
                });
            };
        });
    });
}

// 辞書への追加
document.getElementById('addDicBtn').onclick = () => {
    const k = document.getElementById('dicKanji').value.trim();
    const y = document.getElementById('dicYomi').value.trim();
    
    if (!k || !y) {
        alert("単語と読みを入力してください。");
        return;
    }

    chrome.storage.local.get('common_dict', data => {
        const dict = data.common_dict || {};
        dict[k] = y;
        chrome.storage.local.set({common_dict: dict}, () => {
            document.getElementById('dicKanji').value = '';
            document.getElementById('dicYomi').value = '';
            refreshDicTable();
        });
    });
};