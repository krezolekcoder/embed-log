import { state, PANES } from './state.js';
import { onLineClick } from './lines.js';

// ---------------------------------------------------------------------------
// Line selection + copy
//
// Plain click  → sync works exactly as before (no change).
// Click + drag → once the pointer moves >6 px vertically the drag activates:
//                • syncs the line you started dragging from
//                • highlights the range as you drag
//                • the click that would fire on pointerup is suppressed so
//                  onLineClick isn't called a second time
//
// Copy via the floating "Copy N lines" button, Ctrl/Cmd+C, or Escape to clear.
// ---------------------------------------------------------------------------

let _copyMode = "raw"; // "raw" | "compact"
const _selectionComments = Object.create(null); // paneId -> comment text

// ---------------------------------------------------------------------------
// Inject clipboard indicator into toolbar (before ws-status)
// ---------------------------------------------------------------------------
(function () {
    const wsStatus = document.getElementById("ws-status");
    if (!wsStatus) return;

    const ind = document.createElement("div");
    ind.id            = "clip-indicator";
    ind.style.display = "none";

    const span = document.createElement("span");
    span.className = "clip-count";
    span.title = "Peek clipboard buffer";
    span.addEventListener("click", e => { e.stopPropagation(); _toggleClipPeek(); });
    ind.appendChild(span);

    const sep = document.createElement("span");
    sep.className   = "clip-sep";
    sep.textContent = "·";
    ind.appendChild(sep);

    const peekBtn = document.createElement("button");
    peekBtn.id          = "clip-peek-btn";
    peekBtn.className   = "clip-peek";
    peekBtn.textContent = "Peek";
    peekBtn.title       = "Show clipboard buffer";
    peekBtn.addEventListener("click", e => { e.stopPropagation(); _toggleClipPeek(); });
    ind.appendChild(peekBtn);

    const clearBtn = document.createElement("button");
    clearBtn.className   = "clip-clear";
    clearBtn.textContent = "Clear";
    clearBtn.title       = "Clear clipboard buffer";
    clearBtn.addEventListener("click", _clearClipBuffer);
    ind.appendChild(clearBtn);

    const menu = document.createElement("div");
    menu.id = "clip-peek-menu";
    menu.innerHTML = `
        <div class="clip-peek-head">
            <span>Clipboard buffer</span>
            <button type="button" class="clip-peek-copyall" title="Copy full buffered clipboard content">Copy all</button>
        </div>
        <pre class="clip-peek-body"></pre>
    `;
    menu.querySelector(".clip-peek-copyall")?.addEventListener("click", e => {
        e.stopPropagation();
        _copyClipBuffer();
    });
    document.body.appendChild(menu);

    wsStatus.before(ind);
})();

// ---------------------------------------------------------------------------
// Inject per-pane copy button
// ---------------------------------------------------------------------------
export function _selectionSetupPane(id) {
    const body = document.querySelector(`#pane-${id} .pane-body`);
    if (!body) return;

    const wrap = document.createElement("div");
    wrap.className = "copy-actions";
    wrap.id = "copy-actions-" + id;

    const copyBtn = document.createElement("button");
    copyBtn.className = "copy-btn";
    copyBtn.id        = "copy-" + id;
    copyBtn.addEventListener("click", e => { e.stopPropagation(); _copySelected(id); });

    const fmtBtn = document.createElement("button");
    fmtBtn.className = "copy-btn copy-mode-btn";
    fmtBtn.id        = "copy-mode-" + id;
    fmtBtn.title     = "Toggle copy mode (Raw/Compact)";
    fmtBtn.addEventListener("click", e => {
        e.stopPropagation();
        _copyMode = _copyMode === "raw" ? "compact" : "raw";
        _syncAllCopyButtons();
    });

    const cmtBtn = document.createElement("button");
    cmtBtn.className = "copy-btn copy-comment-btn";
    cmtBtn.id        = "copy-comment-" + id;
    cmtBtn.textContent = "Comment";
    cmtBtn.title = "Add a quick context comment for this selection";
    cmtBtn.addEventListener("click", e => {
        e.stopPropagation();
        _openCommentEditor(id, cmtBtn);
    });

    wrap.appendChild(copyBtn);
    wrap.appendChild(fmtBtn);
    wrap.appendChild(cmtBtn);
    body.appendChild(wrap);

    if (!(_selectionComments[id])) _selectionComments[id] = "";
}
PANES.forEach(_selectionSetupPane);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function _stripHtml(str) { return str.replace(/<[^>]+>/g, ""); }

function _syncCopyBtn(paneId) {
    const wrap = document.getElementById("copy-actions-" + paneId);
    const copyBtn = document.getElementById("copy-" + paneId);
    const modeBtn = document.getElementById("copy-mode-" + paneId);
    const commentBtn = document.getElementById("copy-comment-" + paneId);
    if (!wrap || !copyBtn || !modeBtn || !commentBtn) return;

    const count = state.selected[paneId].size;
    const visible = count > 0;
    wrap.classList.toggle("visible", visible);
    copyBtn.classList.toggle("visible", visible);
    modeBtn.classList.toggle("visible", visible);
    commentBtn.classList.toggle("visible", visible);

    if (visible) {
        copyBtn.textContent = `Copy ${count} line${count === 1 ? "" : "s"}`;
        modeBtn.textContent = _copyMode === "raw" ? "Raw" : "Compact";
        const hasComment = !!(_selectionComments[paneId] || "").trim();
        commentBtn.textContent = hasComment ? "Comment ✓" : "Comment";
    }
}

function _syncAllCopyButtons() {
    PANES.forEach(_syncCopyBtn);
}

function _applySelection(paneId) {
    const logEl = document.getElementById("log-" + paneId);
    const sel   = state.selected[paneId];
    Array.from(logEl.children).forEach((div, i) =>
        div.classList.toggle("selected", sel.has(i))
    );
    _syncCopyBtn(paneId);
}

function _clearOtherSelections(keepPane) {
    PANES.forEach(id => {
        if (id === keepPane || !state.selected[id].size) return;
        state.selected[id] = new Set();
        _applySelection(id);
    });
}

function _clearAllSelections() {
    PANES.forEach(id => {
        if (state.selected[id]?.size) {
            state.selected[id] = new Set();
            _applySelection(id);
        }
        if (_selectionComments[id]) _selectionComments[id] = "";
        _syncCopyBtn(id);
    });
    _closeCommentEditor();
}

function _escapeRe(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function _decodeEntities(text) {
    const ta = document.createElement("textarea");
    ta.innerHTML = text;
    return ta.value;
}

function _linePlain(line) {
    return _decodeEntities(_stripHtml(line?.html || "")).replace(/\s+/g, " ").trim();
}

function _lineRaw(line) {
    return `${line.ts}  ${_linePlain(line)}`;
}

function _lineCompact(line, paneId) {
    let text = _linePlain(line)
        .replace(/^\[\d{4}-\d{2}-\d{2}T[^\]]+\]\s*/, "")
        .replace(new RegExp(`^\\[${_escapeRe(paneId)}\\]\\s*`), "");
    return `${line.ts.slice(6)}  ${text}`.trim();
}

function _commentPrefix(paneId) {
    const raw = (_selectionComments[paneId] || "").trim();
    if (!raw) return "";
    return raw.split(/\r?\n/).map(l => `# ${l}`).join("\n") + "\n";
}

function _formatSelectionBlock(paneId, indices) {
    const lines = state.rawLines[paneId];
    if (_copyMode === "compact") {
        const body = indices
            .map(i => lines[i])
            .filter(Boolean)
            .map(line => _lineCompact(line, paneId))
            .join("\n");
        return `${_commentPrefix(paneId)}[${paneId}]\n${body}`;
    }

    const body = indices
        .map(i => lines[i])
        .filter(Boolean)
        .map(_lineRaw)
        .join("\n");
    return `${_commentPrefix(paneId)}${body}`;
}

function _commentMenuEl() { return document.getElementById("selection-comment-menu"); }

function _ensureCommentMenu() {
    if (_commentMenuEl()) return;
    const menu = document.createElement("div");
    menu.id = "selection-comment-menu";
    menu.innerHTML = `
        <div class="selection-comment-head">Selection comment</div>
        <textarea class="selection-comment-input" rows="3" placeholder="Optional context for this copied selection..."></textarea>
        <div class="selection-comment-actions">
            <button type="button" class="selection-comment-save">Save</button>
            <button type="button" class="selection-comment-clear">Clear</button>
            <button type="button" class="selection-comment-cancel">Close</button>
        </div>
    `;
    document.body.appendChild(menu);

    menu.querySelector(".selection-comment-save")?.addEventListener("click", e => {
        e.stopPropagation();
        const paneId = menu.dataset.pane || "";
        const input = menu.querySelector(".selection-comment-input");
        if (!paneId || !input) return;
        _selectionComments[paneId] = input.value.trim();
        _syncCopyBtn(paneId);
        _closeCommentEditor();
    });

    menu.querySelector(".selection-comment-clear")?.addEventListener("click", e => {
        e.stopPropagation();
        const paneId = menu.dataset.pane || "";
        if (paneId) {
            _selectionComments[paneId] = "";
            _syncCopyBtn(paneId);
        }
        const input = menu.querySelector(".selection-comment-input");
        if (input) input.value = "";
    });

    menu.querySelector(".selection-comment-cancel")?.addEventListener("click", e => {
        e.stopPropagation();
        _closeCommentEditor();
    });
}

function _isCommentEditorOpen() {
    return _commentMenuEl()?.classList.contains("open") ?? false;
}

function _openCommentEditor(paneId, anchorEl) {
    _ensureCommentMenu();
    const menu = _commentMenuEl();
    if (!menu || !anchorEl) return;
    menu.dataset.pane = paneId;
    const input = menu.querySelector(".selection-comment-input");
    if (input) input.value = _selectionComments[paneId] || "";

    const rect = anchorEl.getBoundingClientRect();
    menu.style.left = `${Math.max(8, rect.left - 220)}px`;
    menu.style.top = `${rect.bottom + 6}px`;
    menu.classList.add("open");
    input?.focus();
}

function _closeCommentEditor() {
    _commentMenuEl()?.classList.remove("open");
}

// ---------------------------------------------------------------------------
// Clipboard accumulation buffer
// Each copy appends to the buffer (3 blank lines between groups).
// The full buffer is written to the system clipboard every time.
// ---------------------------------------------------------------------------
let _clipBuffer    = "";
let _clipLineCount = 0;

function _clipIndicatorEl() { return document.getElementById("clip-indicator"); }

function _updateClipIndicator() {
    const el = _clipIndicatorEl();
    if (!el) return;
    el.style.display = _clipLineCount > 0 ? "" : "none";
    const span = el.querySelector(".clip-count");
    if (span) span.textContent = `📋 ${_clipLineCount} lines`;
    const peekBtn = document.getElementById("clip-peek-btn");
    if (peekBtn) peekBtn.disabled = _clipLineCount <= 0;
}

function _clearClipBuffer() {
    _clipBuffer    = "";
    _clipLineCount = 0;
    _updateClipIndicator();
    _renderClipPeek();
    _closeClipPeek();
}

function _clipPeekMenuEl() { return document.getElementById("clip-peek-menu"); }

function _isClipPeekOpen() {
    return _clipPeekMenuEl()?.classList.contains("open") ?? false;
}

function _renderClipPeek() {
    const menu = _clipPeekMenuEl();
    if (!menu) return;
    const body = menu.querySelector(".clip-peek-body");
    if (!body) return;
    body.textContent = _clipBuffer || "(Clipboard buffer is empty)";
    const copyAllBtn = menu.querySelector(".clip-peek-copyall");
    if (copyAllBtn) copyAllBtn.disabled = _clipLineCount <= 0;
}

function _copyClipBuffer() {
    if (!_clipBuffer) return;
    const menu = _clipPeekMenuEl();
    const btn = menu?.querySelector(".clip-peek-copyall");
    navigator.clipboard.writeText(_clipBuffer).then(() => {
        if (!btn) return;
        const prev = btn.textContent;
        btn.textContent = "Copied";
        btn.disabled = true;
        setTimeout(() => {
            btn.textContent = prev;
            btn.disabled = _clipLineCount <= 0;
        }, 900);
    }).catch(() => {});
}

function _openClipPeek() {
    if (_clipLineCount <= 0) return;
    const menu = _clipPeekMenuEl();
    const ind = document.getElementById("clip-indicator");
    if (!menu || !ind) return;
    _renderClipPeek();
    const rect = ind.getBoundingClientRect();
    menu.style.left = `${Math.max(8, rect.left)}px`;
    menu.style.top = `${rect.bottom + 6}px`;
    menu.classList.add("open");
}

function _closeClipPeek() {
    _clipPeekMenuEl()?.classList.remove("open");
}

function _toggleClipPeek() {
    if (_isClipPeekOpen()) _closeClipPeek();
    else _openClipPeek();
}

// ---------------------------------------------------------------------------
// Copy
// ---------------------------------------------------------------------------
function _copySelected(paneId) {
    const sel = state.selected[paneId];
    if (!sel.size) return;

    const indices = Array.from(sel).sort((a, b) => a - b);
    const text = _formatSelectionBlock(paneId, indices);
    if (!text) return;

    const isFirst  = _clipBuffer === "";
    _clipBuffer    += (isFirst ? "" : "\n\n\n\n") + text;
    _clipLineCount += sel.size;

    // comment is scoped to this one copied selection
    _selectionComments[paneId] = "";
    _closeCommentEditor();

    // Natural UX: once copied, selection highlight should disappear.
    _clearAllSelections();
    _syncCopyBtn(paneId);

    navigator.clipboard.writeText(_clipBuffer).then(() => {
        const btn = document.getElementById("copy-" + paneId);
        if (!btn) return;
        const prev = btn.textContent;
        btn.textContent = isFirst
            ? `Copied! (${_clipLineCount})`
            : `Appended! (${_clipLineCount} total)`;
        setTimeout(() => { btn.textContent = prev; }, 1400);
        _updateClipIndicator();
        _renderClipPeek();
    }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Pointer drag — selection
// ---------------------------------------------------------------------------
let _drag          = null;   // { paneId, startIdx, startY, lineEl, active }
let _suppressClick = false;  // true after a drag completes; cleared by click handler

document.addEventListener("pointerdown", e => {
    if (e.button !== 0) return;                  // left-click only
    const line    = e.target.closest(".log-line");
    if (!line) return;
    const logArea = line.closest(".log-area");
    if (!logArea) return;

    _drag = {
        paneId:   logArea.id.slice(4),          // "log-X" → "X"
        startIdx: parseInt(line.dataset.idx, 10),
        startY:   e.clientY,
        lineEl:   line,
        active:   false,
    };
    _suppressClick = false;
});

document.addEventListener("pointermove", e => {
    if (!_drag) return;
    if (Math.abs(e.clientY - _drag.startY) < 6) return;   // not enough movement yet

    if (!_drag.active) {
        // Drag just crossed the threshold — activate
        _drag.active   = true;
        _suppressClick = true;

        _clearOtherSelections(_drag.paneId);

        // Sync the starting line now (click will be suppressed, so do it here)
        const raw = state.rawLines[_drag.paneId][_drag.startIdx];
        if (raw) onLineClick(_drag.paneId, raw.numTs, _drag.lineEl);

        try { _drag.lineEl.setPointerCapture(e.pointerId); } catch (_) {}
    }

    // Extend selection to the line currently under the pointer
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el) return;
    const line    = el.closest(".log-line");
    if (!line) return;
    const logArea = line.closest(".log-area");
    if (!logArea || logArea.id.slice(4) !== _drag.paneId) return;

    const endIdx = parseInt(line.dataset.idx, 10);
    const lo = Math.min(_drag.startIdx, endIdx);
    const hi = Math.max(_drag.startIdx, endIdx);
    const sel = new Set();
    for (let i = lo; i <= hi; i++) sel.add(i);
    state.selected[_drag.paneId] = sel;
    _applySelection(_drag.paneId);
});

document.addEventListener("pointerup", () => { _drag = null; });

// After a drag the browser still fires a click event on the log-line.
// Intercept it in the capture phase so onLineClick isn't called a second time.
document.addEventListener("click", e => {
    if (_suppressClick) {
        if (e.target.closest(".log-line")) {
            _suppressClick = false;
            e.stopPropagation();
            return;
        }
        _suppressClick = false;
    }

    const inClipUi = e.target.closest("#clip-indicator") || e.target.closest("#clip-peek-menu");
    const inSelectionUi = e.target.closest(".copy-actions") || e.target.closest("#selection-comment-menu");
    if (_isClipPeekOpen() && !inClipUi) _closeClipPeek();
    if (_isCommentEditorOpen() && !inSelectionUi) _closeCommentEditor();

    // Natural UX: clicking elsewhere dismisses line selection highlight.
    // Keep selection intact when interacting with copy/clipboard/comment controls.
    if (!PANES.some(id => state.selected[id]?.size > 0)) return;
    if (inClipUi || inSelectionUi) return;
    _clearAllSelections();
}, true);

// ---------------------------------------------------------------------------
// Keyboard
// ---------------------------------------------------------------------------
document.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key === "c") {
        const pane = PANES.find(id => state.selected[id].size > 0);
        if (pane) { _copySelected(pane); e.preventDefault(); }
        return;
    }
    if (e.key === "Escape") {
        if (_isCommentEditorOpen()) {
            _closeCommentEditor();
            return;
        }
        if (_isClipPeekOpen()) {
            _closeClipPeek();
            return;
        }
        _clearAllSelections();
    }
});
