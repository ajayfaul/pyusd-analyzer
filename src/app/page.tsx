// --- File: src/app/page.tsx ---
// Description: Main page component for the PYUSD Analyzer application.
// It sets up the main layout with a sidebar and renders either the
// TraceAnalyzer or HistoricalDashboard component based on the active view state.

"use client";

import React, { useState } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  useSidebar, // Note: useSidebar hook is imported but not used in this component
} from "@/components/ui/sidebar";
import TraceAnalyzer from "@/components/TraceAnalyzer";
import HistoricalDashboard from "@/components/HistoricalDashboard"; // Ensure this path is correct
import { TooltipProvider } from "@/components/ui/tooltip";
import { ListTree, Clock } from "lucide-react";

export default function HomePage() {
  // State to manage which view ('analyzer' or 'historical') is currently active
  const [activeView, setActiveView] = useState("analyzer");

  return (
    // Provides tooltip functionality to child components
    <TooltipProvider delayDuration={300}>
      <div className="flex min-h-screen bg-background">
        {/* Sidebar component for navigation */}
        <Sidebar collapsible="icon" className="border-r border-border/10">
          <SidebarHeader className="flex items-center justify-between px-4 py-3">
            {/* Title visible when sidebar is expanded */}
            <h2 className="text-lg font-semibold tracking-tight group-data-[state=collapsed]:hidden">
              PYUSD Analyzer
            </h2>
            {/* Trigger button to collapse/expand sidebar on medium+ screens */}
            <SidebarTrigger className="hidden md:flex" />
          </SidebarHeader>
          <SidebarContent className="flex-1 overflow-auto px-2">
            <SidebarMenu>
              {/* Menu item for the Trace Analyzer view */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => setActiveView("analyzer")}
                  isActive={activeView === "analyzer"}
                  tooltip="Trace Analyzer" // Tooltip shown when sidebar is collapsed
                  className="w-full justify-start gap-3 px-3 py-2"
                >
                  <ListTree className="h-4 w-4" />
                  {/* Text label visible when sidebar is expanded */}
                  <span className="group-data-[state=collapsed]:hidden">
                    PYUSD Trace Analyzer
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {/* Menu item for the Historical Data view */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => setActiveView("historical")}
                  isActive={activeView === "historical"}
                  tooltip="Historical Data" // Tooltip shown when sidebar is collapsed
                  className="w-full justify-start gap-3 px-3 py-2"
                >
                  <Clock className="h-4 w-4" />
                  {/* Text label visible when sidebar is expanded */}
                  <span className="group-data-[state=collapsed]:hidden">
                    Historical Data
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>
        </Sidebar>

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {/* Header for mobile view, showing current view title and sidebar trigger */}
          <div className="flex items-center justify-between mb-6 md:hidden">
            <h1 className="text-xl font-semibold tracking-tight">
              {activeView === "analyzer" ? "Trace Analyzer" : "Historical Data"}
            </h1>
            <SidebarTrigger />
          </div>

          {/* Conditional rendering based on the active view state */}
          {activeView === "analyzer" && <TraceAnalyzer />}
          {activeView === "historical" && <HistoricalDashboard />}

          {/* Footer text */}
          <p className="text-xs text-center text-muted-foreground mt-8 mb-4">
            Built with GCP Blockchain RPC & BigQuery
          </p>
        </main>
      </div>
    </TooltipProvider>
  );
}
