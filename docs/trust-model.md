# Trust & data-ownership model

The whole point of this project: **you own your data, and your keys behave the
way their names imply.** Nothing the author holds can read or write your data,
because the author holds nothing.

## Two keys, two homes

| Key | Lives | Used by | Reaches the agent / model provider? | Reaches the author's infra? |
|---|---|---|---|---|
| **Secret** (`sb_secret_…`) | **Your device only** — local config (`~/.config/agentic-survey/config.json`, `chmod 600`) | your MCP server, running locally | **No** — never a tool argument | **No** |
| **Publishable** (`sb_publishable_…`) | **In the share link** | the page-service (the author's hosted relay, or your own) | No | Transits as a stateless relay; **never stored** |

## Why the secret key never leaks

- The MCP server runs **locally** as a subprocess of your agent (stdio). It reads
  the secret key from local config and talks to *your* Supabase directly.
- `setup_connection` **refuses to accept the secret key as a tool argument** — if
  creds are missing it tells you to run `npx agentic-survey init`. So the key is
  typed into your **terminal** (hidden input), never into the chat. This is what
  keeps it away from the model provider.
- The author's infrastructure has nowhere to receive it and stores no data.

## Why the publishable key is safe in a public URL

The share link resolves to `project ref + publishable key + survey id`, e.g.

```
https://pages.<domain>/s/<projectRef>/<surveyId>#k=<sb_publishable_…>
```

At render time the page-service uses that publishable key to read the *published*
survey live and to write the submission back — persisting nothing.

This is safe because the publishable key is **RLS-fenced** (verified in the spike,
see [`spike-findings.md`](spike-findings.md)). With it you can *only*:

- read **published** surveys + their questions, and
- **insert** responses + answers.

You **cannot** read drafts, read anyone's responses, or update/delete anything.
So a share-link URL that's shared, logged, or leaked exposes nothing sensitive.

Self-hosters avoid the key-in-URL entirely: they configure their own URL +
publishable key in their own page-service deployment, so their links are just
`/<surveyId>`.

## The guarantee, in one line

**Secret key → local, powerful, private. Publishable key → public, fenced,
travels with the link. The author → a stateless relay that holds nothing.**
