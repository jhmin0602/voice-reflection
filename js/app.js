// Main controller — state machine for the reflection session

const App = {
  isWeekly: false,
  dateStr: "",
  title: "",
  questions: [],
  currentQuestion: 0,
  answers: {},
  conversationHistory: [],
  systemPrompt: "",

  init() {
    // ── PIN screen ──
    UI.initPin(async (pin) => {
      const result = await API.authenticate(pin);
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

    // ── Chat input ──
    UI.initChatInput((text) => {
      this.handleUserInput(text);
    });

    // Check if already authenticated
    if (sessionStorage.getItem("auth_token")) {
      UI.showScreen("setup");
    }
  },

  startSession(isWeekly, dateStr) {
    this.isWeekly = isWeekly;
    this.questions = isWeekly ? WEEKLY_QUESTIONS : DAILY_QUESTIONS;
    this.currentQuestion = 0;
    this.answers = {};
    this.conversationHistory = [];
    this._followUpCount = 0;

    // Compute date and title
    const d = new Date(dateStr + "T00:00:00");
    if (isWeekly) {
      // Find Monday of that week
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d);
      monday.setDate(diff);
      this.dateStr = monday.toISOString().split("T")[0];
      const monthName = monday.toLocaleDateString("en-US", { month: "short" });
      this.title = `... Week of ${monthName} ${monday.getDate()}`;
    } else {
      this.dateStr = dateStr;
      const monthName = d.toLocaleDateString("en-US", { month: "short" });
      this.title = `... ${monthName} ${d.getDate()}`;
    }

    const reflectionType = isWeekly ? "weekly" : "daily";
    this.systemPrompt = SYSTEM_PROMPT.replace("{reflection_type}", reflectionType);

    UI.clearMessages();
    UI.showScreen("chat");

    // Backup state to sessionStorage
    this._backupState();

    // Ask first question
    this.askCurrentQuestion();
  },

  async askCurrentQuestion() {
    const q = this.questions[this.currentQuestion];
    this._followUpCount = 0;
    UI.updateChatHeader(this.currentQuestion + 1, this.questions.length, q.key);
    UI.disableInput();

    // Send ASK command to Claude
    const userMsg = `ASK: ${q.prompt}`;
    this.conversationHistory.push({ role: "user", content: userMsg });

    const result = await API.chat(this.conversationHistory, this.systemPrompt);

    if (result.authExpired) {
      this._handleAuthExpired();
      return;
    }

    if (!result.ok) {
      UI.addMessage("Error getting response. Tap mic to retry.", "system");
      // Pop the failed message so we can retry
      this.conversationHistory.pop();
      UI.enableInput();
      return;
    }

    this.conversationHistory.push({ role: "assistant", content: result.message });
    UI.addMessage(result.message, "ai");

    // Speak it
    await Speech.speak(result.message);

    UI.enableInput();
  },

  async handleUserInput(text) {
    UI.addMessage(text, "user");
    UI.disableInput();

    const q = this.questions[this.currentQuestion];

    // First answer for this question?
    if (!this.answers[q.key]) {
      this.answers[q.key] = text;
    } else {
      this.answers[q.key] += " " + text;
    }

    this._backupState();

    // Send as FOLLOW_UP
    const userMsg = `FOLLOW_UP: ${q.key}: ${text}`;
    this.conversationHistory.push({ role: "user", content: userMsg });
    this._followUpCount++;

    const result = await API.chat(this.conversationHistory, this.systemPrompt);

    if (result.authExpired) {
      this._handleAuthExpired();
      return;
    }

    if (!result.ok) {
      UI.addMessage("Error. Tap to retry.", "system");
      this.conversationHistory.pop();
      UI.enableInput();
      return;
    }

    this.conversationHistory.push({ role: "assistant", content: result.message });

    const hasNext = result.message.includes("NEXT");
    const spokenPart = result.message.replace("NEXT", "").trim();

    if (spokenPart) {
      UI.addMessage(spokenPart, "ai");
      await Speech.speak(spokenPart);
    }

    if (hasNext || this._followUpCount >= 4) {
      // Move to next question
      this.currentQuestion++;
      if (this.currentQuestion < this.questions.length) {
        this.askCurrentQuestion();
      } else {
        this.finishSession();
      }
    } else {
      // Wait for more input
      UI.enableInput();
    }
  },

  async finishSession() {
    UI.addMessage("That's all the questions. Saving your reflection...", "system");
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
    if (result.authExpired) {
      this._handleAuthExpired();
      return;
    }

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
      // Show error but data is backed up
      document.querySelector("#screen-done h1").textContent = "Save Error";
      document.querySelector("#screen-done p").textContent =
        "There was an issue saving. Your answers are backed up and you can retry.";
    }
  },

  _handleAuthExpired() {
    sessionStorage.removeItem("auth_token");
    UI.showScreen("pin");
    UI.addMessage("Session expired. Please re-enter your PIN.", "system");
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
