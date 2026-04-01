"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type UploadState = "idle" | "uploading" | "success" | "error";

interface UploadResult {
  imported: { transactions: number; funds: number };
  totals: { transactions: number; funds: number };
}

export function UploadModal({ open, onClose, onSuccess }: UploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<UploadState>("idle");
  const [result, setResult] = useState<UploadResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles[0]) {
      setFile(acceptedFiles[0]);
      setState("idle");
      setResult(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
    },
    maxFiles: 1,
    maxSize: 20 * 1024 * 1024,
  });

  async function handleUpload() {
    if (!file) return;
    setState("uploading");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload-cas", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setState("success");
        setResult(data);
        onSuccess?.();
      } else {
        setState("error");
        setErrorMsg(data.error || "Upload failed");
      }
    } catch {
      setState("error");
      setErrorMsg("Network error — please try again");
    }
  }

  function handleClose() {
    setFile(null);
    setState("idle");
    setResult(null);
    setErrorMsg("");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[calc(100vw-32px)] sm:max-w-md rounded-xl">
        <DialogHeader>
          <DialogTitle>Upload CAS Statement</DialogTitle>
          <DialogDescription>
            Upload your CAMS or KFintech Consolidated Account Statement
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Drop zone */}
          <div
            {...getRootProps()}
            className={cn(
              "border-2 border-dashed rounded-xl p-5 sm:p-8 text-center cursor-pointer transition-colors",
              isDragActive
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50 hover:bg-secondary/50"
            )}
          >
            <input {...getInputProps()} />
            <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            {isDragActive ? (
              <p className="text-sm text-primary font-medium">Drop the file here</p>
            ) : (
              <>
                <p className="text-sm font-medium text-foreground">
                  Drag & drop or click to browse
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Supports PDF and XLSX (max 20MB)
                </p>
              </>
            )}
          </div>

          {/* Selected file */}
          {file && (
            <div className="flex items-center gap-3 p-3 bg-secondary rounded-lg">
              <FileText className="w-5 h-5 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <button
                onClick={() => setFile(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Status messages */}
          {state === "success" && result && (
            <div className="flex items-start gap-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-sm text-emerald-400">
              <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Import successful!</p>
                <p className="text-xs text-emerald-400/80 mt-0.5">
                  {result.imported.transactions} new transactions · {result.totals.funds} funds total
                </p>
              </div>
            </div>
          )}

          {state === "error" && (
            <div className="flex items-start gap-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Upload failed</p>
                <p className="text-xs mt-0.5 opacity-80">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose} className="flex-1">
              {state === "success" ? "Close" : "Cancel"}
            </Button>
            {state !== "success" && (
              <Button
                onClick={handleUpload}
                disabled={!file || state === "uploading"}
                className="flex-1"
              >
                {state === "uploading" && <Loader2 className="w-4 h-4 animate-spin" />}
                {state === "uploading" ? "Uploading..." : "Upload"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
