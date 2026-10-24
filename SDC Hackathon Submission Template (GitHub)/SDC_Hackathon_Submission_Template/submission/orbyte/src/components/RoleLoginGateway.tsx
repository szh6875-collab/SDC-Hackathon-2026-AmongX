import React, { useState } from 'react';
import {
  Crown,
  UserCheck,
  Scale,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { RoleType, LanguageType } from '../types';
import { DEMO_CREDENTIALS, setClientRole } from '../services/api';

interface RoleLoginGatewayProps {
  onLoginSuccess: (role: RoleType) => void;
  onBackHome: () => void;
  language: LanguageType;
  onLanguageChange: (lang: LanguageType) => void;
}

export const RoleLoginGateway: React.FC<RoleLoginGatewayProps> = ({
  onLoginSuccess,
  onBackHome,
  language,
  onLanguageChange,
}) => {
  const isBM = language === 'bm';
  const [selectedRole, setSelectedRole] = useState<RoleType>('owner');
  const [password, setPassword] = useState<string>(DEMO_CREDENTIALS.owner.password);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const roles = [
    {
      id: 'owner' as RoleType,
      title: isBM ? 'Pemilik PKS / Pengarah' : 'SME Owner / Director',
      badge: isBM ? 'Kuasa Penuh' : 'Full Authority',
      iconClass: 'icon-owner',
      tagClass: 'tag-owner',
      emoji: '👑',
      user: 'Ahmad Razak',
      desc: isBM
        ? 'Kuasa penuh meluluskan e-Invois, menandatangani rekod SHA-256, dan mengurus entiti syarikat.'
        : 'Full authority to authorize e-invoices, commit cryptographically chained SHA-256 records, and manage companies.',
      demoPassword: DEMO_CREDENTIALS.owner.password,
    },
    {
      id: 'clerk' as RoleType,
      title: isBM ? 'Staf / Kerani Kewangan' : 'Staff / Finance Clerk',
      badge: isBM ? 'Mod Paparan Sahaja' : 'Intake & View-Only',
      iconClass: 'icon-clerk',
      tagClass: 'tag-clerk',
      emoji: '👤',
      user: 'Siti Aminah',
      desc: isBM
        ? 'Pengambilan fail invois, semakan data, dan paparan terlindung dengan nombor cukai TIN bertapis.'
        : 'Process incoming invoice files, review parsed data, and operate in safe view-only mode with masked TINs.',
      demoPassword: DEMO_CREDENTIALS.clerk.password,
    },
    {
      id: 'expert' as RoleType,
      title: isBM ? 'Penasihat / Pakar Cukai' : 'Tax Advisor / Consultant',
      badge: isBM ? 'Tadbir Urus Dasar' : 'Policy & Governance',
      iconClass: 'icon-advisor',
      tagClass: 'tag-advisor',
      emoji: '⚖️',
      user: 'Dr. Farhan Ismail',
      desc: isBM
        ? 'Akses kepada Pusat Dasar LHDN Belanjawan 2027, semakan Diff peraturan, dan pelan operasi.'
        : 'Access statutory policy schedule diffs, Budget 2027 LHDN guidelines, and compliance simulation test suite.',
      demoPassword: DEMO_CREDENTIALS.expert.password,
    },
  ];

  const handleRoleSelect = (roleId: RoleType) => {
    setSelectedRole(roleId);
    setPassword(DEMO_CREDENTIALS[roleId].password);
    setErrorMsg(null);
  };

  const handleQuickFill = () => {
    setPassword(DEMO_CREDENTIALS[selectedRole].password);
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setErrorMsg(isBM ? 'Sila masukkan kata laluan untuk peranan ini.' : 'Please enter the password for this role.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await setClientRole(selectedRole, password.trim());
      onLoginSuccess(selectedRole);
    } catch (err: any) {
      setErrorMsg(
        err.message?.includes('401') || err.message?.includes('credentials')
          ? (isBM
              ? `Kata laluan salah bagi peranan "${DEMO_CREDENTIALS[selectedRole].roleLabel}". Sila cuba lagi.`
              : `Incorrect password for role "${DEMO_CREDENTIALS[selectedRole].roleLabel}". Please try again.`)
          : (err.message || 'Authentication error')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeRoleConfig = roles.find((r) => r.id === selectedRole) || roles[0];

  return (
    <div className="rbac-page-body min-h-screen flex flex-col justify-between select-none">
      {/* Top Header matching Orbyte InvoisReady benchmark */}
      <header className="site-header">
        <div className="nav-container">
          <div className="brand">
            <svg
              className="brand-mark"
              viewBox="0 0 32 32"
              aria-hidden="true"
              shapeRendering="crispEdges"
            >
              <path fill="#102b44" d="M2 2h28v28H2z" />
              <path fill="#f7f0dc" d="M6 6h8v8H6zm12 0h8v8h-8zM6 18h8v8H6z" />
              <path fill="#f2b84b" d="M18 18h8v8h-8z" />
            </svg>
            <span className="font-mono font-bold tracking-tight text-sm sm:text-base">
              ORBYTE <strong className="text-[#1C3F35]">INVOISREADY</strong>
            </span>
          </div>

          <div className="language-toggle">
            <button
              type="button"
              onClick={() => onLanguageChange('en')}
              className={`lang ${language === 'en' ? 'active' : ''}`}
            >
              EN
            </button>
            <span className="lang-divider">|</span>
            <button
              type="button"
              onClick={() => onLanguageChange('bm')}
              className={`lang ${language === 'bm' ? 'active' : ''}`}
            >
              BM
            </button>
          </div>
        </div>
      </header>

      {/* Main Authentication Container */}
      <main className="rbac-container">
        <button type="button" className="login-home-link" onClick={onBackHome}><ArrowLeft size={14} /> {isBM ? 'Kembali ke laman utama' : 'Back to homepage'}</button>
        {/* Header Section */}
        <div className="rbac-header">
          <div className="tag-badge">
            <span className="tag-accent-box" />
            <span>
              {isBM ? 'AKSES BERASASKAN PERANAN (RBAC)' : 'ROLE-BASED ACCESS CONTROL (RBAC)'}
            </span>
          </div>
          <h1 className="rbac-title">
            {isBM ? 'Pilih Peranan & Masukkan Kata Laluan' : 'Select Your Role & Enter Password'}
          </h1>
          <p className="rbac-subtitle">
            {isBM
              ? 'Sila pilih sama ada anda Pemilik (Owner), Staf (Staff), atau Penasihat Cukai (Tax Advisor) sebelum menggunakan platform.'
              : 'Select whether you are the SME Owner, Staff, or Tax Advisor and enter your password to enter the hub.'}
          </p>
        </div>

        {/* 3 Role Cards Grid */}
        <div className="rbac-cards-grid">
          {roles.map((r) => {
            const isSelected = selectedRole === r.id;
            return (
              <div
                key={r.id}
                role="button"
                tabIndex={0}
                onClick={() => handleRoleSelect(r.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleRoleSelect(r.id);
                  }
                }}
                className={`rbac-card ${isSelected ? 'selected' : ''}`}
              >
                <div>
                  <div className="rbac-card-top">
                    <div className={`rbac-icon-badge ${r.iconClass}`}>
                      <span>{r.emoji}</span>
                    </div>
                    <div className="rbac-radio-circle">
                      <span className="rbac-check-dot">✓</span>
                    </div>
                  </div>

                  <div className="rbac-card-body">
                    <h3 className="rbac-card-title">{r.title}</h3>
                    <div className="rbac-user-name">{r.user}</div>
                    <p className="rbac-card-desc">{r.desc}</p>
                  </div>
                </div>

                <div className="mt-4">
                  <span className={`rbac-tag-pill ${r.tagClass}`}>{r.badge}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Password Form Card */}
        <div className="rbac-form-card">
          <form onSubmit={handleSubmit}>
            <div className="rbac-form-meta">
              <label htmlFor="rbac-password-input" className="rbac-pass-label">
                <Lock className="w-4 h-4 text-[#1C3F35]" />
                <span>
                  {isBM
                    ? `Kata Laluan untuk ${activeRoleConfig.title}`
                    : `Password for ${activeRoleConfig.title}`}
                </span>
              </label>

              {/* 1-Click Demo Fill */}
              <button
                type="button"
                onClick={handleQuickFill}
                className="btn-demo-link flex items-center gap-1 cursor-pointer"
                title="Click to auto-fill demo password"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#285443]" />
                <span>
                  {isBM
                    ? `Isi Kata Laluan: "${activeRoleConfig.demoPassword}"`
                    : `Fill Demo Password: "${activeRoleConfig.demoPassword}"`}
                </span>
              </button>
            </div>

            <div className="rbac-input-wrap">
              <input
                id="rbac-password-input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder={
                  isBM
                    ? `Masukkan kata laluan ${activeRoleConfig.title}...`
                    : `Enter password for ${activeRoleConfig.title}...`
                }
                className="rbac-input font-mono"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="rbac-eye-btn"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Error Banner */}
            {errorMsg && (
              <div className="rbac-error-banner">
                <AlertCircle className="w-4 h-4 text-[#B33927] shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary rbac-submit-btn flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>
                    {isBM ? 'Masuk ke Platform Orbyte Hub' : 'Enter Orbyte Hub Platform'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Local Credentials Guide */}
          <div className="rbac-hint-footer">
            <span>
              {isBM ? 'Kredensial Demo Setempat: ' : 'Local Demo Credentials: '}
            </span>
            <span className="inline-flex flex-wrap items-center justify-center gap-2 mt-1">
              <span>
                owner: <strong className="rbac-code">owner123</strong>
              </span>
              <span>•</span>
              <span>
                staff: <strong className="rbac-code">clerk123</strong>
              </span>
              <span>•</span>
              <span>
                tax advisor: <strong className="rbac-code">expert123</strong>
              </span>
            </span>
          </div>
        </div>
      </main>

      {/* Neo-brutalist Footer */}
      <footer className="site-footer border-t-2 border-[#1C3F35] bg-[#FAF5E8] py-3 px-6 text-xs text-[#4A635B] flex flex-wrap items-center justify-between gap-2">
        <div className="font-medium">
          Orbyte Hub — Malaysian SME e-Invoice &amp; Policy Compliance Platform
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px]">
          <span className="w-2 h-2 rounded-full bg-[#285443]" />
          <span>Local demo environment</span>
        </div>
      </footer>
    </div>
  );
};
