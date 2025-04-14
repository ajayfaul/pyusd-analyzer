"use client";

import React, { useState } from "react";
// Import komponen Sidebar baru
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter, // Kita tidak pakai footer lagi untuk trigger
  SidebarTrigger, // Gunakan trigger ini
  useSidebar,
} from "@/components/ui/sidebar"; // Sesuaikan path jika perlu
import TraceAnalyzer from "@/components/TraceAnalyzer";
import HistoricalDashboard from "@/components/HistoricalDashboard";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ListTree, Clock } from "lucide-react"; // Hapus PanelLeftOpen/Close

export default function HomePage() {
  const [activeView, setActiveView] = useState("analyzer");
  // const { toggleSidebar } = useSidebar(); // Ambil fungsi toggle jika perlu trigger custom

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-screen bg-background">
        {/* Sidebar Baru */}
        <Sidebar collapsible="icon">
          {" "}
          {/* Opsi collapsible */}
          <SidebarHeader className="flex items-center justify-between">
            <h2 className="text-lg font-semibold group-data-[state=collapsed]:hidden">
              PYUSD Analyzer
            </h2>
            {/* Tombol Trigger di Header (hanya tampil di desktop) */}
            <SidebarTrigger className="hidden md:flex" />
          </SidebarHeader>
          <SidebarContent className="flex-1 overflow-auto">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => setActiveView("analyzer")}
                  isActive={activeView === "analyzer"}
                  tooltip="Trace Analyzer"
                >
                  <ListTree className="h-4 w-4" />
                  <span className="group-data-[state=collapsed]:hidden">
                    Trace Analyzer
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => setActiveView("historical")}
                  isActive={activeView === "historical"}
                  tooltip="Historical Data"
                >
                  <Clock className="h-4 w-4" />
                  <span className="group-data-[state=collapsed]:hidden">
                    Historical Data
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>
          {/* Hapus Footer yang berisi tombol lama */}
          {/* <SidebarFooter className="mt-auto"> ... </SidebarFooter> */}
        </Sidebar>

        {/* Konten Utama */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {/* Header Konten dengan Tombol Toggle Mobile */}
          <div className="flex items-center justify-between mb-4 md:hidden">
            <h1 className="text-xl font-semibold">
              {activeView === "analyzer" ? "Trace Analyzer" : "Historical Data"}
            </h1>
            {/* Trigger ini untuk membuka/menutup Sheet di mobile */}
            <SidebarTrigger />
          </div>

          {/* Render komponen berdasarkan activeView */}
          {activeView === "analyzer" && <TraceAnalyzer />}
          {activeView === "historical" && <HistoricalDashboard />}

          <p className="text-xs text-center text-muted-foreground mt-8">
            Menggunakan GCP Blockchain RPC & BigQuery
          </p>
        </main>
      </div>
    </TooltipProvider>
  );
}
