import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createDb } from '@agentic-survey/core';

const SB_URL = process.env.SUPABASE_URL;
const SB_SECRET = process.env.SUPABASE_SECRET_KEY;
const skip = !SB_URL || !SB_SECRET ? 'set SUPABASE_URL + SUPABASE_SECRET_KEY to run' : false;

const serverEntry = fileURLToPath(new URL('./cli.ts', import.meta.url));

let client: Client;
const createdSurveyIds: string[] = [];

before(async () => {
  if (skip) return;
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined) env[k] = v;
  const transport = new StdioClientTransport({
    command: process.execPath, // node
    args: ['--import', 'tsx', serverEntry],
    env,
  });
  client = new Client({ name: 'smoke-test', version: '0.0.0' });
  await client.connect(transport);
});

after(async () => {
  if (skip) return;
  await client?.close();
  if (createdSurveyIds.length) {
    const db = createDb(SB_URL!, SB_SECRET!);
    for (const id of createdSurveyIds) await db.from('surveys').delete().eq('id', id);
  }
});

function structured(res: any): any {
  return res.structuredContent;
}

test('lists the full Phase 1 tool surface', { skip }, async () => {
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name).sort();
  assert.deepEqual(names, [
    'add_question',
    'create_survey',
    'get_results',
    'get_share_link',
    'get_survey',
    'list_responses',
    'list_surveys',
    'publish_survey',
    'remove_question',
    'reorder_questions',
    'setup_connection',
    'update_question',
  ]);
});

test('setup_connection reports connected + schema present', { skip }, async () => {
  const res = await client.callTool({ name: 'setup_connection', arguments: {} });
  const s = structured(res);
  assert.equal(s.connected, true);
  assert.equal(s.schemaPresent, true);
});

test('create → add_question → publish → get_results over stdio', { skip }, async () => {
  const created = structured(
    await client.callTool({ name: 'create_survey', arguments: { title: 'MCP smoke survey' } }),
  );
  const surveyId = created.survey.id as string;
  createdSurveyIds.push(surveyId);
  assert.equal(created.survey.status, 'draft');

  const q = structured(
    await client.callTool({
      name: 'add_question',
      arguments: {
        surveyId,
        type: 'single_choice',
        prompt: 'Pick one',
        config: { options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] },
      },
    }),
  );
  assert.equal(q.question.type, 'single_choice');

  const pub = structured(await client.callTool({ name: 'publish_survey', arguments: { surveyId } }));
  assert.equal(pub.survey.status, 'published');

  const results = structured(await client.callTool({ name: 'get_results', arguments: { surveyId } }));
  assert.equal(results.survey.id, surveyId);
  assert.equal(results.survey.questionCount, 1);
  assert.equal(results.survey.responseCount, 0);
});

test('typed error (not thrown) for a bad survey id', { skip }, async () => {
  const res = await client.callTool({ name: 'get_survey', arguments: { surveyId: 'not-a-uuid' } });
  assert.equal((res as any).isError, true);
  assert.ok(structured(res).error?.code);
});
