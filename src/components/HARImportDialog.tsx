import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Upload, FileText, Filter, CheckCircle, AlertCircle, Download, X, Plus, Globe, Layers, CheckSquare, Square, CopyMinus, FolderInput, FolderPlus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import HARParser, { HARImportFilters, ProcessedHARRequest, HAREntry } from "@/lib/harParser";

interface CollectionItem {
  id: string;
  name: string;
}

interface HARImportDialogProps {
  onImport: (requests: ProcessedHARRequest[], collectionName: string, targetCollectionId?: string) => void;
  collections?: CollectionItem[];
  currentCollectionId?: string;
  children: React.ReactNode;
}

interface ImportState {
  step: 'upload' | 'processing' | 'preview' | 'complete';
  progress: number;
  summary?: {
    totalEntries: number;
    filteredEntries: number;
    skippedEntries: number;
    duplicatesExcluded?: number;
    domainFilter: string;
    routeFilter: string;
  };
}

const HARImportDialog: React.FC<HARImportDialogProps> = ({ 
  onImport, 
  collections = [],
  currentCollectionId = 'default',
  children 
}) => {
  const [open, setOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importState, setImportState] = useState<ImportState>({ step: 'upload', progress: 0 });
  const [processedRequests, setProcessedRequests] = useState<ProcessedHARRequest[]>([]);
  const [collectionName, setCollectionName] = useState('');

  // Destination collection mode: 'existing' vs 'new'
  const [destinationMode, setDestinationMode] = useState<'existing' | 'new'>('existing');
  const [targetCollectionId, setTargetCollectionId] = useState<string>('');

  // Deduplication & Individual Checkbox Selection
  const [deduplicate, setDeduplicate] = useState(true);
  const [selectedRequestIds, setSelectedRequestIds] = useState<Set<string>>(new Set());

  // Tag filter states
  const [domainTags, setDomainTags] = useState<string[]>([]);
  const [domainInput, setDomainInput] = useState('');
  const [routeTags, setRouteTags] = useState<string[]>([]);
  const [routeInput, setRouteInput] = useState('');
  
  // Detected domains from uploaded HAR
  const [detectedDomains, setDetectedDomains] = useState<string[]>([]);
  const [isScanningFile, setIsScanningFile] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const resetDialog = () => {
    setDomainTags([]);
    setDomainInput('');
    setRouteTags([]);
    setRouteInput('');
    setDetectedDomains([]);
    setSelectedFile(null);
    setImportState({ step: 'upload', progress: 0 });
    setProcessedRequests([]);
    setSelectedRequestIds(new Set());
    setDeduplicate(true);
    setDestinationMode('existing');
    setTargetCollectionId('');
    setCollectionName('');
    setIsScanningFile(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Extract detected domains from the chosen file
  const scanFileForDomains = async (file: File) => {
    setIsScanningFile(true);
    try {
      const text = await file.text();
      const harData = HARParser.parseHARFile(text);
      const domains = HARParser.extractDomains(harData.log.entries);
      setDetectedDomains(domains);
    } catch (err) {
      console.warn('Could not pre-scan HAR domains:', err);
    } finally {
      setIsScanningFile(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.har')) {
      toast({
        title: "Invalid File Type",
        description: "Please select a .har file",
        variant: "destructive"
      });
      return;
    }

    const maxSize = 100 * 1024 * 1024; // 100MB in bytes
    if (file.size > maxSize) {
      toast({
        title: "File Too Large",
        description: "HAR file must be smaller than 100MB",
        variant: "destructive"
      });
      return;
    }

    setSelectedFile(file);
    scanFileForDomains(file);
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file && file.name.toLowerCase().endsWith('.har')) {
      setSelectedFile(file);
      scanFileForDomains(file);
    } else {
      toast({
        title: "Invalid File",
        description: "Please drop a .har file",
        variant: "destructive"
      });
    }
  };

  // Domain Tag Helpers
  const addDomainTags = (rawInput: string) => {
    if (!rawInput.trim()) return;
    const parts = rawInput
      .split(/[,;\s]+/)
      .map(p => {
        let t = p.toLowerCase().trim();
        t = t.replace(/^https?:\/\//i, '').replace(/:\d+$/, '').replace(/\/.*$/, '');
        if (t.startsWith('*.')) t = t.slice(2);
        return t;
      })
      .filter(Boolean);

    setDomainTags(prev => {
      const next = [...prev];
      for (const p of parts) {
        if (!next.includes(p)) {
          next.push(p);
        }
      }
      return next;
    });
    setDomainInput('');
  };

  const removeDomainTag = (tagToRemove: string) => {
    setDomainTags(prev => prev.filter(t => t !== tagToRemove));
  };

  const handleDomainKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addDomainTags(domainInput);
    } else if (e.key === 'Backspace' && domainInput === '' && domainTags.length > 0) {
      e.preventDefault();
      setDomainTags(prev => prev.slice(0, -1));
    }
  };

  const handleDomainPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text');
    if (pasted && (pasted.includes(',') || pasted.includes(' ') || pasted.includes('\n'))) {
      e.preventDefault();
      addDomainTags(pasted);
    }
  };

  // Route Tag Helpers
  const addRouteTags = (rawInput: string) => {
    if (!rawInput.trim()) return;
    const parts = rawInput
      .split(/[,;]+/)
      .map(p => p.trim())
      .filter(Boolean);

    setRouteTags(prev => {
      const next = [...prev];
      for (const p of parts) {
        if (!next.includes(p)) {
          next.push(p);
        }
      }
      return next;
    });
    setRouteInput('');
  };

  const removeRouteTag = (tagToRemove: string) => {
    setRouteTags(prev => prev.filter(t => t !== tagToRemove));
  };

  const handleRouteKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addRouteTags(routeInput);
    } else if (e.key === 'Backspace' && routeInput === '' && routeTags.length > 0) {
      e.preventDefault();
      setRouteTags(prev => prev.slice(0, -1));
    }
  };

  const handleRoutePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text');
    if (pasted && (pasted.includes(',') || pasted.includes('\n'))) {
      e.preventDefault();
      addRouteTags(pasted);
    }
  };

  // Checkbox Selection Helpers
  const toggleRequestSelection = (id: string) => {
    setSelectedRequestIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedRequestIds.size === processedRequests.length) {
      setSelectedRequestIds(new Set());
    } else {
      setSelectedRequestIds(new Set(processedRequests.map(r => r.id)));
    }
  };

  const processHARFile = async () => {
    if (!selectedFile) return;

    setImportState({ step: 'processing', progress: 10 });

    try {
      // Gather domain and route filters including pending input
      const finalDomainTags = [...domainTags];
      if (domainInput.trim()) {
        const parts = domainInput
          .split(/[,;\s]+/)
          .map(p => p.toLowerCase().trim().replace(/^https?:\/\//i, '').replace(/:\d+$/, '').replace(/\/.*$/, ''))
          .filter(Boolean);
        for (const p of parts) {
          if (!finalDomainTags.includes(p)) finalDomainTags.push(p);
        }
      }

      const finalRouteTags = [...routeTags];
      if (routeInput.trim()) {
        const parts = routeInput.split(/[,;]+/).map(p => p.trim()).filter(Boolean);
        for (const p of parts) {
          if (!finalRouteTags.includes(p)) finalRouteTags.push(p);
        }
      }

      const activeFilters: HARImportFilters = {
        domains: finalDomainTags,
        routes: finalRouteTags,
        deduplicate
      };

      // Read file content
      const fileContent = await selectedFile.text();
      setImportState(prev => ({ ...prev, progress: 30 }));

      // Parse HAR file
      const harData = HARParser.parseHARFile(fileContent);
      setImportState(prev => ({ ...prev, progress: 50 }));

      // Extract endpoint counts for all entries to track duplicate polling requests
      const endpointCounts = HARParser.getEndpointCounts(harData.log.entries);

      // Raw filtered without deduplication to compute duplicate count accurately
      const rawFiltered = HARParser.filterEntries(harData.log.entries, { ...activeFilters, deduplicate: false });
      
      // Filter entries with deduplication applied if requested
      const filteredEntries = deduplicate 
        ? HARParser.filterEntries(harData.log.entries, activeFilters)
        : rawFiltered;
      
      const duplicatesExcluded = Math.max(0, rawFiltered.length - filteredEntries.length);

      setImportState(prev => ({ ...prev, progress: 70 }));

      // Generate collection name
      const generatedCollectionName = HARParser.generateCollectionName(activeFilters, filteredEntries.length);
      setCollectionName(generatedCollectionName);

      // Convert to Restify requests with repeatCount attached
      const requests = HARParser.convertToRestifyRequests(filteredEntries, 'temp_collection_id', endpointCounts);
      setProcessedRequests(requests);
      
      // Select all filtered requests by default
      setSelectedRequestIds(new Set(requests.map(r => r.id)));
      
      setImportState(prev => ({ ...prev, progress: 90 }));

      // Generate summary
      const summary = HARParser.getImportSummary(
        harData.log.entries.length, 
        filteredEntries.length, 
        activeFilters,
        duplicatesExcluded
      );
      
      setImportState({ 
        step: 'preview', 
        progress: 100,
        summary 
      });

      toast({
        title: "HAR File Processed",
        description: `Found ${requests.length} API requests ready for selection`
      });

    } catch (error) {
      console.error('HAR processing error:', error);
      toast({
        title: "Processing Failed",
        description: error instanceof Error ? error.message : "Failed to process HAR file",
        variant: "destructive"
      });
      setImportState({ step: 'upload', progress: 0 });
    }
  };

  const confirmImport = () => {
    // Only import the user-selected requests!
    const requestsToImport = processedRequests.filter(req => selectedRequestIds.has(req.id));
    if (requestsToImport.length === 0) return;

    const chosenTargetId = destinationMode === 'existing'
      ? (targetCollectionId || currentCollectionId || 'default')
      : `har_${Date.now()}`;

    const chosenCollectionName = destinationMode === 'existing'
      ? (collections?.find(c => c.id === chosenTargetId)?.name || 'Default')
      : (collectionName.trim() || `HAR Import ${new Date().toISOString().split('T')[0]}`);

    const requestsWithCollectionId = requestsToImport.map(req => ({
      ...req,
      collectionId: chosenTargetId
    }));

    onImport(
      requestsWithCollectionId, 
      chosenCollectionName, 
      destinationMode === 'existing' ? chosenTargetId : '__new__'
    );
    
    setImportState({ step: 'complete', progress: 100 });
    
    toast({
      title: "Import Successful",
      description: `${requestsToImport.length} requests imported into collection "${chosenCollectionName}"`
    });

    setTimeout(() => {
      setOpen(false);
      resetDialog();
    }, 1800);
  };

  const renderUploadStep = () => (
    <div className="space-y-6">
      {/* File Upload Area */}
      <div 
        className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-8 text-center hover:border-slate-400 dark:hover:border-slate-600 transition-colors bg-slate-50/50 dark:bg-slate-900/50"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-slate-700 dark:text-slate-200 mb-2">
          Upload HAR File
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Drag and drop your HAR file here, or click to browse
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".har"
          onChange={handleFileSelect}
          className="hidden"
        />
        <Button 
          variant="outline" 
          onClick={() => fileInputRef.current?.click()}
          className="mb-2 shadow-sm"
        >
          <FileText className="w-4 h-4 mr-2" />
          Choose HAR File
        </Button>
        <p className="text-xs text-slate-400">Maximum file size: 100MB</p>
      </div>

      {/* Selected File Info */}
      {selectedFile && (
        <div className="bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-blue-950 dark:text-blue-200 truncate">{selectedFile.name}</p>
              <p className="text-xs text-blue-700 dark:text-blue-400">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                {isScanningFile ? " • Scanning domains..." : ` • Detected ${detectedDomains.length} domains`}
              </p>
            </div>
            <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 font-mono text-[11px]">
              HAR File
            </Badge>
          </div>
        </div>
      )}

      {/* Filters (Tag Style & Polling Deduplication) */}
      <div className="space-y-4 pt-1">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">Filters & Deduplication</h3>
        </div>
        
        {/* Domain Filter Tag Box */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="domain-tag-input" className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-blue-500" />
              Domain Filter
              <span className="text-slate-400 font-normal">(supports subdomains & multiple domains)</span>
            </Label>
            {domainTags.length > 0 && (
              <button
                type="button"
                onClick={() => setDomainTags([])}
                className="text-[11px] text-slate-400 hover:text-red-500 transition-colors"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="min-h-[42px] p-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg flex flex-wrap items-center gap-1.5 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all">
            {domainTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-mono font-medium bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/80 shadow-xs"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeDomainTag(tag)}
                  className="text-blue-400 hover:text-red-500 transition-colors p-0.5 rounded focus:outline-none"
                  title="Remove domain filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <input
              id="domain-tag-input"
              type="text"
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
              onKeyDown={handleDomainKeyDown}
              onPaste={handleDomainPaste}
              onBlur={() => {
                if (domainInput.trim()) addDomainTags(domainInput);
              }}
              placeholder={domainTags.length === 0 ? "e.g., sonyliv.com, apiv2.sonyliv.com (comma/Enter to add)" : "Add more domains..."}
              className="flex-1 min-w-[180px] bg-transparent border-0 outline-none text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 px-1 py-1"
            />
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Subdomain match enabled: <span className="font-mono text-slate-600 dark:text-slate-300">sonyliv.com</span> matches <span className="font-mono text-slate-600 dark:text-slate-300">apiv2.sonyliv.com</span>, <span className="font-mono text-slate-600 dark:text-slate-300">spapi.sonyliv.com</span>, and <span className="font-mono text-slate-600 dark:text-slate-300">www.sonyliv.com</span>.
          </p>

          {/* Quick-add detected domains */}
          {detectedDomains.length > 0 && (
            <div className="pt-1">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                Detected in file (click to filter):
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {detectedDomains.slice(0, 10).map((d) => {
                  const isAlreadyAdded = domainTags.some(t => t === d || d.endsWith('.' + t));
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        if (!domainTags.includes(d)) {
                          setDomainTags(prev => [...prev, d]);
                        }
                      }}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono transition-all ${
                        isAlreadyAdded
                          ? "bg-blue-100/60 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-300/50"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 border border-slate-200 dark:border-slate-700"
                      }`}
                      title={isAlreadyAdded ? "Already active or matched by filter" : `Filter ${d}`}
                    >
                      {!isAlreadyAdded && <Plus className="w-2.5 h-2.5" />}
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        
        {/* Route Filter Tag Box */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between">
            <Label htmlFor="route-tag-input" className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-500" />
              Route Filter
              <span className="text-slate-400 font-normal">(path segments, comma/Enter to add)</span>
            </Label>
            {routeTags.length > 0 && (
              <button
                type="button"
                onClick={() => setRouteTags([])}
                className="text-[11px] text-slate-400 hover:text-red-500 transition-colors"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="min-h-[42px] p-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg flex flex-wrap items-center gap-1.5 focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all">
            {routeTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-mono font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80 shadow-xs"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeRouteTag(tag)}
                  className="text-emerald-400 hover:text-red-500 transition-colors p-0.5 rounded focus:outline-none"
                  title="Remove route filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <input
              id="route-tag-input"
              type="text"
              value={routeInput}
              onChange={(e) => setRouteInput(e.target.value)}
              onKeyDown={handleRouteKeyDown}
              onPaste={handleRoutePaste}
              onBlur={() => {
                if (routeInput.trim()) addRouteTags(routeInput);
              }}
              placeholder={routeTags.length === 0 ? "e.g., /api/user, /playback/, /AGL/ (comma/Enter to add)" : "Add more routes..."}
              className="flex-1 min-w-[180px] bg-transparent border-0 outline-none text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 px-1 py-1"
            />
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Matches any URL path containing any of the route tags. Leave empty to include all routes.
          </p>
        </div>

        {/* Polling API Deduplication Checkbox */}
        <div className="pt-2 pb-1 border-t border-slate-200/80 dark:border-slate-800/80">
          <label className="flex items-start gap-2.5 cursor-pointer select-none group">
            <input
              type="checkbox"
              checked={deduplicate}
              onChange={(e) => setDeduplicate(e.target.checked)}
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-700 dark:bg-slate-900 cursor-pointer mt-0.5"
            />
            <div className="text-xs">
              <span className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex items-center gap-1.5">
                <CopyMinus className="w-3.5 h-3.5 text-blue-500" />
                Deduplicate repeated URLs (keep first occurrence only)
              </span>
              <p className="text-slate-500 dark:text-slate-400 font-normal mt-0.5">
                Automatically consolidates repeated polling and heartbeat calls so you don't import 50+ duplicate entries of the same API.
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Process Button */}
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="outline" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button 
          onClick={processHARFile}
          disabled={!selectedFile}
          className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white shadow-md font-medium"
        >
          <Download className="w-4 h-4 mr-2" />
          Process HAR File
        </Button>
      </div>
    </div>
  );

  const renderProcessingStep = () => (
    <div className="space-y-6 text-center py-6">
      <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-blue-500/20">
        <FileText className="w-8 h-8 text-white animate-pulse" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-1">Processing HAR File</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Parsing network entries, consolidating polling requests, matching domains & routes...
        </p>
        <Progress value={importState.progress} className="w-full h-2" />
        <p className="text-xs text-slate-400 mt-2 font-mono">{importState.progress}% complete</p>
      </div>
    </div>
  );

  const renderPreviewStep = () => {
    const selectedCount = selectedRequestIds.size;
    const allSelected = selectedCount === processedRequests.length && processedRequests.length > 0;

    return (
      <div className="space-y-5">
        {/* Summary */}
        <div className="bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h3 className="font-semibold text-emerald-950 dark:text-emerald-200">Processing Complete</h3>
          </div>
          {importState.summary && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-emerald-800 dark:text-emerald-300">Total HAR entries:</span>
                <Badge variant="secondary" className="font-mono">{importState.summary.totalEntries}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-emerald-800 dark:text-emerald-300 font-medium">Filtered unique endpoints:</span>
                <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-mono px-2.5">
                  {importState.summary.filteredEntries}
                </Badge>
              </div>
              {importState.summary.duplicatesExcluded !== undefined && importState.summary.duplicatesExcluded > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-emerald-800 dark:text-emerald-300">Excluded duplicate calls:</span>
                  <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-300 font-mono text-xs">
                    {importState.summary.duplicatesExcluded} duplicate polling requests skipped
                  </Badge>
                </div>
              )}
              <div className="flex justify-between items-center gap-3">
                <span className="text-emerald-800 dark:text-emerald-300">Domain filter:</span>
                <div className="flex flex-wrap gap-1 justify-end max-w-[65%]">
                  {importState.summary.domainFilter === 'All domains' ? (
                    <span className="text-emerald-900 dark:text-emerald-200 font-mono text-xs">All domains</span>
                  ) : (
                    importState.summary.domainFilter.split(', ').map(d => (
                      <span key={d} className="bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300 font-mono text-[11px] px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                        {d}
                      </span>
                    ))
                  )}
                </div>
              </div>
              <div className="flex justify-between items-center gap-3">
                <span className="text-emerald-800 dark:text-emerald-300">Route filter:</span>
                <div className="flex flex-wrap gap-1 justify-end max-w-[65%]">
                  {importState.summary.routeFilter === 'All routes' ? (
                    <span className="text-emerald-900 dark:text-emerald-200 font-mono text-xs">All routes</span>
                  ) : (
                    importState.summary.routeFilter.split(', ').map(r => (
                      <span key={r} className="bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-mono text-[11px] px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                        {r}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Import Destination: Existing vs New Collection */}
        <div className="space-y-2 bg-slate-50/70 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800/80">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Import Destination
            </Label>
            <span className="text-[11px] text-slate-400">Choose existing collection or create new</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDestinationMode('existing')}
              className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                destinationMode === 'existing'
                  ? "border-blue-500 bg-blue-50/80 dark:bg-blue-950/60 text-blue-900 dark:text-blue-100 ring-1 ring-blue-500"
                  : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300"
              }`}
            >
              <div className="text-xs font-semibold flex items-center gap-1.5">
                <FolderInput className="w-3.5 h-3.5 text-blue-500" />
                Existing Collection
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                Add to active or selected collection
              </div>
            </button>

            <button
              type="button"
              onClick={() => setDestinationMode('new')}
              className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                destinationMode === 'new'
                  ? "border-blue-500 bg-blue-50/80 dark:bg-blue-950/60 text-blue-900 dark:text-blue-100 ring-1 ring-blue-500"
                  : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300"
              }`}
            >
              <div className="text-xs font-semibold flex items-center gap-1.5">
                <FolderPlus className="w-3.5 h-3.5 text-indigo-500" />
                New Collection
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                Create a new separate collection
              </div>
            </button>
          </div>

          {destinationMode === 'existing' ? (
            <div className="mt-2">
              <Select
                value={targetCollectionId || currentCollectionId || 'default'}
                onValueChange={(val) => setTargetCollectionId(val)}
              >
                <SelectTrigger className="w-full text-xs h-9 bg-white dark:bg-slate-950">
                  <SelectValue placeholder="Select target collection" />
                </SelectTrigger>
                <SelectContent>
                  {(collections && collections.length > 0 ? collections : [{ id: 'default', name: 'Default' }]).map(c => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      {c.name} {c.id === currentCollectionId ? '(active)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="mt-2">
              <Input
                id="collection-name"
                value={collectionName}
                onChange={(e) => setCollectionName(e.target.value)}
                placeholder="Enter new collection name..."
                className="text-xs h-9 bg-white dark:bg-slate-950"
              />
            </div>
          )}
        </div>

        {/* Request Preview with Checkboxes */}
        <div className="space-y-2">
          {/* List Header Controls */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={toggleSelectAll}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:text-blue-600 transition-colors"
              >
                {allSelected ? (
                  <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
                <span>Select All</span>
              </button>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 font-mono">
                ({selectedCount} of {processedRequests.length} selected)
              </span>
            </div>

            <div className="flex items-center gap-2">
              {selectedCount < processedRequests.length && (
                <button
                  type="button"
                  onClick={() => setSelectedRequestIds(new Set(processedRequests.map(r => r.id)))}
                  className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Select all
                </button>
              )}
              {selectedCount > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedRequestIds(new Set())}
                  className="text-[11px] text-slate-400 hover:text-red-500 hover:underline"
                >
                  Deselect all
                </button>
              )}
            </div>
          </div>

          {/* Request List */}
          <div className="max-h-72 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50/50 dark:bg-slate-900/50 divide-y divide-slate-200 dark:divide-slate-800">
            {processedRequests.map((request) => {
              const isSelected = selectedRequestIds.has(request.id);
              return (
                <div 
                  key={request.id} 
                  onClick={() => toggleRequestSelection(request.id)}
                  className={`flex items-center gap-3 p-2.5 cursor-pointer transition-colors ${
                    isSelected 
                      ? "bg-white dark:bg-slate-900 hover:bg-blue-50/30 dark:hover:bg-slate-850" 
                      : "bg-slate-50/40 dark:bg-slate-950/40 opacity-55 hover:opacity-80"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleRequestSelection(request.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-700 cursor-pointer shrink-0"
                  />
                  <Badge className={getMethodColor(request.method)} variant="outline">
                    {request.method}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-xs font-medium truncate ${isSelected ? "text-slate-800 dark:text-slate-200" : "text-slate-500 line-through"}`}>
                        {request.name}
                      </p>
                      {request.repeatCount && request.repeatCount > 1 && (
                        <span 
                          className="text-[10px] font-mono px-1.5 py-0.2 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 rounded border border-amber-300/70 dark:border-amber-800 shrink-0"
                          title={`Occurred ${request.repeatCount} times in HAR archive; only 1 entry imported.`}
                        >
                          {request.repeatCount}x in HAR
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate font-mono">{request.originalPath}</p>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 shrink-0">{request.originalDomain}</span>
                </div>
              );
            })}

            {processedRequests.length === 0 && (
              <div className="p-8 text-center text-sm text-slate-500">
                No matching requests found for your filter criteria.
              </div>
            )}
          </div>
        </div>

        {/* Import Button */}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={() => setImportState({ step: 'upload', progress: 0 })}>
            Back
          </Button>
          <Button 
            onClick={confirmImport}
            disabled={selectedCount === 0}
            className="bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-medium shadow-md"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Import {selectedCount} Request{selectedCount !== 1 ? 's' : ''}
          </Button>
        </div>
      </div>
    );
  };

  const renderCompleteStep = () => (
    <div className="space-y-6 text-center py-6">
      <div className="w-16 h-16 bg-gradient-to-r from-emerald-600 to-teal-700 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
        <CheckCircle className="w-8 h-8 text-white" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-1">Import Successful!</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {selectedRequestIds.size} requests have been imported into collection "{collectionName}"
        </p>
      </div>
    </div>
  );

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET': return 'border-emerald-500 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 font-mono text-[10px]';
      case 'POST': return 'border-blue-500 text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 font-mono text-[10px]';
      case 'PUT': return 'border-amber-500 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 font-mono text-[10px]';
      case 'DELETE': return 'border-rose-500 text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 font-mono text-[10px]';
      case 'PATCH': return 'border-purple-500 text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 font-mono text-[10px]';
      default: return 'border-slate-500 text-slate-700 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 font-mono text-[10px]';
    }
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      setOpen(newOpen);
      if (!newOpen) resetDialog();
    }}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Import HAR File
            <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              v2.0
            </Badge>
          </DialogTitle>
        </DialogHeader>
        
        <div className="mt-4">
          {importState.step === 'upload' && renderUploadStep()}
          {importState.step === 'processing' && renderProcessingStep()}
          {importState.step === 'preview' && renderPreviewStep()}
          {importState.step === 'complete' && renderCompleteStep()}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default HARImportDialog;
