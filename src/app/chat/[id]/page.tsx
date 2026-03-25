'use client';

import { useEffect, Suspense, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useChat } from '@ai-sdk/react';
import {
    DefaultChatTransport,
    lastAssistantMessageIsCompleteWithApprovalResponses,
    lastAssistantMessageIsCompleteWithToolCalls,
} from 'ai';
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
    Confirmation,
    ConfirmationAccepted,
    ConfirmationAction,
    ConfirmationActions,
    ConfirmationRejected,
    ConfirmationRequest,
    ConfirmationTitle,
} from '@/components/ai-elements/confirmation';
import {
    Reasoning,
    ReasoningContent,
    ReasoningTrigger,
} from '@/components/ai-elements/reasoning';
import { WriterAgentMessage } from '@/components/ai-elements/writer-agent-message';
import { Attachment, AttachmentInfo, AttachmentPreview, Attachments } from '@/components/ai-elements/attachments';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Check, Loader, X } from 'lucide-react';

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

type SequentialWritingSection = {
    sectionIndex: number;
    totalSections?: number;
    sectionTitle?: string;
    content: string;
    isLastSection?: boolean;
};

function ChatContent() {
    const params = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();
    const chatId = params.id as string;
    const initialQuery = searchParams.get('q');
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4050';
    const [rightbarView, setRightbarView] = useState<'canvas' | 'preview'>('preview');
    const [isRightbarOpen, setIsRightbarOpen] = useState(true);

    const { addMessage } = useChatStore();

    // Fetch initial messages using TanStack Query
    const { data: initialMessages } = useSuspenseQuery({
        queryKey: ['chat', chatId, 'messages'],
        queryFn: async () => {
            if (!chatId) return [];
            try {
                const response = await fetch(`${apiUrl}/chat/threads/${chatId}/messages`);
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

    const { messages, sendMessage, isLoading, stop, status, addToolApprovalResponse, addToolOutput } = useChat({
        transport: new DefaultChatTransport({
            api: `${apiUrl}/chat/network`,
        }),
        id: chatId,
        messages: initialMessages,
        sendAutomaticallyWhen: ({ messages }) =>
            lastAssistantMessageIsCompleteWithApprovalResponses({ messages }) ||
            lastAssistantMessageIsCompleteWithToolCalls({ messages }),
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

    const handleSend = (message: { text: string; files: { type: 'file'; mediaType: string; filename?: string; url: string }[] }) => {
        const parts: GenericPart[] = [
            ...(message.text.trim() ? [{ type: 'text', text: message.text.trim() }] : []),
            ...message.files,
        ];
        if (parts.length === 0) return;

        sendMessage({ role: 'user', parts });
        addMessage(chatId, {
            id: crypto.randomUUID(),
            role: 'user',
            content: message.text.trim() || '(Attachment)',
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

    const getToolDisplayName = (type: string) => type.replace('tool-', '');

    const extractSequentialWritingContent = (value: unknown): string => {
        if (typeof value === 'string') return value;
        if (Array.isArray(value)) {
            return value.map((item) => extractSequentialWritingContent(item)).filter(Boolean).join('\n');
        }
        if (value && typeof value === 'object') {
            const record = value as Record<string, unknown>;
            const directKeys = ['markdown', 'content', 'text', 'draft', 'result', 'output'];
            for (const key of directKeys) {
                const candidate = record[key];
                if (typeof candidate === 'string' && candidate.trim()) return candidate;
            }
            if (Array.isArray(record.content)) {
                return record.content
                    .map((item) => extractSequentialWritingContent(item))
                    .filter(Boolean)
                    .join('\n');
            }
        }
        return toPlainTextWithNewlines(value);
    };

    const normalizeMarkdown = (text: string) => text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

    const parseSequentialWritingSection = (value: unknown): SequentialWritingSection | null => {
        if (!value || typeof value !== 'object') return null;
        const record = value as Record<string, unknown>;
        const index = Number(record.sectionIndex);
        const content = typeof record.content === 'string' ? record.content : '';

        if (!Number.isFinite(index) || !content.trim()) return null;

        const totalSectionsRaw = Number(record.totalSections);
        const totalSections = Number.isFinite(totalSectionsRaw) ? totalSectionsRaw : undefined;
        const sectionTitle = typeof record.sectionTitle === 'string' ? record.sectionTitle : undefined;
        const isLastSection = typeof record.isLastSection === 'boolean' ? record.isLastSection : undefined;

        return {
            sectionIndex: index,
            totalSections,
            sectionTitle,
            content,
            isLastSection,
        };
    };

    const sequentialWritingPreview = useMemo(() => {
        let started = false;
        const sections = new Map<number, SequentialWritingSection>();
        const deltaBufferByCall = new Map<string, string>();
        let fallbackContent = '';

        for (const message of messages) {
            for (const rawPart of message.parts as GenericPart[]) {
                const part = rawPart as GenericPart & {
                    toolName?: string;
                    toolCallId?: string;
                    input?: unknown;
                    output?: unknown;
                    inputTextDelta?: string;
                    type: string;
                };

                const resolvedToolName =
                    part.toolName ||
                    (part.type.startsWith('tool-') ? part.type.replace('tool-', '') : '');
                const isSequentialWritingTool =
                    resolvedToolName === 'sequentialWritingTool' ||
                    resolvedToolName === 'sequential-writing-tool';

                if (!isSequentialWritingTool) continue;

                if (part.type === 'tool-input-start') {
                    started = true;
                    continue;
                }

                if (part.type === 'tool-input-delta' && typeof part.inputTextDelta === 'string') {
                    started = true;
                    const callId = part.toolCallId || 'unknown';
                    const current = deltaBufferByCall.get(callId) || '';
                    deltaBufferByCall.set(callId, current + part.inputTextDelta);
                    continue;
                }

                if (part.type === 'tool-input-available') {
                    started = true;
                    const section = parseSequentialWritingSection(part.input);
                    if (section) {
                        sections.set(section.sectionIndex, section);
                    } else {
                        fallbackContent = extractSequentialWritingContent(part.input) || fallbackContent;
                    }
                    continue;
                }

                if (part.type === 'tool-output-available' || part.type === 'tool-sequentialWritingTool') {
                    started = true;
                    const section =
                        parseSequentialWritingSection(part.output) ||
                        parseSequentialWritingSection(part.input);

                    if (section) {
                        sections.set(section.sectionIndex, section);
                    } else {
                        fallbackContent =
                            extractSequentialWritingContent(part.output) ||
                            extractSequentialWritingContent(part.input) ||
                            fallbackContent;
                    }
                }
            }
        }

        if (sections.size === 0 && deltaBufferByCall.size > 0) {
            for (const value of deltaBufferByCall.values()) {
                try {
                    const parsed = JSON.parse(value);
                    const section = parseSequentialWritingSection(parsed);
                    if (section) sections.set(section.sectionIndex, section);
                } catch {
                }
            }
        }

        if (!started) return null;

        if (sections.size > 0) {
            const merged = Array.from(sections.values())
                .sort((a, b) => a.sectionIndex - b.sectionIndex)
                .map((section) => {
                    const sectionContent = normalizeMarkdown(section.content);
                    // if (section.sectionTitle) {
                    //     return `### ${section.sectionTitle}\n\n${sectionContent}`;
                    // }
                    return sectionContent;
                })
                .join('\n\n');

            return merged || 'Writing started...';
        }

        const normalized = normalizeMarkdown(fallbackContent);
        return normalized || 'Writing started...';
    }, [messages]);

    useEffect(() => {
        if (sequentialWritingPreview) {
            setIsRightbarOpen(true);
        }
    }, [sequentialWritingPreview]);

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
        isSuccess,
        isStreamingPart = false,
    }: {
        label: string;
        isSuccess: boolean;
        isStreamingPart?: boolean;
    }) => (
        <Reasoning defaultOpen isStreaming={isStreamingPart && !isSuccess}>
            <ReasoningTrigger>
                <div className="flex w-full items-center justify-between gap-2">
                    <span className="font-medium">{label}</span>
                    {isSuccess ? (
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                        <Loader className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    )}
                </div>
            </ReasoningTrigger>
        </Reasoning>
    );

    const [generationProgress, setGenerationProgress] = useState(0);
    const [showGenerationProgress, setShowGenerationProgress] = useState(false);
    const wasGeneratingRef = useRef(false);
    const isGenerating = isLoading || status === 'submitted' || status === 'streaming';

    useEffect(() => {
        if (isGenerating) {
            if (!wasGeneratingRef.current) {
                setShowGenerationProgress(true);
                setGenerationProgress(1);
            }
            wasGeneratingRef.current = true;
            return;
        }

        if (wasGeneratingRef.current && status === 'ready') {
            setShowGenerationProgress(true);
            setGenerationProgress(100);
        }

        if (status === 'error') {
            setShowGenerationProgress(false);
            setGenerationProgress(0);
        }

        wasGeneratingRef.current = false;
    }, [isGenerating, status]);

    useEffect(() => {
        if (!isGenerating) return;

        const interval = setInterval(() => {
            setGenerationProgress((prev) => {
                if (prev >= 79) return prev;
                const remaining = 79 - prev;
                const step = remaining > 28 ? 3 : remaining > 14 ? 2 : 1;
                return Math.min(79, prev + step);
            });
        }, 450);

        return () => clearInterval(interval);
    }, [isGenerating]);

    useEffect(() => {
        if (generationProgress !== 100 || !showGenerationProgress) return;

        const timeout = setTimeout(() => {
            setShowGenerationProgress(false);
            setGenerationProgress(0);
        }, 600);

        return () => clearTimeout(timeout);
    }, [generationProgress, showGenerationProgress]);

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
        <div className="flex h-full min-w-0">
            <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                    <span className="text-sm font-medium text-foreground">GPT-4o</span>
                    <span className="text-xs text-muted-foreground">•</span>
                    <span className="text-xs text-muted-foreground">AI Chat</span>
                </div>
                {showGenerationProgress ? (
                    <div className="border-b border-border px-4 py-2">
                        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                            <span>Generating response</span>
                            <span>{generationProgress}%</span>
                        </div>
                        <Progress value={generationProgress} className="h-1.5" />
                    </div>
                ) : null}

                <Conversation className="flex-1 overflow-y-auto">
                    <ConversationContent>
                        {messages.map((message, index) => (
                            <Message from={message.role} key={message.id}>
                                <MessageContent>
                                    {(() => {
                                    let hasRenderedSequentialWritingCard = false;
                                    return message.parts.map((rawPart, i) => {
                                    const isStreaming = isLoading && index === messages.length - 1;
                                    const part = rawPart as GenericPart;
                                    const key = `${message.id}-${i}`;
                                    const toolNameForPart = part.type.startsWith('tool-') ? getToolDisplayName(part.type) : '';
                                    const isSequentialWritingPart =
                                        toolNameForPart === 'sequentialWritingTool' ||
                                        toolNameForPart === 'sequential-writing-tool';

                                    if (part.type === 'text') {
                                        return (
                                            <MessageResponse key={key}>
                                                {part.text}
                                            </MessageResponse>
                                        );
                                    }

                                    if (part.type === 'file') {
                                        return (
                                            <div key={key} className="mb-3">
                                                <Attachments variant="list">
                                                    <Attachment data={{ ...(part as never), id: key }} >
                                                        <AttachmentPreview />
                                                        <AttachmentInfo showMediaType />
                                                    </Attachment>
                                                </Attachments>
                                            </div>
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

                                    if (
                                        isSequentialWritingPart &&
                                        sequentialWritingPreview &&
                                        !isRightbarOpen &&
                                        !hasRenderedSequentialWritingCard
                                    ) {
                                        hasRenderedSequentialWritingCard = true;
                                        return (
                                            <Card key={key} className="mb-4 gap-4 py-4">
                                                <CardHeader className="px-4">
                                                    <CardTitle className="text-sm">📝 Sequential Writing Draft</CardTitle>
                                                    <CardDescription>
                                                        Draft tersedia di rightbar. Klik untuk membuka panel.
                                                    </CardDescription>
                                                </CardHeader>
                                                <CardContent className="px-4">
                                                    <div className="line-clamp-3 text-xs text-muted-foreground">
                                                        {sequentialWritingPreview}
                                                    </div>
                                                </CardContent>
                                                <CardFooter className="justify-end px-4">
                                                    <Button size="sm" onClick={() => setIsRightbarOpen(true)}>
                                                        Open Rightbar
                                                    </Button>
                                                </CardFooter>
                                            </Card>
                                        );
                                    }

                                    if (part.type.startsWith('tool-') || part.type === 'dynamic-tool') {
                                        const toolName =
                                            (part.toolName as string | undefined) ||
                                            getToolDisplayName(part.type);
                                        const approvalId = part.approval?.id;
                                        const hasApprovalState =
                                            part.state === 'approval-requested' ||
                                            part.state === 'approval-responded' ||
                                            part.state === 'output-denied' ||
                                            part.state === 'output-available';

                                        if (toolName === 'askConfirmationTool') {
                                            const prompt =
                                                (part.input as { message?: string; question?: string; reason?: string })?.message ||
                                                (part.input as { message?: string; question?: string; reason?: string })?.question ||
                                                (part.input as { message?: string; question?: string; reason?: string })?.reason ||
                                                'Please confirm this action.';
                                            const resultRecord = part.output as
                                                | string
                                                | { approved?: boolean; confirmed?: boolean; decision?: string }
                                                | undefined;
                                            const approvedValue =
                                                typeof resultRecord === 'string'
                                                    ? resultRecord.toLowerCase() === 'approve'
                                                    : resultRecord?.approved ?? resultRecord?.confirmed;
                                            const isAnswered = part.output !== undefined || part.state === 'approval-responded';

                                            const handleDecision = (approved: boolean) => {
                                                if (approvalId) {
                                                    addToolApprovalResponse({
                                                        id: approvalId,
                                                        approved,
                                                    });
                                                    return;
                                                }

                                                addToolOutput({
                                                    tool: toolName as never,
                                                    toolCallId: part.toolCallId as string,
                                                    output: {
                                                        approved,
                                                        confirmed: approved,
                                                        decision: approved ? 'approve' : 'decline',
                                                    } as never,
                                                });
                                            };

                                            return (
                                                <Card key={key} className="mb-4 w-full">
                                                    <CardHeader>
                                                        <CardTitle className="text-sm font-medium">Confirmation Request</CardTitle>
                                                        <CardDescription>{prompt}</CardDescription>
                                                    </CardHeader>
                                                    <CardFooter className="justify-end gap-2">
                                                        {isAnswered ? (
                                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                                {approvedValue ? (
                                                                    <Check className="h-4 w-4 text-emerald-500" />
                                                                ) : (
                                                                    <X className="h-4 w-4 text-red-500" />
                                                                )}
                                                                <span>{approvedValue ? 'Approved' : 'Declined'}</span>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <Button variant="outline" size="sm" onClick={() => handleDecision(false)}>
                                                                    Decline
                                                                </Button>
                                                                <Button size="sm" onClick={() => handleDecision(true)}>
                                                                    Approve
                                                                </Button>
                                                            </>
                                                        )}
                                                    </CardFooter>
                                                </Card>
                                            );
                                        }

                                        if (approvalId && hasApprovalState) {
                                            return (
                                                <Confirmation
                                                    approval={part.approval}
                                                    state={part.state}
                                                    className="mb-4"
                                                    key={key}
                                                >
                                                    <ConfirmationRequest>
                                                        <div className="space-y-2">
                                                            <ConfirmationTitle>
                                                                {`Tool "${toolName}" memerlukan approval. Lanjutkan eksekusi?`}
                                                            </ConfirmationTitle>
                                                            <div className="text-xs text-muted-foreground">
                                                                {`Query: ${part.input?.query || 'No query'}`}
                                                            </div>
                                                        </div>
                                                    </ConfirmationRequest>
                                                    <ConfirmationAccepted>
                                                        <div className="flex items-center gap-2">
                                                            <Check className="h-4 w-4 text-emerald-600" />
                                                            <span>Approval diberikan, proses dilanjutkan.</span>
                                                        </div>
                                                    </ConfirmationAccepted>
                                                    <ConfirmationRejected>
                                                        <div className="flex items-center gap-2">
                                                            <X className="h-4 w-4 text-red-600" />
                                                            <span>Approval ditolak, proses dihentikan.</span>
                                                        </div>
                                                    </ConfirmationRejected>
                                                    <ConfirmationActions>
                                                        <ConfirmationAction
                                                            variant="outline"
                                                            onClick={() =>
                                                                addToolApprovalResponse({
                                                                    id: approvalId,
                                                                    approved: false,
                                                                })
                                                            }
                                                        >
                                                            Reject
                                                        </ConfirmationAction>
                                                        <ConfirmationAction
                                                            onClick={() =>
                                                                addToolApprovalResponse({
                                                                    id: approvalId,
                                                                    approved: true,
                                                                })
                                                            }
                                                        >
                                                            Approve & Resume
                                                        </ConfirmationAction>
                                                    </ConfirmationActions>
                                                </Confirmation>
                                            );
                                        }

                                        if (toolName === 'sequentialThinkingTool') {
                                            return renderReasoningBlock({
                                                key,
                                                label: `🧠 Thought`,
                                                content: part.input?.thought || 'Berpikir...',
                                                isStreamingPart: isStreaming,
                                            });
                                        }

                                        if (toolName === 'searchTaxKnowledgeTool') {
                                            const query = part.input?.query || 'Menelusuri...';
                                            const isSuccess =
                                                part.state === 'output-available' ||
                                                part.state === 'done' ||
                                                part.state === 'completed' ||
                                                part.output !== undefined;

                                            return (
                                                <ToolProgressBlock
                                                    key={key}
                                                    label={`🔎 Mencari informasi tentang : ${query}`}
                                                    isSuccess={isSuccess}
                                                    isStreamingPart={isStreaming}
                                                />
                                            );
                                        }

                                        if (toolName === 'webSearchTool') {
                                            const query = part.input?.query || 'Menelusuri...';
                                            const isSuccess =
                                                part.state === 'output-available' ||
                                                part.state === 'done' ||
                                                part.state === 'completed' ||
                                                part.output !== undefined;

                                            return (
                                                <ToolProgressBlock
                                                    key={key}
                                                    label={`🔎 Mencari informasi tentang : ${query}`}
                                                    isSuccess={isSuccess}
                                                    isStreamingPart={isStreaming}
                                                />
                                            );
                                        }

                                        if (toolName === 'calculatorTool') {
                                            return renderReasoningBlock({
                                                key,
                                                label: `🔢 Kalkulator`,
                                                content:  `${part?.input?.expression || ''} = ${part.output}` || 'Mengitung...',
                                                isStreamingPart: isStreaming,
                                            });
                                        }

                                        if (toolName === 'skill-activate') {
                                            return renderReasoningBlock({
                                                key,
                                                label: ` 🔧 Aktifkan Skill`,
                                                content: part.output || 'Mengaktifkan skill...',
                                                isStreamingPart: isStreaming,
                                            });
                                        }

                                        return null;
                                    }

                                    return null
                                    });
                                    })()}
                                </MessageContent>
                            </Message>
                        ))}
                    </ConversationContent>
                    <ConversationScrollButton />
                </Conversation>

                <ChatInput onSubmit={handleSend} isLoading={isLoading} onStop={stop} status={status} />
            </div>
            {sequentialWritingPreview && isRightbarOpen ? (
                <aside className="hidden h-full w-[460px] shrink-0 border-l border-border bg-background p-4 xl:block">
                    <div className="mb-3 flex items-center justify-between">
                        <div className="text-sm font-medium text-foreground">Writing Panel</div>
                        <Button variant="ghost" size="icon" onClick={() => setIsRightbarOpen(false)}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                    <Tabs
                        value={rightbarView}
                        onValueChange={(value) => setRightbarView(value as 'canvas' | 'preview')}
                        className="h-[calc(100%-44px)]"
                    >
                        <TabsList className="mb-3 w-full">
                            <TabsTrigger value="canvas">Markdown Canvas</TabsTrigger>
                            <TabsTrigger value="preview">Preview</TabsTrigger>
                        </TabsList>
                        <TabsContent value="canvas" className="h-[calc(100%-52px)]">
                            <div className="h-full rounded-xl border border-border bg-card p-3">
                                <Textarea
                                    value={sequentialWritingPreview}
                                    readOnly
                                    className="h-full min-h-full resize-none font-mono text-xs"
                                />
                            </div>
                        </TabsContent>
                        <TabsContent value="preview" className="h-[calc(100%-52px)]">
                            <WriterAgentMessage content={sequentialWritingPreview} />
                        </TabsContent>
                    </Tabs>
                </aside>
            ) : null}
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
