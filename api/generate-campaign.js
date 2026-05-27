export const config = { maxDuration: 60 };

// Base template aprobado — Claude reemplaza solo el contenido variable
const BASE_TEMPLATE = '<!DOCTYPE html>\n<html lang="es">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>Malbecs de Mendoza — Ligier · 26 mayo 2026</title>\n<style type="text/css">\n  body, table, td { margin:0; padding:0; border:0; font-family:Arial,sans-serif; }\n  body { background-color:#f4f1ec; }\n  a { text-decoration:none; color:inherit; }\n  img { display:block; height:auto; border:0; }\n  @media only screen and (max-width:480px) {\n    .wrap         { width:100% !important; }\n    .hdr-pad      { padding:20px 20px !important; }\n    .hero-pad     { padding:32px 20px 28px !important; }\n    .hero-h1      { font-size:26px !important; }\n    .promo-pad    { padding:0 16px 24px !important; }\n    .promo-inner  { padding:16px !important; }\n    .promo-txt    { display:block !important; width:100% !important; padding-right:0 !important; padding-bottom:14px !important; }\n    .promo-btn    { display:block !important; width:100% !important; text-align:center !important; }\n    .prod-pad     { padding:24px 16px 8px !important; }\n    /* Productos: imagen más chica pero sigue al costado */\n    .prod-img-col { width:90px !important; padding-right:12px !important; }\n    .prod-img-col img { width:80px !important; }\n    .pack-pad     { padding:32px 16px 28px !important; }\n    .acc-pad      { padding:24px 16px !important; }\n    .acc-img-col  { width:100px !important; padding-right:12px !important; }\n    .acc-img-col img { width:90px !important; }\n    .cta-pad      { padding:28px 16px !important; }\n    .cat-pad      { padding:20px 12px !important; }\n    .cnt-pad      { padding:24px 16px !important; }\n    .cnt-left     { display:block !important; width:100% !important; border-right:none !important; border-bottom:1px solid #f0f0f0 !important; padding-right:0 !important; padding-bottom:20px !important; margin-bottom:20px !important; }\n    .cnt-right    { display:block !important; width:100% !important; padding-left:0 !important; }\n    .ftr-pad      { padding:20px 16px !important; }\n  }\n</style>\n</head>\n<body style="background-color:#f4f1ec; margin:0; padding:24px 0; font-family:Arial,sans-serif;">\n\n<table class="wrap" align="center" width="600" cellpadding="0" cellspacing="0" style="width:600px; max-width:600px; margin:0 auto;">\n\n  <!-- ── 1. HEADER ── -->\n  <tr>\n    <td class="hdr-pad" style="background:#ffffff; padding:24px 40px; border-bottom:1px solid #f0f0f0; text-align:center;">\n      <a href="https://vinotecaligier.com" target="_blank">\n        <img src="https://mcusercontent.com/9e298a0f4024c9f23fd6646af/images/3dc5a20a-d835-346a-d331-56796a1934b6.png" alt="Ligier" width="140" style="width:140px; height:auto; margin:0 auto;">\n      </a>\n    </td>\n  </tr>\n\n  <!-- ── 2. HERO ── -->\n  <tr>\n    <td class="hero-pad" style="background:#1a1a1a; padding:48px 40px 40px;">\n      <p style="font-size:10px; font-weight:700; letter-spacing:3px; color:#666; text-transform:uppercase; margin:0 0 18px 0;">MALBECS DE MENDOZA · MAYO 2026</p>\n      <h1 class="hero-h1" style="font-size:34px; font-weight:700; letter-spacing:-1px; color:#ffffff; margin:0 0 16px 0; line-height:1.15;">Seis Malbecs<br>que elegimos<br>para vos</h1>\n      <p style="font-size:15px; color:#aaa; line-height:1.6; margin:0 0 28px 0;">Altamira, Gualtallary, clásicos de Mendoza.<br>Llevá 6, pagá 5.</p>\n      <a href="https://vinotecaligier.com/vino" target="_blank" style="display:inline-block; background:#ffffff; color:#111111; font-size:11px; font-weight:700; letter-spacing:2px; text-transform:uppercase; padding:13px 28px;">VER SELECCIÓN</a>\n    </td>\n  </tr>\n\n  <!-- ── 3. PROMO BANNER 6×5 ── -->\n  <tr>\n    <td class="promo-pad" style="background:#1a1a1a; padding:0 40px 36px;">\n      <table width="100%" cellpadding="0" cellspacing="0">\n        <tr>\n          <td class="promo-inner" style="background:#ffffff; padding:20px 24px;">\n            <table width="100%" cellpadding="0" cellspacing="0">\n              <tr>\n                <td class="promo-txt" valign="middle" style="padding-right:20px;">\n                  <p style="font-size:9px; font-weight:700; letter-spacing:2px; color:#888; text-transform:uppercase; margin:0 0 6px 0;">PROMOCIÓN ACTIVA</p>\n                  <p style="font-size:17px; font-weight:700; color:#111; margin:0 0 5px 0;">Llevá 6, pagá 5</p>\n                  <p style="font-size:13px; color:#888; margin:0; line-height:1.5;">Válido en toda la selección de vinos. Podés mezclar etiquetas.</p>\n                </td>\n                <td class="promo-btn" valign="middle" align="right" style="white-space:nowrap;">\n                  <a href="https://vinotecaligier.com/compartircarrito/index/share/data/W3sic2t1IjoiQkU3NTUwMCIsInF0eSI6MX0seyJza3UiOiJCRTczOTcxIiwicXR5IjoxfSx7InNrdSI6IkJFNzExMDIiLCJxdHkiOjF9LHsic2t1IjoiQkU3Mjg4NCIsInF0eSI6MX0seyJza3UiOiJCRTc3ODg1IiwicXR5IjoxfSx7InNrdSI6IkJFNzU2MzQiLCJxdHkiOjF9XQ==/" target="_blank" style="display:inline-block; background:#111111; color:#ffffff; font-size:10px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; padding:11px 20px;">APROVECHAR</a>\n                </td>\n              </tr>\n            </table>\n          </td>\n        </tr>\n      </table>\n    </td>\n  </tr>\n\n  <!-- ── 4. PRODUCTOS ── -->\n  <tr>\n    <td class="prod-pad" style="background:#ffffff; padding:36px 40px 8px;">\n\n      <!-- Producto 1 -->\n      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:0;">\n        <tr>\n          <td class="prod-img-col" width="150" valign="middle" style="width:150px; padding-right:20px; padding-bottom:24px;">\n            <a href="https://vinotecaligier.com/vi-a-cobos-vinculum-malbec-750.html" target="_blank">\n              <img src="https://vinotecaligier.com/media/catalog/product/cache/73269a27812eefec516431430aa0b457/b/e/be75500_base_vgjwpzyskerjrxru.jpg" alt="Viña Cobos Vinculum Malbec" width="140" style="width:140px;">\n            </a>\n          </td>\n          <td valign="middle" style="padding-bottom:24px;">\n            <p style="font-size:9px; font-weight:700; letter-spacing:2px; color:#aaa; text-transform:uppercase; margin:0 0 5px 0;">Malbec · Mendoza · Argentina</p>\n            <p style="font-size:14px; font-weight:700; color:#111; margin:0 0 6px 0;"><a href="https://vinotecaligier.com/vi-a-cobos-vinculum-malbec-750.html" target="_blank" style="color:#111;">Viña Cobos Vinculum Malbec</a></p>\n            <p style="font-size:13px; color:#888; line-height:1.5; margin:0 0 10px 0;">Violeta tinta, cerezas ácidas y chocolate amargo. Taninos elegantes de un Malbec construido con precisión.</p>\n            <p style="font-size:12px; color:#aaa; text-decoration:line-through; margin:0 0 2px 0;">$67.459</p>\n            <p style="font-size:22px; font-weight:700; color:#111; line-height:1; margin:0 0 2px 0;">$56.216</p>\n            <p style="font-size:9px; font-weight:700; letter-spacing:1px; text-transform:uppercase; color:#888; margin:0 0 10px 0;">c/u comprando 6</p>\n            <a href="https://vinotecaligier.com/vi-a-cobos-vinculum-malbec-750.html" target="_blank" style="display:inline-block; background:#111111; color:#ffffff; font-size:10px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; padding:9px 18px;">COMPRAR</a>\n          </td>\n        </tr>\n        <tr><td colspan="2" style="padding-bottom:0;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td height="1" bgcolor="#f0f0f0" style="font-size:0; line-height:0;">&nbsp;</td></tr><tr><td height="24" style="font-size:0; line-height:0;">&nbsp;</td></tr></table></td></tr>\n      </table>\n\n      <!-- Producto 2 -->\n      <table width="100%" cellpadding="0" cellspacing="0">\n        <tr>\n          <td class="prod-img-col" width="150" valign="middle" style="width:150px; padding-right:20px; padding-bottom:24px;">\n            <a href="https://vinotecaligier.com/susana-balbo-paraje-altamira-malbec-750.html" target="_blank">\n              <img src="https://vinotecaligier.com/media/catalog/product/cache/73269a27812eefec516431430aa0b457/b/e/be73971_base.jpg" alt="Susana Balbo Paraje Altamira" width="140" style="width:140px;">\n            </a>\n          </td>\n          <td valign="middle" style="padding-bottom:24px;">\n            <p style="font-size:9px; font-weight:700; letter-spacing:2px; color:#aaa; text-transform:uppercase; margin:0 0 5px 0;">Malbec · Paraje Altamira · Mendoza</p>\n            <p style="font-size:14px; font-weight:700; color:#111; margin:0 0 6px 0;"><a href="https://vinotecaligier.com/susana-balbo-paraje-altamira-malbec-750.html" target="_blank" style="color:#111;">Susana Balbo Signature Paraje Altamira</a></p>\n            <p style="font-size:13px; color:#888; line-height:1.5; margin:0 0 10px 0;">Mora, cereza negra y menta sobre fondo mineral. Altamira expresado con 14 meses de roble francés.</p>\n            <p style="font-size:12px; color:#aaa; text-decoration:line-through; margin:0 0 2px 0;">$58.062</p>\n            <p style="font-size:22px; font-weight:700; color:#111; line-height:1; margin:0 0 2px 0;">$48.385</p>\n            <p style="font-size:9px; font-weight:700; letter-spacing:1px; text-transform:uppercase; color:#888; margin:0 0 10px 0;">c/u comprando 6</p>\n            <a href="https://vinotecaligier.com/susana-balbo-paraje-altamira-malbec-750.html" target="_blank" style="display:inline-block; background:#111111; color:#ffffff; font-size:10px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; padding:9px 18px;">COMPRAR</a>\n          </td>\n        </tr>\n        <tr><td colspan="2"><table width="100%" cellpadding="0" cellspacing="0"><tr><td height="1" bgcolor="#f0f0f0" style="font-size:0; line-height:0;">&nbsp;</td></tr><tr><td height="24" style="font-size:0; line-height:0;">&nbsp;</td></tr></table></td></tr>\n      </table>\n\n      <!-- Producto 3 -->\n      <table width="100%" cellpadding="0" cellspacing="0">\n        <tr>\n          <td class="prod-img-col" width="150" valign="middle" style="width:150px; padding-right:20px; padding-bottom:24px;">\n            <a href="https://vinotecaligier.com/escorihuela-gascon-don-malbec-750.html" target="_blank">\n              <img src="https://vinotecaligier.com/media/catalog/product/cache/73269a27812eefec516431430aa0b457/b/e/be71102_base.jpg" alt="Escorihuela Gascon Don Malbec" width="140" style="width:140px;">\n            </a>\n          </td>\n          <td valign="middle" style="padding-bottom:24px;">\n            <p style="font-size:9px; font-weight:700; letter-spacing:2px; color:#aaa; text-transform:uppercase; margin:0 0 5px 0;">Malbec · Mendoza · Argentina</p>\n            <p style="font-size:14px; font-weight:700; color:#111; margin:0 0 6px 0;"><a href="https://vinotecaligier.com/escorihuela-gascon-don-malbec-750.html" target="_blank" style="color:#111;">Escorihuela Gascon Don Malbec</a></p>\n            <p style="font-size:13px; color:#888; line-height:1.5; margin:0 0 10px 0;">Violáceo brillante con ciruelas, arándanos y cedro. Equilibrio clásico de una bodega que conoce Mendoza de memoria.</p>\n            <p style="font-size:12px; color:#aaa; text-decoration:line-through; margin:0 0 2px 0;">$62.591</p>\n            <p style="font-size:22px; font-weight:700; color:#111; line-height:1; margin:0 0 2px 0;">$52.159</p>\n            <p style="font-size:9px; font-weight:700; letter-spacing:1px; text-transform:uppercase; color:#888; margin:0 0 10px 0;">c/u comprando 6</p>\n            <a href="https://vinotecaligier.com/escorihuela-gascon-don-malbec-750.html" target="_blank" style="display:inline-block; background:#111111; color:#ffffff; font-size:10px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; padding:9px 18px;">COMPRAR</a>\n          </td>\n        </tr>\n        <tr><td colspan="2"><table width="100%" cellpadding="0" cellspacing="0"><tr><td height="1" bgcolor="#f0f0f0" style="font-size:0; line-height:0;">&nbsp;</td></tr><tr><td height="24" style="font-size:0; line-height:0;">&nbsp;</td></tr></table></td></tr>\n      </table>\n\n      <!-- Producto 4 -->\n      <table width="100%" cellpadding="0" cellspacing="0">\n        <tr>\n          <td class="prod-img-col" width="150" valign="middle" style="width:150px; padding-right:20px; padding-bottom:24px;">\n            <a href="https://vinotecaligier.com/vino-rutini-altamira-malbec-750.html" target="_blank">\n              <img src="https://vinotecaligier.com/media/catalog/product/cache/73269a27812eefec516431430aa0b457/b/e/be72884_base.jpg" alt="Rutini Single Vineyard Altamira" width="140" style="width:140px;">\n            </a>\n          </td>\n          <td valign="middle" style="padding-bottom:24px;">\n            <p style="font-size:9px; font-weight:700; letter-spacing:2px; color:#aaa; text-transform:uppercase; margin:0 0 5px 0;">Malbec · Altamira · Mendoza</p>\n            <p style="font-size:14px; font-weight:700; color:#111; margin:0 0 6px 0;"><a href="https://vinotecaligier.com/vino-rutini-altamira-malbec-750.html" target="_blank" style="color:#111;">Rutini Single Vineyard Altamira</a></p>\n            <p style="font-size:13px; color:#888; line-height:1.5; margin:0 0 10px 0;">Violetas, lavanda y anís de viñedo propio en Altamira. Taninos firmes con un final fresco y prolongado.</p>\n            <p style="font-size:12px; color:#aaa; text-decoration:line-through; margin:0 0 2px 0;">$51.000</p>\n            <p style="font-size:22px; font-weight:700; color:#111; line-height:1; margin:0 0 2px 0;">$42.500</p>\n            <p style="font-size:9px; font-weight:700; letter-spacing:1px; text-transform:uppercase; color:#888; margin:0 0 10px 0;">c/u comprando 6</p>\n            <a href="https://vinotecaligier.com/vino-rutini-altamira-malbec-750.html" target="_blank" style="display:inline-block; background:#111111; color:#ffffff; font-size:10px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; padding:9px 18px;">COMPRAR</a>\n          </td>\n        </tr>\n        <tr><td colspan="2"><table width="100%" cellpadding="0" cellspacing="0"><tr><td height="1" bgcolor="#f0f0f0" style="font-size:0; line-height:0;">&nbsp;</td></tr><tr><td height="24" style="font-size:0; line-height:0;">&nbsp;</td></tr></table></td></tr>\n      </table>\n\n      <!-- Producto 5 -->\n      <table width="100%" cellpadding="0" cellspacing="0">\n        <tr>\n          <td class="prod-img-col" width="150" valign="middle" style="width:150px; padding-right:20px; padding-bottom:24px;">\n            <a href="https://vinotecaligier.com/elodia-single-vineyard-mantrax-malbec-750.html" target="_blank">\n              <img src="https://vinotecaligier.com/media/catalog/product/cache/73269a27812eefec516431430aa0b457/b/e/be77885_base.jpg" alt="Elodia Single Vineyard Mantrax Malbec" width="140" style="width:140px;">\n            </a>\n          </td>\n          <td valign="middle" style="padding-bottom:24px;">\n            <p style="font-size:9px; font-weight:700; letter-spacing:2px; color:#aaa; text-transform:uppercase; margin:0 0 5px 0;">Malbec · Mendoza · Argentina</p>\n            <p style="font-size:14px; font-weight:700; color:#111; margin:0 0 6px 0;"><a href="https://vinotecaligier.com/elodia-single-vineyard-mantrax-malbec-750.html" target="_blank" style="color:#111;">Elodia Single Vineyard Mantrax Malbec</a></p>\n            <p style="font-size:13px; color:#888; line-height:1.5; margin:0 0 10px 0;">Identidad de viñedo definida en cada copa. Frutas negras concentradas, especias y estructura para mesa larga.</p>\n            <p style="font-size:12px; color:#aaa; text-decoration:line-through; margin:0 0 2px 0;">$57.152</p>\n            <p style="font-size:22px; font-weight:700; color:#111; line-height:1; margin:0 0 2px 0;">$47.627</p>\n            <p style="font-size:9px; font-weight:700; letter-spacing:1px; text-transform:uppercase; color:#888; margin:0 0 10px 0;">c/u comprando 6</p>\n            <a href="https://vinotecaligier.com/elodia-single-vineyard-mantrax-malbec-750.html" target="_blank" style="display:inline-block; background:#111111; color:#ffffff; font-size:10px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; padding:9px 18px;">COMPRAR</a>\n          </td>\n        </tr>\n        <tr><td colspan="2"><table width="100%" cellpadding="0" cellspacing="0"><tr><td height="1" bgcolor="#f0f0f0" style="font-size:0; line-height:0;">&nbsp;</td></tr><tr><td height="24" style="font-size:0; line-height:0;">&nbsp;</td></tr></table></td></tr>\n      </table>\n\n      <!-- Producto 6 — sin separador -->\n      <table width="100%" cellpadding="0" cellspacing="0">\n        <tr>\n          <td class="prod-img-col" width="150" valign="middle" style="width:150px; padding-right:20px; padding-bottom:24px;">\n            <a href="https://vinotecaligier.com/bobo-la-arcilla-malbec-750.html" target="_blank">\n              <img src="https://vinotecaligier.com/media/catalog/product/cache/73269a27812eefec516431430aa0b457/b/e/be75634_base.jpg" alt="Bobó La Arcilla Malbec" width="140" style="width:140px;">\n            </a>\n          </td>\n          <td valign="middle" style="padding-bottom:24px;">\n            <p style="font-size:9px; font-weight:700; letter-spacing:2px; color:#aaa; text-transform:uppercase; margin:0 0 5px 0;">Malbec · Mendoza · Argentina</p>\n            <p style="font-size:14px; font-weight:700; color:#111; margin:0 0 6px 0;"><a href="https://vinotecaligier.com/bobo-la-arcilla-malbec-750.html" target="_blank" style="color:#111;">Bobó La Arcilla Malbec</a></p>\n            <p style="font-size:13px; color:#888; line-height:1.5; margin:0 0 10px 0;">La arcilla como terroir, la profundidad como resultado. Color intenso, moras maduras y especias de fondo.</p>\n            <p style="font-size:12px; color:#aaa; text-decoration:line-through; margin:0 0 2px 0;">$61.200</p>\n            <p style="font-size:22px; font-weight:700; color:#111; line-height:1; margin:0 0 2px 0;">$51.000</p>\n            <p style="font-size:9px; font-weight:700; letter-spacing:1px; text-transform:uppercase; color:#888; margin:0 0 10px 0;">c/u comprando 6</p>\n            <a href="https://vinotecaligier.com/bobo-la-arcilla-malbec-750.html" target="_blank" style="display:inline-block; background:#111111; color:#ffffff; font-size:10px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; padding:9px 18px;">COMPRAR</a>\n          </td>\n        </tr>\n      </table>\n\n    </td>\n  </tr>\n\n  <!-- ── 4b. BOTÓN PACK ── -->\n  <tr>\n    <td class="pack-pad" style="background:#ffffff; padding:40px 40px 36px; text-align:center;">\n      <a href="https://vinotecaligier.com/compartircarrito/index/share/data/W3sic2t1IjoiQkU3NTUwMCIsInF0eSI6MX0seyJza3UiOiJCRTczOTcxIiwicXR5IjoxfSx7InNrdSI6IkJFNzExMDIiLCJxdHkiOjF9LHsic2t1IjoiQkU3Mjg4NCIsInF0eSI6MX0seyJza3UiOiJCRTc3ODg1IiwicXR5IjoxfSx7InNrdSI6IkJFNzU2MzQiLCJxdHkiOjF9XQ==/" target="_blank" style="display:inline-block; background:#111111; color:#ffffff; font-size:11px; font-weight:700; letter-spacing:2px; text-transform:uppercase; padding:15px 36px;">LLEVÁ EL PACK COMPLETO · 6 BOTELLAS</a>\n      <p style="margin:14px 0 4px 0; font-size:11px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; color:#aaa;">Total 6×5</p>\n      <p style="margin:0 0 6px 0; font-size:24px; font-weight:700; color:#111; letter-spacing:-0.5px;">$306.465</p>\n      <p style="margin:0; font-size:11px; color:#aaa;">pagás 5, llevás 6</p>\n    </td>\n  </tr>\n\n  <!-- ── 5. ACCESORIO ── -->\n  <tr>\n    <td class="acc-pad" style="background:#f4f1ec; padding:32px 40px;">\n      <p style="font-size:10px; font-weight:700; letter-spacing:2px; color:#888; text-transform:uppercase; margin:0 0 20px 0;">COMPLEMENTÁ TU EXPERIENCIA</p>\n      <table width="100%" cellpadding="0" cellspacing="0">\n        <tr>\n          <td class="acc-img-col" width="150" valign="middle" style="width:150px; padding-right:20px;">\n            <a href="https://vinotecaligier.com/riedel-veritas-cabernet-merlot-set-2.html" target="_blank">\n              <img src="https://vinotecaligier.com/media/catalog/product/cache/73269a27812eefec516431430aa0b457/r/g/rg70864_ojogcidrgdzpwgjo.jpg" alt="Riedel Veritas Cabernet Merlot Set x2" width="140" style="width:140px;">\n            </a>\n          </td>\n          <td valign="middle">\n            <p style="font-size:9px; font-weight:700; letter-spacing:2px; color:#aaa; text-transform:uppercase; margin:0 0 5px 0;">Cristalería · Riedel · Austria</p>\n            <p style="font-size:14px; font-weight:700; color:#111; margin:0 0 6px 0;"><a href="https://vinotecaligier.com/riedel-veritas-cabernet-merlot-set-2.html" target="_blank" style="color:#111;">Riedel Veritas Cabernet / Merlot Set x2</a></p>\n            <p style="font-size:13px; color:#888; line-height:1.5; margin:0 0 10px 0;">Diseñadas para potenciar tintos de cuerpo. Copa de 625ml que concentra fruta oscura y especias en cada sorbo.</p>\n            <p style="font-size:16px; font-weight:700; color:#111; margin:0 0 14px 0;">$180.588</p>\n            <a href="https://vinotecaligier.com/riedel-veritas-cabernet-merlot-set-2.html" target="_blank" style="display:inline-block; background:transparent; border:1.5px solid #111111; color:#111111; font-size:10px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; padding:9px 18px;">VER PRODUCTO</a>\n          </td>\n        </tr>\n      </table>\n    </td>\n  </tr>\n\n  <!-- ── 6. CTA CENTRAL ── -->\n  <tr>\n    <td class="cta-pad" style="background:#ffffff; padding:40px; text-align:center;">\n      <p style="font-size:10px; font-weight:700; letter-spacing:2px; color:#888; text-transform:uppercase; margin:0 0 12px 0;">TODA LA SELECCIÓN</p>\n      <h2 style="font-size:22px; font-weight:700; letter-spacing:-0.5px; color:#111; margin:0 0 20px 0; line-height:1.3;">Todos los vinos<br>de la semana</h2>\n      <a href="https://vinotecaligier.com/vino" target="_blank" style="display:inline-block; background:#111111; color:#ffffff; font-size:11px; font-weight:700; letter-spacing:2px; text-transform:uppercase; padding:15px 36px;">VER TODOS LOS VINOS</a>\n    </td>\n  </tr>\n\n  <!-- ── 7. CATEGORÍAS ── -->\n  <tr>\n    <td class="cat-pad" style="background:#1a1a1a; padding:28px 40px; text-align:center;">\n      <p style="font-size:9px; font-weight:700; letter-spacing:3px; color:#555; text-transform:uppercase; margin:0 0 16px 0;">EXPLORÁ TODA LA TIENDA</p>\n      <a href="https://vinotecaligier.com/vino" target="_blank" style="display:inline-block; border:1px solid #333; color:#ccc; font-size:10px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; padding:7px 14px; margin:4px;">Vinos</a>\n      <a href="https://vinotecaligier.com/vinos-guardados" target="_blank" style="display:inline-block; border:1px solid #333; color:#ccc; font-size:10px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; padding:7px 14px; margin:4px;">Guardados</a>\n      <a href="https://vinotecaligier.com/espumantes" target="_blank" style="display:inline-block; border:1px solid #333; color:#ccc; font-size:10px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; padding:7px 14px; margin:4px;">Espumantes</a>\n      <a href="https://vinotecaligier.com/whisky" target="_blank" style="display:inline-block; border:1px solid #333; color:#ccc; font-size:10px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; padding:7px 14px; margin:4px;">Whisky</a>\n      <a href="https://vinotecaligier.com/espirituosas" target="_blank" style="display:inline-block; border:1px solid #333; color:#ccc; font-size:10px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; padding:7px 14px; margin:4px;">Espirituosas</a>\n      <a href="https://vinotecaligier.com/regalos" target="_blank" style="display:inline-block; border:1px solid #333; color:#ccc; font-size:10px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; padding:7px 14px; margin:4px;">Regalos</a>\n      <a href="https://vinotecaligier.com/gift-card-ligier.html" target="_blank" style="display:inline-block; border:1px solid #333; color:#ccc; font-size:10px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; padding:7px 14px; margin:4px;">Gift Cards</a>\n      <a href="https://vinotecaligier.com/contenido-wineclub" target="_blank" style="display:inline-block; border:1px solid #333; color:#ccc; font-size:10px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; padding:7px 14px; margin:4px;">Wine Club</a>\n      <a href="https://vinotecaligier.com/contenido-experiencias" target="_blank" style="display:inline-block; border:1px solid #333; color:#ccc; font-size:10px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; padding:7px 14px; margin:4px;">Experiencias</a>\n      <a href="https://vinotecaligier.com/ofertas" target="_blank" style="display:inline-block; border:1px solid #333; color:#ccc; font-size:10px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; padding:7px 14px; margin:4px;">Ofertas</a>\n    </td>\n  </tr>\n\n  <!-- ── 8. CONTACTO ── -->\n  <tr>\n    <td class="cnt-pad" style="background:#ffffff; padding:36px 40px;">\n      <p style="font-size:9px; font-weight:700; letter-spacing:3px; color:#aaa; text-transform:uppercase; text-align:center; margin:0 0 28px 0;">CONTACTO</p>\n      <table width="100%" cellpadding="0" cellspacing="0">\n        <tr>\n\n          <!-- Columna izquierda -->\n          <td class="cnt-left" width="50%" valign="top" style="padding-right:28px; border-right:1px solid #f0f0f0;">\n\n            <!-- WhatsApp -->\n            <table cellpadding="0" cellspacing="0" style="margin-bottom:20px;">\n              <tr>\n                <td valign="middle" width="38" style="padding-right:10px;">\n                  <a href="https://wa.me/5491170546060" target="_blank">\n                    <img src="https://mcusercontent.com/14b7b2be6d99dcac6ed81f35c/images/5660aedf-265a-c31e-44e8-721cc53da96f.png" width="28" height="28" alt="WhatsApp" style="display:block;width:28px;height:28px;">\n                  </a>\n                </td>\n                <td valign="middle">\n                  <p style="font-size:9px; font-weight:700; letter-spacing:1.5px; color:#aaa; text-transform:uppercase; margin:0 0 3px 0;">WhatsApp</p>\n                  <a href="https://wa.me/5491170546060" target="_blank" style="font-size:13px; font-weight:700; color:#111;">+54 9 11 7054-6060</a>\n                </td>\n              </tr>\n            </table>\n\n            <!-- Teléfono -->\n            <table cellpadding="0" cellspacing="0" style="margin-bottom:20px;">\n              <tr>\n                <td valign="middle" width="38" style="padding-right:10px;">\n                  <a href="tel:+541120401252">\n                    <img src="https://mcusercontent.com/14b7b2be6d99dcac6ed81f35c/images/f346b0f0-d6be-eac4-b520-541808d693dc.png" width="28" height="28" alt="Teléfono" style="display:block;width:28px;height:28px;">\n                  </a>\n                </td>\n                <td valign="middle">\n                  <p style="font-size:9px; font-weight:700; letter-spacing:1.5px; color:#aaa; text-transform:uppercase; margin:0 0 3px 0;">Teléfono</p>\n                  <a href="tel:+541120401252" style="font-size:13px; font-weight:700; color:#111;">+54 11 2040-1252</a>\n                </td>\n              </tr>\n            </table>\n\n            <!-- Instagram @ligier -->\n            <table cellpadding="0" cellspacing="0" style="margin-bottom:14px;">\n              <tr>\n                <td valign="middle" width="38" style="padding-right:10px;">\n                  <a href="https://www.instagram.com/ligier" target="_blank">\n                    <img src="https://mcusercontent.com/14b7b2be6d99dcac6ed81f35c/images/4f18a0b0-eb4d-9ed9-9c1a-bcaf9dd32a1c.png" width="28" height="28" alt="Instagram" style="display:block;width:28px;height:28px;">\n                  </a>\n                </td>\n                <td valign="middle">\n                  <p style="font-size:9px; font-weight:700; letter-spacing:1.5px; color:#aaa; text-transform:uppercase; margin:0 0 3px 0;">Instagram</p>\n                  <a href="https://www.instagram.com/ligier" target="_blank" style="font-size:13px; font-weight:700; color:#111;">@ligier</a>\n                </td>\n              </tr>\n            </table>\n\n            <!-- Instagram @vinosguardados -->\n            <table cellpadding="0" cellspacing="0">\n              <tr>\n                <td valign="middle" width="38" style="padding-right:10px;">\n                  <a href="https://www.instagram.com/vinosguardados" target="_blank">\n                    <img src="https://mcusercontent.com/14b7b2be6d99dcac6ed81f35c/images/4f18a0b0-eb4d-9ed9-9c1a-bcaf9dd32a1c.png" width="28" height="28" alt="Instagram" style="display:block;width:28px;height:28px;">\n                  </a>\n                </td>\n                <td valign="middle">\n                  <p style="font-size:9px; font-weight:700; letter-spacing:1.5px; color:#aaa; text-transform:uppercase; margin:0 0 3px 0;">Vinos Guardados</p>\n                  <a href="https://www.instagram.com/vinosguardados" target="_blank" style="font-size:13px; font-weight:700; color:#111;">@vinosguardados</a>\n                </td>\n              </tr>\n            </table>\n\n          </td>\n\n          <!-- Columna derecha -->\n          <td class="cnt-right" width="50%" valign="top" style="padding-left:28px;">\n\n            <table cellpadding="0" cellspacing="0" style="margin-bottom:20px;">\n              <tr><td>\n                <p style="font-size:9px; font-weight:700; letter-spacing:1.5px; color:#aaa; text-transform:uppercase; margin:0 0 3px 0;">Email</p>\n                <a href="mailto:ventas@ligier.com.ar" style="font-size:13px; font-weight:700; color:#111;">ventas@ligier.com.ar</a>\n              </td></tr>\n            </table>\n\n            <table cellpadding="0" cellspacing="0" style="margin-bottom:20px;">\n              <tr><td>\n                <p style="font-size:9px; font-weight:700; letter-spacing:1.5px; color:#aaa; text-transform:uppercase; margin:0 0 3px 0;">Dirección</p>\n                <p style="font-size:13px; color:#555; margin:0; line-height:1.5;">J. D. Perón 1621, C.A.B.A.</p>\n              </td></tr>\n            </table>\n\n            <table cellpadding="0" cellspacing="0">\n              <tr><td>\n                <p style="font-size:9px; font-weight:700; letter-spacing:1.5px; color:#aaa; text-transform:uppercase; margin:0 0 3px 0;">Horarios</p>\n                <p style="font-size:13px; color:#555; margin:0; line-height:1.5;">Lun–Vie 10:00–18:00<br>Sáb 10:00–13:00</p>\n              </td></tr>\n            </table>\n\n          </td>\n        </tr>\n      </table>\n    </td>\n  </tr>\n\n  <!-- ── 9. FOOTER ── -->\n  <tr>\n    <td class="ftr-pad" style="background:#ffffff; padding:24px 40px; text-align:center; border-top:1px solid #f0f0f0;">\n      <p style="font-size:12px; color:#888; margin:0 0 8px 0;">Tu vinoteca online de confianza</p>\n      <a href="*|UNSUB|*" style="font-size:11px; color:#bbb; text-decoration:underline;">Desuscribirme</a>\n    </td>\n  </tr>\n\n</table>\n</body>\n</html>\n';

async function fetchProductData(url) {
  try {
    const res = await fetch(url, { 
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      redirect: 'follow'
    });
    const html = await res.text();
    
    const jsonLdMatches = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    for (const match of jsonLdMatches) {
      try {
        const data = JSON.parse(match[1]);
        const product = Array.isArray(data) ? data.find(d => d['@type'] === 'Product') : (data['@type'] === 'Product' ? data : null);
        if (product) {
          const price = product.offers?.price || product.offers?.[0]?.price;
          return {
            url,
            name: product.name,
            price: price ? parseFloat(price).toLocaleString('es-AR') : null,
            image: Array.isArray(product.image) ? product.image[0] : product.image,
            description: (product.description || '').replace(/<[^>]+>/g, '').trim().slice(0, 250),
          };
        }
      } catch(e) {}
    }
    
    const og = (prop) => html.match(new RegExp(`<meta[^>]+property="${prop}"[^>]+content="([^"]+)"`))?.[1];
    const name = og('og:title') || html.match(/<h1[^>]*>([^<]+)<\/h1>/)?.[1]?.trim();
    const image = og('og:image');
    const price = html.match(/itemprop="price"[^>]+content="([^"]+)"/)?.[1] ||
                  html.match(/"price"\s*:\s*"?([\d.]+)"?/)?.[1];
    const desc = og('og:description');
    
    return { 
      url, 
      name: name?.replace(/\s+/g, ' ').trim(),
      price: price ? parseFloat(price).toLocaleString('es-AR') : null,
      image, 
      description: desc?.slice(0, 250)
    };
  } catch(e) {
    return { url, error: e.message };
  }
}

async function findProductBySku(sku) {
  try {
    const res = await fetch(`https://vinotecaligier.com/catalogsearch/result/?q=${sku}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const html = await res.text();
    const urlMatch = html.match(/href="(https:\/\/vinotecaligier\.com\/[a-z0-9\-]+\.html)"/);
    return urlMatch ? urlMatch[1] : null;
  } catch(e) { return null; }
}

async function getCartTotal(cartUrl) {
  try {
    const res = await fetch(cartUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const html = await res.text();
    const totals = html.match(/\$[\d]{2,3}(?:\.[\d]{3})+/g);
    return totals ? totals[totals.length - 1] : null;
  } catch(e) { return null; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { tipo, seleccion, carrito, urls, rango, dia, hora, notas } = req.body;
  const mes = new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

  try {
    let productUrls = [];
    let cartLink = carrito?.trim();

    if (seleccion === 'carrito' && cartLink) {
      const base64 = cartLink.split('/data/')[1]?.replace(/\/$/, '');
      if (base64) {
        try {
          const skus = JSON.parse(Buffer.from(base64, 'base64').toString());
          const found = await Promise.all(skus.map(s => findProductBySku(s.sku)));
          productUrls = found.filter(Boolean);
        } catch(e) { console.error('Cart decode:', e.message); }
      }
    } else if (seleccion === 'urls' && urls) {
      productUrls = urls.split('\n').map(u => u.trim()).filter(u => u.startsWith('http')).slice(0, 6);
    }

    let productsData = [];
    if (productUrls.length > 0) {
      productsData = await Promise.all(productUrls.slice(0, 6).map(fetchProductData));
    }

    let cartTotal = null;
    if (cartLink) {
      cartTotal = await getCartTotal(cartLink);
      if (!cartTotal) cartTotal = await getCartTotal(cartLink);
    }

    const productsSection = productsData.length > 0
      ? productsData.map((p, i) => `PRODUCTO ${i+1}:
  Nombre: ${p.name || 'N/D'}
  URL: ${p.url}
  Precio unitario: ${p.price ? '$' + p.price : 'ver sitio'}
  Imagen URL: ${p.image || ''}
  Descripción: ${p.description || ''}`).join('\n\n')
      : `Tipo: ${tipo}${rango ? ', rango $' + rango : ''}`;

    const systemPrompt = `Sos el generador de emails de Vinoteca Ligier. 
Se te va a dar un template HTML base y datos de productos. 
Tu tarea es MODIFICAR el template reemplazando únicamente el contenido variable.
NO cambies ningún estilo CSS, NO cambies la estructura de tablas, NO cambies las clases.
Solo reemplazá: título del email, eyebrow, H1, bajada, los 6 bloques de producto, links del carrito, total del pack y el accesorio.
Devolvé ÚNICAMENTE el HTML completo sin explicaciones ni markdown.`;

    const userPrompt = `Usando este template base, generá el email para:

TIPO: ${tipo}
MES: ${mes}
${rango ? 'RANGO: $' + rango : ''}
${notas ? 'NOTAS: ' + notas : ''}
LINK CARRITO: ${cartLink || 'construir con los SKUs de los productos'}
TOTAL 6x5: ${cartTotal || 'calcular: precio_mas_barato × 5 + suma_resto'}

${productsSection}

INSTRUCCIONES:
1. Reemplazá el eyebrow del hero con "${tipo.toUpperCase()} · ${mes.toUpperCase()}"
2. Creá un H1 corto, poético, máx 3 líneas × 6 palabras, sin punto, sin promo — voz de curador
3. Bajada: mencioná los orígenes/características de los vinos + "Llevá 6, pagá 5"
4. Reemplazá los 6 productos con los datos de arriba. Para el precio: mostrar precio original tachado y precio promo = precio × 5/6 redondeado
5. Actualizá ambos links del carrito (promo banner y botón pack)
6. Mostrá el total 6x5 debajo del botón pack
7. Para el accesorio: elegí una copa o accesorio afín a los vinos seleccionados de https://vinotecaligier.com/cristaleria

TEMPLATE BASE:
${BASE_TEMPLATE}`;

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    const claudeData = await claudeRes.json();
    let emailHtml = claudeData.content?.[0]?.text || '';
    emailHtml = emailHtml.replace(/^```html\n?/, '').replace(/\n?```$/, '').trim();

    if (!emailHtml.includes('<!DOCTYPE') && !emailHtml.includes('<html')) {
      return res.status(500).json({ error: 'Claude no generó HTML válido', detail: claudeData.error?.message || emailHtml.slice(0, 300) });
    }

    const mcKey = process.env.MAILCHIMP_API_KEY;
    const dc = mcKey.split('-').pop();
    const audienceId = process.env.MAILCHIMP_AUDIENCE_ID;
    const mcBase = `https://${dc}.api.mailchimp.com/3.0`;
    const mcAuth = 'Basic ' + Buffer.from(`anystring:${mcKey}`).toString('base64');
    const mcHeaders = { 'Authorization': mcAuth, 'Content-Type': 'application/json' };

    const campaignTitle = `Ligier · ${tipo} · ${dia} ${mes}`;

    const createRes = await fetch(`${mcBase}/campaigns`, {
      method: 'POST',
      headers: mcHeaders,
      body: JSON.stringify({
        type: 'regular',
        recipients: { list_id: audienceId },
        settings: {
          subject_line: `Nueva selección ${mes} — Ligier`,
          from_name: 'Ligier',
          reply_to: 'ventas@ligier.com.ar',
          title: campaignTitle
        }
      })
    });

    const campaign = await createRes.json();
    if (!campaign.id) return res.status(500).json({ error: 'Error Mailchimp', detail: JSON.stringify(campaign) });

    await fetch(`${mcBase}/campaigns/${campaign.id}/content`, {
      method: 'PUT', headers: mcHeaders,
      body: JSON.stringify({ html: emailHtml })
    });

    await fetch(`${mcBase}/campaigns/${campaign.id}/actions/test`, {
      method: 'POST', headers: mcHeaders,
      body: JSON.stringify({ test_emails: ['dayanmartin@gmail.com'], send_type: 'html' })
    });

    const diasMap = { Lunes:1, Martes:2, Miércoles:3, Jueves:4, Viernes:5, Sábado:6, Domingo:0 };
    const today = new Date();
    const targetDay = diasMap[dia] ?? 3;
    let daysUntil = (targetDay - today.getDay() + 7) % 7 || 7;
    const sendDate = new Date(today);
    sendDate.setDate(today.getDate() + daysUntil);
    const [h, m] = hora.split(':');
    sendDate.setHours(parseInt(h), parseInt(m), 0, 0);
    const utcDate = new Date(sendDate.getTime() + 3 * 60 * 60 * 1000);
    const scheduleTime = utcDate.toISOString().replace('.000Z', '+00:00');

    await fetch(`${mcBase}/campaigns/${campaign.id}/actions/schedule`, {
      method: 'POST', headers: mcHeaders,
      body: JSON.stringify({ schedule_time: scheduleTime })
    });

    return res.status(200).json({
      success: true,
      campaignId: campaign.id,
      campaignName: campaignTitle,
      scheduleTime,
      webId: campaign.web_id,
      mailchimpUrl: `https://mc.us1.mailchimp.com/campaigns/show?id=${campaign.web_id}`
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
