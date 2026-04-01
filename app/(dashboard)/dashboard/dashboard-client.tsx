"use client";

import { useEffect, useState } from "react";
import { Navbar } from "@/components/dashboard/navbar";
import { KPICard } from "@/components/dashboard/kpi-card";
import { UploadModal } from "@/components/dashboard/upload-modal";
import { EmptyState } from "@/components/dashboard/empty-state";
import { OverviewTab } from "@/components/dashboard/tab-overview";
import { AllocationTab } from "@/components/dashboard/tab-allocation";
import { FundsTab } from "@/components/dashboard/tab-funds";
import { SIPsTab } from "@/components/dashboard/tab-sips";
import { TaxTab } from "@/components/dashboard/tab-tax";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  LayoutDashboard,
  PieChart,
  Table2,
  RepeatIcon,
  Receipt,
  Wallet,
  TrendingUp,
  TrendingDown,
  Percent,
} from "lucide-react";

interface SummaryData {
  totalInvested: number;
  currentValue: number;
  totalReturns: number;
  returnsPercent: number;
  xirr: number | null;
  lastSynced: string | null;
  hasFunds: boolean;
}

interface DashboardClientProps {
  userName: string;
}

export function DashboardClient({ userName }: DashboardClientProps) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  async function fetchSummary() {
    setSummaryLoading(true);
    try {
      const res = await fetch("/api/portfolio/summary");
      const data = await res.json();
      setSummary(data);
    } catch {
      /* ignore */
    } finally {
      setSummaryLoading(false);
    }
  }

  useEffect(() => {
    fetchSummary();
  }, []);

  const hasData = summary?.hasFunds ?? false;

  return (
    <>
      <Navbar
        onUpload={() => setUploadOpen(true)}
        lastSynced={summary?.lastSynced}
        userName={userName}
      />

      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* KPI Summary Strip */}
        {(summaryLoading || hasData) && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              title="Total Invested"
              value={summary?.totalInvested ?? 0}
              icon={Wallet}
              iconColor="text-blue-400"
              loading={summaryLoading}
            />
            <KPICard
              title="Current Value"
              value={summary?.currentValue ?? 0}
              icon={TrendingUp}
              iconColor="text-emerald-400"
              loading={summaryLoading}
            />
            <KPICard
              title="Total Returns"
              value={summary?.totalReturns ?? 0}
              subtitle={
                summary
                  ? `${summary.returnsPercent >= 0 ? "+" : ""}${summary.returnsPercent.toFixed(1)}%`
                  : undefined
              }
              icon={summary && summary.totalReturns < 0 ? TrendingDown : TrendingUp}
              iconColor={
                summary && summary.totalReturns < 0 ? "text-red-400" : "text-emerald-400"
              }
              delta={summary?.returnsPercent}
              loading={summaryLoading}
            />
            <KPICard
              title="XIRR"
              value={summary?.xirr ?? 0}
              format="xirr"
              icon={Percent}
              iconColor="text-purple-400"
              loading={summaryLoading}
            />
          </div>
        )}

        {/* Main Content */}
        {!summaryLoading && !hasData ? (
          <EmptyState onUpload={() => setUploadOpen(true)} />
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="overflow-x-auto">
              <TabsList className="mb-0">
                <TabsTrigger value="overview" className="gap-1.5">
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Overview</span>
                </TabsTrigger>
                <TabsTrigger value="allocation" className="gap-1.5">
                  <PieChart className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Allocation</span>
                </TabsTrigger>
                <TabsTrigger value="funds" className="gap-1.5">
                  <Table2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Funds</span>
                </TabsTrigger>
                <TabsTrigger value="sips" className="gap-1.5">
                  <RepeatIcon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">SIP</span>
                </TabsTrigger>
                <TabsTrigger value="tax" className="gap-1.5">
                  <Receipt className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Tax</span>
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="overview">
              <OverviewTab summary={summary} summaryLoading={summaryLoading} />
            </TabsContent>

            <TabsContent value="allocation">
              <AllocationTab />
            </TabsContent>

            <TabsContent value="funds">
              <FundsTab />
            </TabsContent>

            <TabsContent value="sips">
              <SIPsTab />
            </TabsContent>

            <TabsContent value="tax">
              <TaxTab />
            </TabsContent>
          </Tabs>
        )}
      </main>

      <UploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSuccess={() => {
          setUploadOpen(false);
          fetchSummary();
        }}
      />
    </>
  );
}
