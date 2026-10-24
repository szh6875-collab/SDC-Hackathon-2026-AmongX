import React, { useState, useEffect } from 'react';
import {
  X,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  Sparkles,
  ShieldAlert,
  Crown,
  UserCheck,
  Scale,
  CheckCircle2,
} from 'lucide-react';
import { RoleType, LanguageType } from '../types';
import { DEMO_CREDENTIALS, verifyRolePassword } from '../services/api';

interface RoleSwitchModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetRole: RoleType;
  currentRole: RoleType;
  onConfirmSwitch: (role: RoleType, password: string) => Promise<void>;
  language: LanguageType;
}

export const RoleSwitchModal: React.FC<RoleSwitchModalProps> = ({
  isOpen,
  onClose,
  targetRole,
  currentRole,
  onConfirmSwitch,
  language,
}) => {
  if (!isOpen) return null;

  const isBM = language === 'bm';
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    setPassword('');
    setErrorMsg(null);
    setShowPassword(false);
  }, [targetRole, isOpen]);

  const roleMeta: Record<
    RoleType,
    { title: string; subtitle: string; icon: any; iconColor: string; bg: string; badge: string; demoPassword: string }
  > = {
    owner: {
      title: isBM ? 'Pemilik PKS / Pengarah' : 'SME Owner / Director',
      subtitle: isBM ? 'Kuasa penuh meluluskan invois & lejar SHA-256' : 'Full authorization & SHA-256 ledger sign-off',
      icon: Crown,
      iconColor: 'text-amber-500',
      bg: 'bg-amber-50 border-amber-200 text-amber-900',
      badge: isBM ? 'Kuasa Penuh' : 'Full Authority',
      demoPassword: DEMO_CREDENTIALS.owner.password,
    },
    clerk: {
      title: isBM ? 'Staf / Kerani Kewangan' : 'Staff / Finance Clerk',
      subtitle: isBM ? 'Pengambilan fail & mod paparan terlindung (TIN bertapis)' : 'Invoice intake & view-only mode (masked TINs)',
      icon: UserCheck,
      iconColor: 'text-blue-500',
      bg: 'bg-blue-50 border-blue-200 text-blue-900',
      badge: isBM ? 'Paparan Sahaja' : 'View-Only',
      demoPassword: DEMO_CREDENTIALS.clerk.password,
    },
    expert: {
      title: isBM ? 'Penasihat / Pakar Cukai' : 'Tax Advisor / Consultant',
      subtitle: isBM ? 'Semakan pek dasar Belanjawan 2027 & pengesahan peraturan' : 'Budget 2027 statutory review & candidate activation',
      icon: Scale,
      iconColor: 'text-purple-500',
      bg: 'bg-purple-50 border-purple-200 text-purple-900',
      badge: isBM ? 'Tadbir Urus' : 'Governance',
      demoPassword: DEMO_CREDENTIALS.expert.password,
    },
  };

  const target = roleMeta[targetRole];
  const current = roleMeta[currentRole];
  const TargetIcon = target.icon;
  const CurrentIcon = current.icon;

  const handleQuickFill = () => {
    setPassword(target.demoPassword);
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setErrorMsg(isBM ? 'Sila masukkan kata laluan untuk mengesahkan.' : 'Please enter the password to confirm.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const result = await verifyRolePassword(targetRole, password.trim());
      if (!result.success) {
        setErrorMsg(
          isBM
            ? `Kata laluan salah bagi peranan "${target.title}". Sila semak semula.`
            : `Incorrect password for role "${target.title}". Please try again.`
        );
        setIsSubmitting(false);
        return;
      }

      await onConfirmSwitch(targetRole, password.trim());
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1C3F35]/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-[#FFFFFF] rounded border-2 border-[#1C3F35] shadow-[8px_8px_0_#1C3F35] w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b-2 border-[#1C3F35] flex items-center justify-between bg-[#FAF5E8]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-[#EDF6EB] text-[#1C3F35] border border-[#1C3F35] flex items-center justify-center font-bold">
              <Lock className="w-4 h-4 text-[#285443]" />
            </div>
            <div>
              <h2 className="text-sm font-serif font-bold text-[#1C3F35] leading-tight">
                {isBM ? 'Pengesahan Tukar Peranan' : 'Switch Role Authentication'}
              </h2>
              <p className="text-[11px] text-[#4A635B] font-medium font-mono">
                {isBM ? 'Kata laluan diperlukan untuk menukar peranan pengguna' : 'Password verification required to switch role'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded text-[#1C3F35] hover:bg-[#FFFFFF] border border-[#1C3F35] transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Current -> Target Role Visual */}
          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between gap-3 text-xs">
            {/* From */}
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
                <CurrentIcon className={`w-3.5 h-3.5 ${current.iconColor}`} />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  {isBM ? 'Peranan Asal' : 'Current Role'}
                </div>
                <div className="font-bold text-slate-800 truncate">{current.title}</div>
              </div>
            </div>

            <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />

            {/* To */}
            <div className="flex items-center gap-2 min-w-0 text-right">
              <div className="min-w-0">
                <div className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">
                  {isBM ? 'Peranan Sasaran' : 'Target Role'}
                </div>
                <div className="font-bold text-slate-900 truncate">{target.title}</div>
              </div>
              <div className="w-7 h-7 rounded-lg bg-white border border-blue-200 flex items-center justify-center shrink-0 shadow-2xs">
                <TargetIcon className={`w-3.5 h-3.5 ${target.iconColor}`} />
              </div>
            </div>
          </div>

          {/* Target Role Permissions Notice */}
          <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200/80 text-xs text-blue-900 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-blue-600" />
              <span>{isBM ? 'Hak Akses Peranan Baharu:' : 'Target Permissions:'}</span>
            </div>
            <p className="text-[11px] text-blue-800 leading-relaxed">
              {target.subtitle}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3 pt-1">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">
                  {isBM ? `Kata Laluan (${target.title})` : `Password (${target.title})`}
                </label>

                <button
                  type="button"
                  onClick={handleQuickFill}
                  className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 cursor-pointer underline underline-offset-2"
                >
                  <Sparkles className="w-3 h-3 text-blue-600" />
                  <span>{isBM ? `Guna demo: "${target.demoPassword}"` : `Use demo: "${target.demoPassword}"`}</span>
                </button>
              </div>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder={isBM ? `Masukkan kata laluan ${target.title}...` : `Enter password for ${target.title}...`}
                  className="w-full h-10 pl-3 pr-10 rounded bg-[#FAF5E8] border-2 border-[#1C3F35] text-[#1C3F35] placeholder-[#6B857D] text-xs font-mono shadow-[2px_2px_0_#1C3F35] focus:outline-none focus:border-[#285443] transition-all"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4A635B] hover:text-[#1C3F35] cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="p-2.5 rounded bg-[#FDF2F2] border-2 border-[#B33927] text-[#991B1B] text-xs flex items-center gap-2 shadow-[2px_2px_0_#B33927]">
                <AlertCircle className="w-4 h-4 text-[#B33927] shrink-0" />
                <span className="font-semibold">{errorMsg}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="h-9 px-4 rounded border-2 border-[#1C3F35] bg-[#FFFFFF] hover:bg-[#FAF8F2] text-[#1C3F35] font-bold text-xs transition-colors shadow-[2px_2px_0_#1C3F35] cursor-pointer"
              >
                {isBM ? 'Batal' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="h-9 px-4 rounded bg-[#285443] hover:bg-[#19382E] disabled:bg-[#4A635B] text-white font-bold text-xs transition-colors flex items-center gap-1.5 border-2 border-[#1C3F35] shadow-[3px_3px_0_#1C3F35] cursor-pointer"
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{isBM ? 'Sahkan & Tukar Peranan' : 'Confirm & Switch Role'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
