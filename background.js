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
// --- Update Checker ---
const GITHUB_MANIFEST = "https://raw.githubusercontent.com/TSS-extension/TSS---Text-to-Speak-Shosetu/main/manifest.json";
const UPDATE_CHECK_ALARM = "check_updates";

chrome.alarms.create(UPDATE_CHECK_ALARM, { periodInMinutes: 360 }); // 6 hours

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === UPDATE_CHECK_ALARM) {
        checkForUpdates();
    }
});

chrome.runtime.onStartup.addListener(checkForUpdates);
chrome.runtime.onInstalled.addListener(checkForUpdates);

async function checkForUpdates() {
    try {
        const local = chrome.runtime.getManifest().version;
        const res = await fetch(GITHUB_MANIFEST);
        if (!res.ok) throw new Error("Network error");

        const data = await res.json();
        const remote = data.version;

        if (isNewer(remote, local)) {
            chrome.action.setBadgeText({ text: "NEW" });
            chrome.action.setBadgeBackgroundColor({ color: "#ff5252" });
            chrome.storage.local.set({
                update_available: true,
                latest_version: remote
            });
        } else {
            chrome.action.setBadgeText({ text: "" });
            chrome.storage.local.remove(['update_available']);
        }
    } catch (e) {
        console.log("Update check failed:", e);
    }
}

function isNewer(remote, local) {
    const r = remote.split('.').map(Number);
    const l = local.split('.').map(Number);
    for (let i = 0; i < Math.max(r.length, l.length); i++) {
        const rv = r[i] || 0;
        const lv = l[i] || 0;
        if (rv > lv) return true;
        if (rv < lv) return false;
    }
    return false;
}
