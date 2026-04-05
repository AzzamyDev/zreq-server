import type { Response } from 'express'

const CUSTOM_SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i

/** True for e.g. cursor://, zreq:// — not http(s). */
export const isNonHttpAppUrl = (targetUrl: string): boolean =>
    CUSTOM_SCHEME_RE.test(targetUrl) && !/^https?:/i.test(targetUrl)

/**
 * Browsers and embedded webviews often fail on HTTP 302 to custom URL schemes.
 * Use HTML+JS handoff (same idea as mobile / desktop OAuth).
 */
export const sendHtmlRedirect = (
    res: Response,
    targetUrl: string,
    kind: 'zreq' | 'generic-app' = 'zreq'
): void => {
    const u = JSON.stringify(targetUrl)
    if (isNonHttpAppUrl(targetUrl)) {
        if (kind === 'zreq') {
            res.status(200)
                .type('html')
                .send(
                    `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ZReq — return to app</title>` +
                        `<style>body{font-family:system-ui,sans-serif;padding:2rem;max-width:26rem;margin:auto;line-height:1.5;color:#111}` +
                        `a{display:inline-block;margin-top:1rem;padding:.6rem 1rem;background:#111;color:#fff;border-radius:8px;text-decoration:none;font-weight:600}</style></head><body>` +
                        `<h1>Sign-in complete</h1><p id="m">Trying to open ZReq…</p>` +
                        `<p><a id="L" href=${u}>Open ZReq</a></p>` +
                        `<p style="font-size:.875rem;color:#555">If the window stays blank or the app does not open, tap the button above (or allow the <code>zreq</code> link).</p>` +
                        `<script>var t=${u};function go(){try{location.href=t}catch(e){}}go();setTimeout(function(){document.getElementById("m").textContent="App did not open? Use the button above.";},1500);</script>` +
                        `</body></html>`
                )
            return
        }
        res.status(200)
            .type('html')
            .send(
                `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Return to editor</title>` +
                    `<style>body{font-family:system-ui,sans-serif;padding:2rem;max-width:26rem;margin:auto;line-height:1.5;color:#111}` +
                    `a{display:inline-block;margin-top:1rem;padding:.6rem 1rem;background:#111;color:#fff;border-radius:8px;text-decoration:none;font-weight:600}</style></head><body>` +
                    `<h1>Authorization complete</h1><p id="m">Opening your editor…</p>` +
                    `<p><a href=${u}>Continue in application</a></p>` +
                    `<p style="font-size:.875rem;color:#555">If nothing happens, tap the button above (your browser may block automatic <code>cursor://</code> / app links).</p>` +
                    `<script>var t=${u};function go(){try{location.href=t}catch(e){}}go();setTimeout(function(){document.getElementById("m").textContent="Editor did not open? Use the button above.";},1500);</script>` +
                    `</body></html>`
            )
        return
    }
    res.status(200)
        .type('html')
        .send(
            `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Redirect</title></head><body>` +
                `<script>location.replace(${u})</script>` +
                `<p>Redirecting… If this page stays blank, <a href=${u}>continue</a>.</p>` +
                `</body></html>`
        )
}
