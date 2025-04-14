"use client"

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
// FIX: Impor ThemeProviderProps langsung dari 'next-themes'
import { type ThemeProviderProps } from "next-themes";

/**
 * Wrapper component for next-themes ThemeProvider.
 * Applies theme settings based on Shadcn UI conventions.
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
    return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
