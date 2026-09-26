import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Send, Copy, Trash2, Plus, Settings, HelpCircle, X, Search, Download, Upload, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Header from "./Header";
import CollectionsSidebar from "./CollectionsSidebar";
import RequestTabs from "./RequestTabs";
import ResponsePanel from "./ResponsePanel";
import HARImportDialog from "./HARImportDialog";
import TestLibrary from './TestLibrary';
import { ProcessedHARRequest } from "@/lib/harParser";
import { parseCurlCommand } from "@/lib/curlParser";

interface Header {
  key: string;
  value: string;
  enabled: boolean;
}

interface ApiRequest {
  id: string;
  name: string;
  method: string;
  url: string;
  headers: Header[];
  body: string;
  bodyType: 'none' | 'form-data' | 'x-www-form-urlencoded' | 'raw' | 'binary' | 'GraphQL';
  rawType: 'text' | 'json' | 'javascript' | 'html' | 'xml';
  collectionId?: string;
}

interface ApiResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: any;
  time: number;
  error?: string;
}

const REQUESTS_KEY = 'apicommander:requests';
const ACTIVE_ID_KEY = 'apicommander:activeRequestId';
const HISTORY_KEY = 'apicommander:history';

interface Collection {
  id: string;
  name: string;
}

const COLLECTIONS_KEY = 'apicommander:collections';
const ENVIRONMENTS_KEY = 'apicommander:environments';

interface Environment {
  id: string;
  name: string;
  variables: { key: string; value: string }[];
}

function getProxyEndpoint() {
  if (typeof window !== 'undefined' && (window as any).__SUPERDEBUG_SERVER_URL__) {
    return `${(window as any).__SUPERDEBUG_SERVER_URL__.replace(/\/+$/, '')}/proxy`;
  }
  if (typeof window !== 'undefined' && (window as any).SuperDebug && typeof (window as any).SuperDebug.getServerUrl === 'function') {
    return `${(window as any).SuperDebug.getServerUrl().replace(/\/+$/, '')}/proxy`;
  }
  try {
    const stored = localStorage.getItem('sdm_server_url');
    if (stored) return `${stored.replace(/\/+$/, '')}/proxy`;
  } catch (e) {}
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_PROXY_URL) {
    return import.meta.env.VITE_PROXY_URL;
  }
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    return `${window.location.origin}/proxy`;
  }
  return '/proxy';
}

const ApiTester = () => {
  const { toast } = useToast();
  
  // UI State
  const [showNewCollectionDialog, setShowNewCollectionDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showEnvironmentDialog, setShowEnvironmentDialog] = useState(false);
  const [showNewEnvironmentDialog, setShowNewEnvironmentDialog] = useState(false);
  const [showHelpDialog, setShowHelpDialog] = useState(false);
  const [showTestLibraryDialog, setShowTestLibraryDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newEnvironmentName, setNewEnvironmentName] = useState('');
  const [importData, setImportData] = useState('');

  // Server-side CORS Proxy & Server MITM Override State (default false)
  const [useServerProxy, setUseServerProxy] = useState<boolean>(false);
  const [serverOverride, setServerOverride] = useState<boolean>(false);
  const [serverApiKey, setServerApiKey] = useState<string>(() => {
    try {
      return localStorage.getItem('sdm_active_api_key') || '';
    } catch {
      return '';
    }
  });
  
  // Resizable Left Sidebar State
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const saved = localStorage.getItem('apicommander:sidebarWidth');
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed >= 200 && parsed <= 800) return parsed;
    }
    return 320;
  });
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);

  // Resizable Panel State
  const [responsePanelHeight, setResponsePanelHeight] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  const [isResponseCollapsed, setIsResponseCollapsed] = useState(false);
  const [previousHeight, setPreviousHeight] = useState(320);
  
  // Load requests and activeRequestId from localStorage if present
  const [collections, setCollections] = useState<Collection[]>(() => {
    const saved = localStorage.getItem(COLLECTIONS_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return [
      { id: 'default', name: 'Default' }
    ];
  });
  const [selectedCollectionId, setSelectedCollectionId] = useState('default');
  
  // Environment Variables
  const [environments, setEnvironments] = useState<Environment[]>(() => {
    const saved = localStorage.getItem(ENVIRONMENTS_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return [
      { id: 'default', name: 'Default', variables: [] }
    ];
  });
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState('default');

  const [requests, setRequests] = useState<ApiRequest[]>(() => {
    const saved = localStorage.getItem(REQUESTS_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return [
      {
        id: '1',
        name: 'Untitled Request',
        method: 'GET',
        url: '',
        headers: [{ key: '', value: '', enabled: true }],
        body: '',
        bodyType: 'none',
        rawType: 'json',
        collectionId: 'default'
      }
    ];
  });
  const [activeRequestId, setActiveRequestId] = useState(() => {
    const saved = localStorage.getItem(ACTIVE_ID_KEY);
    if (saved) return saved;
    return '1';
  });
  const [responses, setResponses] = useState<Record<string, ApiResponse>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [history, setHistory] = useState<any[]>(() => {
    const saved = localStorage.getItem(HISTORY_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return [];
  });

  const activeRequest = requests.find(r => r.id === activeRequestId) || requests[0];
  const activeResponse = responses[activeRequestId];
  const visibleRequests = requests.filter(r => r.collectionId === selectedCollectionId);
  const filteredRequests = searchTerm ? 
    visibleRequests.filter(r => 
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.url.toLowerCase().includes(searchTerm.toLowerCase())
    ) : visibleRequests;
  
  // Environment variable substitution
  const replaceVariables = (text: string): string => {
    const environment = environments.find(e => e.id === selectedEnvironmentId);
    if (!environment) return text;
    
    let result = text;
    environment.variables.forEach(variable => {
      const regex = new RegExp(`{{${variable.key}}}`, 'g');
      result = result.replace(regex, variable.value);
    });
    return result;
  };
  
  // Export collections
  const exportCollections = () => {
    const exportData = {
      collections,
      requests,
      environments,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `proxyceptor-collections-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({ title: "Exported", description: "Collections exported successfully" });
  };
  
  // Input validation
  const validateUrl = (url: string): boolean => {
    if (!url.trim()) return false;
    
    // Replace environment variables for validation
    const processedUrl = replaceVariables(url);
    
    try {
      new URL(processedUrl);
      return true;
    } catch {
      // Check if it's a valid relative URL pattern
      return /^(\/|https?:\/\/|{{[\w\s]+}})/.test(url);
    }
  };

  const validateRequest = (request: ApiRequest): string[] => {
    const errors: string[] = [];
    
    if (!request.url.trim()) {
      errors.push('URL is required');
    } else if (!validateUrl(request.url)) {
      errors.push('Invalid URL format');
    }
    
    // Validate headers
    request.headers.forEach((header, index) => {
      if (header.enabled && header.key && !header.value) {
        errors.push(`Header ${index + 1}: Value is required when key is provided`);
      }
    });
    
    return errors;
  };

  // Import collections
  const importCollections = () => {
    try {
      const data = JSON.parse(importData);
      
      if (data.collections) setCollections(prev => [...prev, ...data.collections.filter((c: Collection) => c.id !== 'default')]);
      if (data.requests) setRequests(prev => [...prev, ...data.requests]);
      if (data.environments) setEnvironments(prev => [...prev, ...data.environments.filter((e: Environment) => e.id !== 'default')]);
      
      setShowImportDialog(false);
      setImportData('');
      toast({ title: "Imported", description: "Collections imported successfully" });
    } catch (error) {
      toast({ title: "Error", description: "Invalid import data format", variant: "destructive" });
    }
  };

  // Persist collections to localStorage
  useEffect(() => {
    localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(collections));
  }, [collections]);
  // Persist environments to localStorage
  useEffect(() => {
    localStorage.setItem(ENVIRONMENTS_KEY, JSON.stringify(environments));
  }, [environments]);
  // Persist requests and activeRequestId to localStorage
  useEffect(() => {
    localStorage.setItem(REQUESTS_KEY, JSON.stringify(requests));
  }, [requests]);
  useEffect(() => {
    localStorage.setItem(ACTIVE_ID_KEY, activeRequestId);
  }, [activeRequestId]);
  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }, [history]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Enter or Cmd+Enter to send request
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        sendRequest(activeRequestId);
      }
      // Ctrl+N or Cmd+N to new request
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        addNewRequest();
      }
      // Ctrl+D or Cmd+D to duplicate request
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        duplicateRequest(activeRequestId);
      }
      // Ctrl+W or Cmd+W to close request
      if ((e.ctrlKey || e.metaKey) && e.key === 'w' && requests.length > 1) {
        e.preventDefault();
        closeRequest(activeRequestId);
      }
      // Ctrl+Shift+R or Cmd+Shift+R to toggle response panel
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'R') {
        e.preventDefault();
        handleDoubleClick();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeRequestId, requests.length]);

  // Resizable Panel Logic
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };

  const handleDoubleClick = () => {
    if (isResponseCollapsed) {
      setResponsePanelHeight(previousHeight);
      setIsResponseCollapsed(false);
    } else {
      setPreviousHeight(responsePanelHeight);
      setResponsePanelHeight(40); // Collapsed height
      setIsResponseCollapsed(true);
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || isResponseCollapsed) return;
      
      const container = document.querySelector('[data-right-panel]') as HTMLElement;
      if (!container) return;
      
      const containerRect = container.getBoundingClientRect();
      const newHeight = Math.round(containerRect.bottom - e.clientY);
      
      // Set min height (200px) and max height (80% of container)
      const minHeight = 200;
      const maxHeight = Math.floor(containerRect.height * 0.8);
      const clampedHeight = Math.round(Math.max(minHeight, Math.min(maxHeight, newHeight)));
      
      setResponsePanelHeight(clampedHeight);
      
      // If user starts resizing while collapsed, expand automatically
      if (isResponseCollapsed && clampedHeight > 100) {
        setIsResponseCollapsed(false);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, isResponseCollapsed]);

  // Persist sidebarWidth
  useEffect(() => {
    localStorage.setItem('apicommander:sidebarWidth', Math.round(sidebarWidth).toString());
  }, [sidebarWidth]);

  // Sidebar Resizing Logic
  const handleSidebarMouseDown = (e: React.MouseEvent) => {
    setIsResizingSidebar(true);
    e.preventDefault();
  };

  const handleSidebarDoubleClick = () => {
    setSidebarWidth(sidebarWidth === 320 ? 250 : 320);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingSidebar) return;
      const minWidth = 200;
      const maxWidth = Math.max(minWidth, Math.min(800, Math.floor(window.innerWidth * 0.6)));
      const newWidth = Math.round(Math.max(minWidth, Math.min(maxWidth, e.clientX)));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizingSidebar(false);
    };

    if (isResizingSidebar) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingSidebar]);

  const parseCurl = (curlCommand: string) => {
    try {
      const parsed = parseCurlCommand(curlCommand);

      // Fallback for URL if parser missed non-standard formatting
      if (!parsed.url) {
        const urlMatch = curlCommand.match(/(?:--url\s+)?['"]?(https?:\/\/[^\s'"]+)['"]?/);
        if (urlMatch) {
          parsed.url = urlMatch[1];
        }
      }

      const headers = [...parsed.headers];
      if (!headers.some((h) => !h.key)) {
        headers.push({ key: '', value: '', enabled: true });
      }

      let reqName = 'Imported cURL';
      if (parsed.url) {
        try {
          const u = new URL(parsed.url);
          const seg = u.pathname.split('/').filter(Boolean).pop();
          if (seg) reqName = seg;
        } catch {}
      }

      setRequests((prev) =>
        prev.map((req) =>
          req.id === activeRequestId
            ? {
                ...req,
                method: parsed.method || 'GET',
                url: parsed.url || '',
                headers,
                body: parsed.body || '',
                bodyType: parsed.bodyType || 'none',
                rawType: (parsed.rawType as any) || 'json',
                name: reqName,
              }
            : req
        )
      );

      toast({
        title: "Success",
        description: `cURL command parsed successfully! (${parsed.method || 'GET'} ${parsed.url ? parsed.url.slice(0, 45) + '...' : ''})`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to parse cURL command: " + (error?.message || ''),
        variant: "destructive",
      });
    }
  };

  const sendRequest = async (requestId: string) => {
    const request = requests.find(r => r.id === requestId);
    if (!request) return;
    
    // Validate request before sending
    const validationErrors = validateRequest(request);
    if (validationErrors.length > 0) {
      toast({
        title: "Validation Error",
        description: validationErrors[0],
        variant: "destructive"
      });
      return;
    }

    setLoading(prev => ({ ...prev, [requestId]: true }));
    const startTime = Date.now();

    try {
      // Replace environment variables in URL and headers
      const processedUrl = replaceVariables(request.url);
      const processedHeaders: Record<string, string> = {};
      
      request.headers.forEach(header => {
        if (header.enabled && header.key && header.value) {
          processedHeaders[replaceVariables(header.key)] = replaceVariables(header.value);
        }
      });

      const options: RequestInit = {
        method: request.method,
        headers: processedHeaders,
      };

      if (request.method !== 'GET' && request.method !== 'HEAD' && request.body && request.bodyType !== 'none') {
        // Process body with environment variables
        options.body = replaceVariables(request.body);
      }

      let resStatus = 0;
      let resStatusText = '';
      let resHeaders: Record<string, string> = {};
      let resData: any = null;

      let appliedRules: string[] = [];

      if (useServerProxy || serverOverride) {
        // Route through ProxyCeptor backend CORS proxy server-to-server with optional Server MITM
        const proxyUrl = getProxyEndpoint();
        const effectiveKey = serverApiKey || (typeof window !== 'undefined' ? localStorage.getItem('sdm_active_api_key') || '' : '');
        const proxyPayloadBody: any = {
          url: processedUrl,
          method: request.method,
          headers: processedHeaders,
          body: options.body,
        };

        if (serverOverride) {
          proxyPayloadBody.apiKey = effectiveKey;
          proxyPayloadBody.serverOverride = true;
        }

        const rawFetch = (typeof window !== 'undefined' && ((window as any).__superDebugOriginalFetch || (window as any).SuperDebug?.getOriginalFetch?.())) || fetch;
        const proxyRes = await rawFetch(proxyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(proxyPayloadBody),
        });
        const proxyPayload = await proxyRes.json();
        if (!proxyRes.ok || proxyPayload.status === 0 || proxyPayload.success === false) {
          throw new Error(proxyPayload.error || `Proxy error: ${proxyPayload.statusText || 'Server forward failed'}`);
        }
        resStatus = proxyPayload.status;
        resStatusText = proxyPayload.statusText || 'OK';
        resHeaders = proxyPayload.headers || {};
        resData = proxyPayload.data;
        if (Array.isArray(proxyPayload.rulesApplied)) {
          appliedRules = proxyPayload.rulesApplied;
        }
      } else {
        // Direct browser fetch
        const res = await fetch(processedUrl, options);
        resStatus = res.status;
        resStatusText = res.statusText;
        resHeaders = Object.fromEntries(res.headers.entries());
        resData = await res.json().catch(() => res.text());
      }

      setResponses(prev => ({
        ...prev,
        [requestId]: {
          status: resStatus,
          statusText: resStatusText,
          headers: resHeaders,
          data: resData,
          time: Date.now() - startTime
        }
      }));

      // Save to history
      setHistory(prev => [
        {
          id: Date.now().toString(),
          request: { ...request },
          response: {
            status: resStatus,
            statusText: resStatusText,
            headers: resHeaders,
            time: Date.now() - startTime
          },
          date: new Date().toISOString()
        },
        ...prev
      ].slice(0, 50)); // keep last 50

      const ruleNote = appliedRules.length > 0 ? ` â€¢ ${appliedRules.length} rule(s) applied` : '';
      toast({
        title: serverOverride 
          ? `Request Sent (via Server MITM Override${ruleNote})` 
          : (useServerProxy ? "Request Sent (via Server Proxy)" : "Request Sent"),
        description: `Response: ${resStatus} ${resStatusText}`
      });
    } catch (error) {
      setResponses(prev => ({
        ...prev,
        [requestId]: {
          status: 0,
          statusText: 'Error',
          headers: {},
          data: null,
          time: Date.now() - startTime,
          error: error instanceof Error ? error.message : "Failed to fetch"
        }
      }));

      setHistory(prev => [
        {
          id: Date.now().toString(),
          request: { ...request },
          response: {
            status: 0,
            statusText: 'Error',
            headers: {},
            time: Date.now() - startTime,
            error: error instanceof Error ? error.message : "Failed to fetch"
          },
          date: new Date().toISOString()
        },
        ...prev
      ].slice(0, 50));

      toast({
        title: "Request Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      });
    } finally {
      setLoading(prev => ({ ...prev, [requestId]: false }));
    }
  };

  const addNewRequest = () => {
    const newId = Date.now().toString();
    const newRequest: ApiRequest = {
      id: newId,
      name: 'Untitled Request',
      method: 'GET',
      url: '',
      headers: [{ key: '', value: '', enabled: true }],
      body: '',
      bodyType: 'none',
      rawType: 'json',
      collectionId: selectedCollectionId
    };
    setRequests(prev => [...prev, newRequest]);
    setActiveRequestId(newId);
  };
  
  const duplicateRequest = (requestId: string) => {
    const request = requests.find(r => r.id === requestId);
    if (request) {
      const newRequest = {
        ...request,
        id: Date.now().toString(),
        name: `${request.name} (Copy)`
      };
      setRequests(prev => [...prev, newRequest]);
      setActiveRequestId(newRequest.id);
      toast({ title: "Request duplicated", description: "Request copied successfully" });
    }
  };

  // Phase 2: HAR Import Handler
  const handleHARImport = (
    harRequests: ProcessedHARRequest[], 
    collectionName: string, 
    targetCollectionId?: string
  ) => {
    let collectionIdToUse = targetCollectionId;
    let finalCollectionName = collectionName;

    if (!collectionIdToUse || collectionIdToUse === '__new__') {
      collectionIdToUse = `har_${Date.now()}`;
      const newCollection: Collection = {
        id: collectionIdToUse,
        name: collectionName || `HAR Import ${new Date().toISOString().split('T')[0]}`
      };
      setCollections(prev => [...prev, newCollection]);
    } else {
      const existing = collections.find(c => c.id === collectionIdToUse);
      if (existing) {
        finalCollectionName = existing.name;
      }
    }

    // Convert HAR requests to ApiRequest format with the target collectionId
    const apiRequests: ApiRequest[] = harRequests.map(harReq => ({
      id: harReq.id,
      name: harReq.name,
      method: harReq.method,
      url: harReq.url,
      headers: harReq.headers,
      body: harReq.body,
      bodyType: harReq.bodyType,
      rawType: harReq.rawType,
      collectionId: collectionIdToUse
    }));

    // Add requests to the requests list
    setRequests(prev => [...prev, ...apiRequests]);

    // Switch to the target collection
    setSelectedCollectionId(collectionIdToUse);

    // Set the first imported request as active
    if (apiRequests.length > 0) {
      setActiveRequestId(apiRequests[0].id);
    }

    toast({
      title: "HAR Import Complete",
      description: `Imported ${apiRequests.length} requests into collection "${finalCollectionName}"`
    });
  };

  const closeRequest = (requestId: string) => {
    const currentIndex = requests.findIndex(r => r.id === requestId);
    const nextRequests = requests.filter(r => r.id !== requestId);
    
    if (nextRequests.length === 0) {
      const newId = Date.now().toString();
      const freshRequest: ApiRequest = {
        id: newId,
        name: 'Untitled Request',
        method: 'GET',
        url: '',
        headers: [{ key: '', value: '', enabled: true }],
        body: '',
        bodyType: 'none',
        rawType: 'json',
        collectionId: selectedCollectionId
      };
      setRequests([freshRequest]);
      setActiveRequestId(newId);
    } else {
      setRequests(nextRequests);
      if (activeRequestId === requestId) {
        const nextIndex = Math.max(0, Math.min(currentIndex, nextRequests.length - 1));
        setActiveRequestId(nextRequests[nextIndex]?.id || nextRequests[0].id);
      }
    }

    // Clean up response
    setResponses(prev => {
      const { [requestId]: _, ...rest } = prev;
      return rest;
    });
  };

  const closeOtherRequests = (keepId: string) => {
    const kept = requests.filter(r => r.id === keepId);
    if (kept.length > 0) {
      setRequests(kept);
      setActiveRequestId(keepId);
      setResponses(prev => ({ [keepId]: prev[keepId] }));
      toast({ title: "Tabs Closed", description: "All other tabs have been closed." });
    }
  };

  const closeAllRequests = () => {
    const newId = Date.now().toString();
    const freshRequest: ApiRequest = {
      id: newId,
      name: 'Untitled Request',
      method: 'GET',
      url: '',
      headers: [{ key: '', value: '', enabled: true }],
      body: '',
      bodyType: 'none',
      rawType: 'json',
      collectionId: selectedCollectionId
    };
    setRequests([freshRequest]);
    setActiveRequestId(newId);
    setResponses({});
    toast({ title: "Tabs Closed", description: "Opened fresh request." });
  };

  const deleteHistoryItem = (historyId: string) => {
    setHistory(prev => prev.filter(h => h.id !== historyId));
    toast({ title: "Deleted", description: "Request removed from history." });
  };

  const clearHistory = () => {
    setHistory([]);
    toast({ title: "History Cleared", description: "All request history has been cleared." });
  };

  const renameRequest = (requestId: string, newName: string) => {
    if (!newName.trim()) return;
    
    setRequests(prev => prev.map(req => 
      req.id === requestId 
        ? { ...req, name: newName.trim() }
        : req
    ));
  };

  const updateRequest = (field: keyof ApiRequest, value: any) => {
    setRequests(prev => prev.map(req => 
      req.id === activeRequestId 
        ? { ...req, [field]: value }
        : req
    ));
  };

  const addHeader = () => {
    const newHeaders = [...activeRequest.headers, { key: '', value: '', enabled: true }];
    updateRequest('headers', newHeaders);
  };

  const updateHeader = (index: number, field: keyof Header, value: string | boolean) => {
    const newHeaders = activeRequest.headers.map((header, i) => 
      i === index ? { ...header, [field]: value } : header
    );
    updateRequest('headers', newHeaders);
  };

  const removeHeader = (index: number) => {
    const newHeaders = activeRequest.headers.filter((_, i) => i !== index);
    updateRequest('headers', newHeaders);
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET': return 'text-success bg-success/10 border-success/20';
      case 'POST': return 'text-primary bg-primary/10 border-primary/20';
      case 'PUT': return 'text-warning bg-warning/10 border-warning/20';
      case 'DELETE': return 'text-error bg-error/10 border-error/20';
      case 'PATCH': return 'text-primary bg-primary/10 border-primary/20';
      default: return 'text-muted-foreground bg-muted border-border';
    }
  };

  // Get test statistics for a request
  const getTestStats = (requestId: string) => {
    try {
      const testCases = JSON.parse(localStorage.getItem('apicommander:testCases') || '[]');
      const requestTests = testCases.filter((tc: any) => tc.requestId === requestId || !tc.requestId); // Global tests for now
      const total = requestTests.length;
      const passed = requestTests.filter((tc: any) => tc.status === 'Pass').length;
      const failed = requestTests.filter((tc: any) => tc.status === 'Fail' || tc.status === 'Error').length;
      
      return { total, passed, failed };
    } catch {
      return { total: 0, passed: 0, failed: 0 };
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {/* Phase 3: Sleek Compact Header */}
      <Header onShowHelp={() => setShowHelpDialog(true)} />

      {/* Phase 3: Main Layout - Horizontal Split with Independent Panels */}
      <div className="flex h-[calc(100vh-60px)] overflow-hidden"> {/* Adjusted for compact header */}
        {/* Left Sidebar - Collections (Independent) */}
        <CollectionsSidebar
          width={sidebarWidth}
          collections={collections}
          environments={environments}
          selectedCollectionId={selectedCollectionId}
          selectedEnvironmentId={selectedEnvironmentId}
          searchTerm={searchTerm}
          requests={requests}
          visibleRequests={visibleRequests}
          history={history}
          onSelectCollection={setSelectedCollectionId}
          onSelectEnvironment={setSelectedEnvironmentId}
          onSearchChange={setSearchTerm}
          onNewCollection={() => setShowNewCollectionDialog(true)}
          onManageEnvironments={() => setShowEnvironmentDialog(true)}
          onImport={() => setShowImportDialog(true)}
          onExport={exportCollections}
          onHARImport={handleHARImport}
          onLoadFromHistory={(h) => {
            const newId = Date.now().toString();
            setRequests(prev => [...prev, { ...h.request, id: newId, name: h.request.name + ' (history)' }]);
            setActiveRequestId(newId);
          }}
          onDeleteHistoryItem={deleteHistoryItem}
          onClearHistory={clearHistory}
          onRenameCollection={(id, newName) => {
            setCollections(prev => prev.map(c => c.id === id ? { ...c, name: newName } : c));
          }}
          onDeleteCollection={(id) => {
            setRequests(prev => prev.map(req => 
              req.collectionId === id ? { ...req, collectionId: 'default' } : req
            ));
            setCollections(prev => prev.filter(c => c.id !== id));
            if (selectedCollectionId === id) setSelectedCollectionId('default');
          }}
          getMethodColor={getMethodColor}
        />

        {/* Resizable Divider between Left Sidebar and Right Panel */}
        <div
          onMouseDown={handleSidebarMouseDown}
          onDoubleClick={handleSidebarDoubleClick}
          className={`w-1.5 hover:w-2 active:w-2 transition-all cursor-col-resize select-none relative z-30 group flex items-center justify-center shrink-0 ${
            isResizingSidebar 
              ? 'bg-blue-600 shadow-sm' 
              : 'bg-slate-200/80 hover:bg-blue-400 dark:bg-slate-800 dark:hover:bg-blue-600'
          }`}
          title="Drag to resize partition â€¢ Double-click to reset"
        >
          <div className="absolute inset-y-0 -left-1 -right-1 cursor-col-resize" />
          <div className={`h-8 w-0.5 rounded-full transition-colors ${isResizingSidebar ? 'bg-white' : 'bg-slate-400 group-hover:bg-white'}`} />
          {/* Resize indicator tooltip badge - full integer only */}
          <div className={`absolute left-3 top-2 pointer-events-none transition-opacity ${isResizingSidebar ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
            <div className="text-xs text-white font-medium bg-black/75 px-2 py-1 rounded shadow whitespace-nowrap">
              {Math.round(sidebarWidth)}px
            </div>
          </div>
        </div>

        {/* Right Panel - Request Pane + Bottom Response */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden" data-right-panel>
          {/* Request Tabs Row */}
          <RequestTabs
            requests={filteredRequests}
            activeRequestId={activeRequestId}
            onSelectRequest={setActiveRequestId}
            onCloseRequest={closeRequest}
            onCloseOtherRequests={closeOtherRequests}
            onCloseAllRequests={closeAllRequests}
            onRenameRequest={renameRequest}
            onDuplicateRequest={duplicateRequest}
            onNewRequest={addNewRequest}
            getMethodColor={getMethodColor}
            getTestStats={getTestStats}
          />

          {/* Resizable Container */}
          <div className="flex-1 flex flex-col overflow-hidden" style={{ minHeight: 0 }}>
            {/* Request Content Area */}
            <div 
              className="bg-gradient-to-b from-white via-slate-50/30 to-blue-50/20 overflow-auto scrollbar-thin"
              style={{ height: `calc(100% - ${responsePanelHeight}px)`, minHeight: '200px' }}
            >
            {/* cURL Import Section */}
            <div className="p-4 border-b border-slate-200/60 bg-gradient-to-r from-blue-50/20 to-indigo-50/30">
            <div className="space-y-3">
              <Textarea
                placeholder="Paste your cURL command here..."
                className="min-h-[60px] bg-white/70 border-slate-200/60 focus:bg-white focus:border-slate-300"
                id="curl-input"
              />
              <Button 
                onClick={() => {
                  const textarea = document.getElementById('curl-input') as HTMLTextAreaElement;
                  if (textarea?.value) {
                    parseCurl(textarea.value);
                    textarea.value = '';
                  }
                }}
                className="bg-slate-600 hover:bg-slate-700 text-white"
                size="sm"
              >
                Import cURL
              </Button>
            </div>
          </div>

          {/* Request URL Bar */}
          <div className="p-4 border-b border-slate-200/60 bg-gradient-to-r from-white to-slate-50/40">
            <div className="flex gap-2">
              <Select 
                value={activeRequest.method} 
                onValueChange={(value) => updateRequest('method', value)}
              >
                <SelectTrigger className="w-24 border-slate-200/70 bg-white/80">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem>
                  <SelectItem value="DELETE">DELETE</SelectItem>
                  <SelectItem value="PATCH">PATCH</SelectItem>
                  <SelectItem value="HEAD">HEAD</SelectItem>
                  <SelectItem value="OPTIONS">OPTIONS</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="Enter request URL"
                value={activeRequest.url}
                onChange={(e) => updateRequest('url', e.target.value)}
                className="flex-1 bg-white/80 border-slate-200/70 focus:bg-white focus:border-slate-300"
              />
              <label 
                className="flex items-center gap-1.5 text-xs text-slate-700 select-none cursor-pointer px-2.5 py-1.5 rounded-md hover:bg-slate-100 transition-colors border border-slate-200/80 bg-white/90 shadow-sm"
                title="Route request through ProxyCeptor backend server to bypass browser CORS restrictions"
              >
                <input
                  type="checkbox"
                  checked={useServerProxy}
                  onChange={(e) => setUseServerProxy(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer w-3.5 h-3.5"
                />
                <span className="font-semibold whitespace-nowrap">Server Proxy</span>
              </label>

              <label 
                className={`flex items-center gap-1.5 text-xs select-none cursor-pointer px-2.5 py-1.5 rounded-md transition-colors border shadow-sm ${
                  serverOverride 
                    ? 'bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300' 
                    : 'bg-white/90 text-slate-700 border-slate-200/80 hover:bg-slate-100'
                }`}
                title="Server Side Resource Override (Server MITM): Loads DB rules for your API Key and applies rule matching/transforms directly on server"
              >
                <input
                  type="checkbox"
                  checked={serverOverride}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setServerOverride(checked);
                    if (checked) setUseServerProxy(true);
                  }}
                  className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer w-3.5 h-3.5"
                />
                <span className="font-semibold whitespace-nowrap">Server Override</span>
              </label>

              {serverOverride && (
                <Input
                  placeholder="API Key (sdm_live_...)"
                  value={serverApiKey}
                  onChange={(e) => {
                    const val = e.target.value;
                    setServerApiKey(val);
                    try { localStorage.setItem('sdm_active_api_key', val); } catch {}
                  }}
                  className="w-44 h-8 text-xs font-mono bg-white/90 border-purple-200 focus:border-purple-400"
                  title="ProxyCeptor API Key for DB Rule Lookup"
                />
              )}
              <Button 
                onClick={() => sendRequest(activeRequestId)}
                disabled={loading[activeRequestId] || !activeRequest.url}
                className="bg-slate-600 hover:bg-slate-700 text-white px-6"
                title="Send Request (Ctrl+Enter)"
              >
                {loading[activeRequestId] ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="params" className="w-full">
            <div className="px-4 border-b border-slate-200/60 bg-gradient-to-r from-slate-50/30 to-blue-50/20">
              <TabsList className="bg-transparent p-0 h-auto">
                <TabsTrigger 
                  value="params" 
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-slate-100 data-[state=active]:to-blue-50 data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-slate-600 rounded-none px-4 py-3 text-sm font-medium hover:bg-gradient-to-r hover:from-slate-50 hover:to-blue-50/50"
                >
                  Params
                </TabsTrigger>
                <TabsTrigger 
                  value="authorization"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-slate-100 data-[state=active]:to-blue-50 data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-slate-600 rounded-none px-4 py-3 text-sm font-medium hover:bg-gradient-to-r hover:from-slate-50 hover:to-blue-50/50"
                >
                  Authorization
                </TabsTrigger>
                <TabsTrigger 
                  value="headers"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-slate-100 data-[state=active]:to-blue-50 data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-slate-600 rounded-none px-4 py-3 text-sm font-medium hover:bg-gradient-to-r hover:from-slate-50 hover:to-blue-50/50"
                >
                  Headers ({activeRequest.headers.filter(h => h.key && h.value).length})
                </TabsTrigger>
                <TabsTrigger 
                  value="body"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-slate-100 data-[state=active]:to-blue-50 data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-slate-600 rounded-none px-4 py-3 text-sm font-medium hover:bg-gradient-to-r hover:from-slate-50 hover:to-blue-50/50"
                >
                  Body
                </TabsTrigger>
                <TabsTrigger 
                  value="scripts"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-slate-100 data-[state=active]:to-blue-50 data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-slate-600 rounded-none px-4 py-3 text-sm font-medium hover:bg-gradient-to-r hover:from-slate-50 hover:to-blue-50/50"
                >
                  Scripts
                </TabsTrigger>
                <TabsTrigger 
                  value="settings"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-slate-100 data-[state=active]:to-blue-50 data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-slate-600 rounded-none px-4 py-3 text-sm font-medium hover:bg-gradient-to-r hover:from-slate-50 hover:to-blue-50/50"
                >
                  Settings
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="params" className="p-4 m-0 bg-gradient-to-br from-white to-slate-50/30">
              <div className="text-slate-500 text-sm">
                Query parameters
              </div>
            </TabsContent>

            <TabsContent value="authorization" className="p-4 m-0 bg-gradient-to-br from-white to-slate-50/30">
              <div className="text-slate-500 text-sm">
                Authorization settings
              </div>
            </TabsContent>

            <TabsContent value="headers" className="p-4 m-0 space-y-3 bg-gradient-to-br from-white to-slate-50/30">
              <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 uppercase">
                <div className="col-span-5">Key</div>
                <div className="col-span-6">Value</div>
                <div className="col-span-1"></div>
              </div>
              {activeRequest.headers.map((header, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-center">
                  <Input
                    placeholder="Key"
                    value={header.key}
                    onChange={(e) => updateHeader(index, 'key', e.target.value)}
                    className="col-span-5 bg-white/80 border-slate-200/70 focus:bg-white focus:border-slate-300"
                  />
                  <Input
                    placeholder="Value"
                    value={header.value}
                    onChange={(e) => updateHeader(index, 'value', e.target.value)}
                    className="col-span-6 bg-white/80 border-slate-200/70 focus:bg-white focus:border-slate-300"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeHeader(index)}
                    disabled={activeRequest.headers.length === 1}
                    className="col-span-1 p-1 h-8 w-8"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="ghost"
                onClick={addHeader}
                className="text-orange-500 hover:text-orange-600 hover:bg-orange-50"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Header
              </Button>
            </TabsContent>

            <TabsContent value="body" className="p-0 m-0 bg-gradient-to-br from-white to-slate-50/30">
              <div className="p-4 border-b border-slate-200/60 bg-gradient-to-r from-slate-50/30 to-blue-50/20">
                <RadioGroup 
                  value={activeRequest.bodyType} 
                  onValueChange={(value: any) => updateRequest('bodyType', value)}
                  className="flex gap-6"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="none" id="none" />
                    <Label htmlFor="none" className="text-sm">none</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="form-data" id="form-data" />
                    <Label htmlFor="form-data" className="text-sm">form-data</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="x-www-form-urlencoded" id="x-www-form-urlencoded" />
                    <Label htmlFor="x-www-form-urlencoded" className="text-sm">x-www-form-urlencoded</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="raw" id="raw" />
                    <Label htmlFor="raw" className="text-sm">raw</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="binary" id="binary" />
                    <Label htmlFor="binary" className="text-sm">binary</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="GraphQL" id="GraphQL" />
                    <Label htmlFor="GraphQL" className="text-sm">GraphQL</Label>
                  </div>
                </RadioGroup>
                
                {activeRequest.bodyType === 'raw' && (
                  <div className="mt-4 flex justify-end">
                    <Select 
                      value={activeRequest.rawType} 
                      onValueChange={(value: any) => updateRequest('rawType', value)}
                    >
                      <SelectTrigger className="w-32 border-gray-300">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">Text</SelectItem>
                        <SelectItem value="json">JSON</SelectItem>
                        <SelectItem value="javascript">JavaScript</SelectItem>
                        <SelectItem value="html">HTML</SelectItem>
                        <SelectItem value="xml">XML</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              
              {activeRequest.bodyType !== 'none' && (
                <div className="relative bg-gradient-to-br from-white to-slate-50/20">
                  <div className="absolute top-3 left-3 text-xs text-slate-400 font-mono">
                    {Array.from({ length: 20 }, (_, i) => (
                      <div key={i + 1} className="leading-5">{i + 1}</div>
                    ))}
                  </div>
                  <Textarea
                    placeholder={activeRequest.bodyType === 'raw' && activeRequest.rawType === 'json' ? '{\n    "key": "value"\n}' : 'Enter request body...'}
                    value={activeRequest.body}
                    onChange={(e) => updateRequest('body', e.target.value)}
                    className="min-h-[300px] pl-12 font-mono text-sm border-0 border-t border-slate-200/60 rounded-none resize-none focus:ring-0 bg-white/70 focus:bg-white"
                  />
                </div>
              )}
            </TabsContent>

            <TabsContent value="scripts" className="p-4 m-0 bg-gradient-to-br from-white to-slate-50/30">
              <div className="text-slate-500 text-sm">
                Pre-request and test scripts
              </div>
            </TabsContent>

            <TabsContent value="settings" className="p-4 m-0 bg-gradient-to-br from-white to-slate-50/30">
              <div className="text-slate-500 text-sm">
                Request settings
              </div>
            </TabsContent>
          </Tabs>
            </div>

            {/* Resizer Bar */}
            <div 
              className={`h-2 bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200 hover:from-blue-400 hover:via-blue-500 hover:to-blue-400 cursor-row-resize flex items-center justify-center relative group transition-all duration-200 border-y border-slate-300 ${
                isResizing ? 'from-blue-500 via-blue-600 to-blue-500 shadow-lg' : ''
              }`}
              onMouseDown={handleMouseDown}
              onDoubleClick={handleDoubleClick}
              style={{ userSelect: 'none' }}
              title="Drag to resize â€¢ Double-click to collapse/expand"
            >
              {/* Visual grip indicator */}
              <div className="flex gap-1">
                <div className="w-6 h-0.5 bg-slate-500 group-hover:bg-white transition-colors rounded-full"></div>
                <div className="w-6 h-0.5 bg-slate-500 group-hover:bg-white transition-colors rounded-full"></div>
              </div>
              
              {/* Resize cursor indicator */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="text-xs text-white font-medium bg-black/70 px-2 py-1 rounded pointer-events-none">
                  {isResponseCollapsed ? 'Expand' : `${Math.round(responsePanelHeight)}px`}
                </div>
              </div>
            </div>

            {/* Resizable Response Panel */}
            <div style={{ height: `${Math.round(responsePanelHeight)}px`, minHeight: isResponseCollapsed ? '40px' : '200px' }}>
              {isResponseCollapsed ? (
                <div className="h-full bg-white border-t-2 border-slate-300 flex items-center justify-center">
                  <div className="text-slate-500 text-sm">
                    Response panel collapsed - Double-click resize bar to expand
                  </div>
                </div>
              ) : (
                <ResponsePanel
                  activeRequest={activeRequest}
                  activeResponse={activeResponse}
                  getMethodColor={getMethodColor}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <Dialog open={showNewCollectionDialog} onOpenChange={setShowNewCollectionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Collection</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="collection-name">Collection Name</Label>
              <Input
                id="collection-name"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                placeholder="Enter collection name"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowNewCollectionDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => {
                  if (newCollectionName.trim()) {
                    const id = Date.now().toString();
                    setCollections(prev => [...prev, { id, name: newCollectionName.trim() }]);
                    setNewCollectionName('');
                    setShowNewCollectionDialog(false);
                  }
                }}
              >
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Collections</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="import-data">Paste JSON data</Label>
              <Textarea
                id="import-data"
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                placeholder="Paste your exported JSON here..."
                className="min-h-[200px]"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowImportDialog(false)}>
                Cancel
              </Button>
              <Button onClick={importCollections}>
                Import
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Environment Management Dialog */}
      <Dialog open={showEnvironmentDialog} onOpenChange={setShowEnvironmentDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage Environments</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {environments.map(env => (
              <div key={env.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium">{env.name}</h3>
                  {env.id !== 'default' && (
                    <Button 
                      size="sm" 
                      variant="destructive"
                      onClick={() => {
                        setEnvironments(prev => prev.filter(e => e.id !== env.id));
                        if (selectedEnvironmentId === env.id) setSelectedEnvironmentId('default');
                      }}
                    >
                      Delete
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  {env.variables.map((variable, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        placeholder="Variable name"
                        value={variable.key}
                        onChange={(e) => {
                          const newVariables = [...env.variables];
                          newVariables[index] = { ...variable, key: e.target.value };
                          setEnvironments(prev => prev.map(e => 
                            e.id === env.id ? { ...e, variables: newVariables } : e
                          ));
                        }}
                      />
                      <Input
                        placeholder="Variable value"
                        value={variable.value}
                        onChange={(e) => {
                          const newVariables = [...env.variables];
                          newVariables[index] = { ...variable, value: e.target.value };
                          setEnvironments(prev => prev.map(e => 
                            e.id === env.id ? { ...e, variables: newVariables } : e
                          ));
                        }}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const newVariables = env.variables.filter((_, i) => i !== index);
                          setEnvironments(prev => prev.map(e => 
                            e.id === env.id ? { ...e, variables: newVariables } : e
                          ));
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const newVariables = [...env.variables, { key: '', value: '' }];
                      setEnvironments(prev => prev.map(e => 
                        e.id === env.id ? { ...e, variables: newVariables } : e
                      ));
                    }}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Variable
                  </Button>
                </div>
              </div>
            ))}
            <Button
              onClick={() => setShowNewEnvironmentDialog(true)}
            >
              <Plus className="w-4 h-4 mr-1" />
              New Environment
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* New Environment Dialog */}
      <Dialog open={showNewEnvironmentDialog} onOpenChange={setShowNewEnvironmentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Environment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="environment-name">Environment Name</Label>
              <Input
                id="environment-name"
                value={newEnvironmentName}
                onChange={(e) => setNewEnvironmentName(e.target.value)}
                placeholder="Enter environment name"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowNewEnvironmentDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => {
                  if (newEnvironmentName.trim()) {
                    const id = Date.now().toString();
                    setEnvironments(prev => [...prev, { id, name: newEnvironmentName.trim(), variables: [] }]);
                    setNewEnvironmentName('');
                    setShowNewEnvironmentDialog(false);
                  }
                }}
              >
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Help Dialog */}
      <Dialog open={showHelpDialog} onOpenChange={setShowHelpDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-violet-600" />
              ProxyCeptor Commander â€” Help &amp; Keyboard Shortcuts
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {/* Keyboard Shortcuts Section */}
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-3">âŒ¨ï¸ Keyboard Shortcuts</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex items-center justify-between p-3 bg-gradient-to-r from-slate-50 to-blue-50 rounded-md">
                  <span className="text-sm text-slate-700">Send Request</span>
                  <kbd className="px-2 py-1 bg-slate-200 text-slate-800 rounded text-xs font-mono">Ctrl+Enter</kbd>
                </div>
                <div className="flex items-center justify-between p-3 bg-gradient-to-r from-slate-50 to-blue-50 rounded-md">
                  <span className="text-sm text-slate-700">New Request</span>
                  <kbd className="px-2 py-1 bg-slate-200 text-slate-800 rounded text-xs font-mono">Ctrl+N</kbd>
                </div>
                <div className="flex items-center justify-between p-3 bg-gradient-to-r from-slate-50 to-blue-50 rounded-md">
                  <span className="text-sm text-slate-700">Duplicate Request</span>
                  <kbd className="px-2 py-1 bg-slate-200 text-slate-800 rounded text-xs font-mono">Ctrl+D</kbd>
                </div>
                <div className="flex items-center justify-between p-3 bg-gradient-to-r from-slate-50 to-blue-50 rounded-md">
                  <span className="text-sm text-slate-700">Focus URL Bar</span>
                  <kbd className="px-2 py-1 bg-slate-200 text-slate-800 rounded text-xs font-mono">Ctrl+L</kbd>
                </div>
              </div>
            </div>

            {/* Getting Started Section */}
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-3">ðŸš€ Getting Started</h3>
              <div className="space-y-3">
                <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-md border border-blue-100">
                  <h4 className="font-medium text-slate-800 mb-2">1. Create Your First Request</h4>
                  <p className="text-sm text-slate-600">Click the "+" button or press Ctrl+N to create a new request. Enter your API URL and select the HTTP method.</p>
                </div>
                <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-md border border-blue-100">
                  <h4 className="font-medium text-slate-800 mb-2">2. Configure Headers & Body</h4>
                  <p className="text-sm text-slate-600">Use the tabs below to add headers, request body, and other configurations. Headers support auto-completion.</p>
                </div>
                <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-md border border-blue-100">
                  <h4 className="font-medium text-slate-800 mb-2">3. Organize with Collections</h4>
                  <p className="text-sm text-slate-600">Group related requests in collections for better organization. Create collections from the sidebar.</p>
                </div>
              </div>
            </div>

            {/* Features Section */}
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-3">âœ¨ Key Features</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 bg-gradient-to-r from-slate-50 to-blue-50 rounded-md">
                  <h4 className="font-medium text-slate-800 mb-1">ðŸ”’ 100% Local & Private</h4>
                  <p className="text-xs text-slate-600">All data stays on your device. No cloud dependencies.</p>
                </div>
                <div className="p-3 bg-gradient-to-r from-slate-50 to-blue-50 rounded-md">
                  <h4 className="font-medium text-slate-800 mb-1">âš¡ Lightning Fast</h4>
                  <p className="text-xs text-slate-600">16x faster than traditional API testing tools.</p>
                </div>
                <div className="p-3 bg-gradient-to-r from-slate-50 to-blue-50 rounded-md">
                  <h4 className="font-medium text-slate-800 mb-1">ðŸ“‹ cURL Import</h4>
                  <p className="text-xs text-slate-600">Paste cURL commands to quickly import requests.</p>
                </div>
                <div className="p-3 bg-gradient-to-r from-slate-50 to-blue-50 rounded-md">
                  <h4 className="font-medium text-slate-800 mb-1">ðŸŒ Environment Variables</h4>
                  <p className="text-xs text-slate-600">Use variables for different environments (dev, staging, prod).</p>
                </div>
              </div>
            </div>

            {/* Tips Section */}
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-3">ðŸ’¡ Pro Tips</h3>
              <div className="space-y-2">
                <div className="flex items-start gap-3 p-3 bg-gradient-to-r from-amber-50 to-orange-50 rounded-md">
                  <span className="text-amber-600 mt-0.5">ðŸ’¡</span>
                  <div>
                    <p className="text-sm text-slate-700"><strong>Environment Variables:</strong> Use {`{{variable_name}}`} in URLs and headers for dynamic values.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-gradient-to-r from-emerald-50 to-green-50 rounded-md">
                  <span className="text-emerald-600 mt-0.5">âš¡</span>
                  <div>
                    <p className="text-sm text-slate-700"><strong>Quick Send:</strong> Press Ctrl+Enter from anywhere to send the current request.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-md">
                  <span className="text-blue-600 mt-0.5">ðŸ“</span>
                  <div>
                    <p className="text-sm text-slate-700"><strong>Organization:</strong> Use collections to group related APIs and keep your workspace clean.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Version Info */}
            <div className="pt-4 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-gradient-to-br from-violet-600 via-indigo-600 to-cyan-500 rounded flex items-center justify-center shadow-sm">
                    <Send className="w-3 h-3 text-white" />
                  </div>
                  <span className="font-semibold text-slate-800">ProxyCeptor Commander v2.0.0</span>
                </div>
                <p className="text-xs text-slate-500">Integrated with ProxyCeptor Cloud &amp; SuperDebug</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ApiTester;
