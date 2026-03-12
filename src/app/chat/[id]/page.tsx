'use client';

import { useEffect, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useSuspenseQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/app-shell';
import { ChatInput } from '@/components/chat/chat-input';
import { useChatStore } from '@/stores/chat-store';
import {
    Conversation,
    ConversationContent,
    ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import {
    Message,
    MessageContent,
    MessageResponse,
} from '@/components/ai-elements/message';
import {
    Reasoning,
    ReasoningContent,
    ReasoningTrigger,
} from '@/components/ai-elements/reasoning';
import { WriterAgentMessage } from '@/components/ai-elements/writer-agent-message';
import { Loader } from 'lucide-react';

type GenericPart = {
    type: string;
    text?: string;
    data?: Record<string, unknown>;
    [key: string]: unknown;
};

type ApiMessage = {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content?: string;
    parts?: GenericPart[];
    metadata?: {
        createdAt?: string;
    };
};

function ChatContent() {
    const params = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();
    const chatId = params.id as string;
    const initialQuery = searchParams.get('q');

    const { addMessage } = useChatStore();

    // Fetch initial messages using TanStack Query
    const { data: initialMessages } = useSuspenseQuery({
        queryKey: ['chat', chatId, 'messages'],
        queryFn: async () => {
            if (!chatId) return [];
            try {
                const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/chat/threads/${chatId}/messages`);
                if (!response.ok) {
                    if (response.status === 404 || response.status === 400) return [];
                    throw new Error('Failed to fetch messages');
                }
                
                const data = await response.json();
                console.log('Fetched messages:', data);
                if (data.data && Array.isArray(data.data)) {
                    return data.data.map((msg: ApiMessage) => ({
                        id: msg.id,
                        role: msg.role,
                        content: msg.content || '',
                        parts: msg.parts || [],
                        createdAt: new Date(msg.metadata?.createdAt || new Date()),
                    }));
                }
                return [];
            } catch (error) {
                console.error('Error fetching messages:', error);
                return [];
            }
        },
    });

    const { messages, sendMessage, isLoading, stop, status } = useChat({
        transport: new DefaultChatTransport({
            api: `${process.env.NEXT_PUBLIC_API_URL}/chat/network`,
        }),
        id: chatId,
        messages: initialMessages,
        body: {
            threadId: chatId,
            resourceId: 'user-1', // Default resource ID
        },
        onFinish: ({message}) => {
            // Extract text content from parts
            const content = message.parts
                .filter((part) => part.type === 'text')
                .map((part) => part.text)
                .join('');

            addMessage(chatId, {
                id: message.id,
                role: 'assistant',
                content: content,
                createdAt: new Date(),
            });
        },
    });

    // Send initial query from URL (coming from suggestion card or onboarding)
    useEffect(() => {
        if (initialQuery && messages.length === 0) {
            const msg = decodeURIComponent(initialQuery);
            sendMessage({ role: 'user', parts: [{ type: 'text', text: msg }] });
            addMessage(chatId, {
                id: crypto.randomUUID(),
                role: 'user',
                content: msg,
                createdAt: new Date(),
            });
            // Clean URL
            router.replace(`/chat/${chatId}`);
        }
    }, [initialQuery]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSend = (message: string) => {
        sendMessage({ role: 'user', parts: [{ type: 'text', text: message }] });
        addMessage(chatId, {
            id: crypto.randomUUID(),
            role: 'user',
            content: message,
            createdAt: new Date(),
        });
    };

    const formatPretty = (value: unknown) => {
        if (typeof value === 'string') return value;
        if (value == null) return '';
        try {
            return JSON.stringify(value, null, 2);
        } catch {
            return String(value);
        }
    };

    const renderReasoningBlock = ({
        key,
        label,
        content,
        isStreamingPart = false,
    }: {
        key: string;
        label: string;
        content: unknown;
        isStreamingPart?: boolean;
    }) => (
        <Reasoning key={key} isStreaming={isStreamingPart}>
            <ReasoningTrigger>
                <div className="flex items-center gap-2">
                    <span className="font-medium">{label}</span>
                    {isStreamingPart && <Loader className="h-3 w-3 animate-spin text-muted-foreground" />}
                </div>
            </ReasoningTrigger>
            <ReasoningContent>{formatPretty(content) || 'No output available'}</ReasoningContent>
        </Reasoning>
    );

    const isSequentialThinkingPart = (part: GenericPart) =>
        part.type.startsWith('tool-') &&
        (part.toolName === 'sequentialThinkingTool' ||
            part.toolName === 'sequential-thinking-tool' ||
            part.input?.toolName === 'sequentialThinkingTool');

    const getSequentialThinkingLabel = (type: string) => {
        if (type === 'tool-input-start') return 'Thought Process: Sequential Thinking Started';
        if (type === 'tool-input-delta') return 'Thought Process: Sequential Thinking Stream';
        if (type === 'tool-input-available') return 'Thought Process: Sequential Thinking Input';
        if (type === 'tool-output-available') return 'Thought Process: Sequential Thinking Output';
        return 'Thought Process: Sequential Thinking';
    };

    return (
        <div className="flex h-full flex-col">
            {/* Model Header */}
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <span className="text-sm font-medium text-foreground">GPT-4o</span>
                <span className="text-xs text-muted-foreground">•</span>
                <span className="text-xs text-muted-foreground">AI Chat</span>
            </div>

            {/* Messages */}
            <Conversation className="flex-1 overflow-y-auto">
                <ConversationContent>
                    {messages.map((message, index) => (
                        <Message from={message.role} key={message.id}>
                            <MessageContent>
                                {message.parts.map((rawPart, i) => {
                                    const isStreaming = isLoading && index === messages.length - 1;
                                    const part = rawPart as GenericPart;
                                    const key = `${message.id}-${i}`;

                                    if (part.type === 'text') {
                                        return (
                                            <MessageResponse key={key}>
                                                {part.text}
                                            </MessageResponse>
                                        );
                                    }

                                    if (part.type === 'tool-invocation') {
                                        const toolName = part.toolInvocation?.toolName || 'Unknown Tool';
                                        return renderReasoningBlock({
                                            key,
                                            label: `Using tool: ${toolName}`,
                                            content: part.toolInvocation?.input?.thought || 'No input available',
                                            isStreamingPart: isStreaming,
                                        });
                                    }

                                    if (part.type === 'dynamic-tool') {
                                        const toolName = part.data?.id || 'Unknown Tool';
                                        const toolResult = part.data?.text;

                                        if (toolName === 'writer-agent' && toolResult) {
                                            return (
                                                <div key={key} className="mt-4 w-full">
                                                    <WriterAgentMessage content={toolResult} />
                                                </div>
                                            );
                                        }

                                        return renderReasoningBlock({
                                            key,
                                            label: `Using tool: ${toolName}`,
                                            content: part.data?.input?.thought,
                                            isStreamingPart: isStreaming,
                                        });
                                    }

                                    if (part.type === 'reasoning' || part.type === 'data-tool-agent') {
                                        const agentData = part.data || {};
                                        const agentName = agentData.id || 'Unknown Agent';

                                        return renderReasoningBlock({
                                            key,
                                            label: `Agent: ${agentName}`,
                                            content: agentData.text || agentData,
                                            isStreamingPart: isStreaming,
                                        });
                                    }

                                    // if (part.type === 'data-om-status') {
                                    //     const windows = part.data?.windows;
                                    //     const activeMessageTokens = windows?.active?.messages?.tokens;
                                    //     const activeMessageThreshold = windows?.active?.messages?.threshold;
                                    //     const activeObservationTokens = windows?.active?.observations?.tokens;
                                    //     const activeObservationThreshold = windows?.active?.observations?.threshold;

                                    //     return renderReasoningBlock({
                                    //         key,
                                    //         label: 'Thought Process: Observation Memory Status',
                                    //         content: {
                                    //             recordId: part.data?.recordId,
                                    //             threadId: part.data?.threadId,
                                    //             stepNumber: part.data?.stepNumber,
                                    //             generationCount: part.data?.generationCount,
                                    //             activeMessages: `${activeMessageTokens ?? 0}/${activeMessageThreshold ?? 0}`,
                                    //             activeObservations: `${activeObservationTokens ?? 0}/${activeObservationThreshold ?? 0}`,
                                    //             buffered: windows?.buffered,
                                    //         },
                                    //         isStreamingPart: isStreaming,
                                    //     });
                                    // }

                                    // if (part.type === 'data-om-buffering-start') {
                                    //     return renderReasoningBlock({
                                    //         key,
                                    //         label: 'Thought Process: Observation Buffering Started',
                                    //         content: {
                                    //             cycleId: part.data?.cycleId,
                                    //             operationType: part.data?.operationType,
                                    //             startedAt: part.data?.startedAt,
                                    //             tokensToBuffer: part.data?.tokensToBuffer,
                                    //             recordId: part.data?.recordId,
                                    //             threadId: part.data?.threadId,
                                    //             config: part.data?.config,
                                    //         },
                                    //         isStreamingPart: isStreaming,
                                    //     });
                                    // }

                                    // if (part.type === 'data-om-buffering-end') {
                                    //     return renderReasoningBlock({
                                    //         key,
                                    //         label: 'Thought Process: Observation Buffering Completed',
                                    //         content: {
                                    //             cycleId: part.data?.cycleId,
                                    //             operationType: part.data?.operationType,
                                    //             completedAt: part.data?.completedAt,
                                    //             durationMs: part.data?.durationMs,
                                    //             tokensBuffered: part.data?.tokensBuffered,
                                    //             bufferedTokens: part.data?.bufferedTokens,
                                    //             recordId: part.data?.recordId,
                                    //             threadId: part.data?.threadId,
                                    //             observations: part.data?.observations,
                                    //         },
                                    //         isStreamingPart: isStreaming,
                                    //     });
                                    // }

                                    if (part.type.startsWith('tool-')) {
                                        const toolName = part.type.replace('tool-', '');

                                        if (toolName === 'sequentialThinkingTool') {
                                            return renderReasoningBlock({
                                                key,
                                                label: `🧠 Thought`,
                                                content: part.input?.thought || 'there its',
                                                isStreamingPart: isStreaming,
                                            });
                                        }

                                        if (toolName === 'webSearchTool') {
                                            return renderReasoningBlock({
                                                key,
                                                label: `🔎 Mencari informasi tentang : ${part.input?.query || 'nothing'}`,
                                                content: part.output?.map(i => i.content).join('\n\n') || 'there its',
                                                isStreamingPart: isStreaming,
                                            });
                                        }

                                        return renderReasoningBlock({
                                            key,
                                            label: `Using tool: ${toolName}`,
                                            content: `Mencari informasi tentang : ${part.input?.query || 'nothing'}`,
                                            isStreamingPart: isStreaming,
                                        });
                                    }

                                    // if (part.type.startsWith('data-')) {
                                    //     return renderReasoningBlock({
                                    //         key,
                                    //         label: `Event: ${part.type}`,
                                    //         content: part.data ?? part,
                                    //         isStreamingPart: isStreaming,
                                    //     });
                                    // }

                                    return null
                                })}
                            </MessageContent>
                        </Message>
                    ))}
                </ConversationContent>
                <ConversationScrollButton />
            </Conversation>

            {/* Input */}
            <ChatInput onSubmit={handleSend} isLoading={isLoading} onStop={stop} status={status} />
        </div>
    );
}

export default function ChatPage() {
    return (
        <AppShell>
            <Suspense fallback={
                <div className="flex h-full items-center justify-center">
                    <Loader className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            }>
                <ChatContent />
            </Suspense>
        </AppShell>
    );
}
