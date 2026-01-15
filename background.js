// background.js - V1.3.1 Ultra Response
chrome.action.onClicked.addListener(() => {
    chrome.runtime.openOptionsPage(); // アイコンクリックで設定表示
});

chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "tss-register-dic",
        title: "TSS辞書に登録: 「%s」",
        contexts: ["selection"]
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "tss-register-dic") {
        chrome.tabs.sendMessage(tab.id, { action: "openQuickDic", word: info.selectionText }).catch(() => {});
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "stop") {
        chrome.tts.stop(); // 停止を最優先
        return; 
    }

    if (request.action === "speak") {
        const s = request.settings;
        chrome.tts.speak(request.text, {
            lang: 'ja-JP',
            rate: parseFloat(s.rate) || 1.2,
            pitch: parseFloat(s.pitch) || 1.0,
            volume: parseFloat(s.volume) || 1.0,
            enqueue: true,
            onEvent: (event) => {
                if (event.type === 'end') {
                    chrome.tabs.sendMessage(sender.tab.id, { 
                        action: "lineCompleted", 
                        index: request.index, 
                        isLast: request.isLast 
                    }).catch(() => {});
                }
            }
        });
    }
    if (request.action === "pause") chrome.tts.pause();
    if (request.action === "resume") chrome.tts.resume();
});