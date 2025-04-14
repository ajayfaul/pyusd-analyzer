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
  useSidebar,
} from "@/components/ui/sidebar";
import TraceAnalyzer from "@/components/TraceAnalyzer";
import HistoricalDashboard from "@/components/HistoricalDashboard";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ListTree, Clock } from "lucide-react";

export default function HomePage() {
  const [activeView, setActiveView] = useState("analyzer");

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex min-h-screen bg-background">
        <Sidebar collapsible="icon" className="border-r border-border/10">
          <SidebarHeader className="flex items-center justify-between px-4 py-3">
            <h2 className="text-lg font-semibold tracking-tight group-data-[state=collapsed]:hidden">
              PYUSD Analyzer
            </h2>
            <SidebarTrigger className="hidden md:flex" />
          </SidebarHeader>
          <SidebarContent className="flex-1 overflow-auto px-2">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => setActiveView("analyzer")}
                  isActive={activeView === "analyzer"}
                  tooltip="Trace Analyzer"
                  className="w-full justify-start gap-3 px-3 py-2"
                >
                  <ListTree className="h-4 w-4" />
                  <span className="group-data-[state=collapsed]:hidden">
                    PYUSD Trace Analyzer
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => setActiveView("historical")}
                  isActive={activeView === "historical"}
                  tooltip="Historical Data"
                  className="w-full justify-start gap-3 px-3 py-2"
                >
                  <Clock className="h-4 w-4" />
                  <span className="group-data-[state=collapsed]:hidden">
                    Historical Data
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>
        </Sidebar>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="flex items-center justify-between mb-6 md:hidden">
            <h1 className="text-xl font-semibold tracking-tight">
              {activeView === "analyzer" ? "Trace Analyzer" : "Historical Data"}
            </h1>
            <SidebarTrigger />
          </div>

          {activeView === "analyzer" && <TraceAnalyzer />}
          {activeView === "historical" && <HistoricalDashboard />}

          <p className="text-xs text-center text-muted-foreground mt-8 mb-4">
            Menggunakan GCP Blockchain RPC & BigQuery
          </p>
        </main>
      </div>
    </TooltipProvider>
  );
}
