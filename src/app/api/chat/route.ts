import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';

// Allow streaming responses up to 60 seconds
export const maxDuration = 60;

export async function POST(req: Request) {
    const { messages } = await req.json();

    const result = streamText({
        model: openai('gpt-4o'),
        system:
            'You are a helpful AI assistant. Be concise, clear, and helpful. When providing code, always use proper markdown code blocks with language identifiers.',
        messages,
    });

    return result.toDataStreamResponse();
}
