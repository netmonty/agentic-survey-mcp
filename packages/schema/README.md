# @agentic-survey/schema

The data model for [agentic-survey-mcp](https://github.com/netmonty/agentic-survey-mcp): the SQL migration plus shared TypeScript types, including the `get_results` contract. Surfaces the raw SQL so you can install it into your own Supabase (SQL editor, `supabase db push`, or the Supabase MCP).

Most people want [`@agentic-survey/mcp-server`](https://www.npmjs.com/package/@agentic-survey/mcp-server) instead, which installs this for you via `init --print-sql`.

```ts
import { readInitialMigrationSql } from '@agentic-survey/schema';

console.log(readInitialMigrationSql()); // paste into the Supabase SQL editor
```

[MIT](./LICENSE). Docs and issues on [GitHub](https://github.com/netmonty/agentic-survey-mcp).
