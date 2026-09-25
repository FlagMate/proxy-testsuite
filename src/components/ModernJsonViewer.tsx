import React, { useState, useMemo, useCallback, useRef, useEffect, memo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Copy,
  Download,
  Check,
  Search,
  ChevronDown,
  ChevronRight,
  Play,
  Table as TableIcon,
  Code as CodeIcon,
  FileText,
  Clock,
  ExternalLink,
  Sun,
  Moon,
  Maximize2,
  Minimize2,
  X,
  Layers,
  Sparkles
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ==========================================
// SMART VALUE DETECTION HELPERS
// ==========================================

export interface TimestampInfo {
  isValid: boolean;
  date: Date;
  formattedUtc: string;
  relative: string;
}

export const isStreamingMediaUrl = (url: string, keyHint: string = ""): boolean => {
  if (typeof url !== "string" || !/^https?:\/\//i.test(url.trim())) return false;
  const lowerUrl = url.toLowerCase();
  const lowerKey = keyHint.toLowerCase();
  
  const hasStreamExt =
    lowerUrl.includes(".mpd") ||
    lowerUrl.includes(".m3u8") ||
    lowerUrl.includes(".mp4") ||
    lowerUrl.includes(".webm") ||
    lowerUrl.includes(".m4s") ||
    lowerUrl.includes(".ts") ||
    lowerUrl.includes(".mov");

  const hasStreamKey =
    lowerKey.includes("videourl") ||
    lowerKey.includes("streamurl") ||
    lowerKey.includes("manifesturl") ||
    lowerKey.includes("playbackurl") ||
    lowerKey.includes("hlsurl") ||
    lowerKey.includes("dashurl") ||
    lowerKey.includes("video_url") ||
    lowerKey.includes("stream_url") ||
    lowerKey.includes("mediaurl");

  return hasStreamExt || hasStreamKey;
};

export const parseEpochTimestamp = (val: any, keyHint: string = ""): TimestampInfo | null => {
  if (val === null || val === undefined) return null;
  let num: number | null = null;

  if (typeof val === "number" && !isNaN(val)) {
    num = val;
  } else if (typeof val === "string" && /^\d{10,13}$/.test(val.trim())) {
    num = Number(val.trim());
  }

  if (num === null) return null;

  // 10 digits: seconds (e.g. 946684800 is 2000-01-01, 2524608000 is 2050-01-01)
  // 13 digits: milliseconds (e.g. 946684800000 to 2524608000000)
  const isSeconds = num >= 946684800 && num <= 2524608000;
  const isMs = num >= 946684800000 && num <= 2524608000000;

  if (!isSeconds && !isMs) return null;

  const msValue = isSeconds ? num * 1000 : num;
  const date = new Date(msValue);
  if (isNaN(date.getTime())) return null;

  // Format UTC: YYYY-MM-DD HH:mm:ss UTC
  const pad = (n: number) => String(n).padStart(2, "0");
  const formattedUtc = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(
    date.getUTCHours()
  )}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} UTC`;

  // Calculate relative time
  const now = Date.now();
  const diffSec = Math.round((now - msValue) / 1000);
  let relative = "";
  if (Math.abs(diffSec) < 60) {
    relative = "just now";
  } else if (diffSec > 0) {
    const min = Math.floor(diffSec / 60);
    const hours = Math.floor(min / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) relative = `${days}d ago`;
    else if (hours > 0) relative = `${hours}h ago`;
    else relative = `${min}m ago`;
  } else {
    const futureSec = Math.abs(diffSec);
    const min = Math.floor(futureSec / 60);
    const hours = Math.floor(min / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) relative = `in ${days}d`;
    else if (hours > 0) relative = `in ${hours}h`;
    else relative = `in ${min}m`;
  }

  return { isValid: true, date, formattedUtc, relative };
};

export const isColorHex = (val: string): boolean => {
  return typeof val === "string" && /^#(?:[0-9a-fA-F]{3}){1,2}(?:[0-9a-fA-F]{2})?$/.test(val.trim());
};

export const formatJsonPath = (path: string): string => {
  if (!path || path === "root") return "$";
  return path.replace(/^root/, "$");
};

// ==========================================
// MAIN COMPONENT
// ==========================================

interface ModernJsonViewerProps {
  data: any;
  contentType?: string;
  className?: string;
  defaultView?: "pretty" | "tree" | "table" | "raw";
  onCopyFull?: () => void;
  onDownloadFull?: () => void;
}

export const ModernJsonViewer: React.FC<ModernJsonViewerProps> = ({
  data,
  contentType,
  className = "",
  defaultView = "pretty",
  onCopyFull,
  onDownloadFull,
}) => {
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<"pretty" | "tree" | "table" | "raw">(defaultView);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(new Set());

  // Copy feedback helper
  const copyToClipboard = useCallback(
    (text: string, label: string, keyId?: string) => {
      navigator.clipboard.writeText(text);
      if (keyId) {
        setCopiedKey(keyId);
        setTimeout(() => setCopiedKey(null), 1500);
      }
      toast({
        title: "Copied to clipboard",
        description: `${label}: ${text.length > 40 ? text.slice(0, 40) + "..." : text}`,
      });
    },
    [toast]
  );

  // Toggle single path collapsed
  const togglePath = useCallback((path: string) => {
    setCollapsedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  // Expand All / Collapse All
  const expandAll = useCallback(() => {
    setCollapsedPaths(new Set());
  }, []);

  const collapseAll = useCallback(() => {
    const allPaths = new Set<string>();
    const collect = (obj: any, path = "root") => {
      if (obj && typeof obj === "object") {
        allPaths.add(path);
        if (Array.isArray(obj)) {
          obj.forEach((item, idx) => collect(item, `${path}[${idx}]`));
        } else {
          Object.entries(obj).forEach(([k, v]) => collect(v, `${path}.${k}`));
        }
      }
    };
    collect(data);
    setCollapsedPaths(allPaths);
  }, [data]);

  // Total properties or items count
  const metaStats = useMemo(() => {
    if (!data) return { type: "empty", count: 0, rawSize: "0 B" };
    try {
      const jsonStr = JSON.stringify(data);
      const bytes = new TextEncoder().encode(jsonStr).length;
      let rawSize = `${bytes} B`;
      if (bytes > 1024 * 1024) rawSize = `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
      else if (bytes > 1024) rawSize = `${(bytes / 1024).toFixed(1)} KB`;

      if (Array.isArray(data)) {
        return { type: "array", count: data.length, rawSize };
      } else if (typeof data === "object") {
        return { type: "object", count: Object.keys(data).length, rawSize };
      }
      return { type: typeof data, count: 1, rawSize };
    } catch {
      return { type: "unknown", count: 0, rawSize: "0 B" };
    }
  }, [data]);

  // Check if data supports table view (either root is array, or contains an array of objects)
  const tableDataOptions = useMemo(() => {
    if (!data) return [];
    if (Array.isArray(data) && data.length > 0 && typeof data[0] === "object") {
      return [{ label: "Root Array", data: data }];
    }
    if (typeof data === "object" && data !== null) {
      const options: Array<{ label: string; data: any[] }> = [];
      Object.entries(data).forEach(([key, val]) => {
        if (Array.isArray(val) && val.length > 0 && typeof val[0] === "object") {
          options.push({ label: key, data: val });
        }
      });
      return options;
    }
    return [];
  }, [data]);

  const [selectedTableOption, setSelectedTableOption] = useState<string>(
    tableDataOptions[0]?.label || "Root Array"
  );

  // Search matches counter
  const searchMatchesCount = useMemo(() => {
    if (!searchTerm.trim() || !data) return 0;
    const term = searchTerm.toLowerCase();
    let count = 0;
    const countMatches = (obj: any) => {
      if (obj === null || obj === undefined) return;
      if (typeof obj === "string") {
        if (obj.toLowerCase().includes(term)) count++;
      } else if (typeof obj === "number" || typeof obj === "boolean") {
        if (String(obj).toLowerCase().includes(term)) count++;
      } else if (Array.isArray(obj)) {
        obj.forEach(countMatches);
      } else if (typeof obj === "object") {
        Object.entries(obj).forEach(([k, v]) => {
          if (k.toLowerCase().includes(term)) count++;
          countMatches(v);
        });
      }
    };
    countMatches(data);
    return count;
  }, [searchTerm, data]);

  // Theme color styles
  const isDark = theme === "dark";
  const themeClasses = {
    wrapper: isDark
      ? "bg-[#0b0f19] text-slate-200 border-slate-800"
      : "bg-white text-slate-800 border-slate-200",
    header: isDark
      ? "bg-[#0f172a] border-slate-800/80 text-slate-300"
      : "bg-slate-50 border-slate-200 text-slate-700",
    gutter: isDark
      ? "text-slate-600 bg-[#0b0f19] border-slate-800"
      : "text-slate-400 bg-slate-50 border-slate-200",
    rowHover: isDark ? "hover:bg-slate-800/40" : "hover:bg-blue-50/50",
    guideLine: isDark ? "border-slate-800" : "border-slate-200",
    activeGuideLine: isDark ? "border-sky-500/50" : "border-sky-400",
    key: isDark ? "text-sky-300" : "text-sky-700",
    string: isDark ? "text-emerald-300" : "text-emerald-600",
    number: isDark ? "text-purple-300" : "text-purple-600",
    boolean: isDark ? "text-amber-300" : "text-amber-600",
    nullVal: isDark ? "text-rose-400 italic" : "text-rose-600 italic",
    bracket: isDark ? "text-slate-400" : "text-slate-500",
    badge: isDark
      ? "bg-slate-800/80 text-slate-300 border-slate-700"
      : "bg-slate-100 text-slate-700 border-slate-200",
    highlight: "bg-amber-400/30 text-amber-200 rounded px-0.5",
  };

  // Text highlighter for search
  const highlightText = (text: string, isStringLiteral: boolean = false): React.ReactNode => {
    if (!searchTerm.trim()) {
      return isStringLiteral ? `"${text}"` : text;
    }
    const term = searchTerm.toLowerCase();
    const str = String(text);
    const lower = str.toLowerCase();
    if (!lower.includes(term)) {
      return isStringLiteral ? `"${text}"` : text;
    }

    const parts: React.ReactNode[] = [];
    let curr = 0;
    while (curr < str.length) {
      const idx = lower.indexOf(term, curr);
      if (idx === -1) {
        parts.push(str.slice(curr));
        break;
      }
      if (idx > curr) {
        parts.push(str.slice(curr, idx));
      }
      parts.push(
        <mark key={idx} className={themeClasses.highlight}>
          {str.slice(idx, idx + term.length)}
        </mark>
      );
      curr = idx + term.length;
    }

    return (
      <>
        {isStringLiteral && '"'}
        {parts}
        {isStringLiteral && '"'}
      </>
    );
  };

  // ==========================================
  // PRETTY VIEW: Integrated Line Row Generator
  // ==========================================
  interface RenderRow {
    lineNum: number;
    indent: number;
    path: string;
    keyName?: string;
    value?: any;
    type: "obj-open" | "obj-close" | "arr-open" | "arr-close" | "primitive" | "collapsed";
    childCount?: number;
    hasComma?: boolean;
    preview?: string;
  }

  const prettyRows = useMemo(() => {
    if (data === undefined || data === null) {
      return [
        {
          lineNum: 1,
          indent: 0,
          path: "root",
          value: data,
          type: "primitive" as const,
          hasComma: false,
        },
      ];
    }

    const rows: RenderRow[] = [];
    let currentLine = 1;

    const traverse = (
      val: any,
      indent: number,
      path: string,
      keyName?: string,
      hasComma: boolean = false
    ) => {
      const isCollapsed = collapsedPaths.has(path);

      if (Array.isArray(val)) {
        if (isCollapsed) {
          rows.push({
            lineNum: currentLine++,
            indent,
            path,
            keyName,
            type: "collapsed",
            childCount: val.length,
            preview: `[ ${val.length} items ]`,
            hasComma,
          });
          return;
        }

        // Open bracket
        rows.push({
          lineNum: currentLine++,
          indent,
          path,
          keyName,
          type: "arr-open",
          childCount: val.length,
          hasComma: false,
        });

        val.forEach((item, idx) => {
          traverse(item, indent + 1, `${path}[${idx}]`, undefined, idx < val.length - 1);
        });

        // Close bracket
        rows.push({
          lineNum: currentLine++,
          indent,
          path,
          type: "arr-close",
          hasComma,
        });
      } else if (typeof val === "object" && val !== null) {
        const entries = Object.entries(val);
        if (isCollapsed) {
          rows.push({
            lineNum: currentLine++,
            indent,
            path,
            keyName,
            type: "collapsed",
            childCount: entries.length,
            preview: `{ ${entries.length} properties }`,
            hasComma,
          });
          return;
        }

        // Open brace
        rows.push({
          lineNum: currentLine++,
          indent,
          path,
          keyName,
          type: "obj-open",
          childCount: entries.length,
          hasComma: false,
        });

        entries.forEach(([k, v], idx) => {
          traverse(v, indent + 1, `${path}.${k}`, k, idx < entries.length - 1);
        });

        // Close brace
        rows.push({
          lineNum: currentLine++,
          indent,
          path,
          type: "obj-close",
          hasComma,
        });
      } else {
        // Primitive
        rows.push({
          lineNum: currentLine++,
          indent,
          path,
          keyName,
          value: val,
          type: "primitive",
          hasComma,
        });
      }
    };

    traverse(data, 0, "root", undefined, false);
    return rows;
  }, [data, collapsedPaths]);

  // ==========================================
  // RENDER ROW CONTENT
  // ==========================================
  const renderRowValue = (row: RenderRow) => {
    const val = row.value;
    const keyHint = row.keyName || "";

    if (val === null) {
      return <span className={themeClasses.nullVal}>null</span>;
    }
    if (val === undefined) {
      return <span className={themeClasses.nullVal}>undefined</span>;
    }

    if (typeof val === "boolean") {
      return <span className={`${themeClasses.boolean} font-medium`}>{String(val)}</span>;
    }

    if (typeof val === "number") {
      const tsInfo = parseEpochTimestamp(val, keyHint);
      return (
        <span className="inline-flex items-center flex-wrap gap-1.5">
          <span className={`${themeClasses.number} font-medium`}>{highlightText(String(val))}</span>
          {tsInfo && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-sans bg-purple-500/10 text-purple-400 border border-purple-500/20"
              title={`ISO: ${tsInfo.date.toISOString()} | Local: ${tsInfo.date.toLocaleString()}`}
            >
              <Clock className="w-2.5 h-2.5" />
              <span>{tsInfo.formattedUtc}</span>
              <span className="text-purple-400/70">({tsInfo.relative})</span>
            </span>
          )}
        </span>
      );
    }

    if (typeof val === "string") {
      const isMedia = isStreamingMediaUrl(val, keyHint);
      const isHex = isColorHex(val);
      const isHttp = /^https?:\/\//i.test(val.trim());
      const tsInfo = parseEpochTimestamp(val, keyHint);

      return (
        <span className="inline-flex items-center flex-wrap gap-1.5">
          {/* Color swatch */}
          {isHex && (
            <span
              className="inline-block w-3.5 h-3.5 rounded border border-slate-600/50 shadow-sm"
              style={{ backgroundColor: val }}
              title={val}
            />
          )}

          {/* String text */}
          <span className={themeClasses.string}>
            {highlightText(val, true)}
          </span>

          {/* Video Streaming Preview Pill */}
          {isMedia && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setPreviewVideoUrl(val);
              }}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30 transition-colors shadow-sm cursor-pointer"
              title="Preview video stream in modal"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>Play Preview</span>
            </button>
          )}

          {/* Normal HTTP link */}
          {isHttp && !isMedia && (
            <a
              href={val}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-sky-400 hover:text-sky-300 underline text-xs"
              title="Open link in new tab"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          )}

          {/* Timestamp chip if string is epoch */}
          {tsInfo && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-sans bg-purple-500/10 text-purple-400 border border-purple-500/20"
              title={`ISO: ${tsInfo.date.toISOString()} | Local: ${tsInfo.date.toLocaleString()}`}
            >
              <Clock className="w-2.5 h-2.5" />
              <span>{tsInfo.formattedUtc}</span>
              <span className="text-purple-400/70">({tsInfo.relative})</span>
            </span>
          )}
        </span>
      );
    }

    return <span>{String(val)}</span>;
  };

  return (
    <div className={`h-full flex flex-col font-sans ${themeClasses.wrapper} ${className}`}>
      {/* ========================================== */}
      {/* TOP TOOLBAR: Modern, Subtle & Feature-Rich */}
      {/* ========================================== */}
      <div className={`px-3 py-2 border-b flex flex-wrap items-center justify-between gap-2 text-xs ${themeClasses.header}`}>
        {/* Left Side: View Mode Toggles & Stats */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Mode Switcher */}
          <div className="inline-flex items-center bg-black/20 dark:bg-slate-900/60 p-0.5 rounded-md border border-slate-700/50">
            <button
              onClick={() => setViewMode("pretty")}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all ${
                viewMode === "pretty"
                  ? "bg-sky-500 text-white shadow-sm font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <CodeIcon className="w-3.5 h-3.5" />
              Pretty
            </button>
            <button
              onClick={() => setViewMode("tree")}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all ${
                viewMode === "tree"
                  ? "bg-purple-600 text-white shadow-sm font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Tree
            </button>
            {tableDataOptions.length > 0 && (
              <button
                onClick={() => setViewMode("table")}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all ${
                  viewMode === "table"
                    ? "bg-emerald-600 text-white shadow-sm font-semibold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <TableIcon className="w-3.5 h-3.5" />
                Table
              </button>
            )}
            <button
              onClick={() => setViewMode("raw")}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all ${
                viewMode === "raw"
                  ? "bg-slate-700 text-white shadow-sm font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Raw
            </button>
          </div>

          {/* Properties count badge */}
          <Badge variant="outline" className={`text-xs py-0.5 font-mono ${themeClasses.badge}`}>
            {metaStats.type === "array"
              ? `${metaStats.count} items`
              : `${metaStats.count} properties`}
            <span className="opacity-50 ml-1.5">({metaStats.rawSize})</span>
          </Badge>

          {/* Content Type Badge */}
          {contentType && (
            <Badge variant="outline" className={`text-xs py-0.5 font-mono ${themeClasses.badge}`}>
              {contentType}
            </Badge>
          )}
        </div>

        {/* Middle: Integrated Search & Match Counter */}
        <div className="flex items-center gap-2 flex-1 max-w-xs min-w-[160px]">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              type="text"
              placeholder="Search keys & values..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-7 pl-8 pr-7 text-xs bg-slate-900/40 border-slate-700/60 text-slate-200 focus:ring-sky-500 rounded-md"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          {searchTerm && (
            <Badge
              variant="secondary"
              className="text-[11px] whitespace-nowrap bg-amber-500/20 text-amber-300 border-amber-500/30"
            >
              {searchMatchesCount} {searchMatchesCount === 1 ? "match" : "matches"}
            </Badge>
          )}
        </div>

        {/* Right Side: Theme, Fold/Expand, Copy Actions */}
        <div className="flex items-center gap-1.5">
          {/* Expand / Collapse All (Pretty and Tree only) */}
          {(viewMode === "pretty" || viewMode === "tree") && (
            <div className="flex items-center gap-1 mr-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-slate-400 hover:text-slate-200"
                onClick={expandAll}
                title="Expand all nodes"
              >
                Expand All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-slate-400 hover:text-slate-200"
                onClick={collapseAll}
                title="Collapse all nodes"
              >
                Collapse All
              </Button>
            </div>
          )}

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-slate-400 hover:text-slate-200"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            title={`Switch to ${isDark ? "Light" : "Dark"} theme`}
          >
            {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </Button>

          {/* Save / Download */}
          {onDownloadFull && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs gap-1 border-slate-700 bg-slate-800/40 text-slate-300 hover:bg-slate-700"
              onClick={onDownloadFull}
              title="Save JSON to disk"
            >
              <Download className="w-3 h-3" />
              Save
            </Button>
          )}

          {/* Copy Full JSON */}
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs gap-1 border-slate-700 bg-slate-800/40 text-slate-300 hover:bg-slate-700"
            onClick={() => {
              if (onCopyFull) onCopyFull();
              else copyToClipboard(JSON.stringify(data, null, 2), "Full JSON");
            }}
          >
            <Copy className="w-3 h-3" />
            Copy
          </Button>
        </div>
      </div>

      {/* ========================================== */}
      {/* VIEW CONTENT AREA */}
      {/* ========================================== */}
      <div className="flex-1 overflow-auto scrollbar-thin smooth-scroll relative">
        {/* PRETTY VIEW (Integrated Line Numbers + Guideline Rails + Hover Micro-Actions) */}
        {viewMode === "pretty" && (
          <div className="font-mono text-xs leading-6 py-2 select-text">
            {prettyRows.map((row) => {
              const isCollapsible =
                row.type === "obj-open" || row.type === "arr-open" || row.type === "collapsed";
              const isCollapsed = row.type === "collapsed";
              const jsonPath = formatJsonPath(row.path);

              return (
                <div
                  key={`${row.lineNum}-${row.path}`}
                  className={`group flex items-start w-full transition-colors ${themeClasses.rowHover}`}
                >
                  {/* Integrated Gutter: Line Number */}
                  <div
                    className={`w-12 flex-shrink-0 text-right pr-3 select-none font-mono text-[11px] ${themeClasses.gutter}`}
                  >
                    {row.lineNum}
                  </div>

                  {/* Fold Chevron / Space */}
                  <div className="w-4 flex-shrink-0 flex items-center justify-center pt-1 select-none">
                    {isCollapsible ? (
                      <button
                        onClick={() => togglePath(row.path)}
                        className="text-slate-400 hover:text-sky-400 transition-colors"
                        title={isCollapsed ? "Expand node" : "Collapse node"}
                      >
                        {isCollapsed ? (
                          <ChevronRight className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </button>
                    ) : (
                      <span className="w-3" />
                    )}
                  </div>

                  {/* Indentation guide lines & row content */}
                  <div className="flex-1 flex items-center flex-wrap min-w-0 pr-4 relative">
                    {/* Guide rail lines */}
                    {Array.from({ length: row.indent }).map((_, i) => (
                      <span
                        key={i}
                        className={`inline-block w-4 h-full border-l select-none transition-colors ${themeClasses.guideLine} group-hover:${themeClasses.activeGuideLine}`}
                        style={{ height: "1.5rem" }}
                      />
                    ))}

                    {/* Key name */}
                    {row.keyName !== undefined && (
                      <span className="inline-flex items-center mr-1">
                        <span className={`${themeClasses.key} font-medium`}>
                          {highlightText(row.keyName, true)}
                        </span>
                        <span className={themeClasses.bracket}>: </span>
                      </span>
                    )}

                    {/* Open Braces / Collapsed Badges / Primitives */}
                    {row.type === "obj-open" && (
                      <span className={`${themeClasses.bracket} font-semibold`}>{`{`}</span>
                    )}
                    {row.type === "arr-open" && (
                      <span className={`${themeClasses.bracket} font-semibold`}>[</span>
                    )}
                    {row.type === "obj-close" && (
                      <span className={`${themeClasses.bracket} font-semibold`}>{`}`}</span>
                    )}
                    {row.type === "arr-close" && (
                      <span className={`${themeClasses.bracket} font-semibold`}>]</span>
                    )}
                    {row.type === "collapsed" && (
                      <button
                        onClick={() => togglePath(row.path)}
                        className="inline-flex items-center gap-1 text-[11px] px-2 py-0.2 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 hover:bg-sky-500/20 transition-colors"
                      >
                        <span>{row.preview}</span>
                      </button>
                    )}
                    {row.type === "primitive" && renderRowValue(row)}

                    {/* Trailing comma */}
                    {row.hasComma && <span className={themeClasses.bracket}>,</span>}

                    {/* Row Hover Micro-Toolbar (Copy JSONPath & Copy Value) */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity ml-auto pl-3 flex items-center gap-1 select-none">
                      {/* Copy JSONPath button */}
                      <button
                        onClick={() => copyToClipboard(jsonPath, "JSONPath", `path-${row.lineNum}`)}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700 transition-colors"
                        title={`Copy JSONPath: ${jsonPath}`}
                      >
                        {copiedKey === `path-${row.lineNum}` ? (
                          <Check className="w-2.5 h-2.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-2.5 h-2.5 text-slate-400" />
                        )}
                        <span>Path</span>
                      </button>

                      {/* Copy Value button for primitives */}
                      {row.type === "primitive" && (
                        <button
                          onClick={() =>
                            copyToClipboard(
                              typeof row.value === "string" ? row.value : JSON.stringify(row.value),
                              "Value",
                              `val-${row.lineNum}`
                            )
                          }
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700 transition-colors"
                          title="Copy raw value"
                        >
                          {copiedKey === `val-${row.lineNum}` ? (
                            <Check className="w-2.5 h-2.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-2.5 h-2.5 text-slate-400" />
                          )}
                          <span>Value</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TREE VIEW: Visual Node Explorer */}
        {viewMode === "tree" && (
          <div className="p-4">
            <TreeExplorer
              data={data}
              path="root"
              searchTerm={searchTerm}
              themeClasses={themeClasses}
              onPlayVideo={(url) => setPreviewVideoUrl(url)}
              onCopyPath={(p) => copyToClipboard(formatJsonPath(p), "JSONPath")}
              onCopyValue={(v) => copyToClipboard(typeof v === "string" ? v : JSON.stringify(v), "Value")}
            />
          </div>
        )}

        {/* TABLE VIEW: Dedicated Tabular Grid for Array Data */}
        {viewMode === "table" && (
          <div className="p-3 h-full flex flex-col">
            {tableDataOptions.length > 1 && (
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-slate-400 font-medium">Select Array:</span>
                <select
                  value={selectedTableOption}
                  onChange={(e) => setSelectedTableOption(e.target.value)}
                  className="text-xs px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-200"
                >
                  {tableDataOptions.map((opt) => (
                    <option key={opt.label} value={opt.label}>
                      {opt.label} ({opt.data.length} records)
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex-1 overflow-auto border border-slate-800 rounded-lg">
              <JsonTableView
                data={
                  tableDataOptions.find((o) => o.label === selectedTableOption)?.data ||
                  (Array.isArray(data) ? data : [])
                }
                onPlayVideo={(url) => setPreviewVideoUrl(url)}
                onCopyValue={(val) => copyToClipboard(val, "Cell value")}
              />
            </div>
          </div>
        )}

        {/* RAW VIEW: Plain Text Preformatted */}
        {viewMode === "raw" && (
          <pre className="h-full p-4 font-mono text-xs leading-5 text-slate-300 overflow-auto scrollbar-thin select-text">
            {JSON.stringify(data, null, 2)}
          </pre>
        )}
      </div>

      {/* ========================================== */}
      {/* VIDEO STREAM PREVIEW MODAL */}
      {/* ========================================== */}
      {previewVideoUrl && (
        <Dialog open={Boolean(previewVideoUrl)} onOpenChange={() => setPreviewVideoUrl(null)}>
          <DialogContent className="max-w-3xl bg-slate-950 border-slate-800 text-slate-100 p-6">
            <DialogHeader className="mb-3">
              <DialogTitle className="flex items-center justify-between text-base font-semibold">
                <span className="flex items-center gap-2">
                  <Play className="w-4 h-4 text-emerald-400 fill-emerald-400" />
                  Media Stream Preview
                </span>
              </DialogTitle>
            </DialogHeader>

            {/* Video Player */}
            <div className="relative rounded-lg overflow-hidden bg-black border border-slate-800 aspect-video flex items-center justify-center shadow-2xl">
              <video
                src={previewVideoUrl}
                controls
                autoPlay
                playsInline
                className="w-full h-full max-h-[420px] object-contain"
                onError={(e) => {
                  console.warn("Native video playback note:", e);
                }}
              />
            </div>

            {/* Stream URL & Controls */}
            <div className="mt-4 flex items-center justify-between gap-3 bg-slate-900/80 p-2.5 rounded-md border border-slate-800">
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-slate-400 font-medium">Stream Target:</div>
                <div className="text-xs font-mono text-emerald-400 truncate select-all">
                  {previewVideoUrl}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs border-slate-700 hover:bg-slate-800"
                onClick={() => copyToClipboard(previewVideoUrl, "Stream URL")}
              >
                <Copy className="w-3 h-3 mr-1" />
                Copy URL
              </Button>
            </div>

            <div className="mt-2 text-[11px] text-slate-500">
              💡 Tip: HTML5 native player supports direct MP4/WebM/HLS playback. Custom multi-period DASH/DRM manifests can also be tested in Chrome with MediaSource extensions.
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

// ==========================================
// TREE EXPLORER SUB-COMPONENT
// ==========================================
interface TreeExplorerProps {
  data: any;
  path: string;
  searchTerm: string;
  themeClasses: any;
  onPlayVideo: (url: string) => void;
  onCopyPath: (path: string) => void;
  onCopyValue: (val: any) => void;
  depth?: number;
}

const TreeExplorer: React.FC<TreeExplorerProps> = ({
  data,
  path,
  searchTerm,
  themeClasses,
  onPlayVideo,
  onCopyPath,
  onCopyValue,
  depth = 0,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(depth < 2);

  if (data === null || data === undefined || typeof data !== "object") {
    return null;
  }

  const isArray = Array.isArray(data);
  const entries = isArray ? data.map((v, i) => [String(i), v] as [string, any]) : Object.entries(data);

  return (
    <div className="font-mono text-xs">
      <div
        className="flex items-center gap-1.5 py-1 px-2 rounded cursor-pointer hover:bg-slate-800/40 select-none group"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="text-slate-400 hover:text-sky-400">
          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </span>
        <span className="font-semibold text-sky-400">
          {isArray ? `[ ] Array (${data.length})` : `{ } Object (${entries.length})`}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCopyPath(path);
          }}
          className="opacity-0 group-hover:opacity-100 ml-2 text-[10px] text-slate-400 hover:text-white px-1 py-0.5 rounded bg-slate-800"
          title="Copy path"
        >
          Copy Path
        </button>
      </div>

      {isExpanded && (
        <div className="pl-4 border-l border-slate-800 ml-2 mt-0.5 space-y-0.5">
          {entries.map(([key, val]) => {
            const childPath = isArray ? `${path}[${key}]` : `${path}.${key}`;
            const isChildObject = typeof val === "object" && val !== null;

            if (isChildObject) {
              return (
                <div key={key}>
                  <div className="flex items-center gap-1 py-0.5 text-slate-300">
                    <span className="text-sky-300 font-medium">"{key}":</span>
                  </div>
                  <TreeExplorer
                    data={val}
                    path={childPath}
                    searchTerm={searchTerm}
                    themeClasses={themeClasses}
                    onPlayVideo={onPlayVideo}
                    onCopyPath={onCopyPath}
                    onCopyValue={onCopyValue}
                    depth={depth + 1}
                  />
                </div>
              );
            }

            // Primitive row
            const isMedia = typeof val === "string" && isStreamingMediaUrl(val, key);
            const tsInfo = parseEpochTimestamp(val, key);

            return (
              <div
                key={key}
                className="flex items-center gap-2 py-0.5 px-2 rounded hover:bg-slate-800/30 group"
              >
                <span className="text-sky-300 font-medium select-none">"{key}":</span>
                <span className="text-emerald-300 truncate max-w-md">
                  {typeof val === "string" ? `"${val}"` : String(val)}
                </span>
                {isMedia && (
                  <button
                    onClick={() => onPlayVideo(val)}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30"
                  >
                    <Play className="w-2.5 h-2.5 fill-current" />
                    Play
                  </button>
                )}
                {tsInfo && (
                  <span className="text-[10px] text-purple-400 bg-purple-500/10 px-1 py-0.5 rounded border border-purple-500/20">
                    {tsInfo.formattedUtc}
                  </span>
                )}
                <div className="opacity-0 group-hover:opacity-100 ml-auto flex items-center gap-1">
                  <button
                    onClick={() => onCopyPath(childPath)}
                    className="text-[10px] text-slate-400 hover:text-white px-1 rounded bg-slate-800"
                  >
                    Path
                  </button>
                  <button
                    onClick={() => onCopyValue(val)}
                    className="text-[10px] text-slate-400 hover:text-white px-1 rounded bg-slate-800"
                  >
                    Val
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ==========================================
// JSON TABLE VIEW SUB-COMPONENT
// ==========================================
interface JsonTableViewProps {
  data: any[];
  onPlayVideo: (url: string) => void;
  onCopyValue: (val: string) => void;
}

const JsonTableView: React.FC<JsonTableViewProps> = ({ data, onPlayVideo, onCopyValue }) => {
  const [filterText, setFilterText] = useState("");

  const columns = useMemo(() => {
    const keys = new Set<string>();
    data.slice(0, 100).forEach((item) => {
      if (item && typeof item === "object") {
        Object.keys(item).forEach((k) => keys.add(k));
      }
    });
    return Array.from(keys);
  }, [data]);

  const filteredData = useMemo(() => {
    if (!filterText.trim()) return data;
    const term = filterText.toLowerCase();
    return data.filter((item) => {
      return Object.values(item || {}).some((v) =>
        String(v).toLowerCase().includes(term)
      );
    });
  }, [data, filterText]);

  if (columns.length === 0) {
    return <div className="p-4 text-slate-400 text-xs italic">No tabular columns detected.</div>;
  }

  return (
    <div className="h-full flex flex-col text-xs font-mono">
      <div className="p-2 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
        <span className="text-slate-400 text-xs">
          Showing {filteredData.length} of {data.length} records
        </span>
        <Input
          placeholder="Filter rows..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          className="h-6 w-48 text-xs bg-slate-950 border-slate-700"
        />
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-left">
          <thead className="bg-slate-900 sticky top-0 border-b border-slate-800">
            <tr>
              <th className="p-2 text-slate-400 font-semibold w-10 border-r border-slate-800 text-right">
                #
              </th>
              {columns.map((col) => (
                <th
                  key={col}
                  className="p-2 text-sky-400 font-semibold border-r border-slate-800 whitespace-nowrap"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredData.map((row, idx) => (
              <tr key={idx} className="border-b border-slate-800/60 hover:bg-slate-800/30">
                <td className="p-2 text-slate-500 font-mono text-right border-r border-slate-800 select-none">
                  {idx + 1}
                </td>
                {columns.map((col) => {
                  const val = row ? row[col] : undefined;
                  const isMedia = typeof val === "string" && isStreamingMediaUrl(val, col);
                  const displayVal =
                    val === null
                      ? "null"
                      : val === undefined
                      ? ""
                      : typeof val === "object"
                      ? JSON.stringify(val)
                      : String(val);

                  return (
                    <td
                      key={col}
                      className="p-2 text-slate-300 border-r border-slate-800 max-w-xs truncate cursor-pointer"
                      title="Click to copy cell value"
                      onClick={() => onCopyValue(displayVal)}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="truncate">{displayVal}</span>
                        {isMedia && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onPlayVideo(val);
                            }}
                            className="p-0.5 rounded text-emerald-400 hover:bg-emerald-500/20"
                          >
                            <Play className="w-3 h-3 fill-current" />
                          </button>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
