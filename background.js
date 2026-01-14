// background.js - V1.2 OSS Stable Version
// ベース: GitHubリポジトリ
// 追加機能: ポーズ(一時停止/再開)制御、行完了通知

// アイコンクリックで設定画面を開く
chrome.action.onClicked.addListener(() => {
    chrome.runtime.openOptionsPage();
});

// TTS 制御ロジック
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // 1. 読み上げ開始
    if (request.action === "speak") {
        const s = request.settings;
        
        chrome.tts.speak(request.text, {
            lang: 'ja-JP',
            rate: parseFloat(s.rate) || 1.2,
            pitch: parseFloat(s.pitch) || 1.0,
            volume: parseFloat(s.volume) || 1.0,
            enqueue: true, // 行ごとの連続再生を有効化
            onEvent: (event) => {
                // 1行読み終わるごとに、content.jsへ通知を送ってハイライトを移動
                if (event.type === 'end') {
                    chrome.tabs.sendMessage(sender.tab.id, { 
                        action: "lineCompleted", 
                        index: request.index, 
                        isLast: request.isLast 
                    }).catch((err) => {
                        // タブが閉じられた場合などのエラーを無視
                        console.log("Send failed (tab closed):", err);
                    });
                }
                
                // エラー発生時の処理
                if (event.type === 'error') {
                    console.error("TTS Error:", event.errorMessage);
                }
            }
        });
    }

    // 2. 停止 (全てのキューをクリア)
    if (request.action === "stop") {
        chrome.tts.stop();
    }

    // 3. 一時停止 (現在の位置で停止)
    if (request.action === "pause") {
        chrome.tts.pause();
    }

    // 4. 再開 (一時停止した位置から継続)
    if (request.action === "resume") {
        chrome.tts.resume();
    }
});

// 拡張機能のインストール/更新時に初期設定を確認（必要に応じて）
chrome.runtime.onInstalled.addListener(() => {
    console.log("TSS Extension V1.2 Ready.");
});