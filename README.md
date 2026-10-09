# WildLens AI

WildLens AI is a responsive nature discovery interface with an Ollama Cloud vision-model connection and a local browser journal.

## Files

- `index.html` — page structure and content
- `styles.css` — responsive editorial-style design, dark mode, cards, and animations
- `app.js` — photo selection, Ollama Cloud request, prediction display, outdoor missions, and local journal

## Run locally

Open the folder in VS Code and use Live Server, or run this command from the project folder:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## AI setup

1. Create an Ollama Cloud API key in your Ollama account settings.
2. Open WildLens and paste the key into the API key field.
3. Select a vision model available to your account, choose a photo, and select **Identify this find**.

This project calls `https://ollama.com/api/chat` from the browser. Browser CORS rules or model/account availability may prevent direct requests; if that happens, use a small server-side proxy. Never hardcode a personal API key into public client-side code. The key entered into the page is held in page memory and is not saved by this app, but browser-based apps cannot protect secrets from a person who controls the device.

## Privacy and accuracy

Images are sent to Ollama Cloud for analysis. Saved journal entries, including resized image thumbnails, are stored in this browser's local storage. AI identification and confidence estimates may be wrong; treat them as suggestions and verify uncertain species with a trusted field guide. Do not touch or eat unknown plants, fungi, or animals.
