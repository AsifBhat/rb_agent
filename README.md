# RB Agent Chatbot

Lightweight embeddable chatbot powered by your OpenAI Agent Builder workflow and ChatKit.

## Stack

- **Frontend:** Vite + React + `@openai/chatkit-react`
- **Backend:** One Netlify serverless function (`/api/create-session`) that mints short-lived ChatKit client secrets
- **Hosting:** Static site on Netlify (or any static host + serverless)

Your OpenAI API key stays on the server and is never sent to the browser.

## Quick start (local)

1. Copy env file and add your credentials:

```bash
cp .env.example .env
```

2. Install and run:

```bash
npm install
npm run dev
```

3. Open http://localhost:5173

## Deploy to Netlify

1. Push this repo to GitHub.
2. In [Netlify](https://app.netlify.com), create a new site from the repo.
3. Build settings (auto-detected from `netlify.toml`):
   - Build command: `npm run build`
   - Publish directory: `dist`
4. Add environment variables in **Site settings → Environment variables**:
   - `OPENAI_API_KEY` — your OpenAI API key
   - `VITE_CHATKIT_WORKFLOW_ID` — your workflow id (`wf_...`)
   - `CHATKIT_WORKFLOW_ID` — same workflow id (for the serverless function)
5. Deploy.

## Domain allowlist (required)

ChatKit only runs on domains registered in your OpenAI org. Add every origin you use:

https://platform.openai.com/settings/organization/security/domain-allowlist

**Production:** your Netlify URL (e.g. `your-site.netlify.app`) and any custom domain.

**Local dev:** add the exact host and port Vite prints when you run `npm run dev`, for example:

- `localhost:5173` (default — this project uses `strictPort`, so dev always runs on 5173)
- If you see a warning for `localhost:5174`, either add `localhost:5174` to the allowlist or stop the other process using port 5173 and restart `npm run dev`.

The console message *"Domain verification skipped"* means ChatKit detected an unlisted origin. It may still work locally, but production will block until the domain is allowlisted.

## Embed in your app

After deploying, embed the chat page in an iframe:

```html
<iframe
  src="https://your-site.netlify.app"
  title="Retail Pulse AI"
  style="width: 360px; height: 600px; border: none; border-radius: 12px;"
></iframe>
```

Or link users directly to the deployed URL.

## Environment variables

| Variable | Where | Description |
|----------|-------|-------------|
| `OPENAI_API_KEY` | Server only | OpenAI API key |
| `VITE_CHATKIT_WORKFLOW_ID` | Build + client | Agent Builder workflow id |
| `CHATKIT_WORKFLOW_ID` | Server only | Same workflow id for Netlify function |
