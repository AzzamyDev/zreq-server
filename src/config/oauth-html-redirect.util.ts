import type { Response } from 'express'
import { handoffBodyHtml, oauthPageShell } from 'src/helpers/oauth-pages'

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
    if (isNonHttpAppUrl(targetUrl)) {
        if (kind === 'zreq') {
            res.status(200)
                .type('html')
                .send(
                    oauthPageShell({
                        title: 'ZReq — return to app',
                        pill: 'Sign-in complete',
                        cardTitle: 'Return to ZReq',
                        cardDescription: 'Authorization finished. Opening the app…',
                        body: handoffBodyHtml({ kind: 'zreq', targetUrl })
                    })
                )
            return
        }
        res.status(200)
            .type('html')
            .send(
                oauthPageShell({
                    title: 'Return to editor',
                    pill: 'Authorization complete',
                    cardTitle: 'Return to your editor',
                    cardDescription: 'Opening your application…',
                    body: handoffBodyHtml({ kind: 'generic-app', targetUrl })
                })
            )
        return
    }
    res.status(200)
        .type('html')
        .send(
            oauthPageShell({
                title: 'Redirect',
                pill: 'Continuing',
                cardTitle: 'Redirecting…',
                body: handoffBodyHtml({ kind: 'http', targetUrl })
            })
        )
}
