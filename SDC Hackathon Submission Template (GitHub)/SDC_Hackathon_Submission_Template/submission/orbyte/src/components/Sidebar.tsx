import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  ReceiptText,
  ClipboardCheck,
  ShieldCheck,
  RadioTower,
  FileBarChart,
  Fingerprint,
  Building2,
  ChevronDown,
  ChevronRight,
  X,
  BookMarked,
  Sparkles,
} from 'lucide-react';
import { RoleType, LanguageType } from '../types';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  pendingApprovalsCount?: number;
  isPolicyStale?: boolean;
  currentRole: RoleType;
  language: LanguageType;
  onCloseMobile?: () => void;
  companyName?: string;
  ownerName?: string;
}

type NavItem = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeTone?: 'amber' | 'blue';
};
type NavGroup = { id: string; label: string; items: NavItem[] };

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  pendingApprovalsCount = 0,
  isPolicyStale = false,
  currentRole,
  language,
  onCloseMobile,
  companyName = 'ABC Trading Sdn. Bhd.',
}) => {
  const isBM = language === 'bm';
  const groups: NavGroup[] = [
    {
      id: 'work',
      label: isBM ? 'Operasi' : 'Work',
      items: [
        { id: 'invoices', label: isBM ? 'Invois' : 'Invoices', icon: ReceiptText },
        {
          id: 'approvals',
          label: isBM ? 'Kelulusan' : 'Approvals',
          icon: ClipboardCheck,
          badge: pendingApprovalsCount > 0 ? String(pendingApprovalsCount) : undefined,
          badgeTone: 'amber',
        },
      ],
    },
    {
      id: 'compliance',
      label: isBM ? 'Pematuhan' : 'Compliance',
      items: [
        { id: 'eligibility', label: isBM ? 'Kelayakan & Manfaat' : 'Eligibility & Benefits', icon: ShieldCheck },
        {
          id: 'policies',
          label: isBM ? 'Dasar & Pemantauan' : 'Policy & Monitoring',
          icon: RadioTower,
          badge: isPolicyStale ? (isBM ? 'Semak' : 'Review') : undefined,
          badgeTone: 'amber',
        },
        {
          id: 'assistant',
          label: isBM ? 'Chatbot AI Gemini' : 'Gemini AI Chatbot',
          icon: Sparkles,
          badge: 'Gemini',
          badgeTone: 'amber',
        },
      ],
    },
    {
      id: 'insights',
      label: isBM ? 'Wawasan' : 'Insights',
      items: [
        { id: 'reports', label: isBM ? 'Laporan' : 'Reports', icon: FileBarChart },
        { id: 'audit', label: isBM ? 'Jejak Audit' : 'Audit Trail', icon: Fingerprint },
      ],
    },
    {
      id: 'manage',
      label: isBM ? 'Pengurusan' : 'Manage',
      items: [
        { id: 'business', label: isBM ? 'Profil Syarikat' : 'Company Settings', icon: Building2 },
      ],
    },
    {
      id: 'resources',
      label: isBM ? 'Rujukan' : 'Resources',
      items: [
        { id: 'resources', label: isBM ? 'About & Resources' : 'About & Resources', icon: BookMarked },
      ],
    },
  ];

  const parentForTab = new Map<string, string>();
  groups.forEach((group) => group.items.forEach((item) => parentForTab.set(item.id, group.id)));
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    work: true,
    compliance: true,
    insights: true,
    manage: true,
    resources: true,
  });

  useEffect(() => {
    const parent = parentForTab.get(activeTab);
    if (parent) setExpanded((prev) => ({ ...prev, [parent]: true }));
  }, [activeTab]);

  const handleNavigate = (id: string) => {
    onTabChange(id);
    onCloseMobile?.();
  };

  const roleLabel =
    currentRole === 'owner'
      ? isBM
        ? 'Pemilik PKS'
        : 'SME Owner'
      : currentRole === 'clerk'
      ? isBM
        ? 'Staf'
        : 'Staff'
      : isBM
      ? 'Penasihat Cukai'
      : 'Tax Advisor';

  const isTabActive = (id: string) => {
    if (id === 'policies') return ['policies', 'policy', 'compliance', 'policy-monitor', 'sources', 'assistant', 'policy-alerts', 'alerts'].includes(activeTab);
    if (id === 'eligibility') return ['eligibility', 'radar', 'actions'].includes(activeTab);
    if (id === 'policy-monitor') return ['policy-monitor', 'sources'].includes(activeTab);
    if (id === 'business') return ['business', 'settings'].includes(activeTab);
    if (id === 'audit') return ['audit', 'audit-trail'].includes(activeTab);
    if (id === 'resources') return ['resources', 'pitch'].includes(activeTab);
    return id === activeTab;
  };

  const renderItem = (item: NavItem) => {
    const Icon = item.icon;
    const active = isTabActive(item.id);
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => handleNavigate(item.id)}
        aria-current={active ? 'page' : undefined}
        className={`group w-full flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-left text-base transition-all cursor-pointer ${
          active
            ? 'bg-[#1C3F35] text-white border-2 border-[#1C3F35] shadow-[3px_3px_0_#E5A842] font-bold'
            : 'text-[#4A635B] hover:text-[#1C3F35] hover:bg-[#FFFFFF] border-2 border-transparent hover:border-[#1C3F35] font-semibold'
        }`}
      >
        <Icon className={`h-5 w-5 shrink-0 ${active ? 'text-[#E5A842]' : 'text-[#4A635B] group-hover:text-[#1C3F35]'}`} />
        <span className="min-w-0 flex-1 truncate text-base font-semibold">{item.label}</span>
        {item.badge && (
          <span className="shrink-0 rounded-[3px] px-2 py-0.5 text-xs sm:text-sm font-bold bg-[#E5A842] text-[#1C3F35] border border-[#1C3F35]">
            {item.badge}
          </span>
        )}
      </button>
    );
  };

  return (
    <aside className="flex h-full w-64 shrink-0 select-none flex-col border-r-2 border-[#1C3F35] bg-[#FAF5E8]">
      <div className="flex-1 overflow-y-auto">
        {/* Brand Header */}
        <div className="flex items-center justify-between border-b-2 border-[#1C3F35] p-3.5 sm:p-4 bg-[#FAF5E8]">
          <div className="flex min-w-0 items-center gap-2.5">
            <svg
              className="brand-mark w-8 h-8 shrink-0"
              viewBox="0 0 32 32"
              aria-hidden="true"
              shapeRendering="crispEdges"
            >
              <path fill="#102b44" d="M2 2h28v28H2z" />
              <path fill="#f7f0dc" d="M6 6h8v8H6zm12 0h8v8h-8zM6 18h8v8H6z" />
              <path fill="#f2b84b" d="M18 18h8v8h-8z" />
            </svg>
            <div className="min-w-0 font-mono">
              <div className="truncate text-base sm:text-lg font-bold tracking-tight text-[#1C3F35]">
                ORBYTE <strong className="text-[#285443]">INVOISREADY</strong>
              </div>
              <div className="truncate text-xs sm:text-sm font-semibold text-[#4A635B]">
                Malaysian SME Hub
              </div>
            </div>
          </div>
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="rounded p-1 text-[#1C3F35] hover:bg-[#FFFFFF] border border-[#1C3F35] md:hidden cursor-pointer"
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="space-y-4 px-3 py-3.5" aria-label={isBM ? 'Navigasi utama' : 'Main navigation'}>
          <div>
            <div className="mb-1.5 px-2 text-xs sm:text-sm font-mono font-bold uppercase tracking-wider text-[#1C3F35]">
              {isBM ? 'Ruang Kerja' : 'Workspace'}
            </div>
            <button
              type="button"
              onClick={() => handleNavigate('overview')}
              aria-current={activeTab === 'overview' ? 'page' : undefined}
              className={`flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-left text-base transition-all cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-[#1C3F35] text-white border-2 border-[#1C3F35] shadow-[3px_3px_0_#E5A842] font-bold'
                  : 'text-[#4A635B] hover:text-[#1C3F35] hover:bg-[#FFFFFF] border-2 border-transparent hover:border-[#1C3F35] font-semibold'
              }`}
            >
              <LayoutDashboard className={`h-5 w-5 ${activeTab === 'overview' ? 'text-[#E5A842]' : 'text-[#4A635B]'}`} />
              <span className="font-bold text-base">{isBM ? 'Gambaran Keseluruhan' : 'Overview'}</span>
            </button>
          </div>

          {groups.map((group) => {
            const isExpanded = Boolean(expanded[group.id]);
            const groupActive = group.items.some((item) => isTabActive(item.id));
            return (
              <div key={group.id} className="space-y-1">
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  onClick={() => setExpanded((prev) => ({ ...prev, [group.id]: !prev[group.id] }))}
                  className={`flex w-full items-center justify-between rounded px-2.5 py-1 text-xs sm:text-sm font-mono font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                    groupActive ? 'text-[#1C3F35]' : 'text-[#4A635B] hover:text-[#1C3F35]'
                  }`}
                >
                  <span className="font-bold">{group.label}</span>
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
                {isExpanded && <div className="space-y-1">{group.items.map(renderItem)}</div>}
              </div>
            );
          })}
        </nav>
      </div>

      {/* Footer Active Entity Info Box */}
      <div className="m-3 p-3.5 rounded bg-[#FFFFFF] border-2 border-[#1C3F35] shadow-[3px_3px_0_#1C3F35] text-sm space-y-2.5">
        <div>
          <div className="text-xs sm:text-sm font-mono font-bold uppercase tracking-wider text-[#1C3F35]">
            {isBM ? 'Syarikat Aktif' : 'Active Company'}
          </div>
          <div className="truncate font-bold text-base sm:text-lg text-[#1C3F35]" title={companyName}>
            {companyName}
          </div>
          <div className="mt-1 truncate text-xs sm:text-sm text-[#4A635B]">
            {isBM ? 'Pengguna: ' : 'Signed in as: '}
            <strong className="text-[#1C3F35] font-mono text-sm sm:text-base font-bold">{roleLabel}</strong>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-[#1C3F35]/20 pt-2 text-xs sm:text-sm">
          <div className="flex items-center gap-1.5 font-bold text-[#285443]">
            <Sparkles className="h-4 w-4 text-[#E5A842]" />
            <span className="text-xs sm:text-sm font-bold">{isBM ? 'Ruang kerja PKS' : 'SME Workspace'}</span>
          </div>
          <span className="font-mono text-xs font-bold px-2 py-0.5 bg-[#EDF6EB] text-[#1C3F35] border border-[#1C3F35] rounded-[3px]">
            ACTIVE
          </span>
        </div>
      </div>
    </aside>
  );
};
