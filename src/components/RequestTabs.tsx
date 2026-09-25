import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, X, Edit3, ChevronLeft, ChevronRight, Copy, Trash2, XCircle } from "lucide-react";

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

interface RequestTabsProps {
  requests: ApiRequest[];
  activeRequestId: string;
  onSelectRequest: (id: string) => void;
  onCloseRequest: (id: string) => void;
  onCloseOtherRequests?: (id: string) => void;
  onCloseAllRequests?: () => void;
  onRenameRequest: (id: string, newName: string) => void;
  onDuplicateRequest?: (id: string) => void;
  onNewRequest: () => void;
  getMethodColor: (method: string) => string;
  getTestStats?: (requestId: string) => { total: number; passed: number; failed: number };
}

interface ContextMenuState {
  x: number;
  y: number;
  requestId: string;
}

const RequestTabs: React.FC<RequestTabsProps> = ({
  requests,
  activeRequestId,
  onSelectRequest,
  onCloseRequest,
  onCloseOtherRequests,
  onCloseAllRequests,
  onRenameRequest,
  onDuplicateRequest,
  onNewRequest,
  getMethodColor,
  getTestStats,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLDivElement>(null);

  // Check scroll overflows
  const updateScrollButtons = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 2);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 2);
    }
  };

  useEffect(() => {
    updateScrollButtons();
    window.addEventListener('resize', updateScrollButtons);
    return () => window.removeEventListener('resize', updateScrollButtons);
  }, [requests]);

  // Smooth scroll active tab into view when selection changes
  useEffect(() => {
    if (activeTabRef.current) {
      activeTabRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest'
      });
    }
    // Re-check scroll state after DOM update
    setTimeout(updateScrollButtons, 100);
  }, [activeRequestId]);

  // Focus input when editing starts
  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  // Close context menu on outside click or escape
  useEffect(() => {
    const handleDocumentClick = () => setContextMenu(null);
    const handleKeyDownDoc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    document.addEventListener('click', handleDocumentClick);
    document.addEventListener('keydown', handleKeyDownDoc);
    return () => {
      document.removeEventListener('click', handleDocumentClick);
      document.removeEventListener('keydown', handleKeyDownDoc);
    };
  }, []);

  const handleWheel = (e: React.WheelEvent) => {
    if (scrollRef.current) {
      if (e.deltaY !== 0) {
        scrollRef.current.scrollLeft += e.deltaY;
        updateScrollButtons();
      }
    }
  };

  const scrollHorizontally = (amount: number) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
      setTimeout(updateScrollButtons, 200);
    }
  };

  const startEditing = (request: ApiRequest) => {
    setEditingId(request.id);
    setEditingName(request.name);
    setContextMenu(null);
  };

  const finishEditing = () => {
    if (editingId && editingName.trim()) {
      onRenameRequest(editingId, editingName.trim());
    }
    setEditingId(null);
    setEditingName('');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingName('');
  };

  const handleContextMenu = (e: React.MouseEvent, request: ApiRequest) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      requestId: request.id
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      finishEditing();
    } else if (e.key === 'Escape') {
      cancelEditing();
    }
  };

  return (
    <div className="flex items-center border-b border-slate-200 bg-slate-100/90 select-none relative h-10">
      {/* Scroll Left Button */}
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scrollHorizontally(-180)}
          className="h-full px-1.5 flex items-center justify-center bg-slate-200/90 hover:bg-slate-300 text-slate-700 transition-colors z-10 flex-shrink-0 border-r border-slate-300"
          title="Scroll tabs left"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}

      {/* Tabs Container */}
      <div
        ref={scrollRef}
        onWheel={handleWheel}
        onScroll={updateScrollButtons}
        className="flex-1 flex items-center h-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden scroll-smooth"
      >
        {requests.map((request) => {
          const isActive = activeRequestId === request.id;
          return (
            <div
              key={request.id}
              ref={isActive ? activeTabRef : null}
              className={`group relative flex items-center gap-2 h-full px-3 border-r border-slate-200 cursor-pointer flex-shrink-0 min-w-[140px] max-w-[210px] transition-all duration-150 ${
                isActive
                  ? 'bg-white border-b-2 border-b-emerald-600 text-slate-900 font-medium shadow-xs'
                  : 'bg-slate-50/70 hover:bg-slate-100/90 text-slate-600'
              }`}
              onClick={(e) => {
                if (editingId === request.id) {
                  e.preventDefault();
                  return;
                }
                onSelectRequest(request.id);
              }}
              onContextMenu={(e) => handleContextMenu(e, request)}
            >
              {/* HTTP Method Badge */}
              <Badge className={`${getMethodColor(request.method)} text-[10px] px-1.5 py-0.5 font-bold uppercase rounded flex-shrink-0 leading-none shadow-none`}>
                {request.method}
              </Badge>

              {/* Editable Request Name */}
              {editingId === request.id ? (
                <Input
                  ref={inputRef}
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={finishEditing}
                  onKeyDown={handleKeyDown}
                  className="text-xs h-6 px-1.5 py-0 min-w-0 max-w-28 bg-white border-blue-400 focus:border-blue-600"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span
                  className="text-xs truncate flex-1 min-w-0 hover:text-emerald-700 transition-colors"
                  title={`${request.name}\n• Double-click to rename\n• Right-click for options`}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    startEditing(request);
                  }}
                >
                  {request.name}
                </span>
              )}

              {/* Test Status Indicators */}
              {getTestStats && (() => {
                const stats = getTestStats(request.id);
                if (stats.total > 0) {
                  return (
                    <div className="flex items-center gap-0.5 flex-shrink-0 text-[10px]">
                      {stats.passed > 0 && (
                        <span className="text-emerald-600 font-bold">✓{stats.passed}</span>
                      )}
                      {stats.failed > 0 && (
                        <span className="text-red-600 font-bold">✗{stats.failed}</span>
                      )}
                    </div>
                  );
                }
                return null;
              })()}

              {/* Close Button — Always present & clickable */}
              <button
                type="button"
                className="ml-auto flex-shrink-0 p-1 rounded hover:bg-slate-200/80 hover:text-red-600 text-slate-400 opacity-60 group-hover:opacity-100 transition-all cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseRequest(request.id);
                }}
                title="Close request (Ctrl+W)"
                aria-label="Close request"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Scroll Right Button */}
      {canScrollRight && (
        <button
          type="button"
          onClick={() => scrollHorizontally(180)}
          className="h-full px-1.5 flex items-center justify-center bg-slate-200/90 hover:bg-slate-300 text-slate-700 transition-colors z-10 flex-shrink-0 border-l border-slate-300"
          title="Scroll tabs right"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      {/* Add New Request Button */}
      <button
        type="button"
        className="flex-shrink-0 flex items-center gap-1.5 px-3.5 h-full border-l border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-emerald-700 text-xs font-semibold cursor-pointer transition-colors shadow-none"
        onClick={onNewRequest}
        title="Add new request (Ctrl+N)"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>New</span>
      </button>

      {/* Right-Click Context Menu */}
      {contextMenu && (
        <div
          className="fixed bg-white border border-slate-200 rounded-lg shadow-xl py-1 z-50 min-w-44 text-xs animate-in fade-in zoom-in-95 duration-100"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {(() => {
            const targetReq = requests.find(r => r.id === contextMenu.requestId);
            if (!targetReq) return null;
            return (
              <>
                <button
                  type="button"
                  className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-100 text-slate-700"
                  onClick={() => startEditing(targetReq)}
                >
                  <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                  <span>Rename</span>
                </button>
                {onDuplicateRequest && (
                  <button
                    type="button"
                    className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-100 text-slate-700"
                    onClick={() => {
                      onDuplicateRequest(targetReq.id);
                      setContextMenu(null);
                    }}
                  >
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                    <span>Duplicate (Ctrl+D)</span>
                  </button>
                )}
                <div className="my-1 border-t border-slate-100" />
                <button
                  type="button"
                  className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-red-50 text-red-600"
                  onClick={() => {
                    onCloseRequest(targetReq.id);
                    setContextMenu(null);
                  }}
                >
                  <X className="w-3.5 h-3.5 text-red-500" />
                  <span>Close (Ctrl+W)</span>
                </button>
                {onCloseOtherRequests && requests.length > 1 && (
                  <button
                    type="button"
                    className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-100 text-slate-700"
                    onClick={() => {
                      onCloseOtherRequests(targetReq.id);
                      setContextMenu(null);
                    }}
                  >
                    <XCircle className="w-3.5 h-3.5 text-slate-500" />
                    <span>Close Others</span>
                  </button>
                )}
                {onCloseAllRequests && (
                  <button
                    type="button"
                    className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-100 text-slate-700"
                    onClick={() => {
                      onCloseAllRequests();
                      setContextMenu(null);
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-slate-500" />
                    <span>Close All</span>
                  </button>
                )}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default RequestTabs;
