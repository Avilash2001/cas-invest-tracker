"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { TrendingUp, Upload, Sun, Moon, LogOut, RefreshCw, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "./theme-provider";
import { format } from "date-fns";

interface NavbarProps {
  onUpload: () => void;
  lastSynced?: string | null;
  userName?: string;
}

export function Navbar({ onUpload, lastSynced, userName }: NavbarProps) {
  const { theme, toggle } = useTheme();
  const [syncing, setSyncing] = useState(false);

  async function handleSync() {
    setSyncing(true);
    try {
      await fetch("/api/nav/sync", { method: "POST" });
      window.location.reload();
    } finally {
      setSyncing(false);
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-base gradient-text hidden sm:block">MF Analytics</span>
        </div>

        {/* Center: Last synced */}
        {lastSynced && (
          <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary px-3 py-1.5 rounded-full">
            <Clock className="w-3 h-3" />
            NAV updated {format(new Date(lastSynced), "HH:mm, d MMM")}
          </div>
        )}

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSync}
            disabled={syncing}
            title="Sync NAV"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            title="Toggle theme"
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </Button>

          <Button onClick={onUpload} size="sm" className="gap-1.5 hidden sm:flex">
            <Upload className="w-3.5 h-3.5" />
            Upload CAS
          </Button>

          <Button onClick={onUpload} size="icon" variant="default" className="sm:hidden">
            <Upload className="w-4 h-4" />
          </Button>

          <div className="flex items-center gap-2 ml-1">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-xs font-bold text-white">
              {userName?.[0]?.toUpperCase() ?? "A"}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => signOut({ callbackUrl: "/login" })}
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
