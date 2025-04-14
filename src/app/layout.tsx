import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider"; // Asumsi path benar
import { SidebarProvider } from "@/components/ui/sidebar"; // Asumsi path benar
import { Toaster } from "@/components/ui/sonner"; // Asumsi path benar

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PYUSD Analyzer",
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
        {/* FIX: Atur ThemeProvider untuk selalu light mode */}
        <ThemeProvider
          attribute="class"
          defaultTheme="light" // Set default ke light
          enableSystem={false} // Nonaktifkan preferensi sistem
          forcedTheme="light" // Paksa tema light
          disableTransitionOnChange
        >
          <SidebarProvider defaultOpen={true}>
             {children}
          </SidebarProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}