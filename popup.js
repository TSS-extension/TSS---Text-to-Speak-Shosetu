const checkbox = document.getElementById('autoNext');

// 設定の読み込み
chrome.storage.local.get(['autoNextEnabled'], (res) => {
  checkbox.checked = res.autoNextEnabled || false;
});

// 設定の保存
checkbox.addEventListener('change', () => {
  chrome.storage.local.set({ autoNextEnabled: checkbox.checked });
});