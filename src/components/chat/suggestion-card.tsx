'use client';

import { MapPin, Code, FileText, Lightbulb } from 'lucide-react';
import type { SuggestionCard } from '@/types/chat';

const ICON_MAP: Record<string, React.ElementType> = {
    MapPin,
    Code,
    FileText,
    Lightbulb,
};

interface SuggestionCardProps {
    card: SuggestionCard;
    onClick: (prompt: string) => void;
}

export function SuggestionCard({ card, onClick }: SuggestionCardProps) {
    const Icon = ICON_MAP[card.icon] ?? Lightbulb;

    return (
        <button
            onClick={() => onClick(card.prompt)}
            className="group flex flex-col gap-2 rounded-xl border border-border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-card/80 hover:shadow-lg hover:shadow-primary/5"
        >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/20">
                <Icon className="h-4 w-4 text-primary" />
            </div>
            <div>
                <p className="text-sm font-semibold text-foreground">{card.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{card.description}</p>
            </div>
        </button>
    );
}
