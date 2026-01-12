// background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "speak") {
    chrome.tts.speak(request.text, {
      lang: 'ja-JP',
      rate: 1.2,
      enqueue: true,
      onEvent: (event) => {
        if (event.type === 'end') {
          // 一行読み終わるたびに、その行のインデックスを送り返す
          chrome.tabs.sendMessage(sender.tab.id, { 
            action: "lineCompleted", 
            index: request.index,
            isLast: request.isLast 
          }).catch(() => {});
        }
      }
    });
  }
  if (request.action === "stop") {
    chrome.tts.stop();
  }
});