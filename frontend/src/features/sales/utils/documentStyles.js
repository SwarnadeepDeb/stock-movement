// Stylesheet for the printed order form (pink & orange, from the logo) and invoice (formal black
// & white). One string shared by the print iframe and the on-screen preview so the two cannot
// drift apart. Page size and the running footer are added by the caller.
export const DOCUMENT_CSS = String.raw`
* { box-sizing:border-box; }
body { margin:0; background:#fff; }
.ofd,.ivd,.ofd *,.ivd * { -webkit-print-color-adjust:exact; print-color-adjust:exact; }

/* ===== ORDER FORM: pink & orange, from the logo ===== */
.ofd { --pk:#E40A7D; --or:#ED7F1D; --ink:#1F1B2E; --line:#F1D9E6; color:var(--ink); font-family:Inter,"Segoe UI",Roboto,Arial,sans-serif; font-size:11px; line-height:1.35; }
.ofhead { display:grid; grid-template-columns:60mm 1fr; gap:8mm; align-items:center; padding:3mm 7mm; border-radius:5mm; background:linear-gradient(135deg,#FFF5FA 0%,#FFFFFF 45%,#FFF6EA 100%); border:1px solid var(--line); }
.oflogo { width:60mm; height:auto; display:block; }
.offirm { display:flex; flex-direction:column; gap:2.2mm; border-left:2px solid var(--or); padding-left:6mm; }
.oftag { font-family:Georgia,"Times New Roman",serif; font-style:italic; font-size:15px; color:var(--pk); letter-spacing:.01em; }
.ofline { display:flex; gap:2.4mm; align-items:flex-start; font-size:11.5px; color:#3B3550; }
.ofline svg { flex:none; width:3.6mm; height:3.6mm; color:var(--or); margin-top:.5mm; }
.ofline b { color:var(--ink); }
.ofs-title { display:flex; justify-content:space-between; align-items:flex-end; gap:6mm; margin-top:5mm; padding-bottom:2mm; border-bottom:2px solid transparent; border-image:linear-gradient(90deg,#E40A7D,#ED7F1D) 1; }
.ofs-title h2 { margin:0; font-family:Georgia,"Times New Roman",serif; font-size:20px; letter-spacing:.18em; text-transform:uppercase; color:#E40A7D; }
.ofs-title div { display:flex; gap:7mm; font-size:12px; color:#B45A12; }
.ofs-title b { font-size:14px; color:#1F1B2E; margin-left:1.5mm; }
.ofs-info { width:100%; border-collapse:collapse; margin-top:3.5mm; font-size:12px; }
.ofs-info th { text-align:left; font-weight:600; color:#D46A10; padding:1.1mm 2mm 1.1mm 0; white-space:nowrap; width:1%; }
.ofs-info td { padding:1.1mm 6mm 1.1mm 0; color:#1F1B2E; border-bottom:1px dotted #F2A7CC; }
.ofs-info td b { font-size:13.5px; }
.ofs-tbl { width:100%; border-collapse:collapse; margin-top:3.5mm; font-size:12px; }
.ofs-tbl th { border:1px solid #E40A7D; background:#E40A7D; color:#fff; padding:1.7mm 2.5mm; text-align:left; font-size:10.5px; letter-spacing:.06em; text-transform:uppercase; }
.ofs-tbl td { border:1px solid #F3C3DB; padding:1.05mm 2.5mm; color:#1F1B2E; line-height:1.3; }
.ofs-tbl tbody tr:nth-child(even):not(.tot) td { background:#FFF7FB; }
.ofs-tbl td b { color:#C2086A; }
.ofs-tbl tr.tot td { border:1px solid #F3C3DB; border-top:2px solid #ED7F1D; border-bottom:2px solid #ED7F1D; font-weight:700; background:#FFF3E6; color:#1F1B2E; }
.ofs-tbl tr.tot td.r { color:#B45A12; font-size:13.5px; }
.ofs-tbl .c { text-align:center; width:9mm; color:#B98AA3; }
.ofs-tbl .r { text-align:right; width:24mm; }
.ofs-tbl td.rate { font-variant-numeric:tabular-nums; }
.ofs-tbl td.r b { color:#1F1B2E; }
.ofs-tbl .amt { width:34mm; }
.ofs-tbl thead { display:table-header-group; }
.ofs-tbl tr { break-inside:avoid; }
.ofs-notes { margin-top:3mm; font-size:12px; color:#2E2838; }
.ofs-notes b { color:#D46A10; }
.ofs-sign { display:grid; grid-template-columns:repeat(3,1fr); gap:10mm; margin-top:10mm; break-inside:avoid; }
.ofs-sign div { text-align:center; font-size:11px; color:#9A5A7C; }
.ofs-sign b { display:block; font-family:Georgia,"Times New Roman",serif; font-style:italic; font-weight:400; font-size:13px; color:#1F1B2E; border-bottom:1.5px solid #E40A7D; padding-bottom:1.2mm; margin-bottom:1.4mm; min-height:6mm; }
.ofs-end,.ivend { break-inside:avoid; page-break-inside:avoid; }

/* ===== INVOICE: formal black & white ===== */
.ivd { color:#000; font-family:"Times New Roman",Georgia,serif; font-size:13px; line-height:1.45; }
.ivhead { display:grid; grid-template-columns:30mm 1fr; gap:5mm; align-items:center; padding-bottom:3.5mm; border-bottom:2px solid #111; }
.ivlogo { width:30mm; height:auto; display:block; }
.ivfirm { text-align:right; font-size:12px; color:#000; }
.ivname { font-size:22px; font-weight:700; letter-spacing:.12em; }
.ivtag { font-style:italic; margin-bottom:1mm; }
.ivtitle { text-align:center; margin:3.5mm 0; }
.ivtitle span { display:inline-block; border:2px solid #000; padding:1.4mm 10mm; font-size:15px; font-weight:700; letter-spacing:.32em; text-transform:uppercase; }
.ivboxes { display:grid; grid-template-columns:1fr 1fr; border:1px solid #111; }
.ivbox { padding:2.6mm 3.5mm; }
.ivbox + .ivbox { border-left:1px solid #111; }
.ivbt { font-size:10.5px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; }
.ivparty { font-size:17px; font-weight:700; margin:.6mm 0; }
.ivkv { width:100%; border-collapse:collapse; }
.ivkv th { text-align:left; font-weight:400; padding:.7mm 0; width:30mm; white-space:nowrap; }
.ivkv td { padding:.7mm 0; font-size:14px; }
.ivtbl { width:100%; border-collapse:collapse; margin-top:4mm; font-size:14px; }
.ivtbl th { border:1.5px solid #000; background:#E6E6E6; padding:2.2mm 2.5mm; text-align:left; font-size:11.5px; letter-spacing:.06em; text-transform:uppercase; color:#000; }
.ivtbl td { border:1px solid #000; padding:2.2mm 2.5mm; vertical-align:middle; color:#000; }
.ivtbl tr.tot td { border:1.5px solid #000; font-weight:700; background:#E6E6E6; font-size:15px; }
.ivtbl .r { text-align:right; white-space:nowrap; }
.ivtbl .q { font-size:15px; font-weight:700; font-variant-numeric:tabular-nums; }
.ivtbl .c { text-align:center; width:7mm; }
.ivtbl .extra { font-size:8.5px; font-weight:700; border:1px solid #111; padding:0 1.2mm; letter-spacing:.06em; margin-left:1.5mm; }
.ivtbl thead { display:table-header-group; }
.ivtbl tr { break-inside:avoid; }
.ivtotal { display:grid; grid-template-columns:1fr 70mm; border:1.5px solid #000; border-top:0; break-inside:avoid; }
.ivwords { padding:2.6mm 3.5mm; border-right:1.5px solid #000; font-size:14px; }
.ivwords span { display:block; font-size:10.5px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; }
.ivsum th,.ivsum td { padding:2.2mm 3.5mm; border-bottom:1px solid #000; font-size:14px; }
.ivsum tr:last-child th,.ivsum tr:last-child td { border-bottom:0; font-size:17px; font-weight:700; }
.ivsum td { text-align:right; font-variant-numeric:tabular-nums; }
.ivsign { display:grid; grid-template-columns:1fr 1fr; gap:30mm; margin-top:16mm; align-items:end; break-inside:avoid; }
.ivsign div { border-top:1px solid #000; padding-top:1.4mm; text-align:center; font-size:12.5px; }
.ivsign .auth { border-top:0; text-align:right; font-weight:700; }
`;
