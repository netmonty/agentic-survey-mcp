import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  createDb,
  createSurvey,
  updateSurvey,
  publishSurvey,
  closeSurvey,
  listSurveys,
  getSurvey,
  addQuestion,
  updateQuestion,
  removeQuestion,
  reorderQuestions,
  listResponses,
  getResults,
  buildShareUrl,
  isErr,
  type Db,
  type LinkConfig,
} from '@agentic-survey/core';
import { readInitialMigrationSql } from '@agentic-survey/schema';
import {
  loadConfig,
  isConnectable,
  projectRefFromUrl,
  configPath,
  DEFAULT_PAGE_ENDPOINT,
  type StoredConfig,
} from './config.js';

const QUESTION_TYPE = z.enum([
  'single_choice',
  'multi_choice',
  'short_text',
  'long_text',
  'rating',
  'yes_no',
  'number',
]);
const SURVEY_STATUS = z.enum(['draft', 'published', 'closed']);

type ToolResult = {
  content: { type: 'text'; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

const ok = (summary: string, data: Record<string, unknown>): ToolResult => ({
  content: [{ type: 'text', text: summary }],
  structuredContent: data,
});

const fail = (code: string, message: string): ToolResult => ({
  content: [{ type: 'text', text: `Error (${code}): ${message}` }],
  structuredContent: { error: { code, message } },
  isError: true,
});

const NOT_CONNECTED = fail(
  'not_connected',
  'No Supabase connection configured. Run `npx agentic-survey init` (it stores your keys locally — never paste them into the agent), then retry.',
);

/** Resolve a live connection from local config/env, or a typed error result. */
function getConn(): { ok: true; db: Db; cfg: StoredConfig } | { ok: false; res: ToolResult } {
  const cfg = loadConfig();
  if (!isConnectable(cfg)) return { ok: false, res: NOT_CONNECTED };
  return { ok: true, db: createDb(cfg.supabaseUrl, cfg.secretKey), cfg };
}

function linkConfig(cfg: StoredConfig): LinkConfig | undefined {
  const projectRef = projectRefFromUrl(cfg.supabaseUrl);
  if (!projectRef || !cfg.publishableKey) return undefined;
  return {
    pageEndpoint: cfg.pageEndpoint ?? DEFAULT_PAGE_ENDPOINT,
    projectRef,
    publishableKey: cfg.publishableKey,
  };
}

export function buildServer(): McpServer {
  const server = new McpServer({ name: 'agentic-survey', version: '0.0.0' });

  server.registerTool(
    'setup_connection',
    {
      title: 'Set up / verify Supabase connection',
      description:
        'Verify the locally-configured Supabase connection and that the survey schema is present. ' +
        'Does NOT accept keys as arguments — keys are configured via `npx agentic-survey init` and stored ' +
        'locally. If the schema is missing, returns the SQL to run (paste into the Supabase SQL editor, or use ' +
        '`supabase db push` / the Supabase MCP). Call this first if other tools report not_connected.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      const cfg = loadConfig();
      if (!isConnectable(cfg)) {
        return ok('Not connected.', {
          connected: false,
          configPath: configPath(),
          next: 'Run `npx agentic-survey init` to store your Supabase URL + secret key locally.',
        });
      }
      const db = createDb(cfg.supabaseUrl, cfg.secretKey);
      const probe = await listSurveys(db, {});
      if (isErr(probe)) {
        return ok('Connected, but the survey schema is missing.', {
          connected: true,
          schemaPresent: false,
          error: probe.error,
          migrationSql: readInitialMigrationSql(),
          next: 'Run the migrationSql in the Supabase SQL editor (or `supabase db push` / the Supabase MCP).',
        });
      }
      return ok(`Connected. Schema present. ${probe.data.length} survey(s) found.`, {
        connected: true,
        schemaPresent: true,
        surveyCount: probe.data.length,
        publishableKeyConfigured: Boolean(cfg.publishableKey),
      });
    },
  );

  server.registerTool(
    'create_survey',
    {
      title: 'Create a draft survey',
      description:
        'Create a new draft survey. Returns its id. Typical flow: create_survey → add_question (×N) → ' +
        'publish_survey → get_share_link.',
      inputSchema: {
        title: z.string().min(1).describe('Survey title'),
        description: z.string().optional().describe('Optional description'),
      },
    },
    async ({ title, description }) => {
      const c = getConn();
      if (!c.ok) return c.res;
      const r = await createSurvey(c.db, { title, description });
      if (isErr(r)) return fail(r.error.code, r.error.message);
      return ok(`Created draft survey "${r.data.title}" (id ${r.data.id}).`, { survey: r.data });
    },
  );

  server.registerTool(
    'add_question',
    {
      title: 'Add a question to a survey',
      description:
        'Append (or insert at `position`) a question. `config` shape depends on `type`: ' +
        'single_choice/multi_choice → { options: [{ id, label }] }; rating → { min, max }; ' +
        'number → { min?, max?, step?, unit? }; short_text/long_text → { placeholder?, maxLength? }; ' +
        'yes_no → {}. Give each choice option a stable `id`.',
      inputSchema: {
        surveyId: z.string(),
        type: QUESTION_TYPE,
        prompt: z.string().min(1),
        required: z.boolean().optional(),
        config: z.record(z.string(), z.unknown()).optional().describe('Per-type config (see description)'),
        position: z.number().int().min(0).optional(),
      },
    },
    async ({ surveyId, type, prompt, required, config, position }) => {
      const c = getConn();
      if (!c.ok) return c.res;
      const r = await addQuestion(c.db, surveyId, {
        type,
        prompt,
        required,
        config: config as any,
        position,
      });
      if (isErr(r)) return fail(r.error.code, r.error.message);
      return ok(`Added ${type} question at position ${r.data.position}.`, { question: r.data });
    },
  );

  server.registerTool(
    'update_question',
    {
      title: 'Update a question',
      description: 'Patch a question (prompt, type, required, config, position). Only provided fields change.',
      inputSchema: {
        questionId: z.string(),
        prompt: z.string().min(1).optional(),
        type: QUESTION_TYPE.optional(),
        required: z.boolean().optional(),
        config: z.record(z.string(), z.unknown()).optional(),
        position: z.number().int().min(0).optional(),
      },
    },
    async ({ questionId, ...patch }) => {
      const c = getConn();
      if (!c.ok) return c.res;
      const r = await updateQuestion(c.db, questionId, patch as any);
      if (isErr(r)) return fail(r.error.code, r.error.message);
      return ok('Question updated.', { question: r.data });
    },
  );

  server.registerTool(
    'remove_question',
    {
      title: 'Remove a question',
      description: 'Delete a question from a survey.',
      inputSchema: { questionId: z.string() },
      annotations: { destructiveHint: true },
    },
    async ({ questionId }) => {
      const c = getConn();
      if (!c.ok) return c.res;
      const r = await removeQuestion(c.db, questionId);
      if (isErr(r)) return fail(r.error.code, r.error.message);
      return ok('Question removed.', { removed: true });
    },
  );

  server.registerTool(
    'reorder_questions',
    {
      title: 'Reorder a survey’s questions',
      description: 'Set question order to match `orderedIds` (positions become array index).',
      inputSchema: { surveyId: z.string(), orderedIds: z.array(z.string()).min(1) },
    },
    async ({ surveyId, orderedIds }) => {
      const c = getConn();
      if (!c.ok) return c.res;
      const r = await reorderQuestions(c.db, surveyId, orderedIds);
      if (isErr(r)) return fail(r.error.code, r.error.message);
      return ok('Questions reordered.', { reordered: true });
    },
  );

  server.registerTool(
    'publish_survey',
    {
      title: 'Publish a survey',
      description:
        'Publish a draft survey and return its public share link (if a publishable key is configured). ' +
        'Respondents can then open the link and submit.',
      inputSchema: { surveyId: z.string() },
    },
    async ({ surveyId }) => {
      const c = getConn();
      if (!c.ok) return c.res;
      const r = await publishSurvey(c.db, surveyId, linkConfig(c.cfg));
      if (isErr(r)) return fail(r.error.code, r.error.message);
      const note = r.data.shareUrl
        ? `Share link: ${r.data.shareUrl}`
        : 'Published, but no share link — configure a publishable key (re-run `init`) to enable public links.';
      return ok(`Published "${r.data.survey.title}". ${note}`, {
        survey: r.data.survey,
        shareUrl: r.data.shareUrl ?? null,
      });
    },
  );

  server.registerTool(
    'get_share_link',
    {
      title: 'Get a published survey’s share link',
      description: 'Return the public link for a published survey.',
      inputSchema: { surveyId: z.string() },
      annotations: { readOnlyHint: true },
    },
    async ({ surveyId }) => {
      const c = getConn();
      if (!c.ok) return c.res;
      const r = await getSurvey(c.db, surveyId);
      if (isErr(r)) return fail(r.error.code, r.error.message);
      if (r.data.survey.status !== 'published') {
        return fail('not_published', `Survey is ${r.data.survey.status}; publish it first.`);
      }
      const link = linkConfig(c.cfg);
      if (!link) return fail('no_publishable_key', 'No publishable key configured; re-run `init`.');
      return ok('Share link ready.', { shareUrl: buildShareUrl(link, surveyId) });
    },
  );

  server.registerTool(
    'list_surveys',
    {
      title: 'List surveys',
      description: 'List surveys, optionally filtered by status.',
      inputSchema: { status: SURVEY_STATUS.optional() },
      annotations: { readOnlyHint: true },
    },
    async ({ status }) => {
      const c = getConn();
      if (!c.ok) return c.res;
      const r = await listSurveys(c.db, { status });
      if (isErr(r)) return fail(r.error.code, r.error.message);
      return ok(`${r.data.length} survey(s).`, { surveys: r.data });
    },
  );

  server.registerTool(
    'get_survey',
    {
      title: 'Get a survey’s full definition',
      description: 'Return a survey plus its ordered questions.',
      inputSchema: { surveyId: z.string() },
      annotations: { readOnlyHint: true },
    },
    async ({ surveyId }) => {
      const c = getConn();
      if (!c.ok) return c.res;
      const r = await getSurvey(c.db, surveyId);
      if (isErr(r)) return fail(r.error.code, r.error.message);
      return ok(`"${r.data.survey.title}" — ${r.data.questions.length} question(s).`, {
        survey: r.data.survey,
        questions: r.data.questions,
      });
    },
  );

  server.registerTool(
    'list_responses',
    {
      title: 'List raw responses (paginated)',
      description: 'Cursor-paginated raw responses with answers. Pass the returned nextCursor to page.',
      inputSchema: {
        surveyId: z.string(),
        limit: z.number().int().min(1).max(200).optional(),
        cursor: z.string().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ surveyId, limit, cursor }) => {
      const c = getConn();
      if (!c.ok) return c.res;
      const r = await listResponses(c.db, surveyId, { limit, cursor });
      if (isErr(r)) return fail(r.error.code, r.error.message);
      return ok(`${r.data.responses.length} response(s).`, {
        responses: r.data.responses,
        nextCursor: r.data.nextCursor,
      });
    },
  );

  server.registerTool(
    'get_results',
    {
      title: 'Get survey results (aggregates + raw)',
      description:
        'Return pre-computed aggregates over ALL responses (counts/percentages for choices; ' +
        'mean/median/min/max/distribution for ratings & numbers; raw text for text questions) PLUS a ' +
        'paginated page of raw responses. Use the aggregates for summaries; theme the raw text yourself.',
      inputSchema: {
        surveyId: z.string(),
        responsesLimit: z.number().int().min(1).max(200).optional(),
        cursor: z.string().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ surveyId, responsesLimit, cursor }) => {
      const c = getConn();
      if (!c.ok) return c.res;
      const r = await getResults(c.db, surveyId, { responsesLimit, cursor });
      if (isErr(r)) return fail(r.error.code, r.error.message);
      return ok(
        `Results for "${r.data.survey.title}": ${r.data.survey.responseCount} response(s).`,
        r.data as unknown as Record<string, unknown>,
      );
    },
  );

  return server;
}
