export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getAdminUser } from '@/lib/admin-auth'
import PrintButton from '@/components/PrintButton'

// Bespoke, fixed-layout Annual Review print sheet (front + back, landscape) — a
// faithful port of the reviewed design. The markup is a static, trusted string
// (no user input) rendered as-is so the printed page matches the approved mockup
// exactly; icons are inline SVG, the logo is served from /public. See
// docs/form-print-pdf.md. Not field-driven — this is a one-off branded form.

const STYLE = `:root{
    --green:#3FA23C; --blue:#1C74BC; --gold:#EFA31D; --red:#E23B3B;
    --navy:#0E2A55; --navy2:#16407e;
    --ink:#23324a; --muted:#6b7280; --line:#dde2e8; --soft:#f4f6f8;
    --cream:#fdfdf4; --card:#ffffff; --bg:#e9edf1;
  }
  *{box-sizing:border-box;}
  body{margin:0;font-family:"Segoe UI",Roboto,-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;color:var(--ink);}
  .wrap{background:var(--bg);padding:20px;min-height:100vh;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .bar{max-width:1040px;margin:0 auto 14px;display:flex;justify-content:space-between;align-items:center;gap:12px;}
  .bar .t{font-size:13px;color:var(--muted);}
  .bar .badge{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--green);background:#eafaef;border:1px solid #bfe6c8;border-radius:999px;padding:3px 9px;}
  .pdf{border:0;cursor:pointer;background:var(--green);color:#fff;font-weight:600;font-size:13px;font-family:inherit;padding:8px 14px;border-radius:8px;}
  .otog{display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden;font-size:12px;font-weight:600;}
  .otog a{padding:7px 13px;color:var(--muted);text-decoration:none;}
  .otog a.on{background:var(--navy);color:#fff;}

  .sheet{width:1040px;min-height:804px;margin:0 auto 22px;background:#fff;padding:26px 28px 20px;box-shadow:0 1px 4px rgba(0,0,0,.12);position:relative;display:flex;flex-direction:column;}

  /* ---------- Header / letterhead ---------- */
  .head{display:flex;align-items:stretch;gap:0;margin-bottom:12px;}
  .head .brand{display:flex;align-items:center;gap:14px;padding-right:22px;}
  .head .brand img{height:52px;width:auto;}
  .wordmark .l1{font-size:26px;font-weight:800;letter-spacing:.01em;color:var(--navy);line-height:1;}
  .wordmark .l1 .air{color:var(--navy);}
  .wordmark .l2{font-size:12.5px;font-weight:600;letter-spacing:.42em;color:var(--blue);margin-top:3px;}
  .tagband{flex:1;background:var(--navy);color:#fff;border-radius:8px;padding:12px 20px;display:flex;flex-direction:column;justify-content:center;clip-path:polygon(26px 0,100% 0,100% 100%,0 100%);}
  .tagband .a{color:#7fd28a;font-weight:800;font-size:16px;}
  .tagband .b{font-size:12px;color:#d7e0ef;margin-top:2px;}
  .title{font-size:30px;font-weight:800;letter-spacing:.01em;color:var(--navy);margin:2px 0 12px;}
  .title .g{color:var(--green);}

  /* ---------- Info fields ---------- */
  .info{display:grid;grid-template-columns:1fr 1fr;gap:8px 40px;border:1px solid var(--line);border-radius:12px;padding:14px 18px;margin-bottom:14px;}
  .fld{display:flex;align-items:center;gap:10px;font-size:13px;font-weight:600;color:var(--ink);}
  .fld svg{color:var(--green);flex:none;}
  .fld .ln{flex:1;border-bottom:1px solid #c4ccd4;height:16px;}

  /* ---------- Review sections 1-3 ---------- */
  .sec{display:flex;gap:14px;border:1px solid var(--line);border-radius:14px;padding:12px 14px;margin-bottom:10px;}
  .sec .body{flex:none;min-width:0;}
  .sec-title{display:flex;align-items:center;gap:10px;margin-bottom:6px;}
  .ic{flex:none;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;color:#fff;}
  .ic.lg{width:34px;height:34px;} .ic.sm{width:22px;height:22px;}
  .ic svg{width:60%;height:60%;}
  .sec-title .nm{font-size:14px;font-weight:800;letter-spacing:.02em;color:var(--navy);text-transform:uppercase;}
  .grid{display:grid;grid-template-columns:340px 30px 30px 30px 30px;align-items:center;justify-items:center;column-gap:2px;row-gap:5px;}
  .grid .hdr{display:flex;justify-content:center;}
  .grid .crit{font-size:12px;color:#33445c;padding-right:8px;justify-self:start;}
  .grid .crit .dot{color:var(--green);font-weight:800;}
  .rc{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;border:1.5px solid;font-size:9.5px;font-weight:800;line-height:1;}
  .rc.g{border-color:var(--green);color:var(--green);} .rc.b{border-color:var(--blue);color:var(--blue);} .rc.y{border-color:var(--gold);color:#b9820f;} .rc.r{border-color:var(--red);color:var(--red);}
  /* Column-header score numerals (replace the old rating icons) */
  .hn{font-size:15px;font-weight:800;line-height:1;}
  .hn.g{color:var(--green);} .hn.b{color:var(--blue);} .hn.y{color:#b9820f;} .hn.r{color:var(--red);}
  .coach{flex:1;min-width:0;display:flex;flex-direction:column;border:1px dashed #cfd6de;border-radius:10px;background:var(--soft);padding:8px 10px;}
  .coach .lbl{font-size:9.5px;font-weight:800;letter-spacing:.1em;color:var(--green);text-transform:uppercase;}
  /* One write-in line per criterion, evenly filling the box beside the grid */
  .coach .cline{flex:1;min-height:9px;border-bottom:1px solid #cfd6de;margin-top:7px;}

  /* ---------- Core values ---------- */
  .cv-wrap{border:1px solid var(--line);border-radius:14px;padding:12px 14px;}
  .cv-h{font-size:14px;font-weight:800;letter-spacing:.02em;color:var(--navy);text-transform:uppercase;margin-bottom:10px;}
  .cv-grid{display:grid;grid-template-columns:repeat(8,1fr);gap:6px;}
  .cv{text-align:center;padding:2px;}
  .cv .cvi{height:26px;display:flex;align-items:center;justify-content:center;margin-bottom:4px;}
  .cv .cvi svg{width:24px;height:24px;}
  .cv .cl{font-size:10px;font-weight:700;line-height:1.15;color:var(--navy);min-height:34px;}
  .cv .cc{display:flex;justify-content:center;gap:5px;margin-top:6px;}
  .cv-coach{margin-top:10px;border:1px dashed #cfd6de;border-radius:10px;background:var(--soft);padding:7px 10px;}
  .cv-coach .lbl{font-size:9.5px;font-weight:800;letter-spacing:.1em;color:var(--green);text-transform:uppercase;}

  /* ---------- Back page ---------- */
  .hsec{font-size:15px;font-weight:800;letter-spacing:.05em;color:var(--navy);text-transform:uppercase;text-align:center;margin:2px 0 12px;}
  .hsec.left{text-align:left;display:flex;align-items:center;gap:10px;}
  .hsec .rule{flex:1;height:1px;background:var(--line);}
  .scale-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:6px;}
  .scard{border:1.5px solid var(--line);border-radius:14px;padding:14px 12px;text-align:center;background:#fff;}
  .scard .ic{margin:0 auto 8px;}
  .scard .st{font-size:14px;font-weight:800;letter-spacing:.02em;text-transform:uppercase;}
  .scard .sd{font-size:11.5px;color:#4b5563;margin-top:6px;line-height:1.35;}
  .scard.g{border-color:#bfe6c8;} .scard.g .st{color:var(--green);} .scard.g .snum{color:var(--green);}
  .scard.b{border-color:#b9d6ef;} .scard.b .st{color:var(--blue);} .scard.b .snum{color:var(--blue);}
  .scard.y{border-color:#f3ddab;} .scard.y .st{color:#b9820f;} .scard.y .snum{color:#b9820f;}
  .scard.r{border-color:#f2c2c2;} .scard.r .st{color:var(--red);} .scard.r .snum{color:var(--red);}
  .scard .snum{font-size:34px;font-weight:800;line-height:1;margin-bottom:6px;}
  .scap{text-align:center;font-size:11.5px;color:var(--muted);margin:8px 0 16px;}

  /* Overall total-score tally (replaces the old select-one rating pills) */
  .totalbox{display:flex;align-items:center;justify-content:center;gap:16px;border:1.5px solid #bfe6c8;background:#f6fbf7;border-radius:14px;padding:16px 20px;margin-bottom:16px;}
  .totalbox .tl{font-size:14px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--navy);}
  .totalbox .tv{flex:none;width:130px;border-bottom:2px solid #9fb0c2;height:30px;}
  .totalbox .tm{font-size:22px;font-weight:800;color:var(--muted);}

  .sum-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px;}
  .sumcard{border:1px solid #ece7cf;background:var(--cream);border-radius:14px;padding:13px 14px;}
  .sumhead{display:flex;align-items:center;gap:9px;margin-bottom:8px;}
  .sumhead .tt{font-size:12px;font-weight:800;letter-spacing:.03em;text-transform:uppercase;}
  .sumcard.g .tt{color:var(--green);} .sumcard.b .tt{color:var(--blue);} .sumcard.y .tt{color:#b9820f;}
  .sumcard .q{font-size:11.5px;color:#54607a;line-height:1.35;min-height:44px;}
  .wl{height:15px;border-bottom:1px solid #cfd6de;margin-top:9px;}

  .rate-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px;}
  .rpill{display:flex;align-items:center;justify-content:center;gap:9px;border:1.5px solid var(--line);border-radius:12px;padding:12px;font-weight:800;font-size:13px;letter-spacing:.02em;text-transform:uppercase;}
  .rpill.g{border-color:#bfe6c8;color:var(--green);} .rpill.b{border-color:#b9d6ef;color:var(--blue);}
  .rpill.y{border-color:#f3ddab;color:#b9820f;} .rpill.r{border-color:#f2c2c2;color:var(--red);}

  .two{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;}
  .bcard{border:1px solid #ece7cf;background:var(--cream);border-radius:14px;padding:13px 14px;}
  .bcard .bh{font-size:12px;font-weight:800;letter-spacing:.03em;text-transform:uppercase;color:var(--green);}
  .bcard.dev .bh{color:var(--red);}
  .bcard .bs{font-size:11px;color:var(--muted);margin-top:2px;}
  .drow{display:flex;align-items:center;gap:8px;margin-top:11px;font-size:11.5px;font-weight:600;color:#3b465c;}
  .drow .ln{flex:1;border-bottom:1px solid #cfd6de;height:14px;}

  .sig-grid{display:grid;grid-template-columns:1fr 1fr;gap:26px;margin-top:2px;}
  .sig .sh{font-size:12px;font-weight:800;letter-spacing:.03em;text-transform:uppercase;color:var(--navy);margin-bottom:12px;}
  .sig .srow{display:flex;align-items:baseline;gap:8px;font-size:12px;color:#3b465c;margin-top:12px;}
  .sig .srow .ln{flex:1;border-bottom:1px solid #b7c0ca;height:15px;}
  .sig .srow.d .ln{max-width:150px;}

  .footer{margin-top:auto;background:var(--navy);border-radius:8px;color:#fff;display:flex;flex-wrap:wrap;justify-content:space-between;gap:6px 10px;padding:9px 16px;}
  .footer .fv{display:flex;align-items:center;gap:6px;font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#e6ecf6;}
  .footer .fv svg{width:14px;height:14px;color:#8fb4e6;}

  /* ── Fit-to-page compaction ───────────────────────────────────────────────
     Tighten spacing so EACH sheet (front / back) prints on ONE landscape Letter
     page at 100% scale — required for reliable duplex (front/back) printing.
     Overrides the roomier values above (same selectors, later in source order).
     Verified front≈722px / back≈719px, both under the ~758px usable height
     (8.5in − 0.6in margins @ 96dpi), ~36px headroom each. */
  .info{padding:7px 14px;margin-bottom:7px;}
  .sec{padding:6px 12px;margin-bottom:4px;}
  .sec-title{margin-bottom:3px;}
  .ic.lg{width:26px;height:26px;}
  .grid{row-gap:1px;}
  .rc{width:14px;height:14px;font-size:8.5px;}
  .crit{font-size:11px;}
  .coach{padding:5px 8px;}
  .cv-wrap{padding:6px 12px;}
  .cv-h{margin-bottom:5px;}
  .cv .cvi{height:20px;margin-bottom:2px;}
  .cv .cvi svg{width:20px;height:20px;}
  .cv .cl{min-height:22px;font-size:9.5px;}
  .cv .cc{margin-top:3px;}
  .cv-coach{margin-top:5px;padding:5px 8px;}
  .head{margin-bottom:7px;}
  .head .brand img{height:44px;}
  .title{font-size:25px;margin:2px 0 7px;}
  .scale-grid{gap:10px;margin-bottom:4px;}
  .scard{padding:10px 10px;}
  .scap{margin:5px 0 9px;}
  .hsec{margin:2px 0 8px;}
  .sum-grid{gap:10px;margin-bottom:9px;}
  .sumcard{padding:9px 12px;}
  .sumcard .q{min-height:34px;}
  .wl{height:13px;margin-top:6px;}
  .rate-grid{gap:10px;margin-bottom:9px;}
  .rpill{padding:9px;}
  .two{gap:10px;margin-bottom:9px;}
  .bcard{padding:9px 12px;}
  .drow{margin-top:8px;}
  .sig-grid{gap:24px;}
  .sig .sh{margin-bottom:8px;}
  .sig .srow{margin-top:8px;}
  .footer{padding:7px 14px;}

  @media print{
    @page{size:letter landscape;margin:0.3in;}
    .wrap{background:#fff;padding:0;}
    .bar{display:none;}
    .sheet{width:100%;min-height:0;box-shadow:none;margin:0;padding:14px 16px;break-after:page;}
    .sheet:last-child{break-after:auto;}
  }`

// Portrait overrides — merged after STYLE when ?orientation=portrait. Same content;
// the page just turns portrait (narrower + taller), the core-values row reflows to
// 4-up, and the on-screen preview width matches a portrait Letter page. Portrait has
// far more vertical room, so the fit-to-page compaction simply leaves extra whitespace.
const PORTRAIT_STYLE = `
  @media print{ @page{ size:letter portrait; } }
  @media screen{ .sheet{ width:760px; } }
  .cv-grid{ grid-template-columns:repeat(4,1fr); }
  /* Portrait has far more vertical room than landscape — relax the fit-to-page
     compaction (rules above) so the content breathes instead of hugging the top.
     Verified front≈916px / back≈786px, both under the ~998px portrait usable height. */
  .info{ margin-bottom:12px; padding:11px 16px; }
  .sec{ margin-bottom:9px; padding:9px 12px; }
  .grid{ row-gap:4px; }
  .cv-wrap{ padding:11px 12px; }
  .cv-h{ margin-bottom:9px; }
  .cv .cl{ min-height:30px; }
  .cv-coach{ margin-top:9px; padding:8px 10px; }
  .scale-grid{ margin-bottom:10px; }
  .scap{ margin:8px 0 14px; }
  .hsec{ margin:2px 0 12px; }
  .sum-grid{ margin-bottom:14px; }
  .wl{ height:15px; margin-top:8px; }
  .rate-grid{ margin-bottom:14px; }
  .two{ margin-bottom:12px; }
  .sig-grid{ gap:26px; }
`

const SHEETS = `<section class="sheet">
    <div class="head">
      <div class="brand">
        <img src="/iat-logo-transparent.png" alt="IAT">
        <div class="wordmark">
          <div class="l1">INNOVATIVE <span class="air">AIR</span></div>
          <div class="l2">TECHNOLOGIES</div>
        </div>
      </div>
      <div class="tagband">
        <div class="a">Enrich Lives</div>
        <div class="b">by continuously innovating every process.</div>
      </div>
    </div>

    <div class="title">ANNUAL <span class="g">PERFORMANCE</span> REVIEW</div>

    <div class="info">
      <div class="fld">Employee Name:<span class="ln"></span></div>
      <div class="fld">Reviewer:<span class="ln"></span></div>
    </div>

    <!-- Section 1 -->
    <div class="sec">
      <div class="body">
        <div class="sec-title"><span class="ic lg" style="background:var(--green)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/></svg></span><span class="nm">1. Results &amp; Execution</span></div>
        <div class="grid">
          <div></div>
          <div class="hdr"><span class="hn g">4</span></div>
          <div class="hdr"><span class="hn b">3</span></div>
          <div class="hdr"><span class="hn y">2</span></div>
          <div class="hdr"><span class="hn r">1</span></div>
          <div class="crit"><span class="dot">&bull;</span> Delivers quality work right the first time</div><div class="rc g">4</div><div class="rc b">3</div><div class="rc y">2</div><div class="rc r">1</div>
          <div class="crit"><span class="dot">&bull;</span> Meets commitments and deadlines</div><div class="rc g">4</div><div class="rc b">3</div><div class="rc y">2</div><div class="rc r">1</div>
          <div class="crit"><span class="dot">&bull;</span> Takes ownership and follows through</div><div class="rc g">4</div><div class="rc b">3</div><div class="rc y">2</div><div class="rc r">1</div>
          <div class="crit"><span class="dot">&bull;</span> Solves problems instead of waiting on others</div><div class="rc g">4</div><div class="rc b">3</div><div class="rc y">2</div><div class="rc r">1</div>
          <div class="crit"><span class="dot">&bull;</span> Follows IAT safety protocols</div><div class="rc g">4</div><div class="rc b">3</div><div class="rc y">2</div><div class="rc r">1</div>
        </div>
      </div>
      <div class="coach"><div class="lbl">Coaching Notes</div><div class="cline"></div><div class="cline"></div><div class="cline"></div><div class="cline"></div><div class="cline"></div></div>
    </div>

    <!-- Section 2 -->
    <div class="sec">
      <div class="body">
        <div class="sec-title"><span class="ic lg" style="background:var(--blue)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 20c0-3 2.5-4.6 5.5-4.6s5.5 1.6 5.5 4.6"/><path d="M16 5.2a3.2 3.2 0 0 1 0 6.1"/><path d="M17.5 15.6c2.4.4 4 1.9 4 4.4"/></svg></span><span class="nm">2. Teamwork &amp; Communication</span></div>
        <div class="grid">
          <div></div>
          <div class="hdr"><span class="hn g">4</span></div>
          <div class="hdr"><span class="hn b">3</span></div>
          <div class="hdr"><span class="hn y">2</span></div>
          <div class="hdr"><span class="hn r">1</span></div>
          <div class="crit"><span class="dot">&bull;</span> Communicates clearly with customers and teammates</div><div class="rc g">4</div><div class="rc b">3</div><div class="rc y">2</div><div class="rc r">1</div>
          <div class="crit"><span class="dot">&bull;</span> Lives the Golden Rule</div><div class="rc g">4</div><div class="rc b">3</div><div class="rc y">2</div><div class="rc r">1</div>
          <div class="crit"><span class="dot">&bull;</span> Supports the team and contributes positively</div><div class="rc g">4</div><div class="rc b">3</div><div class="rc y">2</div><div class="rc r">1</div>
          <div class="crit"><span class="dot">&bull;</span> Attendance and punctuality</div><div class="rc g">4</div><div class="rc b">3</div><div class="rc y">2</div><div class="rc r">1</div>
        </div>
      </div>
      <div class="coach"><div class="lbl">Coaching Notes</div><div class="cline"></div><div class="cline"></div><div class="cline"></div><div class="cline"></div></div>
    </div>

    <!-- Section 3 -->
    <div class="sec">
      <div class="body">
        <div class="sec-title"><span class="ic lg" style="background:var(--green)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 7 13.5 15 9.5 11 3 17.5"/><polyline points="16 7 21 7 21 12"/></svg></span><span class="nm">3. Continuous Improvement</span></div>
        <div class="grid">
          <div></div>
          <div class="hdr"><span class="hn g">4</span></div>
          <div class="hdr"><span class="hn b">3</span></div>
          <div class="hdr"><span class="hn y">2</span></div>
          <div class="hdr"><span class="hn r">1</span></div>
          <div class="crit"><span class="dot">&bull;</span> Looks for better ways to improve work</div><div class="rc g">4</div><div class="rc b">3</div><div class="rc y">2</div><div class="rc r">1</div>
          <div class="crit"><span class="dot">&bull;</span> Learns new skills and accepts coaching</div><div class="rc g">4</div><div class="rc b">3</div><div class="rc y">2</div><div class="rc r">1</div>
          <div class="crit"><span class="dot">&bull;</span> Keeps pace with IAT&rsquo;s growth and change</div><div class="rc g">4</div><div class="rc b">3</div><div class="rc y">2</div><div class="rc r">1</div>
        </div>
      </div>
      <div class="coach"><div class="lbl">Coaching Notes</div><div class="cline"></div><div class="cline"></div><div class="cline"></div></div>
    </div>

    <!-- Section 4: core values -->
    <div class="cv-wrap">
      <div class="cv-h">4. Living the IAT Core Values</div>
      <div class="cv-grid">
        <div class="cv"><div class="cvi" style="color:var(--blue)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z"/><path d="M9 12l2 2 4-4"/></svg></div><div class="cl">Integrity is Key</div><div class="cc"><span class="rc g">4</span><span class="rc b">3</span><span class="rc y">2</span><span class="rc r">1</span></div></div>
        <div class="cv"><div class="cvi" style="color:var(--gold)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.5.4.5 1.1.5 1.6h6c0-.5 0-1.2.5-1.6A6 6 0 0 0 12 3z"/></svg></div><div class="cl">Solve Problems</div><div class="cc"><span class="rc g">4</span><span class="rc b">3</span><span class="rc y">2</span><span class="rc r">1</span></div></div>
        <div class="cv"><div class="cvi" style="color:var(--blue)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 20c0-3 2.5-4.6 5.5-4.6s5.5 1.6 5.5 4.6"/><path d="M16 5.2a3.2 3.2 0 0 1 0 6.1"/><path d="M17.5 15.6c2.4.4 4 1.9 4 4.4"/></svg></div><div class="cl">We Are a Team</div><div class="cc"><span class="rc g">4</span><span class="rc b">3</span><span class="rc y">2</span><span class="rc r">1</span></div></div>
        <div class="cv"><div class="cvi" style="color:var(--green)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 7l2.5-2a2 2 0 0 1 2.6.2L21 9v5l-2 1"/><path d="M12 7 9.5 5a2 2 0 0 0-2.6.2L3 9v5l2 1"/><path d="M8 15l2.2 2.2a1.5 1.5 0 0 0 2.1 0L17 12.5"/><path d="M13 17l1.6 1.6a1.4 1.4 0 0 0 2-2"/></svg></div><div class="cl">Golden Rule Mentality</div><div class="cc"><span class="rc g">4</span><span class="rc b">3</span><span class="rc y">2</span><span class="rc r">1</span></div></div>
        <div class="cv"><div class="cvi" style="color:var(--gold)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="5"/><path d="M9 13.5L7.5 21l4.5-2.5L16.5 21 15 13.5"/></svg></div><div class="cl">Quality Matters</div><div class="cc"><span class="rc g">4</span><span class="rc b">3</span><span class="rc y">2</span><span class="rc r">1</span></div></div>
        <div class="cv"><div class="cvi" style="color:var(--blue)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.5.4.5 1.1.5 1.6h6c0-.5 0-1.2.5-1.6A6 6 0 0 0 12 3z"/></svg></div><div class="cl">Innovative Thinking</div><div class="cc"><span class="rc g">4</span><span class="rc b">3</span><span class="rc y">2</span><span class="rc r">1</span></div></div>
        <div class="cv"><div class="cvi" style="color:var(--green)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 19c0-8 6-13 15-13 0 9-5 14-13 14a4 4 0 0 1-2-1z"/><path d="M6 18C10 14 12 12 17 10"/></svg></div><div class="cl">Clean is King</div><div class="cc"><span class="rc g">4</span><span class="rc b">3</span><span class="rc y">2</span><span class="rc r">1</span></div></div>
        <div class="cv"><div class="cvi" style="color:var(--navy)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6C10 4.5 7 4 4 4.5v13C7 17 10 17.5 12 19"/><path d="M12 6c2-1.5 5-2 8-1.5v13c-3-.5-6 0-8 1.5z"/><path d="M12 6v13"/></svg></div><div class="cl">Colossians 3:23</div><div class="cc"><span class="rc g">4</span><span class="rc b">3</span><span class="rc y">2</span><span class="rc r">1</span></div></div>
      </div>
      <div class="cv-coach"><div class="lbl">Coaching Notes</div></div>
    </div>
  </section>

  <!-- ============================= BACK ============================= -->
  <section class="sheet">
    <div class="hsec">Performance Scale</div>
    <div class="scale-grid">
      <div class="scard g"><div class="snum">4</div><div class="sd">Exceptionally rare. Sets pace for IAT and shapes future.</div></div>
      <div class="scard b"><div class="snum">3</div><div class="sd">Rare. Leads improvements. Stays ahead of company growth.</div></div>
      <div class="scard y"><div class="snum">2</div><div class="sd">Keeps pace with company expectations and growth.</div></div>
      <div class="scard r"><div class="snum">1</div><div class="sd">Needs coaching to keep pace with company growth expectations.</div></div>
    </div>
    <div class="scap">Score each item 1&ndash;4 using the scale above (4 = highest, 1 = lowest), then add up the points for a total score.</div>

    <div class="hsec left">Overall Summary<span class="rule"></span></div>
    <div class="sum-grid">
      <div class="sumcard g"><div class="sumhead"><span class="ic sm" style="background:var(--green)"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.1l1-5.8-4.3-4.1 5.9-.9L12 3z"/></svg></span><span class="tt">Biggest Strength</span></div><div class="q">What does this employee consistently do that makes IAT better?</div><div class="wl"></div><div class="wl"></div><div class="wl"></div></div>
      <div class="sumcard b"><div class="sumhead"><span class="ic sm" style="background:var(--blue)"><svg viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="12" width="3.5" height="7" rx="1"/><rect x="10.25" y="8" width="3.5" height="11" rx="1"/><rect x="16.5" y="4" width="3.5" height="15" rx="1"/></svg></span><span class="tt">Greatest Opportunity</span></div><div class="q">What is the one behavior that, if improved, would make the biggest impact?</div><div class="wl"></div><div class="wl"></div><div class="wl"></div></div>
      <div class="sumcard y"><div class="sumhead"><span class="ic sm" style="background:var(--gold)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/></svg></span><span class="tt">Development Goals</span></div><div class="q">Measurable goals for development before the next review.</div><div class="wl"></div><div class="wl"></div><div class="wl"></div></div>
    </div>

    <div class="hsec left">Total Score<span style="font-size:11px;font-weight:600;color:var(--muted);text-transform:none;letter-spacing:0;">(add up every circled number &mdash; 20 items)</span><span class="rule"></span></div>
    <div class="totalbox">
      <span class="tl">Total Score</span>
      <span class="tv"></span>
      <span class="tm">/ 80</span>
    </div>

    <div class="two">
      <div class="bcard"><div class="bh">Employee Comments</div><div class="bs">Add any additional comments or context.</div><div class="wl"></div><div class="wl"></div><div class="wl"></div></div>
      <div class="bcard dev"><div class="bh">Development Plan <span style="font-weight:600;color:var(--muted);text-transform:none;letter-spacing:0;font-size:10.5px;">(for any area scored 1)</span></div>
        <div class="drow">Focus Area:<span class="ln"></span></div>
        <div class="drow">Action Plan:<span class="ln"></span></div>
        <div class="drow">Support Needed:<span class="ln"></span></div>
        <div class="drow">Review Date:<span class="ln"></span></div>
      </div>
    </div>

    <div class="sig-grid">
      <div class="sig"><div class="sh">Employee Signature</div><div class="srow">Signature:<span class="ln"></span></div><div class="srow d">Date:<span class="ln"></span></div></div>
      <div class="sig"><div class="sh">Reviewer Signature</div><div class="srow">Signature:<span class="ln"></span></div><div class="srow d">Date:<span class="ln"></span></div></div>
    </div>

  </section>`

export default async function AnnualReviewPrintPage(props: { searchParams: Promise<{ orientation?: string }> }) {
  const sp = await props.searchParams
  if (!(await getAdminUser())) redirect('/login')
  const portrait = sp?.orientation === 'portrait'
  return (
    <div className="wrap">
      <style dangerouslySetInnerHTML={{ __html: STYLE + (portrait ? PORTRAIT_STYLE : '') }} />
      <div className="bar">
        <Link
          href="/admin/forms"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 500, color: '#52525b', textDecoration: 'none' }}
        >
          <ArrowLeft size={15} /> Back to forms
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="otog" role="group" aria-label="Page orientation">
            <Link href="/print/annual-review" className={portrait ? '' : 'on'}>Landscape</Link>
            <Link href="/print/annual-review?orientation=portrait" className={portrait ? 'on' : ''}>Portrait</Link>
          </div>
          <PrintButton label={`Print / Save as PDF (${portrait ? 'portrait' : 'landscape'})`} />
        </div>
      </div>
      <div dangerouslySetInnerHTML={{ __html: SHEETS }} />
    </div>
  )
}
