import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HelpCircle, ExternalLink, Zap } from "lucide-react";
import pkg from "../../package.json";

interface HeaderProps {
  onShowHelp: () => void;
}

const Header: React.FC<HeaderProps> = ({ onShowHelp }) => {
  return (
    <header className="relative bg-slate-950/95 backdrop-blur border-b border-slate-800 shadow-md select-none">
      {/* ProxyCeptor Gradient Hairline Accent */}
      <div className="h-[2px] w-full bg-gradient-to-r from-[#ff5e00] via-[#ff9436] to-[#ff5e00]" />

      <div className="flex items-center justify-between w-full px-4 py-2.5">
        {/* Logo and Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#0d121d] border border-white/10 shadow-[0_2px_8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)] flex items-center justify-center relative overflow-hidden flex-shrink-0 group">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,122,24,0.18)_0%,transparent_75%)] pointer-events-none" />
            <img
              src="/brand/proxyceptor-mark.webp"
              onError={(e) => {
                const target = e.currentTarget;
                if (!target.dataset.tried) {
                  target.dataset.tried = 'true';
                  target.src = './brand/proxyceptor-mark.webp';
                }
              }}
              alt="ProxyCeptor"
              width="22"
              height="18"
              className="max-w-[80%] max-h-[80%] object-contain drop-shadow-[0_0_6px_rgba(255,122,24,0.45)] group-hover:scale-105 transition-transform"
              draggable={false}
            />
          </div>
          <div className="flex items-center gap-2.5">
            <div className="flex items-baseline gap-1.5">
              <h1 className="text-base font-extrabold tracking-tight text-white">
                Proxy<span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff9436] to-[#ff5e00]">Ceptor</span>
              </h1>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Commander</span>
            </div>
            <Badge className="bg-[#ff7a18]/15 text-[#ff9d42] border border-[#ff7a18]/30 text-[11px] font-semibold px-2 py-0.5 rounded-full shadow-sm">
              v{pkg.version}
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
            href={(import.meta.env.VITE_DASHBOARD_BASE_URL as string) || 'https://app.proxyceptor.com'}
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

