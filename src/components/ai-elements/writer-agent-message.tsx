'use client';

import { Check, Copy, Download } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/utils/cn';
import { MessageResponse } from '@/components/ai-elements/message';

interface WriterAgentMessageProps {
    content: string;
}

export function WriterAgentMessage({ content }: WriterAgentMessageProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(content);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy text:', err);
        }
    };

    const handleDownload = () => {
        const blob = new Blob([content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'writer-agent-draft.md';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="h-[600px] w-full overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="flex h-full flex-col">
                <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-muted/30">
                    <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                            W
                        </span>
                        <span className="text-sm font-medium text-foreground">Writer Agent Final Draft</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleCopy}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            title="Copy content"
                        >
                            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </button>
                        <button
                            onClick={handleDownload}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            title="Download Markdown"
                        >
                            <Download className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                        <MessageResponse>{content}</MessageResponse>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-border bg-muted/30 px-4 py-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>
                        Finalized
                    </span>
                    <span>•</span>
                    <span>{content.length} characters</span>
                </div>
            </div>
        </div>
    );
}