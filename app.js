"use strict";

// -----------------------------------------------
// WildLens AI — Application
// -----------------------------------------------

const API_URL = "https://ollama.com/api/chat";
const JOURNAL_KEY = "wildlens-journal";
const THEME_KEY = "wildlens-theme";
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

const $ = (id) => document.getElementById(id);

const photoInput = $("photo-input");
const dropzone = $("dropzone");
const previewImage = $("preview-image");
const uploadPlaceholder = $("upload-placeholder");
const removePhotoButton = $("remove-photo");

const apiKeyInput = $("ollama-key");
const modelInput = $("ollama-model");
const identifyButton = $("identify-button");
const statusText = $("status");

const emptyResult = $("empty-result");
const resultBox = $("result");
const resultTitle = $("result-title");
const prediction = $("prediction");
const noteInput = $("observation-note");
const saveButton = $("save-button");

const journalList = $("journal-list");
const journalCount = $("journal-count");
const clearJournalButton = $("clear-journal");

const themeToggle = $("theme-toggle");
const themeIcon = $("theme-icon");

let selectedFile = null;
let latestIdentification = "";
let isAnalyzing = false;
let previewURL = null;

// -----------------------------------------------
// Theme
// -----------------------------------------------

function applyTheme(theme) {
  const isDark = theme === "dark";

  document.body.classList.toggle("dark", isDark);
  themeIcon.textContent = isDark ? "☀" : "☾";

  themeToggle.setAttribute(
    "aria-label",
    isDark ? "Switch to light mode" : "Switch to dark mode"
  );
}

try {
  applyTheme(localStorage.getItem(THEME_KEY) || "light");
} catch {
  applyTheme("light");
}

themeToggle.addEventListener("click", () => {
  const nextTheme = document.body.classList.contains("dark")
    ? "light"
    : "dark";

  applyTheme(nextTheme);

  try {
    localStorage.setItem(THEME_KEY, nextTheme);
  } catch {
    // Theme still works for this page session.
  }
});

// -----------------------------------------------
// Image upload and preview
// -----------------------------------------------

function setStatus(message) {
  statusText.textContent = message;
}

function resetPreviewURL() {
  if (previewURL) {
    URL.revokeObjectURL(previewURL);
    previewURL = null;
  }
}

function setSelectedImage(file) {
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    setStatus("Please choose a valid image file.");
    return;
  }

  if (file.size > MAX_IMAGE_SIZE) {
    setStatus("This image is larger than 10 MB. Choose a smaller photo.");
    return;
  }

  resetPreviewURL();

  selectedFile = file;
  latestIdentification = "";

  previewURL = URL.createObjectURL(file);
  previewImage.src = previewURL;
  previewImage.hidden = false;
  uploadPlaceholder.hidden = true;
  removePhotoButton.hidden = false;

  identifyButton.disabled = false;
  resultBox.hidden = true;
  emptyResult.hidden = false;

  setStatus("Photo ready. Connect to Ollama Cloud to identify it.");
}

photoInput.addEventListener("change", () => {
  const file = photoInput.files?.[0];
  if (file) setSelectedImage(file);
});

removePhotoButton.addEventListener("click", () => {
  resetPreviewURL();

  selectedFile = null;
  latestIdentification = "";

  photoInput.value = "";
  previewImage.removeAttribute("src");
  previewImage.hidden = true;
  uploadPlaceholder.hidden = false;
  removePhotoButton.hidden = true;

  identifyButton.disabled = true;
  resultBox.hidden = true;
  emptyResult.hidden = false;

  setStatus("Choose a photograph to begin.");
});

// Drag-and-drop support.
["dragenter", "dragover"].forEach((eventName) => {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.add("dragging");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.remove("dragging");
  });
});

dropzone.addEventListener("drop", (event) => {
  const file = event.dataTransfer?.files?.[0];

  if (file) setSelectedImage(file);
});

// -----------------------------------------------
// Image conversion
// -----------------------------------------------

function imageToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const dataURL = String(reader.result || "");
      const comma = dataURL.indexOf(",");

      if (comma < 0) {
        reject(new Error("Unable to read the selected image."));
        return;
      }

      resolve(dataURL.slice(comma + 1));
    };

    reader.onerror = () => {
      reject(new Error("Failed to read the image file."));
    };

    reader.readAsDataURL(file);
  });
}

// -----------------------------------------------
// Ollama Cloud image identification
// -----------------------------------------------

async function identifyImage() {
  if (isAnalyzing) return;

  if (!selectedFile) {
    setStatus("Please choose a photo first.");
    return;
  }

  const apiKey = apiKeyInput.value.trim();
  const model = modelInput.value.trim();

  if (!apiKey) {
    setStatus("Enter your Ollama Cloud API key first.");
    apiKeyInput.focus();
    return;
  }

  if (!model) {
    setStatus("Enter the name of an available vision model.");
    modelInput.focus();
    return;
  }

  isAnalyzing = true;
  identifyButton.disabled = true;
  identifyButton.innerHTML = "<span>✳</span> Looking closer…";
  resultBox.hidden = true;

  setStatus("Preparing your photo for AI analysis…");

  try {
    const image = await imageToBase64(selectedFile);

    setStatus("Your field companion is examining the image…");

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          {
            role: "system",
            content:
              "You are WildLens, a thoughtful nature observation assistant. " +
              "Help the user understand the main subject in an uploaded photo. " +
              "Use this format: Likely identification; What I can see; " +
              "Why it might fit; What remains uncertain; A safe observation tip. " +
              "Be specific only when the image supports it. Never invent " +
              "a species identification or claim certainty without evidence. " +
              "If the photo is unclear, explain the limitation. " +
              "Never advise the user to eat or touch unknown plants, fungi, " +
              "or animals. Keep the answer helpful and concise."
          },
          {
            role: "user",
            content:
              "Please examine this image and describe the most likely " +
              "nature subject. Mention visible clues and any uncertainty.",
            images: [image]
          }
        ]
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const apiMessage =
        data.error?.message ||
        data.message ||
        `The server returned HTTP ${response.status}.`;

      throw new Error(apiMessage);
    }

    const answer = data.message?.content?.trim();

    if (!answer) {
      throw new Error("The model returned an empty answer.");
    }

    latestIdentification = answer;

    // Keep AI text as text, not HTML.
    prediction.textContent = answer;
    resultTitle.textContent = "A closer look";
    emptyResult.hidden = true;
    resultBox.hidden = false;

    setStatus("Discovery complete. Read your field notes below.");

    resultBox.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });
  } catch (error) {
    console.error("WildLens identification error:", error);

    let message = error.message || "An unexpected error occurred.";

    if (message.toLowerCase().includes("failed to fetch")) {
      message =
        "The request could not reach Ollama Cloud. Check your connection. " +
        "If the browser reports a CORS error, use a server-side proxy.";
    }

    setStatus(`Couldn't identify this photo: ${message}`);
  } finally {
    isAnalyzing = false;
    identifyButton.disabled = !selectedFile;
    identifyButton.innerHTML =
      '<span>✳</span> Identify with AI <span class="button-arrow">↗</span>';
  }
}

identifyButton.addEventListener("click", identifyImage);

// -----------------------------------------------
// Journal storage
// -----------------------------------------------

function readJournal() {
  try {
    const data = JSON.parse(localStorage.getItem(JOURNAL_KEY) || "[]");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

let journal = readJournal();

function persistJournal() {
  try {
    localStorage.setItem(JOURNAL_KEY, JSON.stringify(journal));
    return true;
  } catch {
    setStatus("Could not save the journal. Browser storage may be full.");
    return false;
  }
}

function makeElement(tag, className, content) {
  const element = document.createElement(tag);

  if (className) element.className = className;
  if (content !== undefined) element.textContent = content;

  return element;
}

function renderJournal() {
  journalList.replaceChildren();

  journalCount.textContent =
    `${journal.length} ${journal.length === 1 ? "DISCOVERY" : "DISCOVERIES"}`;

  clearJournalButton.hidden = journal.length === 0;

  if (journal.length === 0) {
    const empty = makeElement("div", "journal-empty");
    const flower = makeElement("span", "", "✳");
    const message = makeElement(
      "p",
      "",
      "Your first discovery is still out there."
    );

    const link = makeElement("a", "", "Find something to remember ↗");
    link.href = "#identify";

    empty.append(flower, message, link);
    journalList.appendChild(empty);
    return;
  }

  journal.forEach((entry) => {
    const card = makeElement("article", "journal-entry");
    const content = makeElement("div", "journal-entry-content");
    const title = makeElement(
      "h3",
      "",
      entry.identification || "Nature discovery"
    );

    const note = makeElement(
      "p",
      "",
      entry.note || "A moment noticed outdoors."
    );

    const date = makeElement(
      "time",
      "",
      new Date(entry.date).toLocaleString()
    );

    date.dateTime = entry.date;

    content.append(title, note, date);

    const deleteButton = makeElement("button", "delete-entry", "Delete");
    deleteButton.type = "button";
    deleteButton.setAttribute("aria-label", "Delete this journal entry");

    deleteButton.addEventListener("click", () => {
      const previousJournal = journal;
      journal = journal.filter((item) => item.id !== entry.id);

      if (persistJournal()) {
        renderJournal();
      } else {
        journal = previousJournal;
      }
    });

    card.append(content, deleteButton);
    journalList.appendChild(card);
  });
}

saveButton.addEventListener("click", () => {
  if (!latestIdentification) {
    setStatus("Identify a photo before saving a discovery.");
    return;
  }

  const entry = {
    id: crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`,
    identification: latestIdentification,
    note: noteInput.value.trim(),
    date: new Date().toISOString()
  };

  const previousJournal = journal;
  journal = [entry, ...journal].slice(0, 50);

  if (persistJournal()) {
    noteInput.value = "";
    renderJournal();
    setStatus("Saved to your nature journal.");
  } else {
    journal = previousJournal;
  }
});

clearJournalButton.addEventListener("click", () => {
  if (!journal.length) return;

  if (!confirm("Clear all your saved discoveries?")) return;

  const previousJournal = journal;
  journal = [];

  if (persistJournal()) {
    renderJournal();
    setStatus("Your journal has been cleared.");
  } else {
    journal = previousJournal;
  }
});

// -----------------------------------------------
// Initial setup
// -----------------------------------------------

renderJournal();