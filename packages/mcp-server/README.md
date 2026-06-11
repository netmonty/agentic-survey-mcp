# @agentic-survey/mcp-server

An open-source ([MIT](./LICENSE)) [MCP](https://modelcontextprotocol.io) server that lets your own AI agent **build surveys and read results**, straight into **your own Supabase**. You own the data, you carry the AI cost, and your keys never leave your machine. It's free.

Part of [agentic-survey-mcp](https://github.com/netmonty/agentic-survey-mcp). Site: [mcpsurveys.com](https://www.mcpsurveys.com).

## Why

- **You own the data.** Surveys, questions, and responses live in *your* Supabase project. Nothing is stored on anyone else's infrastructure.
- **You carry the AI cost.** Authoring and analysis happen inside *your* agent. There's no AI running server-side, so there's nothing to bill you for.
- **Bring your own keys.** Your Supabase secret key stays in a local config file. It's never transmitted, never logged, and never a tool argument the agent can read.

## Quick start

```bash
# 1. Print the schema, paste it into your Supabase SQL editor
npx -y @agentic-survey/mcp-server init --print-sql

# 2. Store your keys locally and verify the connection
#    (typed into your terminal, never sent to the agent)
npx -y @agentic-survey/mcp-server init
```

Then point your MCP client at the server:

```bash
# Claude Code
claude mcp add agentic-survey -- npx -y @agentic-survey/mcp-server
```

```jsonc
// Claude Desktop / Cursor / other (claude_desktop_config.json, .cursor/mcp.json, ...)
{
  "mcpServers": {
    "agentic-survey": { "command": "npx", "args": ["-y", "@agentic-survey/mcp-server"] }
  }
}
```

Now just talk to your agent:

> "Build a 4-question customer-satisfaction survey with a 1-5 rating, a yes/no, a multiple choice, and an open comment. Publish it and give me the share link."

> "Summarise the results so far, themes from the comments too."

The agent chains the tools for you: `create_survey` → `add_question` → `publish_survey` → `get_results`.

> Tip: `npm i -g @agentic-survey/mcp-server` gives you the shorter `agentic-survey init` command.

### Do I need to enable RLS / anything in the Supabase dashboard?

No. The `init --print-sql` migration enables Row Level Security and the access policies for you, on all four tables. **Don't disable RLS:** it's what fences the publishable key (which travels in the share link) so it can *only* read **published** surveys and **insert** responses. It cannot read anyone's responses or your drafts. Your secret key, stored locally on your machine, bypasses RLS for authoring and analysis.

## How it works

```
  your AI agent ──(MCP / stdio)──▶  mcp-server ──┐
                                                  ├──▶  your Supabase
  respondent ──(browser)──▶  page-service ────────┘     (source of truth)
```

Publishing a survey returns a share link carrying your project ref and publishable key. A respondent opens it, the stateless page-service writes their answers into your Supabase, and your agent reads them back with `get_results`. Supabase is the backend for now; more are planned.

## Tools

`setup_connection`, `create_survey`, `add_question`, `update_question`, `remove_question`, `reorder_questions`, `set_question_logic`, `validate_survey`, `publish_survey`, `get_share_link`, `list_surveys`, `get_survey`, `list_responses`, `get_results`.

Question types: `single_choice`, `multi_choice`, `rating`, `yes_no`, `number`, `short_text`, `long_text`, `date`, `time` (24-hour), `slider` (0–100 percentage by default).

### Branching / skip logic

`set_question_logic` makes a question conditional: it shows (or hides) based on the answers to **earlier** questions — e.g. only ask the follow-up if someone rated you ≤ 2. The page-service evaluates this live and submission validation respects it (a hidden required question isn't required; answers to hidden questions are rejected). Run `validate_survey` after wiring logic and before `publish_survey` — it catches forward/dangling references, conditions citing options that don't exist (so a question could never appear), and choice questions with no options.

## License

[MIT](./LICENSE). Built by [Monty](https://montymakesthings.com). Source and issues on [GitHub](https://github.com/netmonty/agentic-survey-mcp).
