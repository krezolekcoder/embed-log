import { state, TABS, PANES } from './state.js';
import { rerenderPane } from './lines.js';

// ---------------------------------------------------------------------------
// Toolbar — wrap
// ---------------------------------------------------------------------------
const btnWrap = document.getElementById("btn-wrap");
btnWrap.addEventListener("click", () => {
    state.wrap = !state.wrap;
    btnWrap.classList.toggle("active", state.wrap);
    PANES.forEach(id => document.getElementById("log-" + id).classList.toggle("wrap", state.wrap));
});

// ---------------------------------------------------------------------------
// Toolbar — timestamps
// ---------------------------------------------------------------------------
const btnTs = document.getElementById("btn-ts");
btnTs.addEventListener("click", () => {
    state.showTs = !state.showTs;
    btnTs.classList.toggle("active", state.showTs);
    PANES.forEach(rerenderPane);
});

// ---------------------------------------------------------------------------
// Toolbar — font size
// ---------------------------------------------------------------------------
document.getElementById("btn-font-dec").addEventListener("click", () => {
    state.fontSize = Math.max(9, state.fontSize - 1);
    document.documentElement.style.setProperty("--font-size", state.fontSize + "px");
});
document.getElementById("btn-font-inc").addEventListener("click", () => {
    state.fontSize = Math.min(24, state.fontSize + 1);
    document.documentElement.style.setProperty("--font-size", state.fontSize + "px");
});

// ---------------------------------------------------------------------------
// Toolbar — sync toggle
// ---------------------------------------------------------------------------
const btnSync = document.getElementById("btn-sync");
btnSync.addEventListener("click", () => {
    state.syncEnabled = !state.syncEnabled;
    btnSync.classList.toggle("active", state.syncEnabled);
});

// ---------------------------------------------------------------------------
// Toolbar — theme toggle (single button: shows target-mode icon)
//   light (Whitesand) → button shows 🌙  (click to go dark)
//   dark  (Mocha)     → button shows ☀  (click to go light)
// ---------------------------------------------------------------------------
(function () {
    const btn = document.getElementById("btn-theme");

    function setTheme(theme) {
        document.documentElement.setAttribute("data-theme", theme);
        btn.textContent = theme === "whitesand" ? "🌙" : "☀";
    }

    btn.addEventListener("click", () => {
        const isDark = document.documentElement.getAttribute("data-theme") === "";
        setTheme(isDark ? "whitesand" : "");
    });

    // Sync icon with the initial data-theme set in the HTML
    setTheme(document.documentElement.getAttribute("data-theme") || "");
})();

// ---------------------------------------------------------------------------
// Pane swapping (dynamic layout)
// ---------------------------------------------------------------------------
function _findPaneLocation(paneId) {
    for (let tabIdx = 0; tabIdx < TABS.length; tabIdx++) {
        const paneIdx = TABS[tabIdx].panes.indexOf(paneId);
        if (paneIdx !== -1) return { tabIdx, paneIdx };
    }
    return null;
}

function _rebuildTabContent(tabIdx, paneElMap) {
    const tabContent = document.getElementById("tab-content-" + tabIdx);
    if (!tabContent) return;

    const paneIds = TABS[tabIdx].panes;
    const paneEls = paneIds
        .map(paneId => paneElMap[paneId] || document.getElementById("pane-" + paneId))
        .filter(Boolean);

    tabContent.innerHTML = "";
    paneEls.forEach((paneEl, i) => {
        if (i > 0) {
            const splitter = document.createElement("div");
            splitter.className = "splitter";
            tabContent.appendChild(splitter);
        }
        // Reset manual split sizing so the new placement lays out cleanly.
        paneEl.style.width = "";
        paneEl.style.flex = "";
        tabContent.appendChild(paneEl);
    });
}

function _pulsePane(paneId) {
    const el = document.getElementById("pane-" + paneId);
    if (!el) return;
    el.classList.remove("swap-anim");
    // Force reflow so repeated swaps retrigger animation
    void el.offsetWidth;
    el.classList.add("swap-anim");
    setTimeout(() => el.classList.remove("swap-anim"), 320);
}

function _swapPanes(a, b) {
    if (!a || !b || a === b) return;
    const locA = _findPaneLocation(a);
    const locB = _findPaneLocation(b);
    if (!locA || !locB) return;

    // Snapshot pane DOM nodes BEFORE any tab content is rebuilt.
    const paneElMap = {};
    PANES.forEach(id => {
        const el = document.getElementById("pane-" + id);
        if (el) paneElMap[id] = el;
    });

    TABS[locA.tabIdx].panes[locA.paneIdx] = b;
    TABS[locB.tabIdx].panes[locB.paneIdx] = a;

    [...new Set([locA.tabIdx, locB.tabIdx])].forEach(tabIdx => _rebuildTabContent(tabIdx, paneElMap));
    _pulsePane(a);
    _pulsePane(b);
}

function _buildSwapTargetOptions(select, fromPaneId) {
    select.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "swap with…";
    placeholder.selected = true;
    select.appendChild(placeholder);

    PANES.forEach(otherId => {
        if (otherId === fromPaneId) return;
        const loc = _findPaneLocation(otherId);
        const tabLabel = loc ? TABS[loc.tabIdx].label : "?";
        const opt = document.createElement("option");
        opt.value = otherId;
        opt.textContent = `${otherId} · ${tabLabel}`;
        select.appendChild(opt);
    });
}

// Hover popup on tab labels — compact place for pane-swap controls.
(function _setupTabSwapPopup() {
    const tabBar = document.getElementById("tab-bar");
    if (!tabBar) return;

    const menu = document.createElement("div");
    menu.id = "tab-swap-menu";
    document.body.appendChild(menu);

    let hideTimer = null;

    function hideMenu() {
        menu.classList.remove("open");
    }

    function scheduleHide() {
        clearTimeout(hideTimer);
        hideTimer = setTimeout(hideMenu, 150);
    }

    function cancelHide() {
        clearTimeout(hideTimer);
    }

    function showForButton(btn) {
        const tabIdx = Number(btn.dataset.tabIdx);
        if (!Number.isInteger(tabIdx) || !TABS[tabIdx]) return;

        const panes = TABS[tabIdx].panes;
        menu.innerHTML = "";

        const title = document.createElement("div");
        title.className = "tab-swap-title";
        title.textContent = `Swap panes in “${TABS[tabIdx].label}”`;
        menu.appendChild(title);

        panes.forEach(paneId => {
            const row = document.createElement("div");
            row.className = "tab-swap-row";

            const name = document.createElement("span");
            name.className = "tab-swap-pane-name";
            name.textContent = paneId;

            const select = document.createElement("select");
            select.className = "tab-swap-select";
            _buildSwapTargetOptions(select, paneId);
            select.addEventListener("change", () => {
                const target = select.value;
                if (!target) return;
                _swapPanes(paneId, target);
                showForButton(btn); // refresh options + tab membership labels
            });

            row.appendChild(name);
            row.appendChild(select);
            menu.appendChild(row);
        });

        const rect = btn.getBoundingClientRect();
        menu.style.left = `${Math.max(8, rect.left)}px`;
        menu.style.top = `${rect.bottom + 6}px`;
        menu.classList.add("open");
    }

    tabBar.addEventListener("mouseover", ev => {
        const btn = ev.target.closest(".tab-btn");
        if (!btn || btn.classList.contains("tab-add")) return;
        cancelHide();
        showForButton(btn);
    });

    tabBar.addEventListener("mouseout", ev => {
        const fromBtn = ev.target.closest(".tab-btn");
        if (!fromBtn) return;
        if (menu.contains(ev.relatedTarget)) return;
        scheduleHide();
    });

    menu.addEventListener("mouseenter", cancelHide);
    menu.addEventListener("mouseleave", scheduleHide);
})();

// ---------------------------------------------------------------------------
// Filter inputs
// ---------------------------------------------------------------------------
export function _uiSetupPane(id) {
    const input = document.querySelector(`.filter-input[data-pane="${id}"]`);
    if (input) {
        input.addEventListener("input", () => {
            const val = input.value.trim();
            if (!val) {
                state.filters[id] = null;
                input.classList.remove("invalid");
            } else {
                try {
                    state.filters[id] = new RegExp(val, "i");
                    input.classList.remove("invalid");
                } catch {
                    state.filters[id] = null;
                    input.classList.add("invalid");
                }
            }
            rerenderPane(id);
        });
    }

}
PANES.forEach(_uiSetupPane);

// ---------------------------------------------------------------------------
// Serial TX input — Enter or Send button
// wsSend is provided by ws.js in live mode, or stubbed in static exports.
// ---------------------------------------------------------------------------
function sendSerial(paneId) {
    const input = document.getElementById("input-" + paneId);
    if (!input) return;
    const text  = input.value.trim();
    if (!text) return;
    input.value = "";
    window.wsSend?.({ cmd: "send_raw", id: paneId, data: text + "\n" });
}

export function _uiSetupTxPane(id) {
    const input = document.getElementById("input-" + id);
    if (!input) return;
    input.addEventListener("keydown", e => {
        if (e.key === "Enter") { e.preventDefault(); sendSerial(id); }
    });
    const sendBtn = document.querySelector(`.send-btn[data-pane="${id}"]`);
    if (sendBtn) sendBtn.addEventListener("click", () => sendSerial(id));
}

PANES.forEach(_uiSetupTxPane);

// ---------------------------------------------------------------------------
// Splitter drag — delegated, with pointer + mouse + touch fallback
// (Safari/macOS trackpad friendly)
// ---------------------------------------------------------------------------
(function setupSplitterDrag() {
    function findNeighborPanes(splitter) {
        const tabContent = splitter.parentElement;
        let paneLeft = null, paneRight = null, passed = false;
        for (const child of tabContent.children) {
            if (child === splitter) { passed = true; continue; }
            if (child.classList.contains("pane")) {
                if (!passed) paneLeft = child;
                else if (!paneRight) paneRight = child;
            }
        }
        return { tabContent, paneLeft, paneRight };
    }

    function eventX(ev) {
        if (ev.touches && ev.touches[0]) return ev.touches[0].clientX;
        if (ev.changedTouches && ev.changedTouches[0]) return ev.changedTouches[0].clientX;
        return ev.clientX;
    }

    function startDrag(splitter, ev) {
        const { tabContent, paneLeft, paneRight } = findNeighborPanes(splitter);
        if (!paneLeft || !paneRight) return;

        ev.preventDefault();
        splitter.classList.add("dragging");
        document.body.style.cursor = "col-resize";

        const startX = eventX(ev);
        const startLeftW = paneLeft.getBoundingClientRect().width;
        const totalW = tabContent.getBoundingClientRect().width - splitter.offsetWidth;

        function onMove(moveEv) {
            moveEv.preventDefault();
            const x = eventX(moveEv);
            const newLeft = Math.min(Math.max(startLeftW + x - startX, 120), totalW - 120);
            paneLeft.style.flex = "none";
            paneRight.style.flex = "none";
            paneLeft.style.width = newLeft + "px";
            paneRight.style.width = (totalW - newLeft) + "px";
        }

        function onEnd() {
            splitter.classList.remove("dragging");
            document.body.style.cursor = "";
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onEnd);
            window.removeEventListener("pointercancel", onEnd);
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onEnd);
            window.removeEventListener("touchmove", onMove);
            window.removeEventListener("touchend", onEnd);
            window.removeEventListener("touchcancel", onEnd);
        }

        // Register all move/end listeners; whichever event model fires will work.
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onEnd);
        window.addEventListener("pointercancel", onEnd);
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onEnd);
        window.addEventListener("touchmove", onMove, { passive: false });
        window.addEventListener("touchend", onEnd);
        window.addEventListener("touchcancel", onEnd);
    }

    document.addEventListener("pointerdown", ev => {
        const splitter = ev.target.closest(".splitter");
        if (!splitter) return;
        startDrag(splitter, ev);
    });

    document.addEventListener("mousedown", ev => {
        const splitter = ev.target.closest(".splitter");
        if (!splitter) return;
        startDrag(splitter, ev);
    });

    document.addEventListener("touchstart", ev => {
        const splitter = ev.target.closest(".splitter");
        if (!splitter) return;
        startDrag(splitter, ev);
    }, { passive: false });
})();
