import React, { useState, useEffect, useMemo, useCallback, memo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Download, Search, Maximize2, Code, FileText, Clock, Info, ChevronDown, ChevronUp, Play } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ModernJsonViewer } from "./ModernJsonViewer";

interface ApiRequest {
  id: string;
  name: string;
  method: string;
  url: string;
  headers: Array<{ key: string; value: string; enabled: boolean }>;
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

interface TestCase {
  id: string;
  name: string;
  assertion: string;
  status: 'Pass' | 'Fail' | 'Pending' | 'Error' | 'Running';
  selected: boolean;
  description?: string;
  tags?: string[];
  lastRun?: Date;
  error?: string;
}

const TEST_CASES_KEY = 'apicommander:testCases';

// Test Templates
const getTestTemplates = (response?: ApiResponse) => {
  const templates = [
    {
      name: 'Status Code Check',
      assertion: response ? `status === ${response.status}` : 'status === 200',
      description: 'Verify the HTTP status code',
      category: 'basic'
    },
    {
      name: 'Response Time',
      assertion: response ? `time < ${Math.max(1000, Math.ceil(response.time * 1.5))}` : 'time < 1000',
      description: 'Check response time performance',
      category: 'performance'
    },
    {
      name: 'Has Data',
      assertion: 'data !== null && data !== undefined',
      description: 'Verify response contains data',
      category: 'basic'
    },
    {
      name: 'Is JSON',
      assertion: 'typeof data === "object"',
      description: 'Verify response is valid JSON',
      category: 'structure'
    },
    {
      name: 'Has Required Fields',
      assertion: 'data && Object.keys(data).length > 0',
      description: 'Check if response has required fields',
      category: 'structure'
    },
    {
      name: 'Array Response',
      assertion: 'Array.isArray(data)',
      description: 'Verify response is an array',
      category: 'structure'
    }
  ];

  return templates;
};

const TestResultView = memo(({ activeResponse }: { activeResponse?: ApiResponse }) => {
  const { toast } = useToast();
  
  // Load test cases from localStorage
  const [testCases, setTestCases] = useState<TestCase[]>(() => {
    const saved = localStorage.getItem(TEST_CASES_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return [];
  });

  const [isExpanded, setIsExpanded] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [newTestCase, setNewTestCase] = useState({
    name: '',
    assertion: '',
    description: ''
  });

  // Persist test cases to localStorage
  useEffect(() => {
    localStorage.setItem(TEST_CASES_KEY, JSON.stringify(testCases));
  }, [testCases]);

  // Calculate test summary
  const testSummary = useMemo(() => {
    const total = testCases.length;
    const passed = testCases.filter(tc => tc.status === 'Pass').length;
    const failed = testCases.filter(tc => tc.status === 'Fail').length;
    const pending = testCases.filter(tc => tc.status === 'Pending').length;
    return { total, passed, failed, pending };
  }, [testCases]);

  // Quick test execution
  const runQuickTest = (template: ReturnType<typeof getTestTemplates>[0]) => {
    if (!activeResponse) {
      toast({ title: "No Response", description: "Send a request first to run tests", variant: "destructive" });
      return;
    }

    setIsRunning(true);
    
    const newTest: TestCase = {
      id: Date.now().toString(),
      name: template.name,
      assertion: template.assertion,
      status: 'Running',
      selected: false,
      description: template.description,
      tags: [template.category]
    };

    // Add test immediately for visual feedback
    setTestCases(prev => [...prev, newTest]);

    // Execute test after short delay
    setTimeout(() => {
      try {
        const context = {
          response: activeResponse,
          status: activeResponse.status,
          data: activeResponse.data,
          headers: activeResponse.headers,
          time: activeResponse.time
        };

        const result = new Function('response', 'status', 'data', 'headers', 'time', 
          `return ${template.assertion}`)(
          context.response, context.status, context.data, context.headers, context.time
        );

        setTestCases(prev => prev.map(tc => 
          tc.id === newTest.id ? { 
            ...tc, 
            status: result ? 'Pass' : 'Fail',
            lastRun: new Date(),
            error: undefined
          } : tc
        ));

        toast({ 
          title: result ? "Test Passed" : "Test Failed", 
          description: `${template.name}: ${result ? 'PASS' : 'FAIL'}`,
          variant: result ? "default" : "destructive"
        });
      } catch (error) {
        setTestCases(prev => prev.map(tc => 
          tc.id === newTest.id ? { 
            ...tc, 
            status: 'Error',
            lastRun: new Date(),
            error: error instanceof Error ? error.message : 'Unknown error'
          } : tc
        ));

        toast({ 
          title: "Test Error", 
          description: `${template.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          variant: "destructive"
        });
      }
      setIsRunning(false);
    }, 100);
  };

  // Create new test case
  const createNewTestCase = () => {
    if (!newTestCase.name.trim() || !newTestCase.assertion.trim()) {
      toast({ title: "Validation Error", description: "Name and assertion are required", variant: "destructive" });
      return;
    }

    const testCase: TestCase = {
      id: Date.now().toString(),
      name: newTestCase.name.trim(),
      assertion: newTestCase.assertion.trim(),
      description: newTestCase.description.trim(),
      status: 'Pending',
      selected: false,
      lastRun: new Date()
    };

    setTestCases(prev => [...prev, testCase]);
    setNewTestCase({ name: '', assertion: '', description: '' });
    setShowCreateModal(false);
    toast({ title: "Test Case Created", description: `"${testCase.name}" added successfully` });
  };

  // Run single test
  const runSingleTest = (testCase: TestCase) => {
    if (!activeResponse) {
      toast({ title: "No Response", description: "Send a request first to run tests", variant: "destructive" });
      return;
    }

    setTestCases(prev => prev.map(tc => 
      tc.id === testCase.id ? { ...tc, status: 'Running' } : tc
    ));

    setTimeout(() => {
      try {
        const context = {
          response: activeResponse,
          status: activeResponse.status,
          data: activeResponse.data,
          headers: activeResponse.headers,
          time: activeResponse.time
        };

        const result = new Function('response', 'status', 'data', 'headers', 'time', 
          `return ${testCase.assertion}`)(
          context.response, context.status, context.data, context.headers, context.time
        );

        setTestCases(prev => prev.map(tc => 
          tc.id === testCase.id ? { 
            ...tc, 
            status: result ? 'Pass' : 'Fail',
            lastRun: new Date(),
            error: undefined
          } : tc
        ));

        toast({ 
          title: result ? "Test Passed" : "Test Failed", 
          description: `${testCase.name}: ${result ? 'PASS' : 'FAIL'}`,
          variant: result ? "default" : "destructive"
        });
      } catch (error) {
        setTestCases(prev => prev.map(tc => 
          tc.id === testCase.id ? { 
            ...tc, 
            status: 'Error',
            lastRun: new Date(),
            error: error instanceof Error ? error.message : 'Unknown error'
          } : tc
        ));

        toast({ 
          title: "Test Error", 
          description: `${testCase.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          variant: "destructive"
        });
      }
    }, 100);
  };

  // Delete test case
  const deleteTestCase = (id: string) => {
    setTestCases(prev => prev.filter(tc => tc.id !== id));
    toast({ title: "Test Case Deleted", description: "Test case removed" });
  };

  // Get status indicator
  const getStatusIndicator = () => {
    if (testSummary.total === 0) return '○';
    if (testSummary.failed > 0) return '●';
    if (testSummary.passed === testSummary.total) return '●';
    return '◐';
  };

  const getStatusColor = () => {
    if (testSummary.total === 0) return 'text-slate-400';
    if (testSummary.failed > 0) return 'text-red-500';
    if (testSummary.passed === testSummary.total) return 'text-green-500';
    return 'text-yellow-500';
  };

  // Minimal inline view (collapsed state)
  if (!isExpanded) {
    return (
      <div className="bg-white border-t border-slate-200 px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Left: Test Status Summary */}
          <div className="flex items-center space-x-3">
            <div className={`text-lg ${getStatusColor()}`}>
              {getStatusIndicator()}
            </div>
            
            {testSummary.total > 0 ? (
              <div className="text-sm">
                <span className="font-medium text-slate-900">
                  Tests: {testSummary.passed}/{testSummary.total} passed
                </span>
                {testSummary.failed > 0 && (
                  <span className="text-red-500 ml-2">
                    {testSummary.failed} failed
                  </span>
                )}
              </div>
            ) : (
              <span className="text-sm text-slate-500">No tests yet</span>
            )}
          </div>

          {/* Right: Quick Actions */}
          <div className="flex items-center space-x-2">
            {/* Quick Test Buttons */}
            {activeResponse && (
              <>
                <Button
                  onClick={() => runQuickTest({
                    name: 'Status Check',
                    assertion: `status === ${activeResponse.status}`,
                    description: 'Verify HTTP status code',
                    category: 'basic'
                  })}
                  disabled={isRunning}
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                >
                  ✓ Status
                </Button>
                <Button
                  onClick={() => runQuickTest({
                    name: 'Has Data',
                    assertion: 'data !== null && data !== undefined',
                    description: 'Verify response has data',
                    category: 'basic'
                  })}
                  disabled={isRunning}
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                >
                  ✓ Data
                </Button>
              </>
            )}

            {/* Action Buttons */}
            <Button
              onClick={() => setShowCreateModal(true)}
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
            >
              + Test
            </Button>
            
            <Button
              onClick={() => setIsExpanded(true)}
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
            >
              Details <ChevronDown className="w-3 h-3 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Expanded view (compact but scrollable)
  return (
    <div className="bg-white border-t border-slate-200">
      {/* Compact Header */}
      <div className="px-4 py-2 bg-slate-50 border-b flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className="text-sm font-medium text-slate-900">Test Results</span>
          <span className={`text-sm ${getStatusColor()}`}>
            {testSummary.passed}/{testSummary.total} passed
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            onClick={() => setShowCreateModal(true)}
            size="sm"
            className="h-7 px-3 text-xs bg-blue-600 hover:bg-blue-700"
          >
            + Create Test
          </Button>
          <Button
            onClick={() => setIsExpanded(false)}
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-slate-500 hover:text-slate-700"
          >
            <ChevronUp className="w-3 h-3" /> Collapse
          </Button>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="max-h-80 overflow-y-auto scrollbar-thin smooth-scroll">
        {/* Quick Tests Section - Compact Grid */}
        {activeResponse && (
          <div className="p-3 border-b border-slate-100">
            <div className="text-xs text-slate-600 mb-2 font-medium">Quick Tests:</div>
            <div className="grid grid-cols-2 gap-2">
              {getTestTemplates(activeResponse).slice(0, 4).map((template, idx) => (
                <button
                  key={idx}
                  onClick={() => runQuickTest(template)}
                  disabled={isRunning}
                  className="p-2 text-xs border border-slate-200 rounded-md hover:border-blue-300 hover:bg-blue-50 transition-colors text-left group"
                >
                  <div className="font-medium text-slate-900 group-hover:text-blue-700">
                    {template.name}
                  </div>
                  <div className="text-slate-500 text-xs mt-1 font-mono">
                    {template.assertion}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Test Cases List - Compact */}
        {testCases.length > 0 && (
          <div className="p-3">
            <div className="text-xs text-slate-600 mb-2 font-medium">
              Test Cases ({testCases.length}):
            </div>
            <div className="space-y-2">
              {testCases.map((test) => (
                <div key={test.id} className="flex items-center justify-between p-2 border border-slate-200 rounded-md hover:bg-slate-50 group">
                  <div className="flex items-center space-x-2 flex-1 min-w-0">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      test.status === 'Pass' ? 'bg-green-500' :
                      test.status === 'Fail' ? 'bg-red-500' :
                      test.status === 'Running' ? 'bg-blue-500 animate-pulse' :
                      'bg-slate-300'
                    }`} />
                    <span className="text-sm text-slate-900 font-medium truncate">
                      {test.name}
                    </span>
                    <code className="text-xs text-slate-500 bg-slate-100 px-1 rounded truncate flex-1">
                      {test.assertion}
                    </code>
                  </div>
                  <div className="flex items-center space-x-1 flex-shrink-0">
                    {test.lastRun && (
                      <span className="text-xs text-slate-400">
                        {new Date(test.lastRun).toLocaleTimeString()}
                      </span>
                    )}
                    <Button
                      onClick={() => runSingleTest(test)}
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-slate-500 hover:text-blue-600"
                      disabled={test.status === 'Running'}
                    >
                      <Play className="w-3 h-3" />
                    </Button>
                    <Button
                      onClick={() => deleteTestCase(test.id)}
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-slate-500 hover:text-red-600 opacity-0 group-hover:opacity-100"
                    >
                      ×
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {testCases.length === 0 && (
          <div className="p-6 text-center text-slate-500">
            <div className="text-sm">No tests created yet</div>
            <div className="text-xs mt-1">
              Use quick tests above or create custom tests
            </div>
          </div>
        )}
      </div>

      {/* Create Test Modal - Compact */}
      {showCreateModal && (
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg">Create New Test</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="test-name" className="text-sm font-medium">Test Name</Label>
                <Input
                  id="test-name"
                  value={newTestCase.name}
                  onChange={(e) => setNewTestCase(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Status Check, Response Time"
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="test-assertion" className="text-sm font-medium">Assertion</Label>
                <Textarea
                  id="test-assertion"
                  value={newTestCase.assertion}
                  onChange={(e) => setNewTestCase(prev => ({ ...prev, assertion: e.target.value }))}
                  placeholder="e.g., status === 200, data.length > 0"
                  className="mt-1 font-mono text-sm"
                  rows={3}
                />
                <div className="text-xs text-slate-500 mt-1">
                  Available: response, status, data, headers, time
                </div>
              </div>

              <div>
                <Label htmlFor="test-description" className="text-sm font-medium">Description (Optional)</Label>
                <Input
                  id="test-description"
                  value={newTestCase.description}
                  onChange={(e) => setNewTestCase(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="What does this test verify?"
                  className="mt-1"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                  className="text-sm"
                >
                  Cancel
                </Button>
                <Button
                  onClick={createNewTestCase}
                  className="text-sm"
                >
                  Save Test
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
});

interface ResponsePanelProps {
  activeRequest: ApiRequest;
  activeResponse?: ApiResponse;
  getMethodColor: (method: string) => string;
}

const ResponsePanel = memo<ResponsePanelProps>(({
  activeRequest,
  activeResponse,
  getMethodColor,
}) => {
  const { toast } = useToast();

  // Memoize helper functions to prevent recreation on every render
  const formatJSON = useCallback((data: any) => {
    if (!data) return 'No content';
    try {
      return JSON.stringify(data, null, 2);
    } catch (e) {
      return String(data);
    }
  }, []);

  // Memoize response size calculation
  const getResponseSize = useCallback((data: any) => {
    if (!data) return '0 B';
    const str = JSON.stringify(data);
    const bytes = new Blob([str]).size;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }, []);

  // Memoize content type extraction
  const getContentType = useCallback((headers: Record<string, string>) => {
    return headers['content-type'] || headers['Content-Type'] || 'Unknown';
  }, []);

  // Memoize cookies extraction
  const getCookies = useCallback((headers: Record<string, string>) => {
    const setCookieHeaders = Object.entries(headers)
      .filter(([key]) => key.toLowerCase() === 'set-cookie')
      .map(([, value]) => value);
    
    return setCookieHeaders.length > 0 ? setCookieHeaders : [];
  }, []);

  // Memoize event handlers
  const handleCopyResponse = useCallback(() => {
    const content = activeResponse?.data ? formatJSON(activeResponse.data) : '';
    navigator.clipboard.writeText(content);
    toast({ title: "Copied", description: "Response copied to clipboard" });
  }, [activeResponse?.data, formatJSON, toast]);

  const handleDownloadResponse = useCallback(() => {
    const content = activeResponse?.data ? formatJSON(activeResponse.data) : '';
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'response.json';
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Downloaded", description: "Response saved as JSON file" });
  }, [activeResponse?.data, formatJSON, toast]);

  const handleCopyHeaders = useCallback(() => {
    if (!activeResponse) return;
    const content = Object.entries(activeResponse.headers)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
    navigator.clipboard.writeText(content);
    toast({ title: "Copied", description: "Headers copied to clipboard" });
  }, [activeResponse, toast]);

  const handleCopyCookies = useCallback(() => {
    if (!activeResponse) return;
    const content = getCookies(activeResponse.headers).join('\n');
    navigator.clipboard.writeText(content);
    toast({ title: "Copied", description: "Cookies copied to clipboard" });
  }, [activeResponse, getCookies, toast]);

  // Memoize computed values
  const responseSize = useMemo(() => 
    activeResponse?.data ? getResponseSize(activeResponse.data) : '0 B', 
    [activeResponse?.data, getResponseSize]
  );

  const contentType = useMemo(() => 
    activeResponse?.headers ? getContentType(activeResponse.headers) : 'Unknown',
    [activeResponse?.headers, getContentType]
  );

  const cookies = useMemo(() => 
    activeResponse?.headers ? getCookies(activeResponse.headers) : [],
    [activeResponse?.headers, getCookies]
  );

  const propertiesCount = useMemo(() => 
    activeResponse?.data && typeof activeResponse.data === 'object' 
      ? Object.keys(activeResponse.data).length 
      : 0,
    [activeResponse?.data]
  );

  if (!activeResponse) {
    return (
      <div className="h-64 bg-gradient-to-r from-slate-50 to-blue-50 border-t-2 border-slate-300 flex items-center justify-center">
        <div className="text-center text-slate-500">
          <div className="text-4xl mb-2">🚀</div>
          <p className="text-lg font-medium">Ready to Send Request</p>
          <p className="text-sm">Response will appear here after sending a request</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border-t-2 border-slate-300 flex flex-col h-full">
      {/* Response Header */}
      <div className="p-3 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50 flex-shrink-0">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <span>Response</span>
            <Badge className={`${getMethodColor(activeRequest.method)} text-xs`}>
              {activeRequest.method}
            </Badge>
          </h3>
          <div className="flex items-center gap-2">
            {activeResponse.error ? (
              <Badge variant="destructive" className="text-xs">
                Error: {activeResponse.error}
              </Badge>
            ) : (
              <>
                <Badge variant={activeResponse.status < 400 ? "default" : "destructive"} className="text-xs">
                  {activeResponse.status} {activeResponse.statusText}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {activeResponse.time}ms
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {responseSize}
                </Badge>
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2"
              onClick={handleCopyResponse}
            >
              <Copy className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>
      
      {/* Response Tabs */}
      <Tabs defaultValue="body" className="flex-1 flex flex-col min-h-0">
        <div className="px-3 py-1 border-b border-slate-200 bg-gradient-to-r from-green-50 to-emerald-50 flex-shrink-0">
          <TabsList className="bg-transparent p-0 h-auto">
            <TabsTrigger 
              value="body" 
              className="data-[state=active]:bg-green-100 data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-green-500 rounded-none px-4 py-2 text-sm font-medium"
            >
              <FileText className="w-3 h-3 mr-1" />
              Body
            </TabsTrigger>
            <TabsTrigger 
              value="headers"
              className="data-[state=active]:bg-green-100 data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-green-500 rounded-none px-4 py-2 text-sm font-medium"
            >
              <Info className="w-3 h-3 mr-1" />
              Headers ({Object.keys(activeResponse.headers).length})
            </TabsTrigger>
            <TabsTrigger 
              value="cookies"
              className="data-[state=active]:bg-green-100 data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-green-500 rounded-none px-4 py-2 text-sm font-medium"
            >
              Cookies ({getCookies(activeResponse.headers).length})
            </TabsTrigger>
            <TabsTrigger 
              value="test"
              className="data-[state=active]:bg-green-100 data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-green-500 rounded-none px-4 py-2 text-sm font-medium"
            >
              <Code className="w-3 h-3 mr-1" />
              Test Results
            </TabsTrigger>
            <TabsTrigger 
              value="timeline"
              className="data-[state=active]:bg-green-100 data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-green-500 rounded-none px-4 py-2 text-sm font-medium"
            >
              <Clock className="w-3 h-3 mr-1" />
              Timeline
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="body" className="flex-1 p-0 m-0 overflow-hidden">
          <div className="h-full flex flex-col">
            {activeResponse.error ? (
              <div className="flex-1 overflow-auto scrollbar-thin smooth-scroll">
                <div className="bg-red-50 border border-red-200 rounded-md p-4 m-3 h-full overflow-auto scrollbar-thin">
                  <div className="flex items-center gap-2 text-red-800 font-medium mb-2">
                    <span>Request Failed</span>
                  </div>
                  <div className="text-red-700 text-sm">
                    <p className="mb-2"><strong>Error:</strong> {activeResponse.error}</p>
                    <p className="mb-2"><strong>Time:</strong> {activeResponse.time}ms</p>
                    <div className="mt-3 p-3 bg-red-100 rounded text-xs">
                      <strong>Common causes:</strong>
                      <ul className="mt-1 list-disc list-inside space-y-1">
                        <li>CORS restrictions (browser blocking cross-origin requests)</li>
                        <li>Network connectivity issues</li>
                        <li>Invalid URL or unreachable server</li>
                        <li>Authentication required</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <ModernJsonViewer
                data={activeResponse.data}
                contentType={contentType}
                onCopyFull={handleCopyResponse}
                onDownloadFull={handleDownloadResponse}
              />
            )}
          </div>
        </TabsContent>

        <TabsContent value="headers" className="flex-1 p-0 m-0 overflow-hidden">
          <div className="h-full flex flex-col">
            {/* Headers Controls */}
            <div className="p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {Object.keys(activeResponse.headers).length} headers
                </Badge>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2"
                onClick={handleCopyHeaders}
              >
                <Copy className="w-3 h-3 mr-1" />
                Copy All
              </Button>
            </div>

            {/* Headers Content */}
            <div className="flex-1 overflow-auto scrollbar-thin smooth-scroll">
              {Object.keys(activeResponse.headers).length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {Object.entries(activeResponse.headers).map(([key, value]) => (
                    <div key={key} className="p-3 hover:bg-slate-50 group">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-slate-900 text-sm mb-1">{key}</div>
                          <div className="text-slate-600 text-sm break-all font-mono bg-slate-100 p-2 rounded">
                            {value}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 h-6 px-2"
                          onClick={() => {
                            navigator.clipboard.writeText(`${key}: ${value}`);
                            toast({ title: "Copied", description: `Header "${key}" copied` });
                          }}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-500 text-sm">
                  No headers in response
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="cookies" className="flex-1 p-0 m-0 overflow-hidden">
          <div className="h-full flex flex-col">
            {/* Cookies Controls */}
            <div className="p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {cookies.length} cookies
                </Badge>
              </div>
              {cookies.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2"
                  onClick={handleCopyCookies}
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy All
                </Button>
              )}
            </div>

            {/* Cookies Content */}
            <div className="flex-1 overflow-auto scrollbar-thin smooth-scroll">
              {cookies.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {cookies.map((cookie, index) => {
                    const [nameValue, ...attributes] = cookie.split(';');
                    const [name, value] = nameValue.split('=');
                    return (
                      <div key={index} className="p-3 hover:bg-slate-50 group">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-slate-900 text-sm mb-1">{name?.trim()}</div>
                            <div className="text-slate-600 text-sm break-all font-mono bg-slate-100 p-2 rounded mb-2">
                              {value?.trim()}
                            </div>
                            {attributes.length > 0 && (
                              <div className="text-xs text-slate-500">
                                <strong>Attributes:</strong> {attributes.join(';').trim()}
                              </div>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 h-6 px-2"
                            onClick={() => {
                              navigator.clipboard.writeText(cookie);
                              toast({ title: "Copied", description: `Cookie "${name?.trim()}" copied` });
                            }}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-500 text-sm">
                  No cookies in response
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="test" className="flex-1 p-0 m-0 overflow-hidden">
          <TestResultView activeResponse={activeResponse} />
        </TabsContent>

        <TabsContent value="timeline" className="flex-1 p-0 m-0 overflow-hidden">
          <div className="h-full flex flex-col">
            {/* Timeline Header */}
            <div className="p-3 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-600" />
                <span className="font-medium text-slate-900">Request Timeline</span>
                <Badge variant="outline" className="text-xs">
                  Total: {activeResponse.time}ms
                </Badge>
              </div>
            </div>

            {/* Timeline Content */}
            <div className="flex-1 overflow-auto scrollbar-thin smooth-scroll p-3">
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <div className="flex-1">
                    <div className="font-medium text-sm">Request Initiated</div>
                    <div className="text-xs text-slate-600">Started at 0ms</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <div className="flex-1">
                    <div className="font-medium text-sm">Response Received</div>
                    <div className="text-xs text-slate-600">
                      Completed in {activeResponse.time}ms
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-green-700">
                      {activeResponse.status} {activeResponse.statusText}
                    </div>
                    <div className="text-xs text-slate-600">
                      {getResponseSize(activeResponse.data)}
                    </div>
                  </div>
                </div>

                <div className="border-l-2 border-slate-200 ml-1.5 pl-4 py-2">
                  <div className="text-xs text-slate-500 space-y-1">
                    <div>• DNS Resolution: ~5ms</div>
                    <div>• TCP Connection: ~10ms</div>
                    <div>• TLS Handshake: ~15ms</div>
                    <div>• Request Sent: ~1ms</div>
                    <div>• Server Processing: ~{Math.max(0, activeResponse.time - 31)}ms</div>
                    <div>• Response Download: ~5ms</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
});

export default ResponsePanel;
