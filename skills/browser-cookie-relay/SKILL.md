---
name: browser-cookie-relay
description: Relay authenticated browser cookies from a user's local Chrome session into the VM Playwright browser state. Use when automation needs logged-in access (LinkedIn, Reddit, etc.) and direct VM login is blocked or unreliable.
---

# Browser Cookie Relay Skill

Use this skill to unblock authenticated browsing with the browser relay.

## Execute Flow

1. Ask user to connect Chrome from BlitzClaw dashboard (`Connect Browser`) and open the connect URL with the extension installed.
2. Wait for explicit confirmation that relay is connected.
3. Navigate in connected Chrome to target site.
4. Ask user to complete login manually if needed.
5. Fetch cookies via CDP.
6. Convert cookies to Playwright storage state.
7. Continue normal browser automation using that storage state.
8. Tell user they can disconnect relay.

## Commands

```bash
browser-relay-cdp '{"method":"Page.navigate","params":{"url":"https://www.linkedin.com"}}'
browser-relay-cdp '{"method":"Network.getCookies","params":{"urls":["https://www.linkedin.com"]}}' > /tmp/linkedin-cookies.json
inject-cookies /tmp/linkedin-cookies.json /root/.openclaw/workspace/linkedin.storage-state.json
```

Direct API fallback:

```bash
SECRET=$(cat /etc/blitzclaw/proxy_secret)
curl -X POST https://www.blitzclaw.com/api/browser-relay/cdp \
  -H "x-instance-secret: $SECRET" \
  -H "Content-Type: application/json" \
  -d '{"method":"Network.getCookies","params":{"urls":["https://www.linkedin.com"]}}'
```

## Notes

- `browser-relay-cdp` reads secret from `/etc/blitzclaw/proxy_secret`.
- `inject-cookies` accepts raw CDP response, `{cookies:[...]}`, or cookie array.
- Default storage state output: `/root/.openclaw/workspace/browser-relay.storage-state.json`.
