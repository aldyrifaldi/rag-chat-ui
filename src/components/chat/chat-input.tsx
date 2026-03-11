'use client';

import {
    PromptInput,
    PromptInputBody,
    PromptInputFooter,
    PromptInputHeader,
    PromptInputSubmit,
    PromptInputTextarea,
    PromptInputTools,
    PromptInputActionMenu,
    PromptInputActionMenuTrigger,
    PromptInputActionMenuContent,
    PromptInputActionAddAttachments,
    usePromptInputAttachments,
} from '@/components/ai-elements/prompt-input';
import {
    Attachment,
    AttachmentPreview,
    AttachmentRemove,
    Attachments,
} from '@/components/ai-elements/attachments';
import { cn } from '@/utils/cn';

interface ChatInputProps {
    onSubmit: (message: string) => void;
    isLoading?: boolean;
    onStop?: () => void;
    status?: 'streaming' | 'submitted' | 'ready' | 'error';
    placeholder?: string;
    className?: string;
    defaultValue?: string;
}

const PromptInputAttachmentsDisplay = () => {
    const attachments = usePromptInputAttachments();

    if (attachments.files.length === 0) {
        return null;
    }

    return (
        <Attachments variant="inline">
            {attachments.files.map((attachment) => (
                <Attachment
                    data={attachment}
                    key={attachment.id}
                    onRemove={() => attachments.remove(attachment.id)}
                >
                    <AttachmentPreview />
                    <AttachmentRemove />
                </Attachment>
            ))}
        </Attachments>
    );
};

export function ChatInput({
    onSubmit,
    isLoading = false,
    onStop,
    status,
    placeholder = 'Ask anything...',
    className,
    defaultValue,
}: ChatInputProps) {
    const handleSubmit = (message: { text: string; files: any[] }) => {
        if (!message.text.trim()) return;
        onSubmit(message.text);
    };

    const displayStatus = status || (isLoading ? 'streaming' : 'ready');

    return (
        <div className={cn('px-4 pb-4', className)}>
            <PromptInput
                onSubmit={handleSubmit}
                maxFiles={5}
                maxFileSize={10 * 1024 * 1024} // 10MB
                className="relative rounded-xl border border-border bg-[hsl(var(--input))] shadow-sm transition-colors focus-within:border-primary/50"
            >
                <PromptInputHeader>
                    <PromptInputAttachmentsDisplay />
                </PromptInputHeader>
                <PromptInputBody className="px-3 py-2">
                    <PromptInputTextarea
                        defaultValue={defaultValue}
                        placeholder={placeholder}
                        className="min-h-[44px] max-h-[200px] resize-none border-0 bg-transparent p-0 text-sm text-foreground shadow-none placeholder:text-muted-foreground focus-visible:ring-0"
                    />

                    <PromptInputFooter className="mt-1 flex items-center justify-between">
                        <PromptInputTools>
                            <PromptInputActionMenu>
                                <PromptInputActionMenuTrigger className="h-7 w-7 text-muted-foreground hover:text-foreground" />
                                <PromptInputActionMenuContent>
                                    <PromptInputActionAddAttachments />
                                </PromptInputActionMenuContent>
                            </PromptInputActionMenu>
                        </PromptInputTools>

                        <PromptInputSubmit
                            status={displayStatus}
                            onStop={onStop}
                            className="h-7 w-7 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30"
                        />
                    </PromptInputFooter>
                </PromptInputBody>
            </PromptInput>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
                AI can make mistakes. Check important info.
            </p>
        </div>
    );
}
