// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractConversationId(url) {
  const uuidMatch = url.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
  );
  if (uuidMatch) return uuidMatch[0];
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

function formatTimestamp(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
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
  const exportBar = document.getElementById("export-bar");

  bookmarkList.innerHTML = "";

  if (list.length === 0) {
    emptyMsg.style.display = "block";
    exportBar.classList.remove("visible");
    return;
  }

  emptyMsg.style.display = "none";
  exportBar.classList.add("visible");

  list.forEach((bm, i) => {
    const card = document.createElement("div");
    card.className = "bm-card";

    const ts = formatTimestamp(bm.timestamp);

    card.innerHTML = `
      <div class="bm-card-body">
        <div class="bm-name">${escapeHtml(bm.name)}</div>
        ${bm.note ? `<div class="bm-note">${escapeHtml(bm.note)}</div>` : ""}
        ${ts ? `<div class="bm-timestamp">${ts}</div>` : ""}
      </div>
      <button class="bm-delete" title="Delete bookmark">🗑️</button>
    `;

    // Card click → scroll to element in tab
    card.addEventListener("click", (e) => {
      if (e.target.classList.contains("bm-delete")) return;
      chrome.tabs.sendMessage(tabId, {
        action: "scrollTo",
        elementId: bm.elementId,
      });
      window.close();
    });

    // Delete button
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

  // ── Export JSON ──────────────────────────────────────────────────────────
  document.getElementById("export-json").onclick = () => {
    const blob = new Blob([JSON.stringify(list, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "geodude-bookmarks.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Copy All ─────────────────────────────────────────────────────────────
  document.getElementById("export-copy").onclick = () => {
    const text = list
      .map((bm, idx) => {
        let line = `${idx + 1}. ${bm.name}`;
        if (bm.note) line += `\n   Note: ${bm.note}`;
        if (bm.timestamp) line += `\n   Saved: ${formatTimestamp(bm.timestamp)}`;
        return line;
      })
      .join("\n\n");
    navigator.clipboard.writeText(text).catch(() => {
      window.prompt("Copy this:", text);
    });
  };
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

    const convId = extractConversationId(tab.url);
    render(tab.id, convId);
  });
});
