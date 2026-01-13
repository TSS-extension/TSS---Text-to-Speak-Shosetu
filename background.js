// background.js

// アイコンクリック時に設定ページを開く
chrome.action.onClicked.addListener(() => {
    chrome.runtime.openOptionsPage();
});

// 読み上げリクエストの処理
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "speak") {
        const s = request.settings || { rate: 1.2, pitch: 1.0, volume: 1.0 };

        /**
         * Chrome TTS API 安全装置 (Clamping)
         * APIの仕様上限を超えると TypeError で停止するため、ここで丸める
         */
        const safeRate = Math.min(Math.max(parseFloat(s.rate) || 1.2, 0.1), 10.0); // 最大10倍
        const safePitch = Math.min(Math.max(parseFloat(s.pitch) || 1.0, 0.0), 2.0); // 最大2.0
        const safeVol = Math.min(Math.max(parseFloat(s.volume) || 1.0, 0.0), 1.0);  // 最大1.0

        chrome.tts.speak(request.text, {
            lang: 'ja-JP',
            rate: safeRate,
            pitch: safePitch,
            volume: safeVol,
            enqueue: true,
            onEvent: (event) => {
                if (event.type === 'end') {
                    // 1行読み上げ完了をcontent.jsに通知
                    chrome.tabs.sendMessage(sender.tab.id, {
                        action: "lineCompleted",
                        index: request.index,
                        isLast: request.isLast
                    }).catch(() => { /* タブが閉じられた場合などのエラー防止 */ });
                }
            }
        });
    }

    if (request.action === "stop") {
        chrome.tts.stop();
    }
});