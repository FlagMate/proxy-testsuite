import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Search, Plus, Upload, Download, Settings, FileText, Trash2, MoreVertical, Pencil, FolderEdit, AlertTriangle } from "lucide-react";
import HARImportDialog from "./HARImportDialog";
import { ProcessedHARRequest } from "@/lib/harParser";

interface Collection {
  id: string;
  name: string;
}

interface Environment {
  id: string;
  name: string;
  variables: { key: string; value: string }[];
}

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

interface CollectionsSidebarProps {
  collections: Collection[];
  environments: Environment[];
  selectedCollectionId: string;
  selectedEnvironmentId: string;
  width?: number;
  searchTerm: string;
  requests?: ApiRequest[];
  visibleRequests: ApiRequest[];
  history: any[];
  onSelectCollection: (id: string) => void;
  onSelectEnvironment: (id: string) => void;
  onSearchChange: (term: string) => void;
  onNewCollection: () => void;
  onManageEnvironments: () => void;
  onImport: () => void;
  onExport: () => void;
  onHARImport: (harRequests: ProcessedHARRequest[], collectionName: string, targetCollectionId?: string) => void;
  onLoadFromHistory: (historyItem: any) => void;
  onDeleteHistoryItem?: (id: string) => void;
  onClearHistory?: () => void;
  onRenameCollection: (id: string, newName: string) => void;
  onDeleteCollection: (id: string) => void;
  getMethodColor: (method: string) => string;
}

const CollectionsSidebar: React.FC<CollectionsSidebarProps> = ({
  collections,
  environments,
  selectedCollectionId,
  selectedEnvironmentId,
  width,
  searchTerm,
  requests = [],
  visibleRequests,
  history,
  onSelectCollection,
  onSelectEnvironment,
  onSearchChange,
  onNewCollection,
  onManageEnvironments,
  onImport,
  onExport,
  onHARImport,
  onLoadFromHistory,
  onDeleteHistoryItem,
  onClearHistory,
  onRenameCollection,
  onDeleteCollection,
  getMethodColor,
}) => {
  // Rename and Delete Dialog state
  const [renamingCollection, setRenamingCollection] = useState<Collection | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deletingCollection, setDeletingCollection] = useState<Collection | null>(null);

  const openRenameModal = (col: Collection) => {
    setRenamingCollection(col);
    setRenameValue(col.name);
  };

  const handleRenameSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!renamingCollection || !renameValue.trim()) return;
    onRenameCollection(renamingCollection.id, renameValue.trim());
    setRenamingCollection(null);
  };

  const openDeleteModal = (col: Collection) => {
    setDeletingCollection(col);
  };

  const handleDeleteConfirm = () => {
    if (!deletingCollection) return;
    onDeleteCollection(deletingCollection.id);
    setDeletingCollection(null);
  };

  return (
    <div 
      className="border-r border-border bg-card/40 flex flex-col h-full select-none overflow-hidden shrink-0"
      style={{ 
        width: width ? `${width}px` : undefined,
        minWidth: width ? `${width}px` : undefined,
        maxWidth: width ? `${width}px` : undefined
      }}
    >
      {/* Sidebar Header with Actions and Search */}
      <div className="p-4 border-b border-border space-y-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h2 className="font-semibold text-sm">Collections</h2>
            <Badge variant="secondary" className="text-xs">
              {collections.length}
            </Badge>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={onNewCollection}
            className="h-8 px-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors duration-200"
            title="Create new collection"
          >
            <Plus className="w-4 h-4 mr-1" />
            <span className="text-xs font-medium">New</span>
          </Button>
        </div>

        {/* Action Buttons: Import, Export, Manage */}
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onManageEnvironments}
              className="text-xs h-8 border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors duration-200 flex items-center justify-center"
              title="Manage environments and variables"
            >
              <Settings className="w-3 h-3 mr-1 flex-shrink-0" />
              <span className="truncate">Manage</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onExport}
              className="text-xs h-8 border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors duration-200 flex items-center justify-center"
              title="Export all collections, requests, and environments"
            >
              <Download className="w-3 h-3 mr-1 flex-shrink-0" />
              <span className="truncate">Export</span>
            </Button>
          </div>
          
          {/* HAR Import Button */}
          <div className="flex items-center">
            <HARImportDialog 
              onImport={onHARImport}
              collections={collections}
              currentCollectionId={selectedCollectionId}
            >
              <Button size="sm" variant="outline" className="w-full border-blue-200 text-blue-700 hover:bg-blue-50 bg-gradient-to-r from-blue-50 to-indigo-50 transition-all duration-200">
                <FileText className="w-3 h-3 mr-1 flex-shrink-0" />
                <span className="truncate flex-1">Import HAR</span>
                <Badge variant="secondary" className="ml-1 text-xs flex-shrink-0">New</Badge>
              </Button>
            </HARImportDialog>
          </div>
        </div>
        
        <div className="relative flex-shrink-0">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none z-10" />
          <Input
            placeholder="🔍 Search requests..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 border-slate-200 focus:border-slate-500 focus:ring-slate-500 transition-colors duration-200"
          />
        </div>
      </div>

      {/* Collections List */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {/* Single Scroll Container for All Content */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent smooth-scroll">
          {/* Collections Section */}
          <div className="p-2 space-y-1">
            {collections.map(col => {
              const colCount = requests.filter(r => (r.collectionId || 'default') === col.id).length;
              const isSelected = selectedCollectionId === col.id;

              return (
                <div
                  key={col.id}
                  className={`group relative flex items-center w-full rounded-lg transition-all duration-150 ${
                    isSelected
                      ? "bg-blue-600 text-white shadow-xs font-medium"
                      : "hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-300"
                  }`}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openRenameModal(col);
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onSelectCollection(col.id)}
                    className="flex-1 flex items-center justify-between text-left text-xs py-2 pl-3 pr-2 min-w-0"
                    title={`Click to select "${col.name}" (Right-click to rename)`}
                  >
                    <span className="truncate flex-1 font-medium">{col.name}</span>
                    <span className={`text-[11px] font-mono ml-2 shrink-0 ${isSelected ? "text-blue-100" : "text-slate-400"}`}>
                      ({colCount})
                    </span>
                  </button>

                  {/* Three-dots Action Menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        onClick={(e) => e.stopPropagation()}
                        className={`p-1 mr-1 rounded-md transition-opacity cursor-pointer shrink-0 ${
                          isSelected 
                            ? "text-blue-100 hover:text-white hover:bg-blue-700" 
                            : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 opacity-0 group-hover:opacity-100"
                        }`}
                        title="Collection options"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem 
                        onClick={(e) => {
                          e.stopPropagation();
                          openRenameModal(col);
                        }}
                        className="cursor-pointer text-xs flex items-center gap-2"
                      >
                        <Pencil className="w-3.5 h-3.5 text-blue-500" />
                        Rename
                      </DropdownMenuItem>
                      {col.id !== 'default' && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation();
                              openDeleteModal(col);
                            }}
                            className="cursor-pointer text-xs text-red-600 dark:text-red-400 flex items-center gap-2 hover:bg-red-50 dark:hover:bg-red-950/40"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-500" />
                            Delete
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>

          {/* Request History Section */}
          <div className="p-4 border-t border-border">
            <div className="font-semibold mb-2 text-sm flex items-center justify-between">
              <div className="flex items-center">
                <span>Request History</span>
                {history.length > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {history.length}
                  </Badge>
                )}
              </div>
              {history.length > 0 && onClearHistory && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClearHistory}
                  className="h-6 px-2 text-xs text-muted-foreground hover:text-red-600 hover:bg-red-50 flex items-center gap-1"
                  title="Clear all request history"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear</span>
                </Button>
              )}
            </div>
            <div className="space-y-1">
              {history.length === 0 && (
                <div className="text-xs text-muted-foreground py-2 text-center border border-dashed border-muted rounded-md">
                  No history yet
                </div>
              )}
              {history.map((h) => (
                <div
                  key={h.id}
                  className="group relative flex items-center w-full rounded-md hover:bg-accent/60 transition-colors"
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-xs h-auto py-2 pr-8 text-left transition-all duration-200"
                    onClick={() => onLoadFromHistory(h)}
                  >
                    <div className="flex flex-col items-start gap-1 w-full min-w-0">
                      <div className="flex items-center gap-2 w-full min-w-0">
                        <Badge className={`${getMethodColor(h.request.method)} text-[10px] px-1.5 py-0.5 font-bold uppercase rounded flex-shrink-0 leading-none`}>
                          {h.request.method}
                        </Badge>
                        <span className="truncate flex-1 font-medium">{h.request.name}</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground truncate w-full">
                        {h.request.url}
                      </span>
                    </div>
                  </Button>
                  {onDeleteHistoryItem && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteHistoryItem(h.id);
                      }}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-100 opacity-0 group-hover:opacity-100 transition-all cursor-pointer z-10"
                      title="Delete this history entry"
                      aria-label="Delete history entry"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Sleek Rename Collection Modal */}
      <Dialog open={!!renamingCollection} onOpenChange={(open) => { if (!open) setRenamingCollection(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <FolderEdit className="w-4 h-4 text-blue-500" />
              Rename Collection
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRenameSubmit} className="space-y-4 pt-2">
            <div>
              <Label htmlFor="rename-col-input" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Collection Name
              </Label>
              <Input
                id="rename-col-input"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                placeholder="Enter collection name..."
                autoFocus
                className="mt-1.5 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={() => setRenamingCollection(null)}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                size="sm"
                disabled={!renameValue.trim() || renameValue.trim() === renamingCollection?.name}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Save Changes
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Sleek Delete Collection Modal */}
      <Dialog open={!!deletingCollection} onOpenChange={(open) => { if (!open) setDeletingCollection(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base text-red-600 dark:text-red-400">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              Delete Collection
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Are you sure you want to delete <span className="font-semibold text-slate-900 dark:text-slate-100">"{deletingCollection?.name}"</span>?
            </p>
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-800 dark:text-amber-300">
              Requests in this collection will not be deleted — they will be safely preserved and moved to the <span className="font-semibold">Default</span> collection.
            </div>
            <div className="flex justify-end gap-2 pt-3">
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={() => setDeletingCollection(null)}
              >
                Cancel
              </Button>
              <Button 
                type="button" 
                size="sm"
                variant="destructive"
                onClick={handleDeleteConfirm}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Delete Collection
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CollectionsSidebar;
