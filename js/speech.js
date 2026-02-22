// Web Speech API wrapper — STT only

const Speech = {
  recognition: null,
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
};
