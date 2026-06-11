# @agentic-survey/core

Pure TypeScript service layer for [agentic-survey-mcp](https://github.com/netmonty/agentic-survey-mcp). All the survey logic (create, publish, collect, aggregate) over an injected Supabase client. No MCP, no HTTP, no framework types. Functions return a typed `Result` and never throw.

Most people want [`@agentic-survey/mcp-server`](https://www.npmjs.com/package/@agentic-survey/mcp-server) instead. Use this directly only if you're building your own integration on top of the survey model.

```ts
import { createDb, createSurvey, getResults } from '@agentic-survey/core';

const db = createDb(supabaseUrl, secretKey);
const survey = await createSurvey(db, { title: 'NPS' });
```

[MIT](./LICENSE). Docs and issues on [GitHub](https://github.com/netmonty/agentic-survey-mcp).
