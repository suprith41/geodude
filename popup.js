// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractConversationId(url) {
  const match = url.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
  );
  return match ? match[0] : null;
}

function loadBookmarks(callback) {
  chrome.storage.local.get("bookmarks", (result) => {
    callback(result.bookmarks || {});
  });
}

function saveBookmarks(bookmarks, callback) {
  chrome.storage.local.set({ bookmarks }, callback);
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Render ───────────────────────────────────────────────────────────────────

function renderBookmarks(tabId, conversationId) {
  loadBookmarks((bookmarks) => {
    const list = document.getElementById("bookmark-list");
    const emptyMsg = document.getElementById("empty-msg");
    const entries = bookmarks[conversationId] || [];

    list.innerHTML = "";

    if (entries.length === 0) {
      emptyMsg.style.display = "block";
      return;
    }

    emptyMsg.style.display = "none";

    entries.forEach((bm) => {
      const item = document.createElement("div");
      item.className = "bookmark-item";

      item.innerHTML = `
        <span class="bm-icon">🪨</span>
        <span class="bm-name">${escapeHtml(bm.name)}</span>
        <button class="bm-delete" title="Delete bookmark">🗑️</button>
      `;

      // Click on item (not delete) → scroll to element in page
      item.addEventListener("click", (e) => {
        if (e.target.classList.contains("bm-delete")) return;
        chrome.tabs.sendMessage(tabId, {
          action: "scrollTo",
          elementId: bm.elementId,
        });
        window.close();
      });

      // Delete button
      item.querySelector(".bm-delete").addEventListener("click", (e) => {
        e.stopPropagation();
        loadBookmarks((latest) => {
          if (!latest[conversationId]) return;
          latest[conversationId] = latest[conversationId].filter(
            (b) => b.id !== bm.id
          );
          if (latest[conversationId].length === 0) {
            delete latest[conversationId];
          }
          saveBookmarks(latest, () => {
            renderBookmarks(tabId, conversationId);
          });
        });
      });

      list.appendChild(item);
    });
  });
}

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab || !tab.url) {
      document.getElementById("empty-msg").textContent =
        "Open a Claude.ai conversation to see bookmarks.";
      return;
    }

    const conversationId = extractConversationId(tab.url);
    if (!conversationId) {
      document.getElementById("empty-msg").textContent =
        "Open a Claude.ai conversation to see bookmarks.";
      return;
    }

    renderBookmarks(tab.id, conversationId);
  });
});
