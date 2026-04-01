import { TrendingUp, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  onUpload?: () => void;
}

export function EmptyState({ onUpload }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="w-20 h-20 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-2xl flex items-center justify-center mb-6 border border-indigo-500/20">
        <TrendingUp className="w-10 h-10 text-primary" />
      </div>
      <h3 className="text-xl font-semibold text-foreground mb-2">No portfolio data yet</h3>
      <p className="text-muted-foreground text-sm max-w-sm mb-6">
        Upload your CAMS or KFintech Consolidated Account Statement (CAS) to get started with
        detailed analytics.
      </p>
      {onUpload && (
        <Button onClick={onUpload} className="gap-2">
          <Upload className="w-4 h-4" />
          Upload CAS File
        </Button>
      )}
    </div>
  );
}
