"use client";

import { Component, ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ChartErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card className="p-6 flex flex-col items-center justify-center gap-3 min-h-[200px]">
          <AlertCircle className="w-8 h-8 text-destructive" />
          <p className="text-sm font-medium">{this.props.fallbackTitle ?? "Chart failed to load"}</p>
          <p className="text-xs text-muted-foreground">{this.state.error?.message}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => this.setState({ hasError: false })}
          >
            <RefreshCw className="w-3 h-3" />
            Retry
          </Button>
        </Card>
      );
    }
    return this.props.children;
  }
}
