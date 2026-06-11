# Sample survey — prompts to drive your agent

Once the MCP server is connected, these are the kinds of things you can say. The agent maps them
onto the tools (`create_survey`, `add_question`, `publish_survey`, `get_share_link`, `get_results`).

## Build it

> Create a customer-satisfaction survey called "Q3 Check-in" with:
> 1. a 1–5 rating: "How satisfied are you overall?"
> 2. a single choice: "Which plan are you on?" — Free / Pro / Enterprise
> 3. a multiple choice: "Which features do you use?" — Email, API, Dashboard, Mobile
> 4. a yes/no: "Would you recommend us?"
> 5. a long-text: "What's the one thing we should improve?"
> Make questions 1 and 4 required, then publish it and give me the share link.

## Collect

Open the returned link in a browser, fill it out, submit. The page writes straight into your
Supabase. Share the link however you like.

## Read

> How are the results looking? Summarise the ratings and themes from the comments.

The agent calls `get_results` — it gets pre-computed aggregates (mean rating, choice counts,
yes/no split) plus the raw comment text, and does the theming itself.

## Resulting tool chain

```
create_survey            → { id }
add_question  × 5        → positions 0..4
publish_survey           → { shareUrl }
get_share_link           → { shareUrl }      (any time later)
get_results              → { survey, questions[aggregate], responses[], pagination }
```
