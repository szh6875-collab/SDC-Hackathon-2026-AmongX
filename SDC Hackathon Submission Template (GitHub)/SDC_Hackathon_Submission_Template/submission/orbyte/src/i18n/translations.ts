export type Lang = 'en' | 'bm';

export const i18n = {
  // Common action buttons & states
  common: {
    upload: { en: 'Upload Invoice', bm: 'Muat Naik Invois' },
    verify: { en: 'Verify', bm: 'Sahkan' },
    approve: { en: 'Approve', bm: 'Luluskan' },
    reject: { en: 'Reject', bm: 'Tolak' },
    cancel: { en: 'Cancel', bm: 'Batal' },
    save: { en: 'Save', bm: 'Simpan' },
    edit: { en: 'Edit', bm: 'Ubah' },
    refresh: { en: 'Refresh', bm: 'Segarkan' },
    download: { en: 'Download', bm: 'Muat Turun' },
    details: { en: 'Details', bm: 'Butiran' },
    close: { en: 'Close', bm: 'Tutup' },
    status: { en: 'Status', bm: 'Status' },
    copy: { en: 'Copy', bm: 'Salin' },
    copied: { en: 'Copied!', bm: 'Disalin!' },
    takeMeThere: { en: 'Take me there', bm: 'Bawa saya ke sana' },
    trySample: { en: 'Try Sample Invoice', bm: 'Cuba Invois Contoh' },
    learnMore: { en: 'Learn more', bm: 'Ketahui lebih lanjut' },
    allGood: { en: 'All clear', bm: 'Semua teratur' },
  },

  // Navigation items
  nav: {
    dashboard: {
      title: { en: 'Overview', bm: 'Gambaran Keseluruhan' },
      desc: { en: 'Compliance status and daily start point', bm: 'Status pematuhan & titik mula harian' },
    },
    invois: {
      title: { en: 'Invoice Intake', bm: 'Semakan Invois' },
      desc: { en: 'Multi-format parse & rule check', bm: 'Ekstrak pelbagai format & semakan peraturan' },
    },
    eligibility: {
      title: { en: 'Policy Eligibility', bm: 'Kelayakan Dasar' },
      desc: { en: 'Budget 2027 tax & grant pre-check', bm: 'Pra-semakan cukai & geran Belanjawan 2027' },
    },
    radar: {
      title: { en: 'Exemption Radar', bm: 'Radar Pengecualian' },
      desc: { en: 'RM3M turnover reference screening', bm: 'Saringan rujukan perolehan RM3J' },
    },
    approvals: {
      title: { en: 'Approval Center', bm: 'Pusat Kelulusan' },
      desc: { en: 'Owner sign-off and RBAC enforcement', bm: 'Kelulusan pemilik & kawalan RBAC' },
    },
    policy: {
      title: { en: 'Policy Center', bm: 'Pusat Dasar' },
      desc: { en: 'Rule catalog and Gazette parser', bm: 'Katalog peraturan & penghurai warta' },
    },
    replay: {
      title: { en: 'Policy Replay', bm: 'Simulasi Dasar' },
      desc: { en: 'Test rules against 50 synthetic SMEs', bm: 'Uji peraturan terhadap 50 profil PKS' },
    },
    audit: {
      title: { en: 'Audit Ledger', bm: 'Lejar Audit' },
      desc: { en: 'In-memory SHA-256 chain verification', bm: 'Pengesahan rantaian kriptografi memori' },
    },
    tests: {
      title: { en: 'Acceptance Tests', bm: 'Suit Ujian' },
      desc: { en: '15 core regression & security checks', bm: '15 semakan regresi & keselamatan' },
    },
    groupStart: { en: 'Getting Started', bm: 'Mula Di Sini' },
    groupDaily: { en: 'Daily SME Tasks', bm: 'Tugasan Harian PKS' },
    groupPolicy: { en: 'Policy Management', bm: 'Pengurusan Dasar' },
    groupAdvanced: { en: 'Advanced & Audit', bm: 'Audit & Pengesahan Lanjutan' },
  },

  // Roles
  roles: {
    clerk: {
      name: { en: 'Staff / Clerk', bm: 'Staf / Kerani' },
      roleDesc: {
        en: 'Can view masked invoices & upload receipts. Approvals blocked with HTTP 403.',
        bm: 'Boleh lihat invois bertapis & muat naik resit. Kelulusan dihalang (HTTP 403).',
      },
    },
    owner: {
      name: { en: 'SME Owner', bm: 'Pemilik PKS' },
      roleDesc: {
        en: 'Full administrative rights: can edit fields and authorize invoice drafts.',
        bm: 'Hak pentadbiran penuh: boleh sahkan data & meluluskan draf invois.',
      },
    },
    expert: {
      name: { en: 'Tax Expert', bm: 'Pakar Cukai' },
      roleDesc: {
        en: 'Policy publisher: can review Gazettes, diffs, and activate rule packs.',
        bm: 'Penerbit dasar: boleh menyemak warta, perbezaan, & meluluskan pek peraturan.',
      },
    },
  },

  // Onboarding & Guide
  onboarding: {
    welcomeTitle: { en: 'Welcome to Orbyte Hub', bm: 'Selamat Datang ke Orbyte Hub' },
    welcomeSubtitle: {
      en: 'A compliance and invoice gateway designed for Malaysian SMEs. Start in 3 simple steps:',
      bm: 'Gerbang pematuhan dan e-invois untuk PKS Malaysia. Mulakan dalam 3 langkah mudah:',
    },
    step1Title: { en: '1. Ingest an Invoice', bm: '1. Muat Naik Invois' },
    step1Desc: {
      en: 'Drag in a PDF, image, or WhatsApp receipt. The engine extracts amount, buyer, and TIN.',
      bm: 'Seret fail PDF, imej, atau mesej WhatsApp. Enjin mengekstrak jumlah, pembeli & TIN.',
    },
    step2Title: { en: '2. Check & Confirm', bm: '2. Semak & Betulkan' },
    step2Desc: {
      en: 'Review deterministic checks and configured review prompts; edit any low-confidence fields.',
      bm: 'Semak pemeriksaan deterministik dan petunjuk semakan yang dikonfigurasikan; betulkan medan jika perlu.',
    },
    step3Title: { en: '3. Owner Sign-Off', bm: '3. Kelulusan Pemilik' },
    step3Desc: {
      en: 'Owner approves the action list; the event is recorded in the local SHA-256 hash-chain audit log.',
      bm: 'Pemilik meluluskan tindakan, direkodkan ke dalam lejar audit berantai SHA-256.',
    },
    dismiss: { en: 'Got it, let me explore', bm: 'Faham, biar saya cuba' },
  },

  // Status badges
  status: {
    ready: { en: 'Ready to Submit', bm: 'Sedia Dihantar' },
    reviewRequired: { en: 'Review Required', bm: 'Semakan Diperlukan' },
    missingInfo: { en: 'Missing Info', bm: 'Maklumat Tidak Lengkap' },
    approved: { en: 'Approved & Committed', bm: 'Diluluskan & Dirantai' },
    blocked: { en: 'Threshold Blocked', bm: 'Disekat Oleh Ambang' },
    pass: { en: 'Pass', bm: 'Lulus' },
    warn: { en: 'Notice', bm: 'Pemberitahuan' },
  },
} as const;

export function t<T extends Record<Lang, string>>(item: T, lang: Lang): string {
  return item[lang] || item['en'];
}
