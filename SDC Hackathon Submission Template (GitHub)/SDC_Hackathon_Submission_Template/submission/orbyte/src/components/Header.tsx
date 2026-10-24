import React, { useState, useRef, useEffect } from 'react';
import {
  Building2,
  ChevronDown,
  HelpCircle,
  Menu,
  Play,
  ArrowRight,
  Check,
  LogOut,
  Lock,
  PlusCircle,
  Compass,
} from 'lucide-react';
import { RoleType, LanguageType, CompanyEntity } from '../types';

interface HeaderProps {
  currentRole: RoleType;
  onRoleChange: (role: RoleType) => void;
  onRequestRoleSwitch?: (role: RoleType) => void;
  onLogout?: () => void;
  language: LanguageType;
  onLanguageChange: (lang: LanguageType) => void;
  activePolicyVersion: string;
  companyName: string;
  ownerName: string;
  onOpenEditProfile: () => void;
  onRunScenario: (scenarioId: number) => void;
  onOpenMobileMenu?: () => void;
  onOpenDemoGuide?: (scenarioId?: number) => void;
  onOpenWelcomeGuide?: () => void;
  activeCompanyId?: string;
  companies?: CompanyEntity[];
  onCompanySwitch?: (id: string) => void;
  onOpenGoogleDrive?: () => void;
  isDriveConnected?: boolean;
}

export const Header: React.FC<HeaderProps> = ({

  currentRole,
  onRoleChange,
  onRequestRoleSwitch,
  onLogout,
  language,
  onLanguageChange,
  activePolicyVersion,
  companyName,
  ownerName,
  onOpenEditProfile,
  onRunScenario,
  onOpenMobileMenu,
  onOpenDemoGuide,
  onOpenWelcomeGuide,
  activeCompanyId = 'COMP-A',
  companies = [],
  onCompanySwitch,
  onOpenGoogleDrive,
  isDriveConnected = false,
}) => {
  const isBM = language === 'bm';
  const [isDemoDropdownOpen, setIsDemoDropdownOpen] = useState(false);
  const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const companyRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDemoDropdownOpen(false);
      }
      if (companyRef.current && !companyRef.current.contains(e.target as Node)) {
        setIsCompanyDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const scenarios = [
    {
      id: 1,
      title: isBM ? '1. Semakan & Pengambilan Invois' : '1. Invoices & e-Invoice Intake',
      desc: isBM ? 'Muat naik atau semak invois dengan peraturan LHDN' : 'Process incoming invoice & check compliance readiness',
    },
    {
      id: 2,
      title: isBM ? '2. Pelepasan Cukai & Geran PKS' : '2. Tax Relief & Grants Analysis',
      desc: isBM ? 'Semak pengumuman dasar PKS, syarat kelayakan dan tindakan seterusnya' : 'Review SME policy announcements, eligibility conditions & next steps',
    },
    {
      id: 3,
      title: isBM ? '3. Pengesahan & Kelulusan e-Invois' : '3. e-Invoice Sign-Off & Validation',
      desc: isBM ? 'Kelulusan rasmi invois oleh pengarah syarikat' : 'Review queue and authorize invoices for issuance',
    },
    {
      id: 4,
      title: isBM ? '4. Tetapan Perniagaan & Entiti' : '4. Business Settings & Entities',
      desc: isBM ? 'Urus profil syarikat, entiti, dan nombor cukai TIN' : 'Manage company profiles, entities, and tax identifiers',
    },
  ];

  return (
    <header className="bg-[#FAF5E8] border-b-2 border-[#1C3F35] sticky top-0 z-30 select-none">
      <div className="h-16 px-3 sm:px-6 flex items-center justify-between gap-3">
        {/* Left: Mobile trigger & Company Switcher */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {onOpenMobileMenu && (
            <button
              onClick={onOpenMobileMenu}
              className="md:hidden p-1.5 text-[#1C3F35] bg-[#FFFFFF] border-2 border-[#1C3F35] rounded shadow-[2px_2px_0_#1C3F35] hover:bg-[#FAF8F2] focus:outline-none cursor-pointer"
              aria-label="Toggle Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          {/* Interactive Company Switcher & Profile Dropdown */}
          <div className="relative" ref={companyRef}>
            <button
              onClick={() => setIsCompanyDropdownOpen(!isCompanyDropdownOpen)}
              className="group flex items-center gap-2 px-3 py-1.5 rounded bg-[#FFFFFF] hover:bg-[#FFFDF8] border-2 border-[#1C3F35] shadow-[2px_2px_0_#1C3F35] transition-transform active:translate-x-[1px] active:translate-y-[1px] text-left cursor-pointer min-w-0"
              title={isBM ? 'Klik untuk tukar atau urus syarikat' : 'Click to switch or manage companies'}
            >
              <div className="w-7 h-7 rounded bg-[#EDF6EB] border border-[#1C3F35] text-[#1C3F35] flex items-center justify-center shrink-0">
                <Building2 className="w-4 h-4" />
              </div>
              <div className="min-w-0 max-w-[140px] sm:max-w-[210px]">
                <div className="text-sm font-bold text-[#1C3F35] flex items-center gap-1 truncate">
                  <span className="truncate">{companyName}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-[#4A635B] shrink-0" />
                </div>
                <div className="text-xs text-[#4A635B] truncate font-mono">
                  {isBM ? 'Pemilik:' : 'Owner:'} <strong className="text-[#1C3F35]">{ownerName}</strong>
                </div>
              </div>
            </button>

            {isCompanyDropdownOpen && (
              <div className="absolute left-0 mt-1.5 w-80 bg-[#FFFFFF] rounded border-2 border-[#1C3F35] shadow-[6px_6px_0_#1C3F35] p-2 text-xs z-50 animate-in fade-in duration-150">
                <div className="px-3 py-2 border-b-2 border-[#1C3F35]/20 flex items-center justify-between">
                  <span className="font-bold text-[#1C3F35] uppercase tracking-wider text-[11px] font-mono">
                    {isBM ? 'Tukar Entiti Perniagaan' : 'Switch Business Entity'}
                  </span>
                  <button
                    onClick={() => {
                      setIsCompanyDropdownOpen(false);
                      onOpenEditProfile();
                    }}
                    className="text-[#285443] hover:text-[#19382E] font-bold text-[11px] flex items-center gap-1 cursor-pointer underline underline-offset-2"
                  >
                    <span>{isBM ? 'Urus Semua' : 'Manage All'}</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                <div className="max-h-60 overflow-y-auto py-1 space-y-1">
                  {companies.filter((c) => c.status === 'active').map((c) => {
                    const isCurrent = c.id === activeCompanyId || c.name === companyName;
                    return (
                      <button
                        key={c.id}
                        onClick={() => {
                          setIsCompanyDropdownOpen(false);
                          if (onCompanySwitch) onCompanySwitch(c.id);
                        }}
                        className={`w-full text-left p-2 rounded border transition-colors cursor-pointer ${
                          isCurrent
                            ? 'bg-[#FEF3C7] border-[#1C3F35] text-[#1C3F35] font-semibold'
                            : 'hover:bg-[#FAF5E8] border-transparent text-[#4A635B]'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-xs truncate flex items-center gap-1.5 text-[#1C3F35]">
                            <span className="truncate">{c.name}</span>
                            {isCurrent && <Check className="w-3.5 h-3.5 text-[#285443] shrink-0" />}
                          </div>
                          <div className="text-[11px] text-[#4A635B] font-mono">
                            {c.ssm_registration || c.uen_or_tin} • {c.salesDisplay}
                          </div>
                        </div>
                        {c.pendingInvoicesCount && c.pendingInvoicesCount > 0 ? (
                          <span className="px-1.5 py-0.5 rounded bg-[#E5A842] text-[#1C3F35] font-bold text-[10px] shrink-0">
                            {c.pendingInvoicesCount}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>

                <div className="pt-2 border-t-2 border-[#1C3F35]/20 px-1">
                  <button
                    onClick={() => {
                      setIsCompanyDropdownOpen(false);
                      onOpenEditProfile();
                    }}
                    className="w-full py-1.5 px-2 rounded bg-[#EDF6EB] hover:bg-[#D9ECDD] text-[#1C3F35] font-bold text-xs flex items-center justify-center gap-1.5 border border-[#1C3F35] cursor-pointer"
                  >
                    <PlusCircle className="w-3.5 h-3.5 text-[#285443]" />
                    <span>{isBM ? '+ Tambah / Daftar Syarikat' : '+ Add / Register Company'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Controls (Demo Menu, Role Switcher, Language Toggle, Help) */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Demo Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDemoDropdownOpen(!isDemoDropdownOpen)}
              className="h-9 sm:h-10 px-3 sm:px-3.5 rounded bg-[#FFFFFF] hover:bg-[#FFFDF8] text-[#1C3F35] border-2 border-[#1C3F35] shadow-[2px_2px_0_#1C3F35] text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              aria-expanded={isDemoDropdownOpen}
            >
              <Compass className="w-4.5 h-4.5 text-[#285443]" />
              <span className="hidden sm:inline">{isBM ? 'Pusat Demo' : 'Demo & Pitch'}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-[#4A635B] transition-transform ${
                  isDemoDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isDemoDropdownOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-[#FFFFFF] rounded border-2 border-[#1C3F35] shadow-[6px_6px_0_#1C3F35] p-2 z-50 text-xs animate-in fade-in duration-150">
                <div className="px-3 py-2 border-b-2 border-[#1C3F35]/20">
                  <div className="font-serif text-[#1C3F35] text-base font-bold">
                    {isBM ? 'Demonstrasi 3 Minit' : '3-Minute Live Pitch Demos'}
                  </div>
                  <div className="text-[11px] text-[#4A635B] mt-0.5">
                    {isBM ? 'Pilih senario untuk jalankan aliran penuh' : 'Select a pre-built flow to test live logic'}
                  </div>
                </div>

                <div className="py-1 space-y-0.5">
                  {scenarios.map((sc) => (
                    <button
                      key={sc.id}
                      onClick={() => {
                        onRunScenario(sc.id);
                        setIsDemoDropdownOpen(false);
                      }}
                      className="w-full p-2.5 rounded text-left hover:bg-[#FAF5E8] border border-transparent hover:border-[#1C3F35] transition-colors flex items-start gap-2.5 cursor-pointer group"
                    >
                      <Play className="w-3.5 h-3.5 text-[#285443] mt-0.5 shrink-0 fill-current" />
                      <div>
                        <div className="font-bold text-[#1C3F35] leading-tight">
                          {sc.title}
                        </div>
                        <div className="text-[11px] text-[#4A635B] mt-0.5 leading-tight">
                          {sc.desc}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {onOpenDemoGuide && (
                  <div className="pt-1.5 mt-1 border-t-2 border-[#1C3F35]/20">
                    <button
                      onClick={() => {
                        onOpenDemoGuide(1);
                        setIsDemoDropdownOpen(false);
                      }}
                      className="w-full px-3 py-2 rounded bg-[#FEF3C7] hover:bg-[#FDE68A] text-[#1C3F35] font-bold flex items-center justify-between border border-[#1C3F35] cursor-pointer transition-colors"
                    >
                      <span className="flex items-center gap-1.5">
                        <Compass className="w-4 h-4 text-[#1C3F35]" />
                        {isBM ? 'Panduan Langkah demi Langkah' : 'Interactive Walkthrough Guide'}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Role Switcher */}
          <div className="flex items-center gap-1.5 text-xs">
            <select
              value={currentRole}
              onChange={(e) => {
                const nextRole = e.target.value as RoleType;
                if (nextRole !== currentRole) {
                  if (onRequestRoleSwitch) {
                    onRequestRoleSwitch(nextRole);
                  } else {
                    onRoleChange(nextRole);
                  }
                }
              }}
              className="h-9 sm:h-10 py-1.5 px-3 rounded bg-[#FFFFFF] border-2 border-[#1C3F35] shadow-[2px_2px_0_#1C3F35] font-bold text-[#1C3F35] focus:outline-none text-xs sm:text-sm cursor-pointer"
              title="Click to switch role (requires password)"
            >
              <option value="owner">👑 Owner (Ahmad Razak)</option>
              <option value="clerk">👤 Staff (Siti Aminah)</option>
              <option value="expert">⚖️ Tax Advisor (Dr. Farhan)</option>
            </select>
          </div>

          {/* Language Toggle */}
          <div className="language-toggle">
            <button
              onClick={() => onLanguageChange('en')}
              className={`lang ${language === 'en' ? 'active' : ''}`}
            >
              EN
            </button>
            <span className="lang-divider">|</span>
            <button
              onClick={() => onLanguageChange('bm')}
              className={`lang ${language === 'bm' ? 'active' : ''}`}
            >
              BM
            </button>
          </div>

          {/* Lock / Switch Account (Logout) */}
          {onLogout && (
            <button
              onClick={onLogout}
              className="h-8 sm:h-9 px-2 sm:px-2.5 rounded bg-[#FFFFFF] hover:bg-[#1C3F35] hover:text-[#FFFFFF] text-[#1C3F35] border-2 border-[#1C3F35] shadow-[2px_2px_0_#1C3F35] flex items-center gap-1.5 transition-colors cursor-pointer text-xs font-bold"
              title={isBM ? 'Kunci & Tukar Pengguna (Perlu Kata Laluan)' : 'Lock & Switch Account (Requires Password)'}
              aria-label="Logout or switch account"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isBM ? 'Tukar Akaun' : 'Lock/Logout'}</span>
            </button>
          )}

          {/* 60s Onboarding Guide (?) Button */}
          {onOpenWelcomeGuide && (
            <button
              onClick={onOpenWelcomeGuide}
              className="w-8 sm:w-9 h-8 sm:h-9 rounded bg-[#FFFFFF] hover:bg-[#1C3F35] hover:text-[#FFFFFF] text-[#1C3F35] border-2 border-[#1C3F35] shadow-[2px_2px_0_#1C3F35] flex items-center justify-center transition-colors cursor-pointer"
              title={isBM ? 'Buka panduan pantas 60 saat' : 'Open 60-second quick guide'}
              aria-label="Open Guide"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
