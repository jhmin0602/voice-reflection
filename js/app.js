// Main controller — card-based reflection session

const App = {
  isWeekly: false,
  dateStr: "",
  title: "",
  questions: [],
  answers: {}, // { key: { raw, summary } }

  _hasKeys() {
    return (
      localStorage.getItem("app_pin") &&
      localStorage.getItem("gemini_api_key") &&
      localStorage.getItem("notion_api_key") &&
      localStorage.getItem("worker_url") &&
      localStorage.getItem("notion_db_id")
    );
  },

  init() {
    // ── Settings screen ──
    UI.initSettings(() => {
      UI.showScreen("pin");
    });

    // ── PIN screen ──
    UI.initPin((pin) => {
      const result = API.authenticate(pin);
      if (result.ok) {
        UI.showScreen("setup");
      } else {
        UI.showPinError();
      }
    });

    // ── Setup screen ──
    UI.initSetup((isWeekly, dateStr) => {
      this.startSession(isWeekly, dateStr);
    });

    // ── Settings link on setup screen ──
    UI.initSettingsLink();

    // On boot: if no keys → settings, else → PIN
    if (!this._hasKeys()) {
      UI.showScreen("settings");
    }
  },

  startSession(isWeekly, dateStr) {
    this.isWeekly = isWeekly;
    this.questions = isWeekly ? WEEKLY_QUESTIONS : DAILY_QUESTIONS;
    this.answers = {};

    // Compute date and fallback title
    const emoji = isWeekly ? "\u{1F4C5}" : "\u{1F305}";
    const d = new Date(dateStr + "T00:00:00");
    if (isWeekly) {
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d);
      monday.setDate(diff);
      this.dateStr = monday.toISOString().split("T")[0];
      const monthName = monday.toLocaleDateString("en-US", { month: "short" });
      this.title = `${emoji} Weekly ${monthName} ${monday.getDate()}`;
    } else {
      this.dateStr = dateStr;
      const monthName = d.toLocaleDateString("en-US", { month: "short" });
      this.title = `${emoji} Daily ${monthName} ${d.getDate()}`;
    }

    const label = isWeekly ? "Weekly Reflection" : "Daily Reflection";

    UI.buildCards(this.questions, emoji, label, {
      onRecord: (i, transcript) => this.handleRecording(i, transcript),
      onText: (i, text) => this.handleTextInput(i, text),
      onRedo: (i) => this.handleRedo(i),
      onSave: () => this.saveAll(),
    });

    UI.showScreen("cards");
    this._backupState();
  },

  async handleRecording(cardIndex, rawTranscript) {
    const q = this.questions[cardIndex];
    UI.setCardState(cardIndex, "summarizing");

    const result = await API.summarizeAnswer(q.prompt, rawTranscript);

    if (result.ok) {
      this.answers[q.key] = { raw: rawTranscript, summary: result.summary };
      UI.setCardState(cardIndex, "done", result.summary);
    } else {
      // On error, show raw transcript as summary
      this.answers[q.key] = { raw: rawTranscript, summary: rawTranscript };
      UI.setCardState(cardIndex, "done", rawTranscript);
    }

    this._backupState();
  },

  async handleTextInput(cardIndex, text) {
    const q = this.questions[cardIndex];
    UI.setCardState(cardIndex, "summarizing");

    const result = await API.summarizeAnswer(q.prompt, text);

    if (result.ok) {
      this.answers[q.key] = { raw: text, summary: result.summary };
      UI.setCardState(cardIndex, "done", result.summary);
    } else {
      // On error, use raw text
      this.answers[q.key] = { raw: text, summary: text };
      UI.setCardState(cardIndex, "done", text);
    }

    this._backupState();
  },

  handleRedo(cardIndex) {
    const q = this.questions[cardIndex];
    delete this.answers[q.key];
    UI.setCardState(cardIndex, "idle");
    this._backupState();
  },

  async saveAll() {
    if (Object.keys(this.answers).length === 0) return;

    UI.showScreen("saving");

    if (this.isWeekly) {
      UI.setSavingDetail("Generating AI review and saving to Notion...");
      const result = await API.saveWeekly(this.title, this.dateStr, this.answers);
      this._handleSaveResult(result);
    } else {
      UI.setSavingDetail("Creating Notion page...");
      const result = await API.saveDaily(this.title, this.dateStr, this.answers);
      this._handleSaveResult(result);
    }
  },

  _handleSaveResult(result) {
    if (!result.ok) console.error("Save failed:", result.error);
    UI.showScreen("done");
    if (result.ok) {
      UI.initDone(result.url, () => {
        sessionStorage.removeItem("reflection_backup");
        UI.showScreen("setup");
      });
    } else {
      UI.initDone(null, () => {
        UI.showScreen("setup");
      });
      document.querySelector("#screen-done h1").textContent = "Save Error";
      document.querySelector("#screen-done p").textContent =
        "There was an issue saving. Your answers are backed up and you can retry.";
    }
  },

  _backupState() {
    try {
      sessionStorage.setItem(
        "reflection_backup",
        JSON.stringify({
          isWeekly: this.isWeekly,
          dateStr: this.dateStr,
          title: this.title,
          answers: this.answers,
        })
      );
    } catch (e) {
      // Ignore storage errors
    }
  },
};

// Boot
document.addEventListener("DOMContentLoaded", () => App.init());
