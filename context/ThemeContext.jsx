"use client";

import { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext(undefined);

export function ThemeProvider({ children }) {
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Initialize theme on mount
  useEffect(() => {
    // Check local storage first
    const storedTheme = (typeof window !== 'undefined' && localStorage.getItem("theme")) || null;
    
    if (storedTheme === "dark" || 
      (!storedTheme && typeof window !== 'undefined' && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      setIsDarkMode(true);
      if (typeof document !== 'undefined') document.documentElement.classList.add("dark");
    } else {
      setIsDarkMode(false);
      if (typeof document !== 'undefined') document.documentElement.classList.remove("dark");
    }
  }, []);

  // Update theme class and localStorage when state changes
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode(prev => !prev);
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}