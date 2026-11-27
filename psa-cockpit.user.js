// ==UserScript==
// @name         PSA Cockpit
// @namespace    awsemjairgarcia.psa-cockpit
// @version      0.9.4
// @updateURL    https://awsemjairgarcia.github.io/PSA_Cockpit/psa-cockpit.user.js
// @downloadURL  https://awsemjairgarcia.github.io/PSA_Cockpit/psa-cockpit.user.js
// @description  Read-only: reads the PSA project header and its 3 reports, uploads the JSON to the private PSA_Cockpit_Data repo. For ProServe LATAM EMs.
// @match        https://proservecrm.lightning.force.com/*
// @match        https://proservecrm--pse.vf.force.com/apex/*
// @match        https://awsemjairgarcia.github.io/PSA_Cockpit/*
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_openInTab
// @connect      api.github.com
// ==/UserScript==
(function () {
  'use strict';
  // Never run inside the report iframes: injecting there breaks Lightning (alohaOrigin error).
  if (window.top !== window.self && !location.hostname.includes('--pse.vf.force.com')) return;
  const VERSION = '0.9.4';
  // <changelog>
  const CHANGELOG = [{"version": "0.9.4", "date": "2026-11-24", "changes": ["Proyectos sin partner (como Banorte): todos van como AWS y la tarjeta se llama «Costo interno AWS», sin presupuesto ni porcentajes.", "El costo de cada persona sale de su Default Cost Rate; si está en USD se convierte a MXN con el tipo de cambio que Salesforce muestra en sus propios montos.", "Las personas se cruzan con su cuenta (AWS o partner) aunque solo tengan timecards."]}, {"version": "0.9.3", "date": "2026-11-24", "changes": ["Proyectos nuevos: el script saca el PR de las ligas de reportes de la propia página y, si no lo encuentra, lo pide SIN valor por defecto (antes ofrecía el último PR y se mezclaban proyectos).", "Antes de subir, comprueba que los reportes sean del proyecto en pantalla; si no, no sube nada y explica por qué.", "El motor ignora capturas cuyos timecards no coinciden con el proyecto del encabezado."]}, {"version": "0.9.2", "date": "2026-11-23", "changes": ["GAAP revenue: las personas del partner usan su Default Cost Rate (Global Task MXN 1,600/h) en lugar de la tarifa del rate card."]}, {"version": "0.9.1", "date": "2026-11-23", "changes": ["GAAP revenue = horas planeadas en el planner × tarifa de cada persona, para todos los meses (ya no mezcla horas reales). Incluye facturables y no facturables, separado AWS y partner, y se compara contra «PI Planned Revenue» de Salesforce.", "El script abre la pestaña Financials del proyecto, lee Investment Booking, Spent y Remaining (total y AWS), costos, margen y PI Planned Revenue, y regresa a Overview.", "Tarjetas «Financials (Salesforce)» en el cockpit."]}, {"version": "0.9.0", "date": "2026-11-22", "changes": ["Comentarios en cada alerta para anotar cómo se resolvió (se guardan en el navegador).", "Presupuesto del partner (estimado): horas aprobadas, en Saved y planeadas, su monto con la tarifa y la tarifa máxima para que alcance el presupuesto.", "Revenue estimado por mes: horas reales y del planner por persona y mes, tarifa, monto y totales, separado AWS y partner. Las tarifas que falten se escriben a mano.", "La tarifa del partner ya no se calcula como presupuesto ÷ 200 h: esas 200 h son las aprobadas, no las contratadas.", "Tarifas leídas de Salesforce: revenue con Bill Rate o el rate card del rol, Investment con el Investment Rate y costo del partner con su Default Cost Rate (Global Task MXN 1,600/h).", "AWS y partner se separan por la cuenta del Contact; si falta, por el costo en USD de los empleados AWS.", "El script vuelve a leer las Assignments incompletas y toma la liga del Resource para leer a todas las personas."]}, {"version": "0.8.0", "date": "2026-11-22", "changes": ["Tarifas automáticas: después de los reportes, el script abre cada Assignment (Bill Rate, Cost Rate, Resource) y cada persona (Default Cost Rate, si es diaria, Account, External Resource) en una pestaña, lo lee y la cierra.", "Lo leído se guarda 7 días en el navegador, para no abrir las mismas pestañas en cada captura."]}, {"version": "0.7.7", "date": "2026-11-22", "changes": ["Simulador: el doble clic ya abre el editor de la celda (Tampermonkey no aceptaba su ventana en el evento).", "Las filas se identifican una vez y después se usan sus IDs, así la verificación no se confunde cuando el planner se desplaza.", "Si una celda falla, se detiene y dice cuántas alcanzó a escribir."]}, {"version": "0.7.6", "date": "2026-11-22", "changes": ["Simulador: encuentra las filas como discoverIds de los scripts de consola del planner (id de la fila y nombre a la misma altura) y espera a que todas las asignaciones estén dibujadas.", "Edición de celdas igual que los scripts probados: centrar la celda, doble clic, escribir y Enter."]}, {"version": "0.7.5", "date": "2026-11-22", "changes": ["Simulador: el panel muestra la versión del script y por qué no encuentra cada celda.", "Con 0 celdas el botón queda desactivado y ya no dice «quedaron como el escenario»."]}, {"version": "0.7.4", "date": "2026-11-22", "changes": ["El userscript muestra su historial de versiones: clic en «vX.Y.Z · cambios», debajo del botón naranja.", "El historial del userscript y el del cockpit salen del mismo archivo, así siempre dicen lo mismo."]}, {"version": "0.7.3", "date": "2026-11-22", "changes": ["Simulador: busca las celdas del planner igual que la lectura del planner (antes no encontraba ninguna) y deja en la consola por qué no ve una celda."]}, {"version": "0.7.2", "date": "2026-11-22", "changes": ["Simulador: el escenario se toma hasta que el planner dibuja su tabla. Antes lo tomaba la página intermedia, que redirige, y el panel no aparecía."]}, {"version": "0.7.1", "date": "2026-11-22", "changes": ["Simulador del planner en el cockpit: fecha de cierre, recortar o recorrer, efecto por asignación y celdas que cambian.", "«Aplicar en el planner» abre el planner del proyecto y muestra celda por celda el valor actual y el nuevo. Solo escribe si confirmas; después verifica cada celda y avisa si el planner movió horas en otras semanas. El Save lo das tú."]}, {"version": "0.7.0", "date": "2026-11-22", "changes": ["Planner: cada captura se guarda con su hora y el motor las junta. Por cada semana usa la captura más reciente que la incluya, así no se pierde el plan de semanas pasadas aunque «Included dates» empiece después."]}, {"version": "0.6.9", "date": "2026-11-22", "changes": ["Primer planner cargado (12 asignaciones desde el 27-sep): línea del plan en la gráfica y alertas de horas después del cierre.", "Las alertas del planner dicen si la asignación es facturable o no facturable, y muestran la fecha de inicio de cada semana."]}, {"version": "0.6.8", "date": "2026-11-22", "changes": ["En el planner sale un solo botón: si el planner tiene el suyo, la página de Salesforce esconde el repetido."]}, {"version": "0.6.7", "date": "2026-11-22", "changes": ["El script también corre en /apex/plannerscheduler, la dirección a la que redirige el Project Planner (antes no se activaba ahí).", "El ID del proyecto se toma de dimensionId en el planner."]}, {"version": "0.6.6", "date": "2026-11-22", "changes": ["La pestaña del planner muestra un aviso con lo que va haciendo y solo se cierra si salió bien.", "«Generate Fixed Price Milestones» se lee como sí/no (Salesforce lo da como texto)."]}, {"version": "0.6.5", "date": "2026-11-22", "changes": ["Botón «PSA Planner» en la página del planner dentro de Salesforce: abre el planner en su pestaña, lo lee, lo sube y la cierra.", "«PSA Cockpit» espera a que la página del proyecto termine de cargar antes de leer el encabezado."]}, {"version": "0.6.4", "date": "2026-11-22", "changes": ["Alertas: casilla «Resuelto» por alerta y filtro «Resueltas». Se guarda en el navegador; si la siguiente captura ya no trae la alerta, desaparece sola.", "El botón «PSA Planner» aparece aunque el planner se abra dentro de Salesforce (va en un marco).", "Encabezado: los valores (EM, Account, Bookings) se leen del texto visible del campo."]}, {"version": "0.6.3", "date": "2026-11-22", "changes": ["El encabezado lee los nombres del equipo (EM, DPM, Resource Manager, Operations Manager) y la barra de arriba (Account, Bookings, Approved Billings).", "Tipo de cobro desde el campo «ProServe Billing Type»."]}, {"version": "0.6.2", "date": "2026-11-22", "changes": ["Los reportes se leen completos: el script achica la vista para que Lightning dibuje todas las columnas (faltaban horas y montos).", "El motor ignora una captura con columnas incompletas y usa la última buena, en vez de detener la publicación."]}, {"version": "0.6.1", "date": "2026-11-22", "changes": ["Los reportes se abren con la dirección normal de Lightning (/lightning/r/Report/…?fv0=PR); la dirección interna fallaba sola."]}, {"version": "0.6.0", "date": "2026-11-22", "changes": ["Los reportes se leen en una pestaña normal que se abre y se cierra sola (el iframe oculto hacía fallar a Lightning).", "El botón muestra la versión para confirmar que el userscript está al día."]}, {"version": "0.5.2", "date": "2026-11-22", "changes": ["El userscript ya no se ejecuta dentro de los reportes ocultos (eso tumbaba Lightning con el error alohaOrigin).", "Si Lightning falla en un reporte, lo reintenta una vez en lugar de esperar 75 s.", "El motor ignora capturas donde falló el reporte de timecards y usa la última completa."]}, {"version": "0.5.1", "date": "2026-11-22", "changes": ["El userscript lee los reportes aunque Tampermonkey corra aislado de la página.", "Si un reporte no carga, el mensaje dice qué vio el script (diagnóstico).", "Recuerda el PR de cada proyecto: solo lo pide la primera vez.", "Nombre del proyecto sin el sufijo «| Project»."]}, {"version": "0.5.0", "date": "2026-11-21", "changes": ["Herramienta regional para los EMs de ProServe LATAM, no solo GBM LZ.", "Repos renombrados: PSA_Cockpit_Data (privado) y PSA_Cockpit (sitio cifrado, awsemjairgarcia.github.io/PSA_Cockpit).", "El logo del cliente sale solo en su proyecto; la portada y la guía llevan el de AWS.", "El botón aparece aunque llegues al proyecto navegando dentro de Salesforce.", "Guía de instalación con el paso «Allow User Scripts» de Chrome."]}, {"version": "0.4.1", "date": "2026-11-21", "changes": ["Página de instalación para EMs (instalar.html) con los 6 pasos.", "El userscript se instala con un clic desde el sitio y se actualiza solo.", "Contraseña del cockpit definida por Jair."]}, {"version": "0.4.0", "date": "2026-11-21", "changes": ["Botón «PSA Planner» en el Project Planner: lee horas planeadas por persona y semana y las sube al repo.", "La gráfica semanal muestra el plan del planner (línea punteada) contra lo real.", "Alerta nueva: horas planeadas en semanas posteriores a la fecha de cierre."]}, {"version": "0.3.1", "date": "2026-11-21", "changes": ["Publicación en el sitio público: el sitio público solo recibe archivos cifrados.", "El repo de código y datos sigue privado; publica con una deploy key limitada al sitio.", "Candado en el pipeline: si una página no está cifrada, no se publica."]}, {"version": "0.3.0", "date": "2026-11-21", "changes": ["Logos de GBM y AWS en el encabezado y en el pie.", "Historial de versiones: clic en la versión del pie.", "Cockpit publicado con contraseña: los datos van cifrados (AES-GCM), sin la clave no se pueden leer.", "Userscript con botón «PSA Cockpit» en la página del proyecto: lee el encabezado y los 3 reportes.", "Subida automática del JSON al repo privado y regeneración con GitHub Actions."]}, {"version": "0.2.0", "date": "2026-11-21", "changes": ["Colector en consola: lee los reportes por iframe, sin exportar a mano.", "El motor toma psa-raw_*.json de Descargas y lo archiva en data/.", "Cockpit oscuro con gauges, horas por semana, horas por persona y alertas con filtro.", "Alertas de horas fuera de fecha agrupadas por persona."]}, {"version": "0.1.0", "date": "2026-11-21", "changes": ["Primera versión: snapshot JSON, 10 reglas de alertas y cockpit HTML.", "Lectura del reporte pegado en Excel con corrección de fechas día/mes."]}];
  // </changelog>
  const REPO = 'AWSEMJairGarcia/PSA_Cockpit_Data';
  const COCKPIT_URL = 'https://awsemjairgarcia.github.io/PSA_Cockpit/';
  const REPORTS = {
    timecards: { id: '00O8b000007jLaqEAE', ready: /TCH-\d/ },
    est_vs_actuals: { id: '00O8b000007jMVJEA2', ready: /Sum of Actual Hours/ },
    partner_budget: { id: '00O8b000007jMO7EAM', ready: /Partner Budget Header|No Results|No records/ },
  };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const clean = s => (s || '').replace(/\s+/g, ' ').trim();
  const log = (...a) => console.log('PSA>', ...a);

  // ---------- page header (Lightning record page, LWC with shadow DOM) ----------
  function deepAll(root, sel, out = []) {
    root.querySelectorAll(sel).forEach(e => out.push(e));
    root.querySelectorAll('*').forEach(e => { if (e.shadowRoot) deepAll(e.shadowRoot, sel, out); });
    return out;
  }
  // Text of a node including what lives inside nested shadow roots (lookup links, formatted values).
  function deepText(n) {
    if (!n) return '';
    if (n.nodeType === 3) return n.textContent;
    if (n.nodeType !== 1 && n.nodeType !== 11) return '';
    if (n.nodeName === 'STYLE' || n.nodeName === 'SCRIPT') return '';
    const kids = [...(n.shadowRoot ? n.shadowRoot.childNodes : []), ...n.childNodes];
    return kids.map(deepText).join(' ');
  }
  // Visible text of a field without its label and the hidden helper texts ("Edit X", "Open X Preview", "Help X").
  function fieldValue(item, label) {
    let t = (item.innerText || '').split('\n').map(x => x.trim()).filter(Boolean);
    t = t.filter(x => x !== label && !/^(Edit|Help|Open) |Preview$|^Change Owner/.test(x));
    return clean(t.join(' '));
  }
  function readFields() {
    const fields = {};
    for (const lbl of deepAll(document, '.test-id__field-label')) {
      const name = clean(lbl.textContent);
      const item = lbl.closest('.slds-form-element') || lbl.parentElement?.parentElement;
      if (!name || !item || (name in fields && fields[name] !== '')) continue;
      const box = item.querySelector('input[type=checkbox], img[alt]');
      fields[name] = box ? (box.checked ?? /true|checked/i.test(box.alt)) : fieldValue(item, name);
    }
    // Highlights bar at the top of the record (Account, Engagement Manager, Bookings, Approved Billings).
    for (const it of deepAll(document, 'records-highlights-details-item')) {
      const lines = (it.innerText || '').split('\n').map(x => x.trim()).filter(Boolean);
      if (lines.length >= 2 && !fields[lines[0]]) fields[lines[0]] = fieldValue(it, lines[0]);
    }
    const em = deepAll(document, '.test-id__field-label').find(l => clean(l.textContent) === 'Engagement Manager');
    if (em && !fields['Engagement Manager']) log('DIAG EM', (em.closest('.slds-form-element') || em.parentElement).outerHTML.slice(0, 600));
    return fields;
  }
  const usDate = s => { const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s || ''); return m ? `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` : null; };
  const money = s => { const m = /([A-Z]{3})\s*(-?[\d,]+(?:\.\d+)?)/.exec(s || ''); return m ? { cur: m[1], n: parseFloat(m[2].replace(/,/g, '')) } : null; };
  const pick = (f, ...names) => { for (const n of names) if (f[n] !== undefined && f[n] !== '') return f[n]; return null; };

  function readHeader() {
    const f = readFields();
    log('campos leídos', JSON.stringify(f));
    const sfid = (location.pathname.match(/pse__Proj__c\/(\w{15,18})/) || [])[1] || null;
    const bookings = money(pick(f, 'Bookings'));
    const billed = money(pick(f, 'Approved Billings'));
    // Label present but empty -> null (really empty in Salesforce); label not found -> omitted (keep known value).
    const role = n => (n in f) ? (clean(String(f[n]).replace(/Open .* Preview/g, '')) || null) : undefined;
    return {
      header: {
        capturado: new Date().toISOString(),
        sfid, url: location.href.split('?')[0],
        pr: pick(f, 'Project ID'),
        nombre: pick(f, 'Project Name') || clean(document.title.replace(/\|.*$/, '')),
        cuenta: pick(f, 'Account'),
        tipo_cobro: pick(f, 'ProServe Billing Type', 'Billing Type'),
        estado: pick(f, 'Stage', 'Status'),
        inicio: usDate(pick(f, 'Start Date')),
        fin_salesforce: usDate(pick(f, 'End Date')),
        moneda: bookings ? bookings.cur : null,
        bookings: bookings ? bookings.n : null,
        facturacion_aprobada: billed ? billed.n : null,
        generate_fixed_price_milestones: (v => typeof v === 'boolean' ? v : /^true$/i.test(v) ? true : /^false$/i.test(v) ? false : null)(f['Generate Fixed Price Milestones']),
        equipo: Object.fromEntries(['Engagement Manager', 'Delivery Practice Manager', 'Resource Manager', 'Technical Lead',
          'Security Lead', 'ProServe Cloud Architect', 'Operations Manager'].map(n => [n, role(n)])),
      },
      fields_found: Object.keys(f).length,
    };
  }

  // ---------- reports through the internal report app (same as the Lightning page) ----------
  const cellText = c => clean(c.innerText);
  const readTables = doc => [...doc.querySelectorAll('table')].map(t =>
    [...t.querySelectorAll('tr')].map(tr => [...tr.querySelectorAll('th,td')].map(cellText)).filter(r => r.some(Boolean)));
  const scrollers = doc => [...doc.querySelectorAll('*')].filter(e => e.scrollHeight > e.clientHeight + 20 &&
    /auto|scroll/.test(getComputedStyle(e).overflowY));

  // Reports are opened in a real tab (a hidden iframe makes Lightning crash with "alohaOrigin").
  // The same userscript runs in that tab, reads the table, hands the result back via GM storage and closes it.
  function docsOf(doc, out = []) {
    out.push(doc);
    doc.querySelectorAll('iframe').forEach(i => { try { if (i.contentDocument && i.contentDocument.body) docsOf(i.contentDocument, out); } catch (e) { } });
    return out;
  }
  async function readReportHere(job) {
    const ready = new RegExp(job.ready);
    let doc = null;
    for (let s = 0; s < 90 && !doc; s++) {
      await sleep(1000);
      doc = docsOf(document).find(d => d.body && ready.test(d.body.innerText)) || null;
      if (!doc && s > 25 && docsOf(document).some(d => d.body && /Sorry to interrupt/.test(d.body.innerText))) throw new Error('Lightning falló: ' + clean(document.body.innerText).slice(0, 160));
    }
    if (!doc) throw new Error(`no cargó en 90 s · marcos=${docsOf(document).length} · texto=${clean(docsOf(document).map(d => d.body ? d.body.innerText : '').join(' ')).slice(0, 200)}`);
    // Lightning only renders the columns that fit on screen: shrink the report so every column is drawn.
    for (const d of docsOf(document)) { try { d.documentElement.style.zoom = '0.2'; d.defaultView.dispatchEvent(new Event('resize')); } catch (e) { } }
    await sleep(2500);
    const seen = new Map();
    const collect = () => readTables(doc).forEach((rows, ti) =>
      rows.forEach(r => { const k = ti + '|' + r.join('\u241f'); if (!seen.has(k)) seen.set(k, { t: ti, r }); }));
    collect();
    for (const sc of scrollers(doc))
      for (let y = 0; y <= sc.scrollHeight; y += Math.max(200, sc.clientHeight - 50)) { sc.scrollTop = y; await sleep(300); collect(); }
    const tables = [];
    for (const { t, r } of seen.values()) (tables[t] = tables[t] || []).push(r);
    log('columnas por tabla', tables.filter(Boolean).map(t => t[0].length));
    const links = [...new Map(docsOf(document).flatMap(d => [...d.querySelectorAll('a[href]')])
      .map(a => [recordId(a.getAttribute('href')), { t: clean(a.textContent), id: recordId(a.getAttribute('href')) }])
      .filter(([id, l]) => id && l.t)).values()];
    return { ok: true, report_id: job.id, rows: seen.size, text: doc.body.innerText, tables: tables.filter(Boolean), links };
  }
  // Salesforce record id inside a link (/lightning/r/<Obj>/<id>/view, /lightning/r/<id>/view or /<id>).
  function recordId(href) {
    const m = String(href || '').match(/\/lightning\/r\/(?:\w+\/)?([a-zA-Z0-9]{15,18})\/view|^\/([a-zA-Z0-9]{15,18})(?:[?#]|$)/);
    return m ? (m[1] || m[2]) : null;
  }
  // Same tab mechanism as the reports: open a record page, read its fields and links, close it.
  async function recordTabMode(job) {
    GM_setValue('psaJob', null);
    let res;
    try {
      let f = {}, prev = -1, stable = 0;
      for (let i = 0; i < 45; i++) {
        await sleep(1000); f = readFields();
        const n = Object.keys(f).length;
        stable = n >= 5 && n === prev ? stable + 1 : 0; prev = n;
        if (stable >= 3) break;
      }
      if (Object.keys(f).length < 5) throw new Error('la página no cargó sus campos');
      const links = {};
      for (const lbl of deepAll(document, '.test-id__field-label')) {
        const item = lbl.closest('.slds-form-element') || lbl.parentElement?.parentElement;
        const a = item && (item.querySelector('a[href]') || deepAll(item, 'a[href]')[0]);
        const id = a && recordId(a.getAttribute('href'));
        if (id) links[clean(lbl.textContent)] = id;
      }
      res = { ok: true, id: job.id, fields: f, links };
    } catch (e) { res = { ok: false, id: job.id, error: e.message }; }
    GM_setValue('psaResult_' + job.token, res);
    setTimeout(() => window.close(), 300);
  }
  async function openRecord(id, status, label) {
    const token = 'rec_' + id + '_' + Date.now();
    GM_setValue('psaJob', { token, id, kind: 'record', ts: Date.now() });
    const tab = GM_openInTab(`${location.origin}/lightning/r/${id}/view`, { active: true, insert: true, setParent: true });
    try {
      for (let s = 0; s < 60; s++) {
        await sleep(1000); status(`${label}… ${s + 1}s`);
        const r = GM_getValue('psaResult_' + token, null);
        if (r) { GM_setValue('psaResult_' + token, null); return r; }
      }
      return { ok: false, id, error: 'la pestaña no respondió en 60 s' };
    } finally { try { tab.close(); } catch (e) { } }
  }
  const RATE_TTL = 7 * 24 * 3600 * 1000;
  async function cachedRecord(id, status, label) {
    const c = GM_getValue('rec_' + id, null);
    // Reuse only complete reads made by this collector generation (older ones missed links / fields).
    if (c && c.v === 2 && Date.now() - c.ts < RATE_TTL && c.r.ok && Object.keys(c.r.fields || {}).length >= 10) return c.r;
    const r = await openRecord(id, status, label);
    if (r.ok) GM_setValue('rec_' + id, { v: 2, ts: Date.now(), r });
    return r;
  }
  // Rates: every Assignment (Bill Rate, Cost Rate, Resource) and every Contact (Default Cost Rate, Account).
  async function collectRates(reports, status) {
    const asg = [...new Map((reports.est_vs_actuals.links || []).filter(l => /^\[(Non )?Billable\]/.test(l.t)).map(l => [l.id, l])).values()];
    const contacts = new Map();
    const tcLinks = (reports.timecards.links || []);
    const out = { asignaciones: [], contactos: [] };
    let i = 0;
    for (const a of asg) {
      i++;
      const r = await cachedRecord(a.id, status, `Tarifas: assignment ${i}/${asg.length}`);
      out.asignaciones.push({ nombre: a.t, ...r });
      const cid = r.ok && (r.links['Resource'] || r.links['Contact']);
      if (cid) contacts.set(cid, (r.fields && r.fields['Resource']) || a.t.split(' - ').pop());
    }
    for (const l of tcLinks) if (/^003/.test(l.id) && !contacts.has(l.id)) contacts.set(l.id, l.t);
    i = 0;
    for (const [cid, name] of contacts) {
      i++;
      const r = await cachedRecord(cid, status, `Tarifas: persona ${i}/${contacts.size}`);
      out.contactos.push({ nombre: name, ...r });
    }
    log('tarifas', out.asignaciones.length, 'assignments,', out.contactos.length, 'personas', out.asignaciones.length ? '' : '· el reporte Est vs Actuals no trajo ligas a assignments');
    return out;
  }
  async function reportTabMode() {
    const rid = new URLSearchParams(location.search).get('reportId') || (location.pathname.match(/Report\/(00O\w+)/) || [])[1];
    const job = GM_getValue('psaJob', null);
    if (!rid || !job || !rid.startsWith(job.id.slice(0, 15)) || Date.now() - job.ts > 180000) return;
    GM_setValue('psaJob', null);
    let res;
    try { res = await readReportHere(job); } catch (e) { res = { ok: false, report_id: job.id, error: e.message }; }
    GM_setValue('psaResult_' + job.token, res);
    setTimeout(() => window.close(), 300);
  }
  async function loadReport(key, cfg, pr, status) {
    const token = key + '_' + Date.now();
    GM_setValue('psaJob', { token, id: cfg.id, ready: cfg.ready.source, ts: Date.now() });
    // Standard Lightning report URL: it wraps the report app in its own frame (opened alone, the app crashes).
    const url = `${location.origin}/lightning/r/Report/${cfg.id}/view?fv0=${encodeURIComponent(pr)}`;
    const tab = GM_openInTab(url, { active: true, insert: true, setParent: true });
    try {
      for (let s = 0; s < 120; s++) {
        await sleep(1000); status(`${key}… ${s + 1}s`);
        const res = GM_getValue('psaResult_' + token, null);
        if (res) { GM_setValue('psaResult_' + token, null); log(key, res.ok ? `${res.rows} filas · columnas ${(res.tables || []).map(t => t[0].length).join('/')}` : 'ERROR ' + res.error); return res; }
      }
      log(key, 'ERROR la pestaña del reporte no respondió en 120 s');
      return { ok: false, report_id: cfg.id, error: 'la pestaña del reporte no respondió en 120 s' };
    } finally { try { tab.close(); } catch (e) { } }
  }
  // ---------- GitHub upload (private repo, token kept only in this browser) ----------
  function gh(method, path, body) {
    const token = GM_getValue('ghToken');
    return new Promise((res, rej) => GM_xmlhttpRequest({
      method, url: `https://api.github.com/repos/${REPO}/contents/${path}`,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
      data: body ? JSON.stringify(body) : undefined,
      onload: r => res({ status: r.status, json: (() => { try { return JSON.parse(r.responseText); } catch { return {}; } })() }),
      onerror: rej,
    }));
  }
  const b64utf8 = s => btoa(unescape(encodeURIComponent(s)));
  async function upload(path, text, message) {
    const cur = await gh('GET', path);
    const r = await gh('PUT', path, { message, content: b64utf8(text), ...(cur.status === 200 ? { sha: cur.json.sha } : {}) });
    if (r.status >= 300) throw new Error(`GitHub ${r.status}: ${r.json.message || ''}`);
  }


  // ---------- Project Planner (week view): planned hours per assignment and week ----------
  function readPlanner() {
    const heads = [...document.querySelectorAll('.sch-header-row-middle td.sch-column-header[data-date]')];
    if (!heads.length) throw new Error('No veo las columnas del planner. Espera a que cargue.');
    const cols = heads.map(h => { const m = h.getAttribute('data-date').match(/^(\d{4})(\d{2})(\d{2})/); return `${m[1]}-${m[2]}-${m[3]}`; });
    const colW = heads[0].getBoundingClientRect().width || 1;
    const labels = {};
    let rootIndex = Infinity;
    document.querySelectorAll('[id^="treeview-"][data-recordid]').forEach(r => {
      const span = r.querySelector('.f-tree-node-text');
      const idx = Number(r.getAttribute('data-recordindex'));
      if (!span) return;
      labels[r.getAttribute('data-recordid')] = { label: clean(span.textContent), idx };
      rootIndex = Math.min(rootIndex, idx);
    });
    const rows = [];
    document.querySelectorAll('[id^="PlannerScheduler-timelineview-record-"][data-recordid]').forEach(row => {
      const id = row.getAttribute('data-recordid');
      const info = labels[id];
      if (!info || info.idx === rootIndex) return; // skip the project total row
      const bar = row.querySelector('[id^="PlannerScheduler"][style*="left:"]');
      const cells = [...row.querySelectorAll('.planner-event-bar-cell-text')];
      if (!bar || !cells.length) return;
      const left = parseFloat(((bar.getAttribute('style') || '').match(/left:\s*(-?[0-9.]+)px/) || [0, 0])[1]);
      const start = Math.round(left / colW);
      const semanas = {};
      cells.forEach((c, i) => { const v = parseFloat(clean(c.textContent)); const d = cols[start + i]; if (d && Number.isFinite(v)) semanas[d] = v; });
      rows.push({ record_id: id, asignacion: info.label, facturable: /^\[Billable\]/.test(info.label),
                  persona: info.label.split(' - ').pop(), semanas });
    });
    if (!rows.length) throw new Error('No encontré filas de asignaciones en el planner.');
    return { columnas: cols, asignaciones: rows };
  }

  function banner(t, bad) {
    let d = document.getElementById('psa-banner');
    if (!d) { d = document.createElement('div'); d.id = 'psa-banner'; document.body.appendChild(d); }
    d.style.cssText = `position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:99999;padding:12px 20px;border-radius:10px;font:600 15px system-ui;color:#0a0a0a;background:${bad ? '#EF4444' : '#FF9900'};box-shadow:0 6px 20px rgba(0,0,0,.35)`;
    d.textContent = 'PSA Cockpit: ' + t;
  }
  async function runPlanner(auto = false) {
    const b = document.getElementById('psa-cockpit-btn') || { textContent: '', disabled: false };
    if (auto) banner('leyendo el planner… no cierres esta pestaña');
    b.disabled = true;
    try {
      const q = new URLSearchParams(location.search);
      const sfid = (q.get('dimensionId') || q.get('id') || '').slice(0, 15);
      let pr = GM_getValue('pr2_' + sfid) || (prompt('¿Qué PR es este proyecto? (PR-xxxxxx)', '') || '').trim().toUpperCase();
      if (!/^PR-\d{4,}$/.test(pr)) throw new Error('PR inválido; no se subió nada.');
      GM_setValue('pr2_' + sfid, pr);
      let plan = null;
      for (let i = 0; i < 60 && !plan; i++) {
        try { plan = readPlanner(); } catch (e) { if (i === 59) throw e; if (auto) banner(`esperando que cargue el planner… ${i + 1}s · ${e.message}`); await sleep(1000); }
      }
      const msg = `Planner de ${pr}: ${plan.asignaciones.length} asignaciones, semanas ${plan.columnas[0]} a ${plan.columnas[plan.columnas.length - 1]}.\n` +
        'Solo se leen las semanas visibles en «Included dates». ¿Subir?';
      if (!auto && !confirm(msg)) return;
      log('planner', plan.asignaciones.length, 'asignaciones', plan.columnas[0], '→', plan.columnas[plan.columnas.length - 1]);
      const raw = { schema: 1, collector: VERSION, pr, sfid, captured: new Date().toISOString(), planner: plan };
      const text = JSON.stringify(raw);
      // One file per capture (with time): the engine merges them, each covers only its visible weeks.
      const name = `psa-planner_${pr}_${raw.captured.slice(0, 16).replace(':', '')}.json`;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name; a.click();
      if (GM_getValue('ghToken')) { b.textContent = 'Subiendo…'; await upload(`data/${pr}/${name}`, text, `planner(${pr}): ${raw.captured}`); b.textContent = 'Planner subido ✓'; }
      else b.textContent = 'Descargado ✓ (sin token)';
      if (auto) { GM_setValue('psaPlannerDone', { ok: true, n: plan.asignaciones.length, ts: Date.now() }); banner('planner subido ✓'); }
    } catch (e) {
      if (auto) { GM_setValue('psaPlannerDone', { ok: false, error: e.message, ts: Date.now() }); banner('ERROR · ' + e.message, true); } else alert('PSA Cockpit: ' + e.message);
      log(e);
    } finally {
      if (auto && window.top === window.self && document.getElementById('psa-banner')?.textContent.includes('✓')) setTimeout(() => window.close(), 1500);
      setTimeout(() => { b.disabled = false; b.textContent = `PSA Planner v${VERSION}`; }, 5000);
    }
  }

  // Planner opened inside Lightning (one.app#<base64>): the Visualforce address is inside the hash.
  function plannerAddress() {
    if (!/\/one\/one\.app/.test(location.pathname)) return null;
    try {
      const j = JSON.parse(atob(decodeURIComponent(location.hash.slice(1))));
      const a = j && j.attributes && j.attributes.address;
      return a && /ProjectPlanner/.test(a) ? a : null;
    } catch (e) { return null; }
  }
  async function openPlannerTab() {
    const b = document.getElementById('psa-cockpit-btn');
    b.disabled = true;
    try {
      GM_setValue('psaPlannerDone', null);
      GM_setValue('psaPlannerJob', { ts: Date.now() });
      const tab = GM_openInTab(plannerAddress(), { active: true, insert: true, setParent: true });
      log('planner abierto en pestaña', plannerAddress());
      for (let s = 0; s < 120; s++) {
        await sleep(1000); b.textContent = `Planner… ${s + 1}s`;
        const r = GM_getValue('psaPlannerDone', null);
        if (r) {
          if (r.ok) { try { tab.close(); } catch (e) { } }
          b.textContent = r.ok ? `Planner subido ✓ (${r.n})` : 'Error';
          if (!r.ok) alert('PSA Planner: ' + r.error);
          return;
        }
      }
      alert('PSA Planner: la pestaña del planner no respondió en 120 s. Déjala abierta y mándame una captura de lo que muestra (y su consola).');
    } finally { setTimeout(() => { b.disabled = false; b.textContent = `PSA Planner v${VERSION}`; }, 6000); }
  }

  // ---------- Planner simulator: receive a scenario from the cockpit and apply it cell by cell ----------
  if (location.hostname === 'awsemjairgarcia.github.io') {
    // The cockpit is decrypted with document.open(), which drops window listeners: use a DOM flag instead.
    setInterval(() => {
      const b = document.body;
      if (!b || !b.dataset.psaScenario) return;
      let sc; try { sc = JSON.parse(b.dataset.psaScenario); } catch (e) { return; }
      delete b.dataset.psaScenario;
      GM_setValue('psaScenario', { ...sc, ts: Date.now() });
      b.dataset.psaAck = String(Date.now());
      GM_openInTab(`https://proservecrm--pse.vf.force.com/apex/ProjectPlannerForProject?id=${encodeURIComponent(sc.sfid)}`, { active: true, insert: true });
    }, 500);
    return;
  }
  // discoverIds, same method as GBM/scripts/planner-editor-*.js (proven): timeline rows by id,
  // and each row's name is the left-side cell at the same height.
  function plannerGrid() {
    const heads = [...document.querySelectorAll('.sch-header-row-middle td.sch-column-header[data-date]')];
    const cols = heads.map(h => { const m = h.getAttribute('data-date').match(/^(\d{4})(\d{2})(\d{2})/); return `${m[1]}-${m[2]}-${m[3]}`; });
    const colW = (heads[0] && heads[0].getBoundingClientRect().width) || 1;
    const names = [...document.querySelectorAll('.f-tree-node-text, .x-grid-cell-inner, .sch-resource-name')]
      .map(n => ({ t: clean(n.textContent), top: n.getBoundingClientRect().top }))
      .filter(n => / - /.test(n.t));
    const labels = {};
    document.querySelectorAll('[id^="PlannerScheduler-timelineview-record-"]').forEach(r => {
      const top = r.getBoundingClientRect().top;
      let best = null, diff = 9999;
      for (const n of names) { const d = Math.abs(n.top - top); if (d < diff) { diff = d; best = n; } }
      if (best && diff < 25 && !(best.t in labels)) labels[best.t] = r.id.replace('PlannerScheduler-timelineview-record-', '');
    });
    return { cols, colW, labels };
  }
  // The cell for an assignment and week (week START date), or null if the planner does not draw it.
  const cellWhy = {};
  function plannerCell(g, asignacion, week) {
    const id = g.labels[asignacion];
    if (!id) { cellWhy[asignacion] = 'no encontré la fila con ese nombre'; return null; }
    const row = document.getElementById('PlannerScheduler-timelineview-record-' + id);
    const cells = row ? [...row.querySelectorAll('.planner-event-bar-cell')] : [];
    if (!cells.length) { cellWhy[asignacion] = 'la fila no tiene celdas de horas'; return null; }
    const bar = row.querySelector('[id^="PlannerScheduler"][style*="left:"]');
    const left = bar ? parseFloat(((bar.getAttribute('style') || '').match(/left:\s*(-?[0-9.]+)px/) || [0, 0])[1]) : 0;
    const start = Math.round(left / g.colW);
    const i = g.cols.indexOf(week) - start;
    if (!(i >= 0 && i < cells.length)) { cellWhy[asignacion + ' ' + week] = `semana fuera de la barra (col ${g.cols.indexOf(week)}, inicio ${start}, celdas ${cells.length})`; return null; }
    return cells[i];
  }
  const cellValue = c => parseFloat(clean((c.querySelector('.planner-event-bar-cell-text') || c).textContent)) || 0;
  function rowSnapshot(g, asignacion) {
    const out = {};
    g.cols.forEach(w => { const c = plannerCell(g, asignacion, w); if (c) out[w] = cellValue(c); });
    return out;
  }
  async function writeCell(cell, value) {
    cell.scrollIntoView({ block: 'center', inline: 'center' });
    await sleep(300);
    cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
    await sleep(500);
    const input = document.activeElement;
    if (!input || !(input.tagName === 'INPUT' || input.isContentEditable)) throw new Error('no se abrió el editor de la celda');
    if (input.select) input.select();
    document.execCommand('insertText', false, String(value));
    await sleep(150);
    for (const type of ['keydown', 'keyup']) input.dispatchEvent(new KeyboardEvent(type, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
    await sleep(800);
  }
  async function scenarioPanel(sc) {
    let g = null;
    // Wait until the assignment rows are drawn and the count stops changing (the project row comes first).
    let prev = -1, stable = 0;
    for (let i = 0; i < 90; i++) {
      g = plannerGrid();
      const n = Object.keys(g.labels).length;
      stable = n > 1 && n === prev ? stable + 1 : 0; prev = n;
      if (g.cols.length && stable >= 2) break;
      banner(`esperando las filas del planner… ${i + 1}s (${n} filas)`);
      await sleep(1000);
    }
    if (!g.cols.length) return;
    if (document.getElementById('psa-sim') || !GM_getValue('psaScenario', null)) return;
    GM_setValue('psaScenario', null);
    // Build the change list against what the planner shows right now.
    const changes = [];
    for (const c of sc.cambios) for (const [w, v] of Object.entries(c.semanas)) {
      const cell = plannerCell(g, c.asignacion, w);
      changes.push({ asignacion: c.asignacion, semana: w, nuevo: v, actual: cell ? cellValue(cell) : null, visible: !!cell });
    }
    const todo = changes.filter(c => c.visible && Math.abs(c.actual - c.nuevo) > 0.004);
    log('simulador DIAG', { columnas: g.cols.slice(0, 3).concat('…', g.cols.slice(-2)), filas: Object.keys(g.labels).length, colW: g.colW, por_que: cellWhy });
    const hidden = changes.filter(c => !c.visible);
    const box = document.createElement('div');
    box.id = 'psa-sim';
    box.style.cssText = 'position:fixed;top:60px;right:16px;z-index:99999;width:560px;max-height:78vh;overflow:auto;background:#16161e;color:#eee;border:1px solid #33334a;border-radius:12px;padding:16px;font:13px system-ui;box-shadow:0 10px 30px rgba(0,0,0,.5)';
    const who = a => a.replace(/^\[(Non )?Billable\] .* - /, m => (/Non/.test(m) ? '[NB] ' : '[B] '));
    box.innerHTML = `<div style="font-weight:700;font-size:15px;color:#FF9900">Simulador PSA Cockpit · ${sc.modo} al ${sc.cierre}</div>
      <div style="color:#aaa;margin:6px 0 10px">${todo.length} celdas cambian${hidden.length ? ` · ${hidden.length} no se ven en el planner (amplía «Included dates»)` : ''}. Nada se ha escrito todavía.</div>
      <table style="width:100%;border-collapse:collapse">${todo.map(c => `<tr><td style="padding:3px 4px;border-bottom:1px solid #26263a">${who(c.asignacion)}</td><td>${c.semana}</td><td style="text-align:right">${c.actual}</td><td style="text-align:center">→</td><td style="text-align:right;color:#FF9900;font-weight:700">${c.nuevo}</td></tr>`).join('')}</table>
      <div style="margin-top:10px;color:#FFB020">Antes de aplicar: si la asignación tiene «Total hours held constant», el planner reparte las horas que quitas en otras semanas. Para un recorte usa «End date held constant».</div>
      ${hidden.length ? `<div style="margin-top:10px;color:#EF4444;font-weight:700">Por qué no veo ${hidden.length} celdas</div>
      <div style="color:#bbb;font-size:12px">Planner: ${g.cols.length} semanas (${g.cols[0] || '—'} a ${g.cols[g.cols.length - 1] || '—'}), ${Object.keys(g.labels).length} filas, ancho de columna ${Math.round(g.colW)} px.</div>
      ${Object.entries(cellWhy).slice(0, 8).map(([k, v]) => `<div style="color:#bbb;font-size:12px">· ${who(k)}: ${v}</div>`).join('')}
      <div style="color:#bbb;font-size:12px">Nombres que busco: ${[...new Set(hidden.map(c => c.asignacion))].slice(0, 2).map(who).join(' | ')}</div>
      <div style="color:#bbb;font-size:12px">Nombres en el planner: ${Object.keys(g.labels).slice(0, 2).map(who).join(' | ')}</div>` : ''}
      <div id="psa-sim-res" style="margin-top:10px"></div>
      <div style="margin-top:12px;display:flex;gap:10px"><button id="psa-sim-go" style="background:#FF9900;border:0;border-radius:999px;padding:9px 16px;font-weight:700;cursor:pointer">Aplicar ${todo.length} celdas</button>
      <button id="psa-sim-x" style="background:#26263a;color:#fff;border:0;border-radius:999px;padding:9px 16px;cursor:pointer">Cancelar</button></div>`;
    document.body.appendChild(box);
    banner('revisa los cambios a la derecha; nada se ha escrito');
    document.getElementById('psa-sim-x').onclick = () => { box.remove(); banner('simulación cancelada, no se escribió nada'); };
    if (!todo.length) {
      const go0 = document.getElementById('psa-sim-go'); go0.disabled = true; go0.style.opacity = '.4'; go0.textContent = 'Nada que aplicar';
      banner(hidden.length ? 'no encontré las celdas: mira el motivo en el panel; no se escribió nada' : 'el planner ya coincide con el escenario', !!hidden.length);
      return;
    }
    document.getElementById('psa-sim-go').onclick = async () => {
      if (!confirm(`¿Escribir ${todo.length} celdas en el planner? Después tú das Save.`)) return;
      const go = document.getElementById('psa-sim-go'); go.disabled = true;
      const res = document.getElementById('psa-sim-res');
      const before = {};
      [...new Set(todo.map(c => c.asignacion))].forEach(a => { before[a] = rowSnapshot(g, a); });
      // Rows are mapped once (g, taken before any scroll); afterwards only record ids are used.
      let n = 0, fail = [];
      for (const c of todo) {
        n++; go.textContent = `Escribiendo ${n}/${todo.length}…`;
        try { const cell = plannerCell(g, c.asignacion, c.semana); if (!cell) throw new Error('celda no visible'); await writeCell(cell, c.nuevo); }
        catch (e) { fail.push(`${who(c.asignacion)} ${c.semana}: ${e.message}`); break; }
      }
      await sleep(2000);
      // Verify only what was attempted: target cells hold the new value and no other week of those rows moved.
      const done = todo.slice(0, n - fail.length);
      const wrong = [], moved = [];
      for (const c of done) { const cell = plannerCell(g, c.asignacion, c.semana); const v = cell ? cellValue(cell) : null; if (v === null || Math.abs(v - c.nuevo) > 0.004) wrong.push(`${who(c.asignacion)} ${c.semana}: quedó ${v}, debía ${c.nuevo}`); }
      for (const a of [...new Set(done.map(c => c.asignacion))]) { const after = rowSnapshot(g, a); for (const w of Object.keys(after)) if (!todo.some(c => c.asignacion === a && c.semana === w) && Math.abs((before[a][w] || 0) - after[w]) > 0.004) moved.push(`${who(a)} ${w}: ${before[a][w]} → ${after[w]}`); }
      if (fail.length) fail.unshift(`Me detuve en la celda ${n} de ${todo.length}. Escritas antes del error: ${done.length}.`);
      log('simulador', { escritas: todo.length - fail.length, fallas: fail, distintas: wrong, redistribuidas: moved });
      res.innerHTML = (wrong.length || fail.length || moved.length)
        ? `<div style="color:#EF4444;font-weight:700">Revisar antes de guardar</div>${[...fail, ...wrong].map(x => `<div>${x}</div>`).join('')}${moved.length ? `<div style="color:#FFB020;margin-top:6px">El planner movió horas en otras semanas (Total hours held constant):</div>${moved.map(x => `<div>${x}</div>`).join('')}` : ''}<div style="margin-top:6px">Si algo no te cuadra, da <b>Reload</b> en el planner sin guardar y nada cambia.</div>`
        : `<div style="color:#22C55E;font-weight:700">Las ${todo.length} celdas quedaron como el escenario.</div><div>Revisa el planner y da <b>Save</b> tú. Si no te convence, <b>Reload</b> sin guardar.</div>`;
      go.textContent = 'Aplicado';
      banner(wrong.length || fail.length || moved.length ? 'revisa los avisos antes de dar Save' : 'listo: revisa y da Save en el planner');
    };
  }
  // The project page's "Report Links" carry the PR in their filter (fv0=PR-xxxxxx).
  function findPR() {
    for (const a of deepAll(document, 'a[href]')) {
      const m = decodeURIComponent(a.getAttribute('href') || '').match(/fv0["']?\s*[:=]\s*["']?(PR-\d{4,})/i);
      if (m) return m[1].toUpperCase();
    }
    return '';
  }
  // ---------- Financials tab of the project (Investment, costs, planned revenue) ----------
  const FIN_RX = /Investment|Revenue|Costs|Margin|Hours|Booking|Billings|EAC|Burned|Remaining|Expense|Invoiced|Billed/;
  function clickTab(name) {
    const tab = deepAll(document, '[role="tab"], a[data-label]').find(t => clean(t.textContent) === name || t.getAttribute('data-label') === name);
    if (tab) tab.click();
    return !!tab;
  }
  async function readFinancials(status) {
    if (!clickTab('Financials')) throw new Error('no encontré la pestaña Financials');
    let f = {};
    for (let i = 0; i < 20; i++) {
      status(`Leyendo Financials… ${i + 1}s`); await sleep(1000);
      f = readFields();
      if (f['ProServe Investment Booking'] !== undefined && f['Internal Costs'] !== undefined) break;
    }
    clickTab('Overview');
    const out = {};
    for (const [k, v] of Object.entries(f)) if (FIN_RX.test(k) && typeof v === 'string') out[k] = v;
    if (!Object.keys(out).length) throw new Error('la pestaña Financials no mostró sus campos');
    return out;
  }
  // ---------- Changelog (same history as the cockpit) ----------
  function showChangelog() {
    let m = document.getElementById('psa-cl');
    if (m) { m.remove(); return; }
    m = document.createElement('div');
    m.id = 'psa-cl';
    m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:100000;display:flex;align-items:center;justify-content:center;padding:16px';
    const esc = t => String(t).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    m.innerHTML = `<div style="background:#16161e;color:#eee;border:1px solid #33334a;border-radius:14px;width:100%;max-width:540px;max-height:80vh;display:flex;flex-direction:column;overflow:hidden;font:14px system-ui">
      <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);padding:14px 20px;display:flex;justify-content:space-between;align-items:center">
        <div><div style="font-weight:700">Historial de versiones</div><div style="color:#8a8a9a;font-size:12px">PSA Cockpit · userscript y cockpit</div></div>
        <button id="psa-cl-x" style="background:none;border:0;color:#ccc;font-size:24px;cursor:pointer">×</button></div>
      <div style="padding:6px 20px;overflow-y:auto">${CHANGELOG.map((e, i) => `<div style="padding:12px 0;border-bottom:1px solid #26263a">
        <div style="margin-bottom:6px"><span style="font-weight:700;padding:2px 9px;border-radius:6px;background:${i ? '#26263a' : '#FF9900'};color:${i ? '#fff' : '#0a0a0a'}">v${esc(e.version)}</span>
        <span style="color:#8a8a9a;font-size:12px;margin-left:8px">${esc(e.date)}</span>${e.version === VERSION ? '<span style="color:#FF9900;font-size:12px;margin-left:8px">instalada</span>' : ''}</div>
        <ul style="margin:0;padding-left:18px">${e.changes.map(c => `<li style="margin:4px 0;color:#c9c9d6">${esc(c)}</li>`).join('')}</ul></div>`).join('')}</div></div>`;
    m.onclick = e => { if (e.target === m) m.remove(); };
    document.body.appendChild(m);
    document.getElementById('psa-cl-x').onclick = () => m.remove();
  }
  // ---------- UI ----------
  function ui(isPlanner) {
    if (document.getElementById('psa-cockpit-btn')) return;
    const b = document.createElement('button');
    b.id = 'psa-cockpit-btn';
    b.textContent = isPlanner ? `PSA Planner v${VERSION}` : `PSA Cockpit v${VERSION}`;
    b.style.cssText = 'position:fixed;right:22px;bottom:22px;z-index:9999;background:#FF9900;color:#0a0a0a;border:0;border-radius:999px;' +
      'padding:12px 20px;font:700 14px system-ui;box-shadow:0 6px 20px rgba(0,0,0,.35);cursor:pointer';
    b.onclick = isPlanner === 'open' ? openPlannerTab : isPlanner ? () => runPlanner(false) : run;
    b.oncontextmenu = e => { e.preventDefault(); const t = prompt('Token de GitHub (fine-grained, solo PSA_Cockpit_Data, Contents: write). Vacío = borrar.', ''); if (t !== null) GM_setValue('ghToken', t.trim()); };
    document.body.appendChild(b);
    const v = document.createElement('span');
    v.id = 'psa-cockpit-ver';
    v.textContent = `v${VERSION} · cambios`;
    v.title = 'Ver historial de versiones';
    v.style.cssText = 'position:fixed;right:26px;bottom:6px;z-index:9999;font:11px ui-monospace,Menlo,monospace;color:#888;cursor:pointer;border-bottom:1px dotted #888;background:rgba(255,255,255,.85);padding:0 4px;border-radius:4px';
    v.onclick = showChangelog;
    document.body.appendChild(v);
  }

  async function run() {
    const b = document.getElementById('psa-cockpit-btn');
    const status = t => { b.textContent = t; };
    b.disabled = true;
    try {
      let hdr = readHeader();
      for (let i = 0; i < 20 && hdr.fields_found < 5; i++) { status(`Esperando la página… ${i + 1}s`); await sleep(1000); hdr = readHeader(); }
      if (hdr.fields_found < 5) throw new Error('la página del proyecto no terminó de cargar. Espera unos segundos y vuelve a dar clic.');
      const { header, fields_found } = hdr;
      try { header.finanzas = await readFinancials(status); log('finanzas', JSON.stringify(header.finanzas)); }
      catch (e) { log('finanzas ERROR', e.message); }
      log('encabezado', fields_found, 'campos', header);
      const PRX = /^PR-\d{4,}$/i;
      // 1) Project ID field, 2) the page's own report links (fv0=PR-xxxxxx), 3) remembered for THIS project, 4) ask (never a default).
      let pr = header.pr || findPR() || (header.sfid && GM_getValue('pr2_' + header.sfid.slice(0, 15))) || '';
      if (!PRX.test(pr || '')) {
        pr = (prompt(`No encontré el Project ID de «${header.nombre}». Escribe su PR (PR-xxxxxx):`, '') || '').trim().toUpperCase();
        if (!PRX.test(pr)) throw new Error('PR inválido o vacío; no se capturó nada.');
      }
      pr = pr.toUpperCase(); header.pr = pr;
      const raw = { schema: 1, collector: VERSION, pr, captured: new Date().toISOString(), header, reports: {} };
      for (const [k, cfg] of Object.entries(REPORTS)) raw.reports[k] = await loadReport(k, cfg, pr, status);
      // Guard: the reports must belong to the project on screen (a wrong PR returns another project's rows).
      const wrongOnes = Object.entries(raw.reports).filter(([, r]) => r.ok && (r.tables || []).some(t => t.length > 1) && header.nombre && !String(r.text || '').includes(header.nombre)).map(([k]) => k);
      if (wrongOnes.length) throw new Error(`El PR ${pr} no es de «${header.nombre}»: los reportes (${wrongOnes.join(', ')}) traen otro proyecto. No se subió nada. Revisa el PR y vuelve a intentar.`);
      if (header.sfid) GM_setValue('pr2_' + header.sfid.slice(0, 15), pr);
      if (raw.reports.est_vs_actuals.ok) {
        try { raw.tarifas = await collectRates(raw.reports, status); } catch (e) { log('tarifas ERROR', e.message); }
      }
      const text = JSON.stringify(raw);
      const name = `psa-raw_${pr}_${raw.captured.slice(0, 10)}.json`;
      // Local copy always.
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name; a.click();
      if (!GM_getValue('ghToken')) {
        status('Descargado ✓ (sin token)');
        alert('JSON descargado. Para subirlo solo al repo, da clic derecho en el botón y pega tu token de GitHub.');
      } else {
        status('Subiendo…');
        await upload(`data/${pr}/${name}`, text, `data(${pr}): captura ${raw.captured}`);
        status('Subido ✓ · se actualiza en ~2 min');
        if (confirm('Datos subidos. El cockpit se regenera en unos 2 minutos. ¿Abrirlo?')) window.open(COCKPIT_URL, '_blank');
      }
      const failed = Object.entries(raw.reports).filter(([, r]) => !r.ok).map(([k]) => k);
      if (failed.length) alert('Ojo: estos reportes fallaron: ' + failed.join(', '));
    } catch (e) {
      status('Error'); alert('PSA Cockpit: ' + e.message); log(e);
    } finally {
      setTimeout(() => { b.disabled = false; b.textContent = `PSA Cockpit v${VERSION}`; }, 6000);
    }
  }

  // Lightning is a single-page app: keep the button present after navigations.
  if (/lightningReportApp\.app|\/lightning\/r\/Report\//.test(location.href)) { reportTabMode(); return; }
  {
    const job = GM_getValue('psaJob', null);
    const here = (location.pathname.match(/\/lightning\/r\/(?:\w+\/)?([a-zA-Z0-9]{15,18})\/view/) || [])[1];
    if (job && job.kind === 'record' && here && here.slice(0, 15) === job.id.slice(0, 15) && Date.now() - job.ts < 120000) { recordTabMode(job); return; }
  }
  const IS_PLANNER = location.hostname.includes('--pse.vf.force.com') && /planner/i.test(location.pathname);
  // The planner frame has its own button: tell the Lightning page to hide its duplicate.
  let frameHasButton = false;
  window.addEventListener('message', e => {
    if (e.data === 'psa-planner-frame' && /--pse\.vf\.force\.com$/.test(new URL(e.origin).hostname)) {
      frameHasButton = true;
      const b = document.getElementById('psa-cockpit-btn');
      if (b && b.dataset.mode === 'open' && !b.disabled) { b.remove(); document.getElementById('psa-cockpit-ver')?.remove(); }
    }
  });
  if (IS_PLANNER && window.top !== window.self) setInterval(() => { try { window.parent.postMessage('psa-planner-frame', 'https://proservecrm.lightning.force.com'); } catch (e) { } }, 1500);
  if (IS_PLANNER) {
    const sc = GM_getValue('psaScenario', null);
    const here = (new URLSearchParams(location.search).get('dimensionId') || new URLSearchParams(location.search).get('id') || '').slice(0, 15);
    // Consume the scenario only once the grid is drawn: the first page redirects to /plannerscheduler.
    if (sc && Date.now() - sc.ts < 10 * 60000 && sc.sfid && sc.sfid.slice(0, 15) === here) scenarioPanel(sc);
  }
  if (IS_PLANNER) {
    log('script activo en el planner', location.href.slice(0, 120), window.top === window.self ? '(pestaña)' : '(marco)');
    const job = GM_getValue('psaPlannerJob', null);
    if (job && Date.now() - job.ts < 180000) {
      (async () => {
        for (let i = 0; i < 90 && !document.querySelector('.sch-header-row-middle td.sch-column-header[data-date]'); i++) await sleep(1000);
        if (!document.querySelector('.sch-header-row-middle td.sch-column-header[data-date]') || !GM_getValue('psaPlannerJob', null)) return;
        GM_setValue('psaPlannerJob', null); runPlanner(true);
      })();
    }
  }
  setInterval(() => {
    const mode = IS_PLANNER ? true : plannerAddress() ? (frameHasButton ? null : 'open') : /\/lightning\/r\/pse__Proj__c\//.test(location.pathname) ? false : null;
    let btn = document.getElementById('psa-cockpit-btn');
    if (btn && !btn.disabled && btn.dataset.mode !== String(mode)) { btn.remove(); btn = null; document.getElementById('psa-cockpit-ver')?.remove(); }
    if (mode !== null && !btn) { ui(mode); document.getElementById('psa-cockpit-btn').dataset.mode = String(mode); }
  }, 1500);
})();
