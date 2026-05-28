// ─── Helpers ──────────────────────────────────────────────────────────────────

function getConversationId(url) {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function getDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function loadAllBookmarks() {
  return new Promise((resolve) => {
    chrome.storage.local.get("bookmarks", (result) => {
      resolve(result.bookmarks || {});
    });
  });
}

function saveAllBookmarks(all) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ bookmarks: all }, resolve);
  });
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Render ───────────────────────────────────────────────────────────────────

async function render(tabId, convId) {
  const all = await loadAllBookmarks();
  const list = all[convId] || [];

  const bookmarkList = document.getElementById("bookmark-list");
  const emptyMsg = document.getElementById("empty-msg");

  bookmarkList.innerHTML = "";

  if (list.length === 0) {
    emptyMsg.style.display = "block";
    return;
  }

  emptyMsg.style.display = "none";

  list.forEach((bm) => {
    const card = document.createElement("div");
    card.className = "bm-card";
    card.innerHTML = `
      <span class="bm-name">${escapeHtml(bm.name)}</span>
      <button class="bm-delete" title="Delete">🗑️</button>
    `;

    // Card click → scroll to element in page
    card.addEventListener("click", (e) => {
      if (e.target.classList.contains("bm-delete")) return;
      chrome.tabs.sendMessage(tabId, {
        action: "scrollTo",
        elementId: bm.elementId,
      });
      window.close();
    });

    // Delete
    card.querySelector(".bm-delete").addEventListener("click", async (e) => {
      e.stopPropagation();
      const latest = await loadAllBookmarks();
      if (!latest[convId]) return;
      latest[convId] = latest[convId].filter((b) => b.id !== bm.id);
      if (latest[convId].length === 0) delete latest[convId];
      await saveAllBookmarks(latest);
      render(tabId, convId);
    });

    bookmarkList.appendChild(card);
  });
}

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    const pageLabel = document.getElementById("page-label");

    if (!tab || !tab.url) {
      pageLabel.textContent = "No active tab";
      document.getElementById("empty-msg").style.display = "block";
      return;
    }

    pageLabel.textContent = getDomain(tab.url);
    render(tab.id, getConversationId(tab.url));
  });
});
