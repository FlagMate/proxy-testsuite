import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HelpCircle, ExternalLink, Zap } from "lucide-react";

interface HeaderProps {
  onShowHelp: () => void;
}

const Header: React.FC<HeaderProps> = ({ onShowHelp }) => {
  return (
    <header className="relative bg-slate-950/95 backdrop-blur border-b border-slate-800 shadow-md select-none">
      {/* ProxyCeptor Gradient Hairline Accent */}
      <div className="h-[2px] w-full bg-gradient-to-r from-violet-500 via-indigo-500 to-cyan-400" />
      
      <div className="flex items-center justify-between w-full px-4 py-2.5">
        {/* Logo and Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-violet-600 via-indigo-600 to-cyan-500 rounded-lg flex items-center justify-center shadow-md shadow-violet-500/25 border border-violet-400/30">
            <Zap className="w-4 h-4 text-white fill-current" />
          </div>
          <div className="flex items-center gap-2.5">
            <div className="flex items-baseline gap-1.5">
              <h1 className="text-base font-bold tracking-tight text-white">ProxyCeptor</h1>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Commander</span>
            </div>
            <Badge className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold px-2 py-0.5 rounded-full shadow-sm">
              v2.0.1
            </Badge>
          </div>
        </div>
        
        {/* Compact Features, SDK Status & Actions */}
        <div className="flex items-center gap-3 text-xs text-slate-300">
          <span className="hidden xl:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400 font-mono text-[11px]">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            Proxy Interceptor Ready
          </span>
          <span className="hidden lg:flex items-center gap-1.5 text-slate-400 text-[11px]">
            <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full" />
            16x Faster
          </span>
          <span className="hidden md:flex items-center gap-1.5 text-slate-400 text-[11px]">
            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full" />
            100% Local
          </span>

          <a
            href={(import.meta.env.VITE_DASHBOARD_URL as string) || '/app'}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-violet-500/10 text-violet-300 border border-violet-500/30 hover:bg-violet-500/20 hover:text-white transition-colors"
          >
            <span>Cloud Dashboard</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          <Button 
            variant="ghost" 
            size="sm" 
            className="text-slate-300 hover:text-white hover:bg-slate-800 px-2.5 py-1 h-7 text-xs border border-transparent hover:border-slate-700"
            onClick={onShowHelp}
          >
            <HelpCircle className="w-3.5 h-3.5 mr-1 text-slate-400" />
            Help
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;

