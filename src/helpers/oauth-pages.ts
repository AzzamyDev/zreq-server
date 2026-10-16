/** Shared OAuth HTML — mirrors ZReq app AuthShell (Nebula glass / Dracula). */

export const escapeHtml = (value: string): string =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')

const LOGO_MARK = `<img src="/icon.svg" alt="" width="28" height="28" />`

const GITHUB_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>`

const ICON_GLOBE = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>`

const ICON_LAYERS = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/></svg>`

const ICON_ZAP = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>`

const SHELL_CSS = `
:root {
  --background: #282a36;
  --foreground: #f8f8f2;
  --primary: #bd93f9;
  --primary-foreground: #282a36;
  --destructive: #ff5555;
  --chart-1: #8be9fd;
  --chart-4: #ff79c6;
  --dracula-green: #50fa7b;
  --font-sans: "Geist Variable", "Geist", ui-sans-serif, system-ui, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
*, *::before, *::after { box-sizing: border-box; }
html, body { height: 100%; margin: 0; }
body {
  font-family: var(--font-sans);
  font-size: 16px;
  line-height: 1.5;
  color: var(--foreground);
  background: #050508;
  -webkit-font-smoothing: antialiased;
}
@keyframes auth-nebula-float-a {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(18px, 22px) scale(1.06); }
}
@keyframes auth-nebula-float-b {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(-24px, -16px) scale(1.04); }
}
.auth-nebula-shell {
  --auth-nebula-base: color-mix(in srgb, var(--background) 72%, #050508);
  --auth-nebula-fg-soft: color-mix(in srgb, var(--foreground) 52%, transparent);
  --auth-nebula-fg-muted: color-mix(in srgb, var(--foreground) 66%, transparent);
  --auth-nebula-glass: color-mix(in srgb, var(--foreground) 5%, transparent);
  --auth-nebula-glass-border: color-mix(in srgb, var(--foreground) 9%, transparent);
  --auth-nebula-input-bg: color-mix(in srgb, var(--foreground) 3%, transparent);
  --auth-nebula-input-border: color-mix(in srgb, var(--foreground) 10%, transparent);
  --auth-nebula-primary-glow: color-mix(in srgb, var(--primary) 70%, transparent);
  --auth-nebula-primary-soft: color-mix(in srgb, var(--primary) 12%, transparent);
  --auth-nebula-primary-border: color-mix(in srgb, var(--primary) 22%, transparent);
  --auth-nebula-primary-text: color-mix(in srgb, var(--primary) 82%, var(--foreground));
  --auth-nebula-btn-top: color-mix(in srgb, var(--primary) 72%, white);
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  width: 100%;
  overflow: hidden;
  color: var(--foreground);
  background:
    radial-gradient(115% 115% at 82% 6%, color-mix(in srgb, var(--primary) 22%, transparent), transparent 52%),
    radial-gradient(100% 100% at 4% 98%, color-mix(in srgb, var(--chart-1) 18%, transparent), transparent 55%),
    radial-gradient(72% 72% at 62% 58%, color-mix(in srgb, var(--chart-4) 9%, transparent), transparent 60%),
    var(--auth-nebula-base);
}
.auth-nebula-grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(color-mix(in srgb, var(--foreground) 2.2%, transparent) 1px, transparent 1px),
    linear-gradient(90deg, color-mix(in srgb, var(--foreground) 2.2%, transparent) 1px, transparent 1px);
  background-size: 52px 52px;
  -webkit-mask-image: radial-gradient(120% 100% at 30% 40%, #000 30%, transparent 80%);
  mask-image: radial-gradient(120% 100% at 30% 40%, #000 30%, transparent 80%);
}
.auth-nebula-orb {
  position: absolute;
  border-radius: 9999px;
  pointer-events: none;
  filter: blur(20px);
}
.auth-nebula-orb-a {
  width: min(420px, 90vw);
  height: min(420px, 90vw);
  left: 4rem;
  top: -5.5rem;
  background: radial-gradient(circle, color-mix(in srgb, var(--primary) 30%, transparent), transparent 65%);
  animation: auth-nebula-float-a 14s ease-in-out infinite;
}
.auth-nebula-orb-b {
  width: min(360px, 80vw);
  height: min(360px, 80vw);
  right: min(24rem, 30vw);
  bottom: -7.5rem;
  background: radial-gradient(circle, color-mix(in srgb, var(--chart-1) 22%, transparent), transparent 65%);
  animation: auth-nebula-float-b 18s ease-in-out infinite;
}
.auth-nebula-inner {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  flex: 1;
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  min-height: 0;
}
@media (min-width: 1024px) {
  .auth-nebula-inner { flex-direction: row; align-items: stretch; }
}
.auth-nebula-aside {
  display: none;
  flex: 1;
  flex-direction: column;
  justify-content: space-between;
  gap: 2rem;
  padding: 2.5rem;
  min-width: 0;
}
@media (min-width: 1024px) {
  .auth-nebula-aside { display: flex; }
}
@media (min-width: 1536px) {
  .auth-nebula-aside { gap: 3rem; padding: 4.75rem; }
}
.auth-nebula-logo {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3.25rem;
  height: 3.25rem;
  border-radius: 0.9375rem;
  background: linear-gradient(
    160deg,
    color-mix(in srgb, var(--foreground) 10%, transparent),
    color-mix(in srgb, var(--foreground) 2%, transparent)
  );
  border: 1px solid color-mix(in srgb, var(--foreground) 12%, transparent);
  box-shadow:
    0 10px 30px -12px var(--auth-nebula-primary-glow),
    inset 0 1px 0 color-mix(in srgb, var(--foreground) 15%, transparent);
}
.auth-nebula-logo img { display: block; width: 1.75rem; height: 1.75rem; }
.auth-nebula-eyebrow {
  margin: 2rem 0 0;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--auth-nebula-primary-text);
}
@media (min-width: 1536px) {
  .auth-nebula-eyebrow { margin-top: 2.75rem; }
}
.auth-nebula-heading {
  margin: 1.125rem 0 0;
  max-width: 560px;
  font-size: clamp(2rem, 4.2vw, 3.375rem);
  line-height: 1.04;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: color-mix(in srgb, var(--foreground) 96%, transparent);
  text-wrap: balance;
}
.auth-nebula-aside-sub {
  margin: 1.5rem 0 0;
  max-width: 430px;
  font-size: 1rem;
  line-height: 1.65;
  color: var(--auth-nebula-fg-soft);
}
.auth-nebula-bullets {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  max-width: 420px;
}
.auth-nebula-bullets li {
  display: flex;
  align-items: flex-start;
  gap: 0.875rem;
}
.auth-nebula-bullet-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.375rem;
  height: 2.375rem;
  flex-shrink: 0;
  border-radius: 0.6875rem;
  background: var(--auth-nebula-primary-soft);
  border: 1px solid var(--auth-nebula-primary-border);
  color: var(--auth-nebula-primary-text);
}
.auth-nebula-bullets span.text {
  font-size: 0.875rem;
  line-height: 1.35;
  color: var(--auth-nebula-fg-muted);
}
.auth-nebula-main {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
  padding: 2rem 1.25rem;
}
@media (min-width: 640px) {
  .auth-nebula-main { padding: 2.5rem 2rem; }
}
@media (min-width: 1024px) {
  .auth-nebula-main {
    width: min(556px, 46%);
    flex-shrink: 0;
    padding: 2.5rem 1.5rem;
  }
}
@media (min-width: 1280px) {
  .auth-nebula-main { padding-right: 3rem; }
}
@media (min-width: 1536px) {
  .auth-nebula-main { padding: 4.75rem 4.75rem 4.75rem 1.5rem; }
}
.auth-nebula-mobile-brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 2rem;
}
@media (min-width: 1024px) {
  .auth-nebula-mobile-brand { display: none; }
}
.auth-nebula-mobile-brand .auth-nebula-logo {
  width: 2.75rem;
  height: 2.75rem;
  flex-shrink: 0;
}
.auth-nebula-mobile-brand .auth-nebula-eyebrow {
  margin: 0;
  font-size: 0.65rem;
  letter-spacing: 0.18em;
}
.auth-nebula-mobile-brand .brand-name {
  margin: 0.25rem 0 0;
  font-size: 1rem;
  font-weight: 600;
}
.auth-nebula-card {
  width: 100%;
  max-width: 430px;
  border-radius: 1.375rem;
  background: var(--auth-nebula-glass);
  -webkit-backdrop-filter: blur(26px);
  backdrop-filter: blur(26px);
  border: 1px solid var(--auth-nebula-glass-border);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--foreground) 8%, transparent),
    0 30px 70px -25px color-mix(in srgb, #000 70%, transparent);
}
@media (min-width: 1024px) {
  .auth-nebula-card { margin-left: auto; }
}
.auth-nebula-card-pad {
  padding: 2rem;
}
@media (min-width: 1280px) {
  .auth-nebula-card-pad { padding: 2.375rem; }
}
.auth-nebula-pill {
  display: inline-flex;
  align-items: center;
  padding: 0.375rem 0.75rem;
  border-radius: 9999px;
  background: color-mix(in srgb, var(--foreground) 4%, transparent);
  border: 1px solid color-mix(in srgb, var(--foreground) 8%, transparent);
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  color: color-mix(in srgb, var(--foreground) 60%, transparent);
}
.auth-nebula-card-title {
  margin: 1.375rem 0 0;
  font-size: 1.875rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: color-mix(in srgb, var(--foreground) 98%, transparent);
}
.auth-nebula-card-title:first-child { margin-top: 0; }
.auth-nebula-card-desc {
  margin: 0.375rem 0 0;
  font-size: 0.875rem;
  color: var(--auth-nebula-fg-soft);
}
.auth-nebula-card-body {
  margin-top: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}
label.auth-nebula-label {
  display: block;
  margin: 0 0 0.4rem;
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--foreground) 50%, transparent);
}
.auth-nebula-field { margin: 0; }
.auth-nebula-input {
  width: 100%;
  padding: 0.875rem 1rem;
  border-radius: 0.75rem;
  background: var(--auth-nebula-input-bg);
  border: 1px solid var(--auth-nebula-input-border);
  color: var(--foreground);
  font-family: var(--font-mono);
  font-size: 0.875rem;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.auth-nebula-input::placeholder {
  color: color-mix(in srgb, var(--foreground) 35%, transparent);
}
.auth-nebula-input:focus-visible {
  border-color: color-mix(in srgb, var(--primary) 70%, transparent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 16%, transparent);
}
.auth-nebula-btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 0.9375rem;
  border: none;
  border-radius: 0.75rem;
  cursor: pointer;
  font: inherit;
  font-size: 0.9375rem;
  font-weight: 600;
  text-decoration: none;
  color: var(--primary-foreground);
  background: linear-gradient(180deg, var(--auth-nebula-btn-top), var(--primary));
  box-shadow:
    0 14px 30px -12px var(--auth-nebula-primary-glow),
    inset 0 1px 0 color-mix(in srgb, var(--foreground) 50%, transparent);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.auth-nebula-btn-primary:hover {
  transform: translateY(-1px);
  box-shadow:
    0 20px 40px -12px color-mix(in srgb, var(--primary) 85%, transparent),
    inset 0 1px 0 color-mix(in srgb, var(--foreground) 50%, transparent);
}
.auth-nebula-btn-secondary {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.625rem;
  width: 100%;
  padding: 0.875rem;
  border-radius: 0.75rem;
  font: inherit;
  font-size: 0.875rem;
  font-weight: 500;
  text-decoration: none;
  color: color-mix(in srgb, var(--foreground) 96%, transparent);
  background: color-mix(in srgb, var(--foreground) 4%, transparent);
  border: 1px solid color-mix(in srgb, var(--foreground) 12%, transparent);
  transition: background 0.15s ease;
  cursor: pointer;
}
.auth-nebula-btn-secondary:hover {
  background: color-mix(in srgb, var(--foreground) 9%, transparent);
}
.auth-nebula-divider {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  margin: 0.375rem 0;
}
.auth-nebula-divider-line {
  flex: 1;
  height: 1px;
  background: color-mix(in srgb, var(--foreground) 10%, transparent);
}
.auth-nebula-divider-text {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--foreground) 35%, transparent);
}
.auth-nebula-alert {
  margin: 0;
  padding: 0.75rem 0.875rem;
  border-radius: 0.75rem;
  border: 1px solid color-mix(in srgb, var(--destructive) 35%, transparent);
  background: color-mix(in srgb, var(--destructive) 12%, transparent);
  color: var(--destructive);
  font-size: 0.875rem;
}
.auth-nebula-hint {
  margin: 0;
  font-size: 0.75rem;
  color: color-mix(in srgb, var(--foreground) 45%, transparent);
  line-height: 1.5;
}
.auth-nebula-hint code {
  font-family: var(--font-mono);
  font-size: 0.85em;
  padding: 0.1em 0.35em;
  border-radius: 4px;
  background: color-mix(in srgb, var(--foreground) 8%, transparent);
}
.auth-nebula-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  margin: 0;
}
@media (prefers-reduced-motion: reduce) {
  .auth-nebula-orb-a, .auth-nebula-orb-b { animation: none; }
}
`.trim()

export type OAuthPageShellOptions = {
    title: string
    cardTitle: string
    cardDescription?: string
    pill?: string
    body: string
}

export const oauthPageShell = ({
    title,
    cardTitle,
    cardDescription,
    pill,
    body
}: OAuthPageShellOptions): string => {
    const pillHtml = pill
        ? `<span class="auth-nebula-pill">${escapeHtml(pill)}</span>`
        : ''
    const descHtml = cardDescription
        ? `<p class="auth-nebula-card-desc">${escapeHtml(cardDescription)}</p>`
        : ''
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <link rel="icon" href="/icon.svg" type="image/svg+xml" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fontsource-variable/geist@5.2.5/index.css" />
  <style>${SHELL_CSS}</style>
</head>
<body>
  <div class="auth-nebula-shell">
    <div class="auth-nebula-grid" aria-hidden="true"></div>
    <div class="auth-nebula-orb auth-nebula-orb-a" aria-hidden="true"></div>
    <div class="auth-nebula-orb auth-nebula-orb-b" aria-hidden="true"></div>
    <div class="auth-nebula-inner">
      <aside class="auth-nebula-aside">
        <div>
          <div class="auth-nebula-logo">${LOGO_MARK}</div>
          <p class="auth-nebula-eyebrow">API workspace</p>
          <h2 class="auth-nebula-heading">Design, send, and organize HTTP requests.</h2>
          <p class="auth-nebula-aside-sub">Point the app at your server, sync collections and environments, and keep every workspace in one focused surface.</p>
        </div>
        <ul class="auth-nebula-bullets">
          <li>
            <span class="auth-nebula-bullet-icon">${ICON_GLOBE}</span>
            <span class="text">Multiple backends — switch instance without losing your layout</span>
          </li>
          <li>
            <span class="auth-nebula-bullet-icon">${ICON_LAYERS}</span>
            <span class="text">Collections and environments tied to your signed-in workspace</span>
          </li>
          <li>
            <span class="auth-nebula-bullet-icon">${ICON_ZAP}</span>
            <span class="text">A fast request builder with a clear response panel</span>
          </li>
        </ul>
      </aside>
      <div class="auth-nebula-main">
        <div class="auth-nebula-mobile-brand">
          <div class="auth-nebula-logo">${LOGO_MARK}</div>
          <div>
            <p class="auth-nebula-eyebrow">API workspace</p>
            <p class="brand-name">ZReq</p>
          </div>
        </div>
        <div class="auth-nebula-card">
          <div class="auth-nebula-card-pad">
            ${pillHtml}
            <h1 class="auth-nebula-card-title">${escapeHtml(cardTitle)}</h1>
            ${descHtml}
            <div class="auth-nebula-card-body">${body}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`
}

export type LoginFormHtmlOptions = {
    safeNext: string
    githubConfigured: boolean
    error?: string
    email?: string
}

export const loginFormHtml = ({
    safeNext,
    githubConfigured,
    error,
    email = ''
}: LoginFormHtmlOptions): string => {
    const alert = error
        ? `<div class="auth-nebula-alert" role="alert">${escapeHtml(error)}</div>`
        : ''
    const github = githubConfigured
        ? `<div>
  <div class="auth-nebula-divider">
    <span class="auth-nebula-divider-line" aria-hidden="true"></span>
    <span class="auth-nebula-divider-text">or</span>
    <span class="auth-nebula-divider-line" aria-hidden="true"></span>
  </div>
  <a class="auth-nebula-btn-secondary" href="/mcp/oauth/github-start?next=${encodeURIComponent(safeNext)}">
    ${GITHUB_ICON}
    Continue with GitHub
  </a>
</div>`
        : ''
    return `${alert}
<form class="auth-nebula-form" method="post" action="/mcp/oauth/local-login" autocomplete="on">
  <input type="hidden" name="next" value="${escapeHtml(safeNext)}" />
  <div class="auth-nebula-field">
    <label class="auth-nebula-label" for="email">Email</label>
    <input class="auth-nebula-input" id="email" name="email" type="email" required autocomplete="username" placeholder="you@example.com" value="${escapeHtml(email)}" />
  </div>
  <div class="auth-nebula-field">
    <label class="auth-nebula-label" for="password">Password</label>
    <input class="auth-nebula-input" id="password" name="password" type="password" required autocomplete="current-password" placeholder="••••••••" />
  </div>
  <button class="auth-nebula-btn-primary" type="submit">Sign in</button>
</form>
${github}`
}

export type ErrorBodyHtmlOptions = {
    heading?: string
    message: string
    backHref?: string
    backLabel?: string
}

export const errorBodyHtml = ({
    message,
    backHref,
    backLabel = 'Back to sign in'
}: ErrorBodyHtmlOptions): string => {
    const back =
        backHref != null
            ? `<a class="auth-nebula-btn-secondary" href="${escapeHtml(backHref)}">${escapeHtml(backLabel)}</a>`
            : ''
    return `<p class="auth-nebula-hint" style="font-size:0.875rem;color:var(--auth-nebula-fg-soft)">${escapeHtml(message)}</p>
${back}`
}

export type HandoffKind = 'zreq' | 'generic-app' | 'http'

export type HandoffBodyHtmlOptions = {
    kind: HandoffKind
    targetUrl: string
}

export const handoffBodyHtml = ({ kind, targetUrl }: HandoffBodyHtmlOptions): string => {
    const u = JSON.stringify(targetUrl)
    if (kind === 'zreq') {
        return `<p class="auth-nebula-hint" id="m" style="font-size:0.875rem;color:var(--auth-nebula-fg-soft)">Trying to open ZReq…</p>
<a class="auth-nebula-btn-primary" id="L" href=${u}>Open ZReq</a>
<p class="auth-nebula-hint">If the window stays blank or the app does not open, tap the button above (or allow the <code>zreq</code> link).</p>
<script>var t=${u};function go(){try{location.href=t}catch(e){}}go();setTimeout(function(){document.getElementById("m").textContent="App did not open? Use the button above.";},1500);</script>`
    }
    if (kind === 'generic-app') {
        return `<p class="auth-nebula-hint" id="m" style="font-size:0.875rem;color:var(--auth-nebula-fg-soft)">Opening your editor…</p>
<a class="auth-nebula-btn-primary" href=${u}>Continue in application</a>
<p class="auth-nebula-hint">If nothing happens, tap the button above (your browser may block automatic <code>cursor://</code> / app links).</p>
<script>var t=${u};function go(){try{location.href=t}catch(e){}}go();setTimeout(function(){document.getElementById("m").textContent="Editor did not open? Use the button above.";},1500);</script>`
    }
    return `<p class="auth-nebula-hint" style="font-size:0.875rem;color:var(--auth-nebula-fg-soft)">If this page stays blank, use the link below.</p>
<a class="auth-nebula-btn-primary" href=${u}>Continue</a>
<script>location.replace(${u})</script>`
}
