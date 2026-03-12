'use client';

import { useEffect, Suspense, useState } from 'react';
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
import { Progress } from '@/components/ui/progress';
import { Check, Loader } from 'lucide-react';

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

    const toPlainTextWithNewlines = (value: unknown) =>
        formatPretty(value)
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .replace(/\\n/g, '\n')
            .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
            .replace(/[ \t]+/g, ' ')
            .trim();

    const extractToolOutputText = (output: unknown) => {
        if (Array.isArray(output)) {
            return output
                .map((item) => {
                    if (item && typeof item === 'object' && 'content' in item) {
                        const content = (item as { content?: unknown }).content;
                        if (typeof content === 'string') return content;
                    }
                    return formatPretty(item);
                })
                .join('\n');
        }
        if (typeof output === 'string') return output;
        return formatPretty(output);
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
        <Reasoning defaultOpen={true} key={key} isStreaming={isStreamingPart}>
            <ReasoningTrigger>
                <div className="flex items-center gap-2">
                    <span className="font-medium">{label}</span>
                    {isStreamingPart && <Loader className="h-3 w-3 animate-spin text-muted-foreground" />}
                </div>
            </ReasoningTrigger>
            <ReasoningContent>{formatPretty(content) || 'No output available'}</ReasoningContent>
        </Reasoning>
    );

    const ToolProgressBlock = ({
        label,
        content,
        isSuccess,
        isStreamingPart = false,
    }: {
        label: string;
        content: unknown;
        isSuccess: boolean;
        isStreamingPart?: boolean;
    }) => {
        const [progress, setProgress] = useState(isSuccess ? 100 : 1);
        const plainContent = toPlainTextWithNewlines(content).slice(0, 1000);

        useEffect(() => {
            if (isSuccess) {
                setProgress(100);
                return;
            }

            const interval = setInterval(() => {
                setProgress((prev) => {
                    if (prev >= 80) return prev;
                    const next = prev + Math.max(1, Math.floor((80 - prev) / 7));
                    return Math.min(80, next);
                });
            }, 350);

            return () => clearInterval(interval);
        }, [isSuccess]);

        return (
            <Reasoning defaultOpen isStreaming={isStreamingPart && !isSuccess}>
                <ReasoningTrigger>
                    <div className="flex w-full flex-col gap-2">
                        <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{label}</span>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>{progress}%</span>
                                {isSuccess ? (
                                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                                ) : (
                                    <Loader className="h-3.5 w-3.5 animate-spin" />
                                )}
                            </div>
                        </div>
                        <Progress value={progress} className="h-1.5" />
                    </div>
                </ReasoningTrigger>
                {/* <ReasoningContent>{plainContent || 'No output available'}</ReasoningContent> */}
            </Reasoning>
        );
    };

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

                                        if (toolName === 'searchTaxKnowledgeTool') {
                                            const query = part.input?.query || 'nothing';
                                            const content = extractToolOutputText(part.output?.map(i => i.text).join('\n\n')) || 'Mencari referensi...';
                                            const isSuccess =
                                                part.state === 'output-available' ||
                                                part.state === 'done' ||
                                                part.state === 'completed' ||
                                                part.output !== undefined;

                                            return (
                                                <ToolProgressBlock
                                                    key={key}
                                                    label={`🔎 Mencari informasi tentang : ${query}`}
                                                    content={content}
                                                    isSuccess={isSuccess}
                                                    isStreamingPart={isStreaming}
                                                />
                                            );
                                        }

                                        if (toolName === 'webSearchTool') {
                                            const query = part.input?.query || 'nothing';
                                            const content = extractToolOutputText(part.output?.text) || 'Mencari referensi...';
                                            const isSuccess =
                                                part.state === 'output-available' ||
                                                part.state === 'done' ||
                                                part.state === 'completed' ||
                                                part.output !== undefined;

                                            return (
                                                <ToolProgressBlock
                                                    key={key}
                                                    label={`🔎 Mencari informasi tentang : ${query}`}
                                                    content={content}
                                                    isSuccess={isSuccess}
                                                    isStreamingPart={isStreaming}
                                                />
                                            );
                                        }

                                        if (toolName === 'calculatorTool') {
                                            return renderReasoningBlock({
                                                key,
                                                label: `🔢 Kalkulator`,
                                                content:  `${part?.input?.expression || ''} = ${part.output}` || 'Nothing',
                                                isStreamingPart: isStreaming,
                                            });
                                        }

                                        if (toolName === 'skill-activate') {
                                            return renderReasoningBlock({
                                                key,
                                                label: ` 🔧 Aktifkan Skill`,
                                                content: part.output || 'Nothing',
                                                isStreamingPart: isStreaming,
                                            });
                                        }

                                        return null;
                                    }

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
