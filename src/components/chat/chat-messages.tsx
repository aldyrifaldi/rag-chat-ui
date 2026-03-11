'use client';

import { useEffect, useRef } from 'react';
import type { UIMessage } from 'ai';
import { Bot, User, AlertCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/utils/cn';

interface ChatMessagesProps {
    messages: UIMessage[];
    isLoading?: boolean;
    error?: Error | undefined;
}

export function ChatMessages({ messages, isLoading, error }: ChatMessagesProps) {
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    if (messages.length === 0) {
        return (
            <div className="flex flex-1 items-center justify-center">
                <p className="text-sm text-muted-foreground">Start a conversation...</p>
            </div>
        );
    }

    return (
        <ScrollArea className="flex-1">
            <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
                {messages.map((message) => {
                    const content = message.parts
                        .filter((part) => part.type === 'text')
                        .map((part) => part.text)
                        .join('');

                    return (
                        <div
                            key={message.id}
                            className={cn(
                                'flex gap-3',
                                message.role === 'user' ? 'justify-end' : 'justify-start',
                            )}
                        >
                            {message.role === 'assistant' && (
                                <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                                    <Bot className="h-4 w-4 text-primary" />
                                </div>
                            )}

                            <div
                                className={cn(
                                    'max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed',
                                    message.role === 'user'
                                        ? 'bg-primary/15 text-foreground'
                                        : 'bg-secondary text-foreground',
                                )}
                            >
                                {/* Render content with code block support */}
                                <MessageContent content={content} />
                            </div>

                            {message.role === 'user' && (
                                <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary">
                                    <User className="h-4 w-4 text-primary-foreground" />
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* Loading indicator */}
                {isLoading && (
                    <div className="flex gap-3">
                        <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                            <Bot className="h-4 w-4 text-primary" />
                        </div>
                        <div className="rounded-xl bg-secondary px-4 py-3">
                            <div className="flex gap-1">
                                {[0, 1, 2].map((i) => (
                                    <div
                                        key={i}
                                        className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground"
                                        style={{ animationDelay: `${i * 150}ms` }}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <p>
                            {error.message || 'Something went wrong. Please check your API key and try again.'}
                        </p>
                    </div>
                )}

                <div ref={bottomRef} />
            </div>
        </ScrollArea>
    );
}

/**
 * Renders message content, extracting code blocks with syntax highlighting
 */
function MessageContent({ content }: { content: string }) {
    const parts = content.split(/(```[\s\S]*?```)/g);

    return (
        <>
            {parts.map((part, i) => {
                if (part.startsWith('```')) {
                    const firstNewline = part.indexOf('\n');
                    const lang = part.slice(3, firstNewline).trim();
                    const code = part.slice(firstNewline + 1, part.lastIndexOf('```')).trim();

                    return (
                        <div key={i} className="-mx-1 mt-2 mb-2">
                            {lang && (
                                <div className="flex items-center rounded-t-lg border border-border bg-background/50 px-3 py-1.5">
                                    <span className="font-mono text-[11px] text-muted-foreground">{lang}</span>
                                </div>
                            )}
                            <pre
                                className={cn(
                                    'overflow-x-auto rounded-lg border border-border bg-background/80 p-3 text-xs leading-relaxed',
                                    lang && 'rounded-t-none border-t-0',
                                )}
                            >
                                <code className="font-mono text-foreground">{code}</code>
                            </pre>
                        </div>
                    );
                }
                // Regular text - preserve line breaks
                return (
                    <span key={i} className="whitespace-pre-wrap">
                        {part}
                    </span>
                );
            })}
        </>
    );
}
