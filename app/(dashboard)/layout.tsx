import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { NextAuthProvider } from "@/components/session-provider";
import { ThemeProvider } from "@/components/dashboard/theme-provider";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <NextAuthProvider>
      <ThemeProvider>
        <div className="min-h-screen bg-background">
          {children}
        </div>
      </ThemeProvider>
    </NextAuthProvider>
  );
}
