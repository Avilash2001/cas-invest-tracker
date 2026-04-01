"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Mail, Lock, User, Eye, EyeOff,
  CheckCircle2, AlertCircle, TrendingUp, LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ProfileClientProps {
  userName: string;
  userEmail: string;
}

type AlertType = { type: "success" | "error"; message: string } | null;

function Alert({ alert }: { alert: AlertType }) {
  if (!alert) return null;
  return (
    <div
      className={`flex items-center gap-2.5 px-4 py-3 rounded-lg text-sm ${
        alert.type === "success"
          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
          : "bg-red-500/10 text-red-400 border border-red-500/20"
      }`}
    >
      {alert.type === "success" ? (
        <CheckCircle2 className="w-4 h-4 shrink-0" />
      ) : (
        <AlertCircle className="w-4 h-4 shrink-0" />
      )}
      {alert.message}
    </div>
  );
}

function PasswordInput({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pr-10"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        tabIndex={-1}
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

export function ProfileClient({ userName, userEmail }: ProfileClientProps) {
  const router = useRouter();

  // Email form state
  const [emailCurrentPw, setEmailCurrentPw] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailAlert, setEmailAlert] = useState<AlertType>(null);

  // Password form state
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwAlert, setPwAlert] = useState<AlertType>(null);

  async function handleChangeEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailAlert(null);
    setEmailLoading(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "change_email", currentPassword: emailCurrentPw, newEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEmailAlert({ type: "error", message: data.error });
      } else {
        setEmailAlert({ type: "success", message: data.message + " Signing out…" });
        setEmailCurrentPw("");
        setNewEmail("");
        setTimeout(() => signOut({ callbackUrl: "/login" }), 2000);
      }
    } catch {
      setEmailAlert({ type: "error", message: "Network error. Please try again." });
    } finally {
      setEmailLoading(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwAlert(null);
    if (newPw !== confirmPw) {
      setPwAlert({ type: "error", message: "New passwords do not match." });
      return;
    }
    if (newPw.length < 8) {
      setPwAlert({ type: "error", message: "New password must be at least 8 characters." });
      return;
    }
    setPwLoading(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "change_password", currentPassword: currentPw, newPassword: newPw }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPwAlert({ type: "error", message: data.error });
      } else {
        setPwAlert({ type: "success", message: data.message });
        setCurrentPw("");
        setNewPw("");
        setConfirmPw("");
      }
    } catch {
      setPwAlert({ type: "error", message: "Network error. Please try again." });
    } finally {
      setPwLoading(false);
    }
  }

  // Password strength indicator
  const pwStrength = newPw.length === 0 ? 0 : newPw.length < 8 ? 1 : newPw.length < 12 ? 2 : 3;
  const pwStrengthLabel = ["", "Weak", "Good", "Strong"][pwStrength];
  const pwStrengthColor = ["", "bg-red-500", "bg-yellow-500", "bg-emerald-500"][pwStrength];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/dashboard")}
              title="Back to dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-base gradient-text hidden sm:block">MF Analytics</span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 sm:py-10 space-y-4 sm:space-y-6">
        {/* Page title */}
        <div>
          <h1 className="text-2xl font-bold">Profile Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your account credentials</p>
        </div>

        {/* Account info card */}
        <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-xl font-bold text-white shrink-0">
              {userName?.[0]?.toUpperCase() ?? "A"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="font-semibold">{userName}</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{userEmail}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Change email */}
        <div className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-4 sm:space-y-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-indigo-500/10 rounded-lg flex items-center justify-center">
              <Mail className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h2 className="font-semibold">Change Email</h2>
              <p className="text-xs text-muted-foreground">You will be signed out after updating</p>
            </div>
          </div>

          <form onSubmit={handleChangeEmail} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-email">New Email Address</Label>
              <Input
                id="new-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="new@example.com"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email-current-pw">Current Password</Label>
              <PasswordInput
                id="email-current-pw"
                value={emailCurrentPw}
                onChange={setEmailCurrentPw}
                placeholder="Confirm your current password"
              />
            </div>
            <Alert alert={emailAlert} />
            <Button
              type="submit"
              disabled={emailLoading || !newEmail || !emailCurrentPw}
              className="w-full"
            >
              {emailLoading ? "Updating…" : "Update Email"}
            </Button>
          </form>
        </div>

        {/* Change password */}
        <div className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-4 sm:space-y-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-purple-500/10 rounded-lg flex items-center justify-center">
              <Lock className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h2 className="font-semibold">Change Password</h2>
              <p className="text-xs text-muted-foreground">Minimum 8 characters</p>
            </div>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="current-pw">Current Password</Label>
              <PasswordInput
                id="current-pw"
                value={currentPw}
                onChange={setCurrentPw}
                placeholder="Your current password"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-pw">New Password</Label>
              <PasswordInput
                id="new-pw"
                value={newPw}
                onChange={setNewPw}
                placeholder="At least 8 characters"
              />
              {newPw.length > 0 && (
                <div className="space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3].map((level) => (
                      <div
                        key={level}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          pwStrength >= level ? pwStrengthColor : "bg-secondary"
                        }`}
                      />
                    ))}
                  </div>
                  <p className={`text-xs ${["", "text-red-400", "text-yellow-400", "text-emerald-400"][pwStrength]}`}>
                    {pwStrengthLabel}
                  </p>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-pw">Confirm New Password</Label>
              <PasswordInput
                id="confirm-pw"
                value={confirmPw}
                onChange={setConfirmPw}
                placeholder="Repeat new password"
              />
              {confirmPw.length > 0 && newPw !== confirmPw && (
                <p className="text-xs text-red-400">Passwords do not match</p>
              )}
            </div>
            <Alert alert={pwAlert} />
            <Button
              type="submit"
              disabled={pwLoading || !currentPw || !newPw || !confirmPw}
              className="w-full"
            >
              {pwLoading ? "Updating…" : "Update Password"}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
