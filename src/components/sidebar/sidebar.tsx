'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare, Plus, History, Compass, Bot, HelpCircle, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useChatStore } from '@/stores/chat-store';
import { cn } from '@/utils/cn';

const NAV_ITEMS = [
    { icon: History, label: 'History', href: '/' },
    { icon: Compass, label: 'Discovery', href: '/discovery' },
    { icon: Bot, label: 'My GPTs', href: '/my-gpts' },
];

export function Sidebar() {
    const router = useRouter();
    const {
        conversations,
        activeConversationId,
        createConversation,
        setActiveConversation,
        setConversations,
    } = useChatStore();

    useEffect(() => {
        const fetchThreads = async () => {
            try {
                const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/chat/threads`);
                if (!response.ok) throw new Error('Failed to fetch threads');
                const data = await response.json();
                
                // Map API threads to Conversation objects
                const threads = data.threads.map((thread: any) => ({
                    id: thread.id,
                    title: thread.title || 'New Chat',
                    messages: [], // Messages will be fetched when selected
                    createdAt: new Date(thread.createdAt),
                    updatedAt: new Date(thread.updatedAt),
                }));

                setConversations(threads);
            } catch (error) {
                console.error('Error fetching threads:', error);
            }
        };

        fetchThreads();
    }, [setConversations]);

    const handleNewChat = () => {
        const id = createConversation();
        router.push(`/chat/${id}`);
    };

    const handleSelectChat = (id: string) => {
        setActiveConversation(id);
        router.push(`/chat/${id}`);
    };

    return (
        <aside className="flex h-full w-64 flex-col border-r border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar))]">
            {/* Header */}
            <div className="flex items-center gap-2 p-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                    <Bot className="h-4 w-4 text-primary-foreground" />
                </div>
                <span className="text-sm font-semibold text-foreground">AI Assistant</span>
            </div>

            {/* New Chat Button */}
            <div className="px-3 pb-3">
                <Button
                    onClick={handleNewChat}
                    className="w-full justify-start gap-2 bg-primary/10 text-primary hover:bg-primary/20"
                    variant="ghost"
                >
                    <Plus className="h-4 w-4" />
                    New Chat
                </Button>
            </div>

            {/* Nav Items */}
            <div className="px-3">
                {NAV_ITEMS.map((item) => (
                    <Tooltip key={item.label}>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                className="mb-0.5 w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
                                onClick={() => router.push(item.href)}
                            >
                                <item.icon className="h-4 w-4" />
                                {item.label}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="right">{item.label}</TooltipContent>
                    </Tooltip>
                ))}
            </div>

            <Separator className="my-3 opacity-50" />

            {/* Recent Conversations */}
            <div className="px-3 pb-1">
                <p className="mb-1 px-2 text-xs font-medium text-muted-foreground">Recent</p>
            </div>
            <div className="flex-1 overflow-y-auto px-3">
                <div className="space-y-0.5">
                    {conversations.slice(0, 20).map((conv) => (
                        <button
                            key={conv.id}
                            onClick={() => handleSelectChat(conv.id)}
                            className={cn(
                                'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors',
                                activeConversationId === conv.id
                                    ? 'bg-secondary text-foreground'
                                    : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground',
                            )}
                        >
                            <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{conv.title}</span>
                        </button>
                    ))}
                    {conversations.length === 0 && (
                        <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                            No conversations yet
                        </p>
                    )}
                </div>
            </div>

            <Separator className="mt-3 opacity-50" />

            {/* Bottom Actions */}
            <div className="p-3">
                <div className="mb-2 flex gap-1">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                                <HelpCircle className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="right">Help</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                                <Settings className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="right">Settings</TooltipContent>
                    </Tooltip>
                </div>

                {/* User Profile */}
                <div className="flex items-center gap-2 rounded-lg p-2 hover:bg-secondary/50 cursor-pointer transition-colors">
                    <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                            AC
                        </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">Alex Chen</p>
                        <Badge
                            variant="secondary"
                            className="mt-0.5 h-4 px-1.5 text-[10px] bg-primary/20 text-primary"
                        >
                            Plus
                        </Badge>
                    </div>
                </div>
            </div>
        </aside>
    );
}
