"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { type ThemeProviderProps } from "next-themes";

/**
 * Theme Provider Component
 * 
 * Wraps the app with next-themes provider to enable dark mode support.
 * 
 * Features:
 * - Supports light, dark, and system themes
 * - Persists theme preference to localStorage
 * - Prevents hydration mismatch with suppressHydrationWarning
 * - Defaults to system theme
 */
export default function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}

