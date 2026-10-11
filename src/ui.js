(function initializeUi(global) {
  "use strict";

  const root = global.CGMB = global.CGMB || {};

  const ICONS = Object.freeze({
    bookmark: "M6.75 4.75A1.75 1.75 0 0 1 8.5 3h7A1.75 1.75 0 0 1 17.25 4.75v16L12 17.45l-5.25 3.3v-16Z",
    edit: "m15.25 5.25 3.5 3.5M5 19l3.75-.75L19 8a1.75 1.75 0 0 0-3-1.25L5.75 17 5 19Z",
    remove: "M6 6l12 12M18 6 6 18",
    close: "M6 6l12 12M18 6 6 18",
    newTab: "M14 3h7v7M21 3l-10 10M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"
  });

  function icon(name) {
    const namespace = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(namespace, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS(namespace, "path");
    path.setAttribute("d", ICONS[name]);
    svg.append(path);
    return svg;
  }

  function createButton(className, label, iconName) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.setAttribute("aria-label", label);
    button.title = label;
    button.append(icon(iconName));
    return button;
  }

  function createShell(handlers) {
    const toggle = createButton("cgmb-toggle", "Open message bookmarks (Alt+Shift+B)", "bookmark");
    const counter = document.createElement("span");
    counter.className = "cgmb-toggle-count";
    counter.textContent = "0";
    toggle.append(counter);

    const panel = document.createElement("aside");
    panel.className = "cgmb-panel";
    panel.setAttribute("aria-label", "Message bookmarks");
    panel.setAttribute("aria-hidden", "true");

    const header = document.createElement("header");
    header.className = "cgmb-panel-header";
    const heading = document.createElement("h2");
    heading.textContent = "Bookmarks";
    const close = createButton("cgmb-icon-button", "Close bookmarks", "close");
    header.append(heading, close);

    const status = document.createElement("p");
    status.className = "cgmb-status";
    status.hidden = true;
    status.setAttribute("role", "status");

    const list = document.createElement("div");
    list.className = "cgmb-list";
    list.setAttribute("role", "list");
    panel.append(header, status, list);
    document.documentElement.append(toggle, panel);

    toggle.addEventListener("click", handlers.onTogglePanel);
    close.addEventListener("click", handlers.onClosePanel);

    return { toggle, counter, panel, list, status, close };
  }

  function setPanelOpen(shell, isOpen) {
    shell.panel.classList.toggle("cgmb-panel-open", isOpen);
    shell.panel.setAttribute("aria-hidden", String(!isOpen));
    shell.toggle.setAttribute("aria-expanded", String(isOpen));
    shell.toggle.setAttribute("aria-label", `${isOpen ? "Close" : "Open"} message bookmarks (Alt+Shift+B)`);
    if (isOpen) {
      shell.close.focus({ preventScroll: true });
    } else if (shell.panel.contains(document.activeElement)) {
      shell.toggle.focus({ preventScroll: true });
    }
  }

  function setStatus(shell, message) {
    shell.status.textContent = message || "";
    shell.status.hidden = !message;
  }

  function renderList(shell, bookmarks, handlers) {
    shell.list.replaceChildren();
    shell.counter.textContent = String(bookmarks.length);

    if (!bookmarks.length) {
      const empty = document.createElement("p");
      empty.className = "cgmb-empty";
      empty.textContent = "No bookmarks in this conversation yet.";
      shell.list.append(empty);
      return;
    }

    bookmarks.forEach((bookmark) => {
      const item = document.createElement("article");
      item.className = "cgmb-item";
      item.setAttribute("role", "listitem");

      const main = document.createElement("button");
      main.type = "button";
      main.className = "cgmb-item-main";
      main.setAttribute("aria-label", `Go to bookmarked message: ${bookmark.title}`);

      const title = document.createElement("span");
      title.className = "cgmb-item-title";
      title.textContent = bookmark.title;
      const preview = document.createElement("span");
      preview.className = "cgmb-item-preview";
      preview.textContent = bookmark.preview;
      const missing = document.createElement("span");
      missing.className = "cgmb-item-missing";
      missing.textContent = "Message not found";
      missing.hidden = true;
      main.append(title, preview, missing);

      const actions = document.createElement("div");
      actions.className = "cgmb-item-actions";
      const edit = createButton("cgmb-icon-button", `Rename ${bookmark.title}`, "edit");
      const remove = createButton("cgmb-icon-button", `Remove ${bookmark.title}`, "remove");
      actions.append(edit, remove);
      item.append(main, actions);
      shell.list.append(item);

      main.addEventListener("click", async () => {
        main.disabled = true;
        main.setAttribute('aria-busy', 'true');
        missing.textContent = 'Loading message…';
        missing.hidden = false;
        try {
          const found = await handlers.onNavigate(bookmark);
          missing.hidden = found;
          missing.textContent = 'Message could not be loaded. Try again.';
          item.classList.toggle("cgmb-item-not-found", !found);
        } catch (error) {
          missing.textContent = 'Message could not be loaded. Try again.';
          console.warn('[CGMB] Navigation failed.', error);
        } finally {
          main.disabled = false;
          main.removeAttribute('aria-busy');
        }
      });

      remove.addEventListener("click", () => handlers.onRemove(bookmark.id));
      edit.addEventListener("click", () => beginRename(item, title, bookmark, handlers.onRename));
    });
  }

  function beginRename(item, titleElement, bookmark, onRename) {
    if (item.querySelector(".cgmb-title-input")) {
      return;
    }

    const input = document.createElement("input");
    input.type = "text";
    input.className = "cgmb-title-input";
    input.value = bookmark.title;
    input.maxLength = 64;
    input.setAttribute("aria-label", "Bookmark title");
    titleElement.replaceWith(input);
    input.focus();
    input.select();

    let finished = false;
    const finish = async (save) => {
      if (finished) {
        return;
      }
      finished = true;
      const value = input.value.trim() || bookmark.title;
      if (save && value !== bookmark.title) {
        await onRename(bookmark.id, value);
      } else {
        input.replaceWith(titleElement);
      }
    };

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        finish(true);
      } else if (event.key === "Escape") {
        event.preventDefault();
        finish(false);
      }
    });
    input.addEventListener("blur", () => finish(true));
  }

  function addMessageControl(messageElement, handlers) {
    const currentButton = messageElement.querySelector(".cgmb-bookmark-button");
    if (messageElement.dataset.cgmbInitialized === "true" && currentButton) {
      return currentButton;
    }

    messageElement.dataset.cgmbInitialized = "true";
    const button = createButton("cgmb-bookmark-button", "Bookmark this message", "bookmark");
    button.setAttribute("aria-pressed", "false");

    // Own row avoids ChatGPT's hover-only opacity ancestors and action rerenders.
    const container = document.createElement("span");
    container.className = "cgmb-message-actions";
    container.append(button);
    messageElement.append(container);

    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      handlers.onToggleBookmark(messageElement);
    });
    return button;
  }

  function refreshNewChatLinks() {
    const controls = Array.from(document.querySelectorAll('button, a'));
    controls.filter((element) => {
      if (element.closest('[class*="cgmb-"]')) {
        return false;
      }
      const label = (element.getAttribute("aria-label") || element.textContent || "")
        .replace(/\s+/g, " ").trim();
      return /^(Nový chat|New chat)(?:\s*(?:Ctrl|Control|⌘).*)?$/i.test(label);
    }).forEach((control) => {
      let row = control.parentElement;
      if (!row) {
        return;
      }
      if (!row.classList.contains("cgmb-new-chat-row")) {
        row = document.createElement("span");
        row.className = "cgmb-new-chat-row";
        control.before(row);
        row.append(control);
      }
      if (row.querySelector(".cgmb-new-chat-tab")) {
        return;
      }
      const link = document.createElement("a");
      link.className = "cgmb-new-chat-tab";
      link.href = "https://chatgpt.com/";
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.title = "Nový chat v nové kartě";
      link.setAttribute("aria-label", "Nový chat v nové kartě");
      link.append(icon("newTab"));
      // Prevent delegation to ChatGPT while retaining native link navigation.
      link.addEventListener("click", (event) => event.stopPropagation());
      link.addEventListener("auxclick", (event) => event.stopPropagation());
      row.append(link);
    });
  }

  function setMessageControlState(messageElement, isBookmarked) {
    const button = messageElement.querySelector(".cgmb-bookmark-button");
    if (!button) {
      return;
    }
    button.classList.toggle("cgmb-bookmark-button-active", isBookmarked);
    button.setAttribute("aria-pressed", String(isBookmarked));
    button.setAttribute("aria-label", isBookmarked ? "Remove message bookmark" : "Bookmark this message");
    button.title = isBookmarked ? "Remove bookmark" : "Bookmark message";
  }

  function highlightMessage(element) {
    element.classList.add("cgmb-highlight");
    global.setTimeout(() => element.classList.remove("cgmb-highlight"), 1400);
  }

  root.ui = {
    createShell,
    setPanelOpen,
    setStatus,
    renderList,
    addMessageControl,
    refreshNewChatLinks,
    setMessageControlState,
    highlightMessage
  };
})(globalThis);
