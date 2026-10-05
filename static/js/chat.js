/* ============================================================
   Chat client — vanilla JS, no frameworks.
   Talks to POST /api/chat/ with CSRF.
   ============================================================ */

(function () {
    "use strict";

    // ---------- DOM refs ----------
    const chatScroll   = document.getElementById("chatScroll");
    const messagesEl   = document.getElementById("messages");
    const welcomeEl    = document.getElementById("welcome");
    const form         = document.getElementById("chatForm");
    const input        = document.getElementById("questionInput");
    const sendBtn      = document.getElementById("sendBtn");
    const newChatBtn   = document.getElementById("newChatBtn");
    const menuBtn      = document.getElementById("menuBtn");
    const backdrop     = document.getElementById("backdrop");
    const sidebar      = document.getElementById("sidebar");
    const charCounter  = document.getElementById("charCounter");

    const MAX_LEN = parseInt(input.getAttribute("maxlength"), 10) || 2000;

    // ---------- CSRF ----------
    function getCsrfToken() {
        const el = document.querySelector("#csrfHolder input[name='csrfmiddlewaretoken']");
        return el ? el.value : "";
    }

    // ---------- Auto-resize textarea ----------
    function autoResize() {
        input.style.height = "auto";
        input.style.height = Math.min(input.scrollHeight, 180) + "px";
    }

    // ---------- Char counter ----------
    function updateCounter() {
        const len = input.value.length;
        if (len === 0) {
            charCounter.textContent = "";
            charCounter.className = "char-counter";
            return;
        }
        charCounter.textContent = `${len} / ${MAX_LEN}`;
        charCounter.className = "char-counter";
        if (len > MAX_LEN * 0.9) charCounter.classList.add("danger");
        else if (len > MAX_LEN * 0.7) charCounter.classList.add("warn");
    }

    input.addEventListener("input", function () {
        autoResize();
        updateCounter();
    });

    // ---------- Scroll ----------
    function scrollToBottom() {
        chatScroll.scrollTop = chatScroll.scrollHeight;
    }

    // ---------- Escape ----------
    function escapeHtml(str) {
        const div = document.createElement("div");
        div.textContent = str;
        return div.innerHTML;
    }

    // ---------- Markdown-ish renderer ----------
    function renderAiHtml(text) {
        let safe = escapeHtml(text);

        // Bold
        safe = safe.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
        // Italic (single * but not **)
        safe = safe.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
        // Inline code
        safe = safe.replace(/`([^`\n]+)`/g, "<code>$1</code>");

        const lines = safe.split("\n");
        let html = "";
        let inList = false;

        for (const raw of lines) {
            const line = raw.trim();

            const bullet = line.match(/^[-*•]\s+(.*)$/);
            const num = line.match(/^(\d+)\.\s+(.*)$/);

            if (bullet) {
                if (!inList) { html += "<ul>"; inList = true; }
                html += `<li>${bullet[1]}</li>`;
            } else if (num) {
                if (!inList) { html += "<ol>"; inList = true; }
                html += `<li>${num[2]}</li>`;
            } else {
                if (inList) { html += "</ul>"; inList = false; }
                if (line === "") html += "<br>";
                else html += `<p>${line}</p>`;
            }
        }
        if (inList) html += "</ul>";
        return html || "<p></p>";
    }

    // ---------- Time helper ----------
    function nowTime() {
        const d = new Date();
        let h = d.getHours();
        const m = String(d.getMinutes()).padStart(2, "0");
        const ampm = h >= 12 ? "PM" : "AM";
        h = h % 12 || 12;
        return `${h}:${m} ${ampm}`;
    }

    // ---------- Create message element ----------
    function createMessage(role, content, { error = false } = {}) {
        const wrap = document.createElement("div");
        wrap.className = `message ${role}`;

        const avatar = document.createElement("div");
        avatar.className = "msg-avatar";
        avatar.textContent = role === "ai" ? "AI" : "You";

        const contentWrap = document.createElement("div");
        contentWrap.className = "msg-content";

        const roleLabel = document.createElement("div");
        roleLabel.className = "msg-role";
        roleLabel.textContent = (role === "ai" ? "Candidate AI" : "You") + " · " + nowTime();

        const bubble = document.createElement("div");
        bubble.className = "msg-bubble" + (error ? " error" : "");

        if (role === "ai" && !error) {
            bubble.innerHTML = renderAiHtml(content);

            // Copy button
            const copyBtn = document.createElement("button");
            copyBtn.type = "button";
            copyBtn.className = "copy-btn";
            copyBtn.title = "Copy answer";
            copyBtn.textContent = "⧉";
            copyBtn.addEventListener("click", function () {
                navigator.clipboard.writeText(content).then(function () {
                    copyBtn.classList.add("copied");
                    copyBtn.textContent = "✓";
                    setTimeout(function () {
                        copyBtn.classList.remove("copied");
                        copyBtn.textContent = "⧉";
                    }, 1400);
                });
            });
            bubble.appendChild(copyBtn);
        } else {
            bubble.textContent = content;
        }

        contentWrap.appendChild(roleLabel);
        contentWrap.appendChild(bubble);
        wrap.appendChild(avatar);
        wrap.appendChild(contentWrap);
        return wrap;
    }

    // ---------- Append ----------
    function appendMessage(role, content, opts = {}) {
        const el = createMessage(role, content, opts);
        messagesEl.appendChild(el);
        scrollToBottom();
        return el;
    }

    // ---------- Typing ----------
    function showTyping() {
        const wrap = document.createElement("div");
        wrap.className = "message ai";

        const avatar = document.createElement("div");
        avatar.className = "msg-avatar";
        avatar.textContent = "AI";

        const contentWrap = document.createElement("div");
        contentWrap.className = "msg-content";

        const roleLabel = document.createElement("div");
        roleLabel.className = "msg-role";
        roleLabel.textContent = "Candidate AI · typing…";

        const bubble = document.createElement("div");
        bubble.className = "msg-bubble";
        bubble.innerHTML = `<div class="typing"><span></span><span></span><span></span></div>`;

        contentWrap.appendChild(roleLabel);
        contentWrap.appendChild(bubble);
        wrap.appendChild(avatar);
        wrap.appendChild(contentWrap);
        messagesEl.appendChild(wrap);
        scrollToBottom();
        return wrap;
    }

    // ---------- Send ----------
    let isSending = false;

        async function sendQuestion(question) {
        question = (question || "").trim();
        if (!question || isSending) return;
        if (question.length > MAX_LEN) question = question.slice(0, MAX_LEN);

        welcomeEl.classList.add("hidden");
        appendMessage("user", question);

        input.value = "";
        autoResize();
        updateCounter();

        isSending = true;
        sendBtn.disabled = true;
        sendBtn.classList.add("loading");

        // Build the AI message shell immediately (typing state).
        const typingEl = showTyping();
        const typingBubble = typingEl.querySelector(".msg-bubble");
        const typingLabel = typingEl.querySelector(".msg-role");

        let res;
        try {
            res = await fetch("/api/chat/", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": getCsrfToken(),
                },
                body: JSON.stringify({ question }),
            });
        } catch (err) {
            typingEl.remove();
            appendMessage("ai", "Could not reach the server.", { error: true });
            isSending = false;
            sendBtn.disabled = false;
            sendBtn.classList.remove("loading");
            input.focus();
            return;
        }

        // Pre-stream error → JSON response
        const contentType = res.headers.get("content-type") || "";
        if (!res.ok || contentType.includes("application/json")) {
            const data = await res.json().catch(() => ({}));
            typingEl.remove();
            const msg = data.error || `Request failed (${res.status}).`;
            appendMessage("ai", msg, { error: true });
            isSending = false;
            sendBtn.disabled = false;
            sendBtn.classList.remove("loading");
            input.focus();
            return;
        }

        // Streaming path — read chunks
        typingLabel.textContent = "Candidate AI · responding…";
        typingBubble.innerHTML = "";   // clear the dots
        let fullText = "";

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                fullText += chunk;
                typingBubble.innerHTML = renderAiHtml(fullText);
                scrollToBottom();
            }
        } catch (err) {
            fullText += "\n\n[stream interrupted]";
            typingBubble.innerHTML = renderAiHtml(fullText);
        }

        // Finalize: swap the typing element into a proper AI message
        // so it gets the copy button + correct role label.
        typingEl.remove();
        appendMessage("ai", fullText || "The AI returned an empty response.");

        isSending = false;
        sendBtn.disabled = false;
        sendBtn.classList.remove("loading");
        input.focus();
    }

    // ---------- Submit ----------
    form.addEventListener("submit", function (e) {
        e.preventDefault();
        sendQuestion(input.value);
    });

    // ---------- Enter / Shift+Enter ----------
    input.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendQuestion(input.value);
        }
    });

    // ---------- Suggested buttons (sidebar + cards) ----------
    document.querySelectorAll(".suggestion-card, .tool-item[data-q]").forEach(function (btn) {
        btn.addEventListener("click", function () {
            const q = btn.getAttribute("data-q");
            if (q) sendQuestion(q);
            // Close mobile sidebar
            sidebar.classList.remove("open");
            backdrop.classList.remove("show");
        });
    });

    // ---------- New chat ----------
    newChatBtn.addEventListener("click", function () {
        messagesEl.innerHTML = "";
        welcomeEl.classList.remove("hidden");
        input.value = "";
        autoResize();
        updateCounter();
        input.focus();
    });

    // ---------- Mobile sidebar ----------
    function openSidebar() {
        sidebar.classList.add("open");
        backdrop.classList.add("show");
    }
    function closeSidebar() {
        sidebar.classList.remove("open");
        backdrop.classList.remove("show");
    }
    menuBtn.addEventListener("click", openSidebar);
    backdrop.addEventListener("click", closeSidebar);

    // ---------- Initial focus ----------
    window.addEventListener("load", function () {
        input.focus();
        updateCounter();
    });
})();