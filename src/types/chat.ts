export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
    id: string;
    role: MessageRole;
    content: string;
    createdAt: Date;
}

export interface Conversation {
    id: string;
    title: string;
    messages: Message[];
    createdAt: Date;
    updatedAt: Date;
}

export interface SuggestionCard {
    id: string;
    icon: string;
    title: string;
    description: string;
    prompt: string;
}
