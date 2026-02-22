// Web Speech API wrapper — STT + TTS

const Speech = {
  recognition: null,
  synth: window.speechSynthesis,
  available: false,
  listening: false,

  init() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = "en-US";
      this.available = true;
    }
    return this.available;
  },

  /**
   * Listen for speech input. User must call stopListening() to finish.
   * onInterim(text) is called with partial results for live feedback.
   */
  listen(onInterim) {
    return new Promise((resolve, reject) => {
      if (!this.recognition) {
        reject(new Error("Speech recognition not available"));
        return;
      }

      let finalTranscript = "";
      let lastInterim = "";
      this.listening = true;

      this.recognition.onresult = (event) => {
        lastInterim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            lastInterim += transcript;
          }
        }
        if (onInterim) {
          onInterim(finalTranscript + lastInterim);
        }
      };

      this.recognition.onerror = (event) => {
        this.listening = false;
        if (event.error === "no-speech") {
          resolve("");
        } else {
          reject(new Error(event.error));
        }
      };

      this.recognition.onend = () => {
        this.listening = false;
        // Use final transcript, or fall back to last interim if nothing was finalized
        const result = finalTranscript || lastInterim;
        resolve(result.trim());
      };

      this.recognition.start();
    });
  },

  stopListening() {
    if (this.recognition && this.listening) {
      this.recognition.stop();
    }
  },

  /**
   * Speak text aloud using SpeechSynthesis. Returns a promise.
   */
  speak(text) {
    return new Promise((resolve) => {
      if (!this.synth) {
        resolve();
        return;
      }
      // Cancel any ongoing speech
      this.synth.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.2;
      utterance.lang = "en-US";
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      this.synth.speak(utterance);
    });
  },

  cancelSpeak() {
    if (this.synth) {
      this.synth.cancel();
    }
  },
};
