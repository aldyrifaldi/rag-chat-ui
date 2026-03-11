'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { SuggestionCard } from '@/components/chat/suggestion-card';
import { ChatInput } from '@/components/chat/chat-input';
import { useChatStore } from '@/stores/chat-store';
import type { SuggestionCard as SuggestionCardType } from '@/types/chat';

const SUGGESTIONS: SuggestionCardType[] = [
  {
    id: '1',
    icon: 'MapPin',
    title: 'Plan a trip',
    description: 'Explore new places and itineraries',
    prompt: 'Help me plan a trip to ',
  },
  {
    id: '2',
    icon: 'Code',
    title: 'Write a script',
    description: 'Creative storytelling and dialogue',
    prompt: 'Write a script for ',
  },
  {
    id: '3',
    icon: 'FileText',
    title: 'Summarize text',
    description: 'Get the key points from long articles',
    prompt: 'Please summarize the following text: ',
  },
  {
    id: '4',
    icon: 'Lightbulb',
    title: 'Get advice',
    description: 'Ask for expert tips and perspective',
    prompt: 'I need advice on ',
  },
];

export default function HomePage() {
  const router = useRouter();
  const { createConversation } = useChatStore();
  const [pendingMessage, setPendingMessage] = useState<string | undefined>();

  const handleStart = (message: string) => {
    const id = createConversation();
    // Store message to pass via URL for initial send
    router.push(`/chat/${id}?q=${encodeURIComponent(message)}`);
  };

  const handleSuggestionClick = (prompt: string) => {
    setPendingMessage(prompt);
  };

  return (
    <AppShell>
      <div className="flex flex-1 flex-col items-center justify-center overflow-hidden">
        {/* Greeting */}
        <div className="mb-10 text-center">
          <h1 className="bg-gradient-to-b from-foreground to-foreground/60 bg-clip-text text-4xl font-bold text-transparent">
            How can I help you today?
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Ask anything from planning a trip to writing complex code.
          </p>
        </div>

        {/* Suggestion Cards */}
        <div className="mb-8 grid w-full max-w-2xl grid-cols-2 gap-3 px-4 sm:grid-cols-4">
          {SUGGESTIONS.map((card) => (
            <SuggestionCard key={card.id} card={card} onClick={handleSuggestionClick} />
          ))}
        </div>

        {/* Chat Input */}
        <div className="w-full max-w-2xl">
          <ChatInput
            onSubmit={handleStart}
            placeholder="Ask anything..."
            defaultValue={pendingMessage}
          />
        </div>
      </div>
    </AppShell>
  );
}
