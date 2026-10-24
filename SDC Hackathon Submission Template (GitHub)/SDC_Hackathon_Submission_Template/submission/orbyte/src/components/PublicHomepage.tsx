import React, { useState } from 'react';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  FileCheck2,
  Landmark,
  MessageCircleMore,
  ShieldCheck,
  ScanText,
  ClipboardCheck,
  Menu,
  X,
} from 'lucide-react';
import './public-homepage.css';

type PublicHomepageProps = {
  onGetStarted: () => void;
};

const BrandMark = () => (
  <svg className="oh-brand-mark" viewBox="0 0 32 32" aria-hidden="true" shapeRendering="crispEdges">
    <path fill="#1C3F35" d="M2 2h13v13H2z" />
    <path fill="#8EAE91" d="M17 2h13v13H17z" />
    <path fill="#E5A842" d="M17 17h13v13H17z" />
    <path fill="#285443" d="M2 17h13v13H2z" />
    <path fill="#FAF5E8" d="M6 6h5v5H6zm15 0h5v5h-5zM6 21h5v5H6z" />
  </svg>
);

export const PublicHomepage: React.FC<PublicHomepageProps> = ({ onGetStarted }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const jumpTo = (id: string) => {
    setIsMobileMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="orbyte-public-home">
      <header className="oh-nav">
        <div className="oh-container oh-nav-inner">
          <a
            className="oh-brand"
            href="#top"
            aria-label="Orbyte InvoisReady homepage"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
              setIsMobileMenuOpen(false);
            }}
          >
            <BrandMark />
            <span>Orbyte InvoisReady</span>
          </a>
          <nav className="oh-nav-links" aria-label="Main navigation">
            <a href="#features">Features</a>
            <a href="#how-it-works">How It Works</a>
            <a href="#trust">Policy Sources</a>
          </nav>
          <div className="oh-nav-actions">
            <button
              type="button"
              className="oh-button oh-button-primary oh-nav-cta"
              onClick={onGetStarted}
            >
              Get Started <ArrowRight size={17} />
            </button>
            <button
              type="button"
              className="oh-nav-toggle md:hidden"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
        {isMobileMenuOpen && (
          <nav className="oh-mobile-menu" aria-label="Mobile navigation">
            <a
              href="#features"
              onClick={(e) => {
                e.preventDefault();
                jumpTo('features');
              }}
            >
              Features
            </a>
            <a
              href="#how-it-works"
              onClick={(e) => {
                e.preventDefault();
                jumpTo('how-it-works');
              }}
            >
              How It Works
            </a>
            <a
              href="#trust"
              onClick={(e) => {
                e.preventDefault();
                jumpTo('trust');
              }}
            >
              Policy Sources
            </a>
            <button
              type="button"
              className="oh-button oh-button-primary w-full mt-2"
              onClick={() => {
                setIsMobileMenuOpen(false);
                onGetStarted();
              }}
            >
              Get Started <ArrowRight size={16} />
            </button>
          </nav>
        )}
      </header>

      <main>
        <section className="oh-hero" id="top">
          <div className="oh-container oh-hero-grid">
            <div className="oh-hero-copy">
              <div className="oh-eyebrow">
                <span className="oh-eyebrow-square" /> BUILT FOR MALAYSIAN SMEs
              </div>
              <h1>
                Compliance,
                <br />
                Made <span>Clearer.</span>
              </h1>
              <p className="oh-hero-lede">
                Explore relevant SME policies, assess potential eligibility, and manage statutory e-Invoice
                requirements with verified guidance and evidence-aware checks.
              </p>
              <div className="oh-hero-actions">
                <button
                  type="button"
                  className="oh-button oh-button-primary"
                  onClick={onGetStarted}
                >
                  Get Started <ArrowRight size={17} />
                </button>
                <button
                  type="button"
                  className="oh-button oh-button-secondary"
                  onClick={() => jumpTo('features')}
                >
                  Explore Features
                </button>
              </div>
              <div className="oh-proof-row">
                <span>
                  <i><Check size={14} /></i> Practical guidance
                </span>
                <span>
                  <i><Check size={14} /></i> Evidence-aware checks
                </span>
              </div>
            </div>

            <div className="oh-preview-stage" aria-label="Illustrative Orbyte InvoisReady dashboard preview">
              <div className="oh-preview-tape" />
              <div className="oh-preview-window">
                <div className="oh-window-bar">
                  <div className="oh-window-dots"><i /><i /><i /></div>
                  <span>ORBYTE INVOISREADY WORKSPACE</span>
                  <span className="oh-demo-pill">DEMO PREVIEW</span>
                </div>
                <div className="oh-preview-body">
                  <aside className="oh-mini-sidebar">
                    <div className="oh-mini-brand">
                      <BrandMark />
                      <b>Orbyte InvoisReady</b>
                    </div>
                    <div className="oh-mini-nav active"><ClipboardCheck size={14} /> Overview</div>
                    <div className="oh-mini-nav"><FileCheck2 size={14} /> InvoisReady</div>
                    <div className="oh-mini-nav"><Landmark size={14} /> Policy checks</div>
                    <div className="oh-mini-nav"><MessageCircleMore size={14} /> Policy Q&amp;A</div>
                  </aside>
                  <div className="oh-mini-content">
                    <div className="oh-mini-heading">
                      <div>
                        <small>YOUR BUSINESS WORKSPACE</small>
                        <h3>Business overview</h3>
                      </div>
                      <div className="oh-avatar">SM</div>
                    </div>
                    <div className="oh-mini-metrics">
                      <div>
                        <span>INVOICE INTAKE</span>
                        <b><FileCheck2 size={15} /> Ready to review</b>
                        <small>Extracted invoice details</small>
                      </div>
                      <div>
                        <span>POLICY ELIGIBILITY</span>
                        <b><ShieldCheck size={15} /> Pre-check</b>
                        <small>Based on configured rules</small>
                      </div>
                      <div>
                        <span>POLICY Q&amp;A</span>
                        <b><MessageCircleMore size={15} /> Ask a question</b>
                        <small>With available references</small>
                      </div>
                    </div>
                    <div className="oh-mini-lower">
                      <div className="oh-mini-activity">
                        <h4>Review workflow</h4>
                        <div>
                          <i className="good"><Check size={12} /></i>
                          <span>
                            <b>Extract invoice details</b>
                            <small>Check fields and amounts</small>
                          </span>
                        </div>
                        <div>
                          <i className="gold"><ScanText size={12} /></i>
                          <span>
                            <b>Check missing information</b>
                            <small>Review flags before approval</small>
                          </span>
                        </div>
                        <div>
                          <i className="good"><Check size={12} /></i>
                          <span>
                            <b>View policy evidence</b>
                            <small>Open relevant references</small>
                          </span>
                        </div>
                      </div>
                      <div className="oh-mini-quick">
                        <h4>Quick actions</h4>
                        <button type="button" onClick={onGetStarted}>
                          <FileCheck2 size={13} /> Check an invoice <ArrowUpRight size={12} />
                        </button>
                        <button type="button" onClick={onGetStarted}>
                          <Landmark size={13} /> Check eligibility <ArrowUpRight size={12} />
                        </button>
                        <button type="button" onClick={onGetStarted}>
                          <MessageCircleMore size={13} /> Ask about policy <ArrowUpRight size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="oh-preview-note"><span /> A clearer view of compliance tasks</div>
              <div className="oh-floating-mark" aria-hidden="true"><ShieldCheck size={28} /></div>
            </div>
          </div>
        </section>

        <section className="oh-features" id="features">
          <div className="oh-container">
            <div className="oh-section-heading">
              <div>
                <div className="oh-eyebrow">
                  <span className="oh-eyebrow-square" /> WHAT ORBYTE INVOISREADY HELPS WITH
                </div>
                <h2>The essentials, in one workspace.</h2>
                <p>Practical tools for e-Invoice readiness, statutory policy checks, and clearer tax decisions.</p>
              </div>
              <button type="button" className="oh-text-link" onClick={onGetStarted}>
                Explore Orbyte InvoisReady <ArrowRight size={15} />
              </button>
            </div>
            <div className="oh-feature-grid">
              <article className="oh-feature-card">
                <div className="oh-feature-image-wrapper">
                  <img
                    src="https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=800&q=80"
                    alt="Digital e-invoice document analysis and ledger review"
                    className="oh-feature-photo"
                    loading="lazy"
                  />
                  <div className="oh-feature-badge gold">
                    <FileCheck2 size={16} />
                    <span>e-Invoice Validation</span>
                  </div>
                </div>
                <div className="oh-feature-text-block">
                  <div className="oh-card-label">INVOICE READINESS &amp; VALIDATION</div>
                  <h3>Review &amp; validate e-invoices with clarity.</h3>
                  <p>Extract structured invoice lines, verify buyer and supplier tax identifiers (TIN/SST), identify missing mandatory fields, and ensure full LHDN compliance before director authorization.</p>
                </div>
              </article>

              <article className="oh-feature-card">
                <div className="oh-feature-image-wrapper">
                  <img
                    src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80"
                    alt="Modern corporate financial enterprise and tax incentives"
                    className="oh-feature-photo"
                    loading="lazy"
                  />
                  <div className="oh-feature-badge sage">
                    <Landmark size={16} />
                    <span>Policy Eligibility</span>
                  </div>
                </div>
                <div className="oh-feature-text-block">
                  <div className="oh-card-label">POLICY ELIGIBILITY &amp; TAX INCENTIVES</div>
                  <h3>Understand SME statutory support &amp; thresholds.</h3>
                  <p>Assess your company's eligibility against official LHDN guidelines, turnover thresholds, capital allowance rates, and SME preferential tax rate schedules with automated checks.</p>
                </div>
              </article>

              <article className="oh-feature-card">
                <div className="oh-feature-image-wrapper">
                  <img
                    src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=800&q=80"
                    alt="Business advisory team reviewing compliance guidelines"
                    className="oh-feature-photo"
                    loading="lazy"
                  />
                  <div className="oh-feature-badge mint">
                    <MessageCircleMore size={16} />
                    <span>Verified Evidence</span>
                  </div>
                </div>
                <div className="oh-feature-text-block">
                  <div className="oh-card-label">POLICY GUIDANCE &amp; MONITORING</div>
                  <h3>Ask compliance questions, verify official evidence.</h3>
                  <p>Explore instant answers with direct citations to official gazettes, e-invoice guidelines, and real-time policy monitoring state—keeping human decision-makers firmly in control.</p>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="oh-how" id="how-it-works">
          <div className="oh-container oh-how-inner">
            <div className="oh-how-intro">
              <div className="oh-eyebrow light">
                <span className="oh-eyebrow-square" /> HOW IT WORKS
              </div>
              <h2>
                From information
                <br />
                to informed action.
              </h2>
              <p>A clear workflow, with people still in control.</p>
            </div>
            <div className="oh-steps">
              <div className="oh-step">
                <span>01</span>
                <div>
                  <b>Provide information</b>
                  <p>Submit invoice details, business information, or a policy question.</p>
                </div>
              </div>
              <div className="oh-step-arrow"><ArrowDownRight size={22} /></div>
              <div className="oh-step">
                <span>02</span>
                <div>
                  <b>Check rules and evidence</b>
                  <p>Review configured checks and available policy references.</p>
                </div>
              </div>
              <div className="oh-step-arrow"><ArrowDownRight size={22} /></div>
              <div className="oh-step">
                <span>03</span>
                <div>
                  <b>Review and act</b>
                  <p>Confirm results, correct missing details, and complete required approvals.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="oh-trust" id="trust">
          <div className="oh-container oh-trust-inner">
            <div>
              <div className="oh-eyebrow">
                <span className="oh-eyebrow-square" /> THE ORBYTE INVOISREADY APPROACH
              </div>
              <h2>
                AI reads. Rules decide.
                <br />
                <span>Humans approve.</span>
              </h2>
            </div>
            <div className="oh-trust-copy">
              <p>
                Orbyte InvoisReady combines assisted information extraction with configured rule checks and human
                review. Policy eligibility results are preliminary and should be confirmed against relevant official
                guidance.
              </p>
              <button type="button" className="oh-text-link" onClick={onGetStarted}>
                Enter your workspace <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="oh-footer">
        <div className="oh-container oh-footer-inner">
          <a
            className="oh-brand"
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            <BrandMark />
            <span>Orbyte InvoisReady</span>
          </a>
          <p>Built for Malaysian SMEs</p>
          <span className="oh-footer-note">
            Policy guidance should be verified against the latest official sources.
          </span>
          <button type="button" className="oh-button oh-button-primary" onClick={onGetStarted}>
            Get Started <ArrowRight size={17} />
          </button>
        </div>
      </footer>
    </div>
  );
};

