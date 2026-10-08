import assert from 'node:assert/strict'
import { syncSchema } from '../src/server/schema'
import { seedReference } from '../src/server/seed'
import { setSettings } from '../src/server/settings'
import { chat, endpoints, testLlm } from '../src/server/ai/llm'

syncSchema(); seedReference()
const original = globalThis.fetch
const requests: { url: string; body: any; authorization: string | null }[] = []
globalThis.fetch = async (input, init) => {
  const body = JSON.parse(String(init?.body))
  requests.push({ url: String(input), body, authorization: new Headers(init?.headers).get('Authorization') })
  if (body.model === 'retired') return new Response(JSON.stringify({ error: { message: 'Model not found' } }), { status: 404 })
  if (body.model === 'limited') return new Response(JSON.stringify({ error: { message: 'Limit reached' } }), { status: 429 })
  return new Response(JSON.stringify({ choices: [{ message: { content: 'ready', tool_calls: [{ id: 'one', function: { name: 'business_snapshot', arguments: '{}' } }] } }], usage: { total_tokens: 12 } }))
}
try {
  setSettings({ ai_provider: 'openrouter', ai_base_url: '', ai_model: '', ai_api_key: ' test-key ', ai_fallback_provider: '' })
  assert.equal(endpoints()[0].model, 'openrouter/free')
  const result = await chat([{ role: 'user', content: 'Briefing' }], [{ name: 'business_snapshot', description: 'Read business totals', parameters: { type: 'object', properties: {} } }])
  assert.equal(result.tool_calls[0].name, 'business_snapshot')
  assert.equal(requests[0].url, 'https://openrouter.ai/api/v1/chat/completions')
  assert.equal(requests[0].authorization, 'Bearer test-key')
  assert.equal(requests[0].body.tool_choice, 'auto')
  setSettings({ ai_model: 'retired' })
  const failed = await testLlm()
  assert.equal(failed.ok, false)
  assert.match(failed.error!, /HTTP 404.*Check the model ID and base URL/)
  setSettings({ ai_fallback_provider: 'groq', ai_fallback_model: '', ai_fallback_api_key: 'fallback-key' })
  assert.equal((await testLlm()).model, 'openai/gpt-oss-20b')
  setSettings({ ai_fallback_model: 'limited' })
  const both = await testLlm()
  assert.match(both.error!, /primary model retired/)
  assert.match(both.error!, /fallback model limited: HTTP 429/)
  setSettings({ ai_base_url: ' https://example.invalid/v1/// ', ai_model: ' custom-model ' })
  assert.equal(endpoints()[0].base, 'https://example.invalid/v1')
  assert.equal(endpoints()[0].model, 'custom-model')
  console.log('AI connection checks passed: free presets, tool requests, whitespace, 404 guidance, fallback and combined errors. No external API called.')
} finally { globalThis.fetch = original }
