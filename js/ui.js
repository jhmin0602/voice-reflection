// DOM manipulation helpers — card-based UI

const UI = {
  screens: {
    settings: document.getElementById("screen-settings"),
    pin: document.getElementById("screen-pin"),
    setup: document.getElementById("screen-setup"),
    cards: document.getElementById("screen-cards"),
    saving: document.getElementById("screen-saving"),
    done: document.getElementById("screen-done"),
  },

  _cardIndex: 0,
  _totalCards: 0,
  _speechAvailable: false,

  showScreen(name) {
    Object.values(this.screens).forEach((s) => s.classList.remove("active"));
    this.screens[name].classList.add("active");
  },

  // ── PIN screen ──
  initPin(onSubmit) {
    const pinInput = document.getElementById("pin-input");
    const submitBtn = document.getElementById("btn-pin-submit");
    const error = document.getElementById("pin-error");

    const submit = () => {
      const val = pinInput.value.trim();
      if (val) {
        error.classList.add("hidden");
        onSubmit(val);
      }
    };

    submitBtn.addEventListener("click", submit);
    pinInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submit();
    });
  },

  showPinError() {
    document.getElementById("pin-error").classList.remove("hidden");
    document.getElementById("pin-input").value = "";
    document.getElementById("pin-input").focus();
  },

  // ── Settings screen ──
  initSettings(onSave) {
    const form = document.getElementById("settings-form");
    const error = document.getElementById("settings-error");

    // Pre-fill from localStorage
    document.getElementById("settings-pin").value = localStorage.getItem("app_pin") || "";
    document.getElementById("settings-gemini-key").value = localStorage.getItem("gemini_api_key") || CONFIG.gemini_api_key || "";
    document.getElementById("settings-notion-key").value = localStorage.getItem("notion_api_key") || CONFIG.notion_api_key || "";
    document.getElementById("settings-worker-url").value = localStorage.getItem("worker_url") || CONFIG.worker_url || "";
    document.getElementById("settings-notion-db").value =
      localStorage.getItem("notion_db_id") || CONFIG.notion_db_id || "";

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const pin = document.getElementById("settings-pin").value.trim();
      const geminiKey = document.getElementById("settings-gemini-key").value.trim();
      const notionKey = document.getElementById("settings-notion-key").value.trim();
      const workerUrl = document.getElementById("settings-worker-url").value.trim();
      const notionDb = document.getElementById("settings-notion-db").value.trim();

      if (!pin || !geminiKey || !notionKey || !workerUrl || !notionDb) {
        error.classList.remove("hidden");
        return;
      }

      error.classList.add("hidden");
      localStorage.setItem("app_pin", pin);
      localStorage.setItem("gemini_api_key", geminiKey);
      localStorage.setItem("notion_api_key", notionKey);
      localStorage.setItem("worker_url", workerUrl);
      localStorage.setItem("notion_db_id", notionDb);
      onSave();
    });
  },

  initSettingsLink() {
    document.getElementById("btn-open-settings").addEventListener("click", () => {
      document.getElementById("settings-pin").value = localStorage.getItem("app_pin") || "";
      document.getElementById("settings-gemini-key").value = localStorage.getItem("gemini_api_key") || CONFIG.gemini_api_key || "";
      document.getElementById("settings-notion-key").value = localStorage.getItem("notion_api_key") || CONFIG.notion_api_key || "";
      document.getElementById("settings-worker-url").value = localStorage.getItem("worker_url") || CONFIG.worker_url || "";
      document.getElementById("settings-notion-db").value =
        localStorage.getItem("notion_db_id") || CONFIG.notion_db_id || "";
      this.showScreen("settings");
    });
  },

  // ── Setup screen ──
  initSetup(onStart) {
    const btnDaily = document.getElementById("btn-daily");
    const btnWeekly = document.getElementById("btn-weekly");
    const dateInput = document.getElementById("date-input");
    const btnStart = document.getElementById("btn-start");
    let isWeekly = false;

    dateInput.value = new Date().toISOString().split("T")[0];

    btnDaily.addEventListener("click", () => {
      isWeekly = false;
      btnDaily.classList.add("active");
      btnWeekly.classList.remove("active");
    });
    btnWeekly.addEventListener("click", () => {
      isWeekly = true;
      btnWeekly.classList.add("active");
      btnDaily.classList.remove("active");
    });

    btnStart.addEventListener("click", () => {
      onStart(isWeekly, dateInput.value);
    });
  },

  // ── Cards screen ──

  /**
   * Build all question cards + final save card.
   * @param {Array} questions - [{key, prompt}, ...]
   * @param {string} emoji - "🌅" or "📅"
   * @param {string} label - "Daily Reflection" or "Weekly Reflection"
   * @param {object} callbacks - { onRecord, onText, onRedo, onSave }
   */
  buildCards(questions, emoji, label, callbacks) {
    this._speechAvailable = Speech.init();
    this._cardIndex = 0;
    this._totalCards = questions.length + 1; // +1 for save card
    this._callbacks = callbacks;

    document.getElementById("cards-label").textContent = `${emoji} ${label}`;
    document.getElementById("cards-progress").textContent = `1 / ${questions.length}`;

    const track = document.getElementById("card-track");
    track.innerHTML = "";

    // Question cards
    questions.forEach((q, i) => {
      track.appendChild(this._createQuestionCard(q, i));
    });

    // Save card
    track.appendChild(this._createSaveCard(questions.length));

    this._buildDots();
    this._initNavigation();
    this._initSwipeSync();
    this.goToCard(0);
  },

  _createQuestionCard(q, index) {
    const card = document.createElement("div");
    card.className = "card card-idle";
    card.dataset.index = index;
    card.dataset.key = q.key;

    const micSvg = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>';
    const stopSvg = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';

    card.innerHTML = `
      <div class="card-question">${q.prompt}</div>
      <div class="card-body">
        <div class="card-idle-area">
          <button class="btn-record" data-action="record" aria-label="Tap to record">${micSvg}</button>
          <div class="card-record-hint">Tap to record</div>
          <button class="btn-link card-type-toggle" data-action="type-toggle">Type instead</button>
          <div class="card-text-area">
            <textarea class="card-textarea" placeholder="Type your answer..." rows="4"></textarea>
            <div class="card-text-actions">
              <button class="btn-link card-type-cancel" data-action="type-cancel">Cancel</button>
              <button class="btn-secondary-sm" data-action="text-submit">Summarize</button>
            </div>
          </div>
        </div>
        <div class="card-summarizing-area">
          <div class="spinner-small"></div>
          <div class="card-record-hint">Summarizing...</div>
        </div>
        <div class="card-done-area">
          <div class="card-summary"></div>
          <button class="btn-secondary-sm" data-action="redo">Redo</button>
        </div>
      </div>
    `;

    // Hide mic if no speech available
    if (!this._speechAvailable) {
      const recordBtn = card.querySelector('.btn-record');
      const hint = card.querySelector('.card-record-hint');
      recordBtn.classList.add("hidden");
      hint.classList.add("hidden");
      // Auto-show text area
      card.querySelector('.card-text-area').classList.add('active');
      card.querySelector('.card-type-toggle').classList.add('hidden');
    }

    this._wireCardEvents(card, index, micSvg, stopSvg);
    return card;
  },

  _createSaveCard() {
    const card = document.createElement("div");
    card.className = "card";
    card.dataset.index = "save";
    card.innerHTML = `
      <div class="card-question">All done!</div>
      <div class="save-card-content">
        <div id="save-card-status" class="save-card-status">Answer all questions, then save.</div>
        <button id="btn-save-all" class="btn-primary" disabled>Save All</button>
      </div>
    `;

    card.querySelector("#btn-save-all").addEventListener("click", () => {
      if (this._callbacks.onSave) this._callbacks.onSave();
    });

    return card;
  },

  _wireCardEvents(card, index, micSvg, stopSvg) {
    const recordBtn = card.querySelector('[data-action="record"]');
    const typeToggle = card.querySelector('[data-action="type-toggle"]');
    const typeCancel = card.querySelector('[data-action="type-cancel"]');
    const textSubmit = card.querySelector('[data-action="text-submit"]');
    const redoBtn = card.querySelector('[data-action="redo"]');
    const textArea = card.querySelector('.card-text-area');
    const textarea = card.querySelector('.card-textarea');

    // Record button
    if (recordBtn) {
      recordBtn.addEventListener("click", () => {
        if (Speech.listening) {
          // Stop recording
          Speech.stopListening();
          return;
        }
        this._startRecording(card, index, recordBtn, micSvg, stopSvg);
      });
    }

    // Type instead toggle
    if (typeToggle) {
      typeToggle.addEventListener("click", () => {
        textArea.classList.toggle("active");
        typeToggle.textContent = textArea.classList.contains("active") ? "Use mic" : "Type instead";
      });
    }

    // Type cancel
    if (typeCancel) {
      typeCancel.addEventListener("click", () => {
        textArea.classList.remove("active");
        textarea.value = "";
        if (typeToggle) typeToggle.textContent = "Type instead";
      });
    }

    // Text submit
    if (textSubmit) {
      textSubmit.addEventListener("click", () => {
        const text = textarea.value.trim();
        if (!text) return;
        if (this._callbacks.onText) this._callbacks.onText(index, text);
      });
    }

    // Redo
    if (redoBtn) {
      redoBtn.addEventListener("click", () => {
        if (this._callbacks.onRedo) this._callbacks.onRedo(index);
      });
    }
  },

  async _startRecording(card, index, recordBtn, micSvg, stopSvg) {
    recordBtn.classList.add("recording");
    recordBtn.innerHTML = stopSvg;
    const hint = card.querySelector('.card-record-hint');
    hint.textContent = "Listening... tap to stop";

    try {
      const transcript = await Speech.listen((interim) => {
        hint.textContent = interim || "Listening...";
      });
      recordBtn.classList.remove("recording");
      recordBtn.innerHTML = micSvg;
      hint.textContent = "Tap to record";

      if (transcript) {
        if (this._callbacks.onRecord) this._callbacks.onRecord(index, transcript);
      } else {
        hint.textContent = "Didn't catch that. Tap to try again.";
      }
    } catch (err) {
      recordBtn.classList.remove("recording");
      recordBtn.innerHTML = micSvg;
      hint.textContent = "Mic error. Try typing instead.";
      console.error("Speech error:", err);
    }
  },

  /**
   * Set card visual state: "idle", "recording", "summarizing", "done"
   */
  setCardState(index, state, summaryText) {
    const track = document.getElementById("card-track");
    const card = track.children[index];
    if (!card) return;

    card.className = `card card-${state}`;

    if (state === "done" && summaryText) {
      card.querySelector(".card-summary").textContent = summaryText;
    }

    if (state === "idle") {
      const textarea = card.querySelector('.card-textarea');
      if (textarea) textarea.value = "";
      const textArea = card.querySelector('.card-text-area');
      if (textArea) textArea.classList.remove('active');
      const toggle = card.querySelector('.card-type-toggle');
      if (toggle) toggle.textContent = "Type instead";
    }

    this.updateDots();
    this.updateSaveCard();
  },

  /**
   * Navigate to a specific card index.
   */
  goToCard(index) {
    const track = document.getElementById("card-track");
    if (index < 0 || index >= this._totalCards) return;

    this._cardIndex = index;
    const card = track.children[index];
    if (card) {
      card.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
    }

    this._updateNavState();
  },

  _initNavigation() {
    const backBtn = document.getElementById("btn-back");
    const nextBtn = document.getElementById("btn-next");

    // Remove old listeners by cloning
    const newBack = backBtn.cloneNode(true);
    const newNext = nextBtn.cloneNode(true);
    backBtn.parentNode.replaceChild(newBack, backBtn);
    nextBtn.parentNode.replaceChild(newNext, nextBtn);

    newBack.addEventListener("click", () => this.goToCard(this._cardIndex - 1));
    newNext.addEventListener("click", () => this.goToCard(this._cardIndex + 1));
  },

  _initSwipeSync() {
    const track = document.getElementById("card-track");
    let scrollTimer = null;

    track.addEventListener("scroll", () => {
      if (scrollTimer) clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        const cardWidth = track.children[0]?.offsetWidth || track.offsetWidth;
        const newIndex = Math.round(track.scrollLeft / cardWidth);
        if (newIndex !== this._cardIndex && newIndex >= 0 && newIndex < this._totalCards) {
          this._cardIndex = newIndex;
          this._updateNavState();
        }
      }, 100);
    });
  },

  _updateNavState() {
    const backBtn = document.getElementById("btn-back");
    const nextBtn = document.getElementById("btn-next");
    const progress = document.getElementById("cards-progress");

    backBtn.disabled = this._cardIndex === 0;
    nextBtn.disabled = this._cardIndex >= this._totalCards - 1;

    // Show question number or "Save" for last card
    const questions = this._totalCards - 1;
    if (this._cardIndex < questions) {
      progress.textContent = `${this._cardIndex + 1} / ${questions}`;
    } else {
      progress.textContent = "Save";
    }

    this.updateDots();
  },

  _buildDots() {
    const container = document.getElementById("card-dots");
    container.innerHTML = "";
    for (let i = 0; i < this._totalCards; i++) {
      const dot = document.createElement("div");
      dot.className = "dot";
      container.appendChild(dot);
    }
  },

  updateDots() {
    const dots = document.getElementById("card-dots").children;
    const track = document.getElementById("card-track");

    for (let i = 0; i < dots.length; i++) {
      dots[i].className = "dot";
      if (i === this._cardIndex) {
        dots[i].classList.add("active");
      }
      // Mark done cards
      if (i < this._totalCards - 1) {
        const card = track.children[i];
        if (card && card.classList.contains("card-done")) {
          dots[i].classList.add("done");
        }
      }
    }
  },

  updateSaveCard() {
    const track = document.getElementById("card-track");
    const questions = this._totalCards - 1;
    let doneCount = 0;
    for (let i = 0; i < questions; i++) {
      if (track.children[i]?.classList.contains("card-done")) doneCount++;
    }

    const status = document.getElementById("save-card-status");
    const saveBtn = document.getElementById("btn-save-all");

    if (doneCount === 0) {
      status.textContent = "Answer all questions, then save.";
      saveBtn.disabled = true;
    } else if (doneCount < questions) {
      status.textContent = `${doneCount} / ${questions} answered. You can save now or answer more.`;
      saveBtn.disabled = false;
    } else {
      status.textContent = `All ${questions} questions answered!`;
      saveBtn.disabled = false;
    }
  },

  // ── Saving screen ──
  setSavingDetail(text) {
    document.getElementById("saving-detail").textContent = text;
  },

  // ── Done screen ──
  initDone(notionUrl, onNewSession) {
    const link = document.getElementById("notion-link");
    if (notionUrl) {
      link.href = notionUrl;
      link.classList.remove("hidden");
    } else {
      link.classList.add("hidden");
    }
    document.getElementById("btn-new-session").addEventListener("click", onNewSession, { once: true });
  },
};
