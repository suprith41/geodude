// ─── Utilities ────────────────────────────────────────────────────────────────

function getConversationId() {
  const uuidMatch = window.location.href.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
  );
  return uuidMatch ? uuidMatch[0] : window.location.pathname;
}

function loadBookmarks() {
  return new Promise((resolve) => {
    chrome.storage.local.get("bookmarks", (result) => {
      const all = result.bookmarks || {};
      const convId = getConversationId();
      resolve(all[convId] || []);
    });
  });
}

function saveBookmarks(list) {
  return new Promise((resolve) => {
    chrome.storage.local.get("bookmarks", (result) => {
      const all = result.bookmarks || {};
      all[getConversationId()] = list;
      chrome.storage.local.set({ bookmarks: all }, resolve);
    });
  });
}

// ─── Prompt and Save ──────────────────────────────────────────────────────────

async function promptAndSave(messageEl) {
  const name = window.prompt("Bookmark name:");
  if (name === null || name.trim() === "") return;

  const noteRaw = window.prompt("Add a note (optional):");
  const note = noteRaw === null ? "" : noteRaw.trim();

  if (!messageEl.id) {
    messageEl.id = "geodude-" + Date.now();
  }

  const list = await loadBookmarks();
  list.push({
    id: Date.now(),
    name: name.trim(),
    note,
    elementId: messageEl.id,
    timestamp: new Date().toISOString(),
  });
  await saveBookmarks(list);
  renderSidebar();
}

// ─── Hover Button Injection ───────────────────────────────────────────────────

const injectedEls = new WeakSet();

function injectButtons() {
  const candidates = document.querySelectorAll(
    'article, [class*="message"], [class*="chat"], [data-testid*="message"], p, blockquote'
  );

  candidates.forEach((el) => {
    if (injectedEls.has(el)) return;
    if ((el.innerText || "").trim().length <= 100) return;

    injectedEls.add(el);

    const pos = window.getComputedStyle(el).position;
    if (pos === "static") el.style.position = "relative";

    const btn = document.createElement("button");
    btn.className = "geodude-bookmark-btn";
    btn.textContent = "🪨";

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      promptAndSave(el);
    });

    el.appendChild(btn);

    el.addEventListener("mouseenter", () => {
      btn.style.display = "block";
    });
    el.addEventListener("mouseleave", () => {
      btn.style.display = "none";
    });
  });
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatTimestamp(iso) {
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

async function renderSidebar() {
  // ── Ensure sidebar shell exists ────────────────────────────────────────────
  let sidebar = document.getElementById("geodude-sidebar");
  if (!sidebar) {
    sidebar = document.createElement("div");
    sidebar.id = "geodude-sidebar";
    document.body.appendChild(sidebar);
  }

  // ── Ensure toggle button exists ────────────────────────────────────────────
  if (!document.getElementById("geodude-toggle")) {
    const toggle = document.createElement("button");
    toggle.id = "geodude-toggle";
    toggle.textContent = "🪨";
    toggle.title = "Toggle Geodude Bookmarks";
    toggle.addEventListener("click", () => {
      document.getElementById("geodude-sidebar").classList.toggle("open");
    });
    document.body.appendChild(toggle);
  }

  // ── Load bookmarks and build HTML ──────────────────────────────────────────
  const list = await loadBookmarks();

  const itemsHtml =
    list.length === 0
      ? `<div id="geodude-empty">No bookmarks yet.<br>Hover over any text block and click 🪨 Mark</div>`
      : list
          .map(
            (bm, i) => `
        <div class="geodude-item" draggable="true" data-index="${i}" data-element-id="${escapeHtml(bm.elementId)}">
          <div class="geodude-item-name">${escapeHtml(bm.name)}</div>
          ${bm.note ? `<div class="geodude-item-note">${escapeHtml(bm.note)}</div>` : ""}
          ${bm.timestamp ? `<div class="geodude-item-note">${formatTimestamp(bm.timestamp)}</div>` : ""}
          <div class="geodude-item-actions">
            <button class="geodude-action-btn geodude-go" data-index="${i}">🎯 Go</button>
            <button class="geodude-action-btn geodude-edit" data-index="${i}">✏️ Edit</button>
            <button class="geodude-action-btn geodude-delete" data-index="${i}">🗑️ Delete</button>
          </div>
        </div>`
          )
          .join("");

  sidebar.innerHTML = `
    <div class="geodude-header">
      <span class="geodude-header-title">🪨 Geodude</span>
      <button class="geodude-close-btn" id="geodude-close">✕</button>
    </div>
    <div class="geodude-list">
      ${itemsHtml}
    </div>
    <div class="geodude-export-bar">
      <button class="geodude-export-btn" id="geodude-export-json">⬇ JSON</button>
      <button class="geodude-export-btn" id="geodude-export-copy">📋 Copy</button>
    </div>
  `;

  // ── Close ──────────────────────────────────────────────────────────────────
  sidebar.querySelector("#geodude-close").addEventListener("click", () => {
    sidebar.classList.remove("open");
  });

  // ── Action buttons ─────────────────────────────────────────────────────────
  // Card click → scroll (action buttons stop propagation so they don't double-fire)
  sidebar.querySelectorAll(".geodude-item").forEach((item) => {
    item.addEventListener("click", () => {
      const bm = list[parseInt(item.dataset.index)];
      scrollToElement(bm.elementId);
    });
  });

  sidebar.querySelectorAll(".geodude-go").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const bm = list[parseInt(btn.dataset.index)];
      scrollToElement(bm.elementId);
    });
  });

  sidebar.querySelectorAll(".geodude-edit").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.index);
      const bm = list[idx];
      const newName = window.prompt("Bookmark name:", bm.name);
      if (newName === null) return;
      const newNote = window.prompt("Note (optional):", bm.note || "");
      if (newNote === null) return;
      list[idx] = { ...bm, name: newName.trim(), note: newNote.trim() };
      await saveBookmarks(list);
      renderSidebar();
    });
  });

  sidebar.querySelectorAll(".geodude-delete").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.index);
      list.splice(idx, 1);
      await saveBookmarks(list);
      renderSidebar();
    });
  });

  // ── Drag-to-reorder ────────────────────────────────────────────────────────
  let dragSrcIndex = null;

  sidebar.querySelectorAll(".geodude-item").forEach((item) => {
    item.addEventListener("dragstart", () => {
      dragSrcIndex = parseInt(item.dataset.index);
      item.style.opacity = "0.5";
    });

    item.addEventListener("dragend", () => {
      item.style.opacity = "";
      sidebar.querySelectorAll(".geodude-item").forEach((i) =>
        i.classList.remove("geodude-drag-over")
      );
    });

    item.addEventListener("dragover", (e) => {
      e.preventDefault();
      sidebar.querySelectorAll(".geodude-item").forEach((i) =>
        i.classList.remove("geodude-drag-over")
      );
      item.classList.add("geodude-drag-over");
    });

    item.addEventListener("drop", async (e) => {
      e.preventDefault();
      const dropIndex = parseInt(item.dataset.index);
      if (dragSrcIndex === null || dragSrcIndex === dropIndex) return;
      const moved = list.splice(dragSrcIndex, 1)[0];
      list.splice(dropIndex, 0, moved);
      await saveBookmarks(list);
      renderSidebar();
    });
  });

  // ── Export JSON ────────────────────────────────────────────────────────────
  sidebar.querySelector("#geodude-export-json").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(list, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "geodude-bookmarks.json";
    a.click();
    URL.revokeObjectURL(url);
  });

  // ── Export Copy ────────────────────────────────────────────────────────────
  sidebar.querySelector("#geodude-export-copy").addEventListener("click", () => {
    const text = list
      .map((bm, i) => {
        let line = `${i + 1}. ${bm.name}`;
        if (bm.note) line += `\n   Note: ${bm.note}`;
        if (bm.timestamp) line += `\n   Saved: ${formatTimestamp(bm.timestamp)}`;
        return line;
      })
      .join("\n\n");
    navigator.clipboard.writeText(text).catch(() => {
      window.prompt("Copy this:", text);
    });
  });
}

// ─── Scroll Helper ────────────────────────────────────────────────────────────

function scrollToElement(elementId) {
  const el = document.getElementById(elementId);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("geodude-highlight");
    setTimeout(() => el.classList.remove("geodude-highlight"), 1500);
  }
  const sidebar = document.getElementById("geodude-sidebar");
  if (sidebar) sidebar.classList.add("open");
}

// ─── Message Listener ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "contextMenuBookmark") {
    const candidates = Array.from(
      document.querySelectorAll(
        'article, [class*="message"], [class*="chat"], [data-testid*="message"], p, blockquote'
      )
    ).filter((el) => (el.innerText || "").trim().length > 100);

    if (candidates.length === 0) return;

    const viewportMid = window.scrollY + window.innerHeight / 2;
    let closest = candidates[0];
    let minDist = Infinity;

    candidates.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const elMid = window.scrollY + rect.top + rect.height / 2;
      const dist = Math.abs(elMid - viewportMid);
      if (dist < minDist) {
        minDist = dist;
        closest = el;
      }
    });

    promptAndSave(closest);
  }

  if (message.action === "scrollTo") {
    scrollToElement(message.elementId);
  }
});

// ─── Init ─────────────────────────────────────────────────────────────────────

function init() {
  renderSidebar();
  injectButtons();

  const observer = new MutationObserver(() => {
    injectButtons();
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
