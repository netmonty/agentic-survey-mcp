# Open-Source Agentic Survey MCP — Technical Project Plan

*An open-source (MIT) MCP server that lets a user's own AI agent build surveys and review results. Each user brings their own Supabase, so they own all their data. The agent does all the AI work, so users carry their own AI cost. A hosted, swappable public-survey-page service — preconfigured to the author's instance for convenience — serves the pages respondents fill out.*

## Executive Summary

You're building an **open-source MCP server** as the primary artifact and the launch event. A user connects their own AI agent (Claude, ChatGPT, etc.) and their own Supabase project; the agent calls your tools to create surveys, publish them, and read results back. All survey-building and analysis happens inside the *user's* agent — **they pay for the AI** — and all data lives in the *user's own Supabase* — **they own the data, and you carry zero custody/compliance weight.**

The one genuinely hard-to-self-host piece — the public, always-on, fast page that *respondents* fill out — is split off into a small stateless rendering+collection service. It writes submissions straight into the user's Supabase, so it's a conduit, never the store of record. The MCP tool ships **preconfigured to point at your hosted instance** of that service (instant gratification), but the endpoint is swappable so anyone can run their own. That preconfigured-default convenience is the seed of an eventual paid hosted tier; for v1 it's just the easy path.

The launch is the **repo**, not a SaaS. The most important things to get right: a clean MIT-licensed codebase, dead-simple CLI/agent setup, a well-designed tool surface, and a respondent-page service with a crisp contract for writing into a user-supplied Supabase.

## Project Overview

- **Goal**: Ship an open-source MCP server that any agent can drive to build and review surveys, with users owning their data (own Supabase) and their AI cost (own agent).
- **Scope (in, Phase 1 launch)**: The MCP server + survey/response service layer; a "connect your Supabase" setup tool; CLI-based setup; the stateless public-survey-page service (render + collect → write to user's Supabase); MIT license, README, contributing guide; a default hosted instance of the page service that the tool points at out of the box.
- **Scope (out, for now)**: Web account/billing UI; the 3-survey hosted cap + payments; usage metering; in-app AI; results web view; MCP consumption of external tools; survey-page setup wizard UI (CLI-first in v1).
- **Key constraints**: MIT (favouring reach over hosted-revenue protection); user brings own Supabase; user's agent carries AI cost; CLI-first setup; the tool itself contains **no hosting** — it calls out to a swappable endpoint that defaults to the author's instance.

## Architecture at a Glance

Three pieces, deliberately separated:

1. **MCP server** (the product, open-source, runs anywhere the user wants). Thin tool handlers over a pure service layer. Talks to *the user's* Supabase using credentials the user supplied via the setup tool.
2. **User's Supabase** (the store of record, owned entirely by the user). Holds surveys, questions, responses. You never touch it; the user's MCP server and the page service do, using the user's keys.
3. **Public survey-page service** (stateless render + collect). Serves the page a respondent fills out and forwards the submission into the user's Supabase. Open-source and self-hostable; the MCP tool defaults to *your* hosted instance for convenience but the endpoint is configurable.

The key property: **no survey response ever needs to land in a database you own.** Data flows respondent → page service → user's Supabase. You are, at most, a stateless conduit on the easy path, and not even that on the DIY path.

## Why this scope is the right call

- **Zero data custody**: responses live in the user's own Supabase. For survey data (often personal/PII), this removes you from the GDPR/compliance blast radius almost entirely — a big deal for a solo builder.
- **Zero AI cost**: building and analysis run in the user's agent context. Your costs are just hosting the optional default page service.
- **Reputation-first via MIT**: the repo is distribution. Being the canonical open-source agentic-survey MCP server gets your name into the space — which, per your own framing, is worth more than defending small hosted revenue. (You keep copyright, so future relicensing stays an option if the calculus changes.)
- **Differentiation**: "AI writes your survey" is saturated (Typeform, SurveyMonkey Genius, Jotform). "Open-source MCP server your agent operates, on your own data" is close to empty.

## Technology Stack

Guiding principle: **define survey operations once in a pure TypeScript service layer; the MCP tools and the page service are both thin clients of it.** TypeScript end-to-end because the official MCP SDK is most mature there and the spec's auth/transport building blocks ship there first.

### The MCP server (the product)
- **Recommended**: Official **TypeScript MCP SDK**. For Phase 1's open-source/dev-facing launch, ship **stdio** transport first (an agent launches it locally — the simplest possible "it just works" path, no hosting, no OAuth). Design the service layer so a **Streamable HTTP** remote transport can be added later for a hosted multi-user scenario without touching survey logic. Streamable HTTP is the recommended remote transport (SSE is deprecated); save it for when remote/hosted matters.
- **Tool surface (Phase 1)**: `setup_connection` (store the user's Supabase URL + keys, run schema migration), `create_survey`, `add_question`, `publish_survey`, `get_share_link`, `list_surveys`, `list_responses`, `get_results` (returns raw + simple aggregates the user's agent then analyses). Clear semantic descriptions + tool annotations so agents discover and chain them; typed errors, never thrown exceptions.
- **Why stdio-first**: For an MIT repo whose launch is adoption, the lowest-friction path wins. stdio means "point your agent at this command and go" — no server to host, no OAuth dance. Remote/HTTP is a later expansion for the hosted story.
- **Spec caution**: a new MCP spec is slated for **July 28, 2026**, and the SDK paused its main feedback channel ahead of it. Build on the current stable SDK; isolate transport wiring so adopting the new spec is a contained change.

### Data layer — the user's Supabase
- **Recommended**: The user supplies their own Supabase project (cloud or self-hosted — Supabase is fully open-source and self-hostable via Docker Compose). The `setup_connection` tool takes their project URL + a **secret key** (`sb_secret_...`) and runs the survey schema migration into their database. Use the **new Supabase key model** (`sb_publishable_...` / `sb_secret_...`) — the legacy `anon`/`service_role` keys are deprecated by end of 2026, so build against the new keys now.
- **Schema**: surveys → questions → options; responses → answers. Use `jsonb` for flexible question config and answer payloads. Ship the migration as part of setup so the user's DB is provisioned automatically by the agent.
- **Isolation note**: in the self-host/own-Supabase model each user's data is physically separated by being in their own project — the multi-tenant isolation problem largely dissolves for v1. (It returns only if/when you build a shared hosted multi-tenant instance later; defer.)
- **Alternatives considered**: bundling a database with the tool — breaks the "you own your data" promise and makes you custodian; plain Postgres without Supabase — loses the instant REST API, auth, and the easy self-host story Supabase gives users. Supabase is the right call *because* it's open-source and self-hostable, which fits the project's ethos.

### Public survey-page service (render + collect)
- **Recommended**: A small, stateless service (Next.js or even a lean framework) that (a) renders a survey's public page by reading its definition, and (b) accepts a submission and writes it into the relevant user's Supabase using that user's keys. No database of its own. Server-rendered, fast, mobile-first. Rate-limited + bot-protected on submit — the one high-abuse surface.
- **The default-endpoint trick**: the MCP tool's `get_share_link` / publish flow points at *your hosted instance* of this service by default (so a user gets a working public link instantly), but the endpoint is a config value. A DIY user sets it to their own deployment. The tool ships no hosting itself — it just calls out to whatever endpoint is configured, defaulting to yours.
- **Data-flow guarantee**: submission → your page service → user's Supabase. You hold nothing. Document this clearly; it's a selling point.
- **Key tradeoff**: serving pages on your domain means respondent traffic transits your infra (a conduit), so you need basic uptime/abuse protection there. But you store nothing, so the liability is operational, not custodial.

### Setup / onboarding
- **Recommended (Phase 1)**: **CLI-first**, agent-assisted. The user installs the package, points their agent at it, and the agent calls `setup_connection` — prompting for / accepting their Supabase URL + secret key, running the migration, and confirming. A short CLI (`npx <tool> init`) can capture config and write a local env/config file for users who prefer the terminal to the agent. No web setup wizard in v1.
- **Why**: a dev-facing open-source launch lives on the CLI and the agent, not a hosted UI. A web wizard is Phase 2+ territory tied to the hosted tier.

### Licensing
- **Recommended**: **MIT**, per your reach-over-revenue reasoning. Keep copyright clean (so future relicensing of new versions stays possible). Accept that a larger player *could* run a rival hosted version — a mostly theoretical risk until there's traction worth taking, by which point your name is already attached. If protecting hosted revenue ever becomes the priority, AGPL or a source-available license (BSL-style) is the lever — but that's explicitly not the current goal.

### AI layer
- **None on your side.** The user's agent builds and analyses. Your job is clean tool descriptions and a well-structured `get_results` payload so their agent reasons well over the data.

## Phased Build Plan

### Phase 0: Foundation — ~1–2 weeks
**Goal**: Get the core right before any surface.
**Deliverables**: Survey/response data model + Supabase migration; the pure TypeScript service layer (`createSurvey`, `addQuestion`, `publishSurvey`, `listResponses`, `getResults`, …) that reads/writes a *supplied* Supabase connection; the `get_results` payload contract (this is what consumers' agents depend on — design it deliberately).
**Why first**: every surface sits on this; the data model + results contract are the hardest things to change later.

### Phase 1: Open-source MCP server — LAUNCH — ~3–5 weeks
**Goal**: Ship the public repo. A user installs it, connects their Supabase via their agent, builds a survey, gets a working public link, and reads results back.
**Deliverables**:
- MCP server (TS SDK, stdio transport) with the Phase 1 tool surface as thin wrappers over the service layer.
- `setup_connection` tool: takes Supabase URL + secret key, runs the migration, verifies.
- The stateless public-survey-page service (render + collect → write to user's Supabase), self-hostable, with a default hosted instance you run.
- The default-endpoint config so `publish`/`get_share_link` point at your instance out of the box, swappable to the user's own.
- CLI `init` path; clean **README, MIT LICENSE, CONTRIBUTING**, quickstart, and a "connect your agent + your Supabase" walkthrough.
- Bot protection + rate limiting on the page service's submit endpoint.
**This is the milestone that matters** — the repo going public is the reputation event.

### Phase 2 (later, optional): Hosted convenience + paid tier — ~3–4 weeks when wanted
**Goal**: Monetise the convenience for people who don't want to run anything.
**Deliverables**: A hosted offering where you run the MCP server (Streamable HTTP + OAuth 2.1, multi-tenant) and/or a managed Supabase-backed setup; web account/billing UI; **the 3-surveys-free-then-pay cap, enforced in the hosted layer only** (never in the open-source code — capping OSS is pointless and people patch it out); Stripe. Not required to launch or to build reputation.

### Phase 3 (further out): Expansion — ongoing
Richer question types / logic / quotas; a minimal read-only web results view as a safety net; exports; team features; adopting the July 2026 MCP spec; later, MCP *consumption* of external tools.

## Risk & Tradeoff Analysis

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Setup friction (Supabase keys + agent wiring) blocks adoption | High | High | Make `setup_connection` + CLI `init` bulletproof; great quickstart docs; sensible defaults; this is the #1 thing to nail |
| Page service is a conduit for others' data → abuse/liability on your infra | Med | Med | Store nothing; rate-limit + bot-protect submit; clear ToS that you're a stateless relay; keep the service trivially self-hostable so heavy users move off yours |
| User supplies secret key insecurely / it leaks | Med | High | Store keys locally in the user's own config, never transmit to you; document secure handling; never log keys |
| MIT lets a larger player run a rival hosted version | Low→Med | Med | Accept per strategy (reach > revenue); retain copyright for future relicensing of new versions if needed |
| Supabase key-model change (anon/service_role deprecation end 2026) | Med | Low | Build on new `sb_publishable`/`sb_secret` keys from day one |
| MCP spec churn (new spec July 28 2026) | Med | Med | Isolate transport from survey logic; build on current stable SDK |
| Service layer leaks framework types → tools/page-service drift | Med | Med | Keep service layer pure; both surfaces thin; review discipline |
| `get_results` payload poorly designed → agents analyse badly | Med | High | Design the results contract deliberately in Phase 0; raw + aggregates; test against a real agent early |
| Default page-endpoint becomes a free-hosting cost sink | Med | Med | Phase 2 cap lives here; until then, lightweight abuse limits; it's cheap because stateless |

**Hard-to-reverse decisions**: the **survey/response data model + `get_results` contract** (Phase 0); **MIT license** (relicensing future versions is possible, but what's already shipped stays MIT); **TypeScript end-to-end**. Transport (stdio→HTTP) and the page-service endpoint are deliberately swappable and *not* in this category.

**The standout risk for this model is setup friction.** Everything depends on a user successfully connecting their agent *and* their Supabase. If `setup_connection` and the quickstart aren't effortless, the repo gets stars and no users. Treat onboarding as the core product surface, not documentation.

## Cost Estimates

Ranges, not precision. Dev cost left in time (no team rates given).

- **Your infrastructure at launch**: only the default public-survey-page service (stateless) + a landing/repo. Roughly **$20–$100/month** — it's a small stateless service.
- **At modest adoption**: **$50–$300/month**, scaling with respondent page traffic on your default instance (and heavy users can self-host the page service to take load off you).
- **Data storage**: **$0 to you** — it's in users' own Supabase projects.
- **AI**: **$0 to you** — users' agents.
- **Third-party**: domain + TLS (minimal); bot protection (usage-based, modest). Stripe only arrives in Phase 2.
- **Development time**: Phase 0 ~1–2 wks, Phase 1 ~3–5 wks → **~5–7 weeks to the open-source launch** for a small focused builder. Phase 2 only if/when you monetise.
- **Ongoing burn once the repo is live**: realistically **$20–$300/month**. Close to a hobby-cost project until you choose to add the hosted tier.

*Supabase pricing/key details and self-host specifics per Supabase docs as of June 2026; verify before committing.*

## Open Questions

- **`get_results` payload shape**: raw responses, aggregates, or both? Richer payloads → better consumer-agent analysis, more bandwidth. This is the contract — settle it in Phase 0.
- **Key handling in `setup_connection`**: where exactly does the user's Supabase secret key live (local config file? agent-managed?), and how do you guarantee it never reaches you? Security-critical.
- **Respondent identity**: anonymous-only, or optional respondent auth/quotas? Affects the Phase 0 schema.
- **Page-service contract**: how does it authenticate writes into a user's Supabase — does the publish step hand it scoped access, or does the user configure it with their own keys? Defines the data-flow security model.
- **Survey definition source for rendering**: does the page service read the survey definition from the user's Supabase at render time, or is it baked into the share link? Affects how "swappable endpoint" works.
- **Relicensing posture**: are you comfortable that already-shipped MIT code can't be clawed back, only future versions relicensed? (Just confirm you've accepted this.)

## Recommended Next Steps (first two weeks)

1. **Design the survey/response schema and the `get_results` contract on paper**, plus the Supabase migration the setup tool will run. This is the foundation everything depends on.
2. **Spike `setup_connection` end-to-end**: agent supplies a Supabase URL + secret key, tool runs the migration and writes/reads a row. Prove the "bring your own Supabase" loop works with the new key model.
3. **Spike one MCP tool (`create_survey`) over stdio** against Claude / MCP Inspector — confirm the simplest path "just works" before building the full surface.
4. **Prototype the page service's core loop**: render a survey from a definition, accept a submission, write it into a user's Supabase. This closes the full circle: agent builds → human answers → agent reads.
5. **Decide the key-handling + page-service-auth security model**, since it's the one part where getting it wrong has real consequences and it shapes the architecture.
