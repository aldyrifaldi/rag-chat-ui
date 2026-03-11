import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Conversation, Message } from '@/types/chat';

interface ChatState {
    conversations: Conversation[];
    activeConversationId: string | null;

    // Actions
    createConversation: () => string;
    setActiveConversation: (id: string | null) => void;
    addMessage: (conversationId: string, message: Message) => void;
    updateConversationTitle: (conversationId: string, title: string) => void;
    deleteConversation: (conversationId: string) => void;
    getActiveConversation: () => Conversation | undefined;
    setConversations: (conversations: Conversation[]) => void;
}

export const useChatStore = create<ChatState>()(
    persist(
        (set, get) => ({
            conversations: [],
            activeConversationId: null,

            setConversations: (conversations) => {
                set({ conversations });
            },

            createConversation: () => {
                const id = crypto.randomUUID();
                const newConversation: Conversation = {
                    id,
                    title: 'New Chat',
                    messages: [],
                    createdAt: new Date(),
                    updatedAt: new Date(),
                };
                set((state) => ({
                    conversations: [newConversation, ...state.conversations],
                    activeConversationId: id,
                }));
                return id;
            },

            setActiveConversation: (id) => {
                set({ activeConversationId: id });
            },

            addMessage: (conversationId, message) => {
                set((state) => ({
                    conversations: state.conversations.map((conv) =>
                        conv.id === conversationId
                            ? {
                                ...conv,
                                messages: [...conv.messages, message],
                                updatedAt: new Date(),
                                // Auto-generate title from first user message
                                title:
                                    conv.messages.length === 0 && message.role === 'user'
                                        ? message.content.slice(0, 40) +
                                        (message.content.length > 40 ? '...' : '')
                                        : conv.title,
                            }
                            : conv,
                    ),
                }));
            },

            updateConversationTitle: (conversationId, title) => {
                set((state) => ({
                    conversations: state.conversations.map((conv) =>
                        conv.id === conversationId ? { ...conv, title } : conv,
                    ),
                }));
            },

            deleteConversation: (conversationId) => {
                set((state) => ({
                    conversations: state.conversations.filter((c) => c.id !== conversationId),
                    activeConversationId:
                        state.activeConversationId === conversationId
                            ? null
                            : state.activeConversationId,
                }));
            },

            getActiveConversation: () => {
                const state = get();
                return state.conversations.find((c) => c.id === state.activeConversationId);
            },
        }),
        {
            name: 'chat-store',
            // Only persist conversations and activeConversationId
            partialize: (state) => ({
                conversations: state.conversations,
                activeConversationId: state.activeConversationId,
            }),
        },
    ),
);
