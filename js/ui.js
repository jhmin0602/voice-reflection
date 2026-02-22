// DOM manipulation helpers

const UI = {
  screens: {
    pin: document.getElementById("screen-pin"),
    setup: document.getElementById("screen-setup"),
    chat: document.getElementById("screen-chat"),
    saving: document.getElementById("screen-saving"),
    done: document.getElementById("screen-done"),
  },

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

  // ── Setup screen ──
  initSetup(onStart) {
    const btnDaily = document.getElementById("btn-daily");
    const btnWeekly = document.getElementById("btn-weekly");
    const dateInput = document.getElementById("date-input");
    const btnStart = document.getElementById("btn-start");
    let isWeekly = false;

    // Default date to today
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

  // ── Chat screen ──
  updateChatHeader(current, total, topic) {
    document.getElementById("chat-progress").textContent = `${current} / ${total}`;
    document.getElementById("chat-topic").textContent = topic;
  },

  addMessage(text, type) {
    const container = document.getElementById("chat-messages");
    const msg = document.createElement("div");
    msg.className = `msg msg-${type}`;
    msg.textContent = text;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
    return msg;
  },

  clearMessages() {
    document.getElementById("chat-messages").innerHTML = "";
  },

  // ── Mic / text input ──
  _usingTextInput: false,

  initChatInput(onUserInput) {
    const micBtn = document.getElementById("btn-mic");
    const micStatus = document.getElementById("mic-status");
    const micContainer = document.getElementById("mic-container");
    const textContainer = document.getElementById("text-input-container");
    const textInput = document.getElementById("text-input");
    const sendBtn = document.getElementById("btn-send");
    const toggleBtn = document.getElementById("btn-toggle-input");

    this._usingTextInput = false;
    this._onUserInput = onUserInput;
    this._inputEnabled = false;

    // Check speech availability
    const speechAvailable = Speech.init();
    if (!speechAvailable) {
      this._switchToTextInput();
      toggleBtn.classList.add("hidden");
    }

    // Mic tap handler
    micBtn.addEventListener("click", async () => {
      if (!this._inputEnabled) return;
      if (Speech.listening) {
        Speech.stopListening();
        return;
      }

      micBtn.classList.add("listening");
      micStatus.textContent = "Listening...";

      try {
        const transcript = await Speech.listen((interim) => {
          micStatus.textContent = interim || "Listening...";
        });
        micBtn.classList.remove("listening");
        micStatus.textContent = "Tap mic to speak";

        if (transcript) {
          this._inputEnabled = false;
          onUserInput(transcript);
        } else {
          micStatus.textContent = "Didn't catch that. Tap to try again.";
        }
      } catch (err) {
        micBtn.classList.remove("listening");
        micStatus.textContent = "Mic error. Try typing instead.";
        console.error("Speech error:", err);
      }
    });

    // Text input handlers
    const submitText = () => {
      const text = textInput.value.trim();
      if (!text || !this._inputEnabled) return;
      textInput.value = "";
      this._inputEnabled = false;
      onUserInput(text);
    };

    sendBtn.addEventListener("click", submitText);
    textInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submitText();
    });

    // Toggle between mic and text
    toggleBtn.addEventListener("click", () => {
      if (this._usingTextInput) {
        this._switchToMicInput();
      } else {
        this._switchToTextInput();
      }
    });
  },

  _switchToTextInput() {
    this._usingTextInput = true;
    document.getElementById("mic-container").classList.add("hidden");
    document.getElementById("text-input-container").classList.add("active");
    document.getElementById("btn-toggle-input").textContent = "Use mic instead";
  },

  _switchToMicInput() {
    this._usingTextInput = false;
    document.getElementById("mic-container").classList.remove("hidden");
    document.getElementById("text-input-container").classList.remove("active");
    document.getElementById("btn-toggle-input").textContent = "Type instead";
  },

  enableInput() {
    this._inputEnabled = true;
    if (this._usingTextInput) {
      document.getElementById("text-input").focus();
    }
  },

  disableInput() {
    this._inputEnabled = false;
  },

  setMicStatus(text) {
    document.getElementById("mic-status").textContent = text;
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
