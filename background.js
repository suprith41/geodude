chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "add-bookmark",
    title: "Add Bookmark here",
    contexts: ["page"],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "add-bookmark") {
    chrome.tabs.sendMessage(tab.id, { action: "contextMenuBookmark" });
  }
});
