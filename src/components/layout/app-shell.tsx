'use client';

import { TooltipProvider } from '@/components/ui/tooltip';
import { Sidebar } from '@/components/sidebar/sidebar';

export function AppShell({ children }: { children: React.ReactNode }) {
    return (
        <TooltipProvider>
            <div className="flex h-screen overflow-hidden bg-background">
                <Sidebar />
                <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
            </div>
        </TooltipProvider>
    );
}
