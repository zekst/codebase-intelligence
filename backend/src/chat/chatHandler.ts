import Anthropic from '@anthropic-ai/sdk';
import { buildSystemPrompt } from './promptBuilder.js';
import type { ChatRequest, ChatResponse } from '../types/index.js';

const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 1024;

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        'ANTHROPIC_API_KEY environment variable is not set. ' +
        'Set it before starting the server: export ANTHROPIC_API_KEY=sk-...'
      );
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

/**
 * Handles a chat request by building a context-rich prompt
 * and calling the Anthropic Claude API.
 */
export async function handleChat(req: ChatRequest): Promise<ChatResponse> {
  try {
    const systemPrompt = buildSystemPrompt(req.context);

    // Build messages array: history + current message
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    if (req.history?.length) {
      // Limit to last 10 messages to control token usage
      messages.push(...req.history.slice(-10));
    }

    messages.push({ role: 'user', content: req.message });

    const anthropic = getClient();

    console.log(`💬 Chat: "${req.message.slice(0, 60)}${req.message.length > 60 ? '...' : ''}"`);
    console.log(`   📋 Context: ${systemPrompt.length} chars, ${messages.length} messages`);

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages,
    });

    const textBlock = response.content.find(b => b.type === 'text');
    const reply = textBlock ? (textBlock as { type: 'text'; text: string }).text : 'No response generated.';

    console.log(`   ✅ Reply: ${reply.length} chars, ${response.usage.output_tokens} tokens`);

    return { success: true, reply };
  } catch (err) {
    const message = (err as Error).message;
    console.error('❌ Chat error:', message);
    return { success: false, error: message };
  }
}
