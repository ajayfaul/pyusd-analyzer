import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider"; // Asumsi Anda punya ThemeProvider
import { SidebarProvider } from "@/components/ui/sidebar"; // <-- Import SidebarProvider
import { Toaster } from "@/components/ui/sonner"; // <-- Import Toaster

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PYUSD Analyzer", // Ganti judul jika perlu
  description: "Analyze PYUSD transactions with GCP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {/* Bungkus dengan SidebarProvider */}
          <SidebarProvider defaultOpen={true}>{children}</SidebarProvider>
          <Toaster /> {/* Letakkan Toaster di sini */}
        </ThemeProvider>
      </body>
    </html>
  );
}
