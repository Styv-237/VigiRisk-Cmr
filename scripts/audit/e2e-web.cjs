/* Tests de bout en bout du site web (build de production) — audit qualité VigiRisk.
 * Usage : node scripts/audit/e2e-web.cjs <dossier_sortie>   (site servi sur AUDIT_URL, défaut http://localhost:8092)
 * Nécessite : playwright (préinstallé), axe-core (npm i axe-core) résolu depuis AXE_PATH ou node_modules.
 * Chaque test produit un statut RÉUSSI / ÉCHOUÉ ; le résumé JSON est écrit dans <sortie>/resultats.json. */
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.AUDIT_URL || 'http://localhost:8092';
const OUT = process.argv[2] || 'audit-out';
fs.mkdirSync(OUT, { recursive: true });
const AXE = fs.readFileSync(process.env.AXE_PATH || require.resolve('axe-core/axe.min.js'), 'utf8');
const SUPABASE = /supabase\.co/;

const results = [];
function record(id, name, ok, detail = '') {
  results.push({ id, name, status: ok ? 'RÉUSSI' : 'ÉCHOUÉ', detail: String(detail).slice(0, 400) });
  console.log(`${ok ? '✔' : '✘'} ${id} ${name}${detail ? ' — ' + String(detail).slice(0, 160) : ''}`);
}

async function test(id, name, fn) {
  if (process.env.AUDIT_ONLY && !id.startsWith(process.env.AUDIT_ONLY)) return;
  try {
    // Réussite : la fonction renvoie true, ou une chaîne commençant par « OK: » (mesure à consigner).
    // Toute autre chaîne est le détail d'un échec.
    const r = await fn();
    const ok = r === true || (typeof r === 'string' && r.startsWith('OK: '));
    record(id, name, ok, typeof r === 'string' ? r.replace(/^OK: /, '') : '');
  } catch (e) {
    record(id, name, false, e.message.split('\n')[0]);
  }
}

async function newPage(browser, opts = {}) {
  const proxy = process.env.HTTPS_PROXY;
  const ctx = await browser.newContext({ ...devices['Pixel 7'], locale: 'fr-FR', timezoneId: 'Africa/Douala', ...opts });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && page.errors.push(m.text()));
  return { ctx, page };
}

async function pickCommune(page, query, name) {
  await page.getByRole('button', { name: 'Choisir une commune' }).first().click();
  await page.getByPlaceholder('Commune, département, région…').fill(query);
  await page.getByText(name, { exact: true }).first().click();
  await page.getByText('Prévisions sur 10 jours').waitFor({ timeout: 20000 });
}

(async () => {
  const proxy = process.env.HTTPS_PROXY;
  const browser = await chromium.launch(proxy ? { proxy: { server: proxy, bypass: 'localhost,127.0.0.1' } } : {});

  // ---------- A. Parcours fonctionnels ----------
  {
    const { ctx, page } = await newPage(browser);
    await test('A01', 'Premier lancement : écran « Où êtes-vous ? » avec deux actions', async () => {
      await page.goto(BASE, { waitUntil: 'networkidle' });
      await page.getByText('Où êtes-vous ?').waitFor();
      return (await page.getByRole('button', { name: 'Utiliser ma position' }).count()) === 1 && (await page.getByRole('button', { name: 'Choisir une commune' }).count()) === 1;
    });
    await page.screenshot({ path: path.join(OUT, 'A01-premier-lancement.png') });
    await test('A02', 'Recherche : indice affiché sous 2 caractères', async () => {
      await page.getByRole('button', { name: 'Choisir une commune' }).click();
      await page.getByPlaceholder('Commune, département, région…').fill('y');
      return page.getByText(/Tapez au moins 2 lettres/).isVisible();
    });
    await test('A03', 'Recherche « yaounde 7 » : Yaoundé VII en premier', async () => {
      await page.getByPlaceholder('Commune, département, région…').fill('yaounde 7');
      await page.getByText('Yaoundé VII', { exact: true }).first().waitFor({ timeout: 15000 });
      const first = await page.locator('text=/^Yaoundé [IVX]+$/').first().innerText();
      return first === 'Yaoundé VII' || `premier résultat : ${first}`;
    });
    await test('A04', 'Recherche sans résultat : message explicite', async () => {
      await page.getByPlaceholder('Commune, département, région…').fill('zzqqxx');
      await page.getByText(/Aucun résultat pour/).waitFor({ timeout: 15000 });
      return true;
    });
    await test('A05', 'Recherche injection/XSS : texte rendu tel quel, aucune erreur', async () => {
      await page.getByPlaceholder('Commune, département, région…').fill(`<img src=x onerror=alert(1)>'"; drop table x;--`);
      await page.waitForTimeout(1500);
      return (await page.locator('img[src="x"]').count()) === 0 && page.errors.length === 0;
    });
    await test('A06', 'Choisir une région ouvre la liste de ses communes (Centre → Mbalmayo)', async () => {
      await page.getByPlaceholder('Commune, département, région…').fill('Centre');
      await page.getByText('Région', { exact: false }).first().waitFor({ timeout: 15000 });
      await page.getByText('Centre', { exact: true }).first().click();
      await page.getByText('Mbalmayo', { exact: true }).waitFor({ timeout: 15000 });
      const n = await page.locator('text=/^(Yaoundé|Mbalmayo|Obala|Soa|Mfou)/').count();
      await page.getByText('Mbalmayo', { exact: true }).click();
      await page.getByText('Prévisions sur 10 jours').waitFor({ timeout: 20000 });
      return n >= 5 && (await page.getByRole('header', { name: 'Mbalmayo' }).count()) >= 0;
    });
    await test('A07', 'Accueil : commune, température, 48 h, 10 jours, cumuls, source', async () => {
      const t = await page.locator('body').innerText();
      // innerText applique text-transform (titres en capitales) : comparaisons insensibles à la casse.
      const checks = { commune: t.includes('Mbalmayo'), temp: /\d+°/.test(t), dix: /prévisions sur 10 jours/i.test(t), cumuls: /cumuls de pluie/i.test(t), source: /Open-Meteo · CC BY 4\.0 · mis à jour/.test(t), avert: t.includes('Information indicative') };
      const ko = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
      return ko.length === 0 || `manquant : ${ko.join(', ')}`;
    });
    await page.screenshot({ path: path.join(OUT, 'A07-accueil.png'), fullPage: false });
    await test('A08', '48 h : 48 colonnes horaires', async () => {
      const n = await page.locator('[aria-label*="°,"]').count();
      return n >= 48 || `${n} éléments horaires/journaliers étiquetés`;
    });
    await test('A09', 'Persistance : la commune choisie survit au rechargement', async () => {
      await page.reload({ waitUntil: 'networkidle' });
      await page.getByText('Prévisions sur 10 jours').waitFor({ timeout: 20000 });
      return (await page.locator('body').innerText()).includes('Mbalmayo');
    });
    await test('A10', 'Toucher le nom de la commune ouvre la recherche ; fermer y revient', async () => {
      await page.getByText('Mbalmayo', { exact: true }).first().click();
      await page.getByPlaceholder('Commune, département, région…').waitFor();
      await page.getByRole('button', { name: 'Fermer' }).click();
      await page.getByText('Prévisions sur 10 jours').waitFor({ timeout: 10000 });
      return true;
    });
    await test('A11', 'Lien « Méthodes et sources » ouvre la page et se ferme', async () => {
      await page.getByText(/Méthodes et sources/).first().click();
      await page.getByText('Limites administratives').waitFor();
      const ok = (await page.locator('body').innerText()).includes('Dernière mise à jour de votre commune');
      await page.getByRole('button', { name: 'Fermer' }).click();
      await page.getByText('Prévisions sur 10 jours').waitFor({ timeout: 10000 });
      return ok || 'date de mise à jour absente';
    });
    // Chaque onglet doit changer l'adresse ET afficher son propre écran (le texte seul ne suffit pas :
    // l'accueil mentionne aussi « étape 6 »).
    for (const [id, label, route, expected] of [
      ['A12', 'Groupes', '/groupes', 'étape 7'],
      ['A13', 'Fil citoyen', '/fil', 'étape 6'],
      ['A14', 'Profil', '/profil', 'étape 4'],
      ['A15', 'Signaler un incident', '/signaler', 'étape 5'],
      ['A16', 'Météo', '/', 'Prévisions sur 10 jours'],
    ]) {
      await test(id, `Onglet « ${label} » : adresse ${route} et écran attendu`, async () => {
        await page.getByLabel(label, { exact: true }).click();
        await page.waitForURL((u) => new URL(u).pathname === route, { timeout: 10000 });
        await page.getByText(new RegExp(expected)).last().waitFor({ state: 'visible', timeout: 10000 });
        const selected = await page.getByLabel(label, { exact: true }).getAttribute('aria-selected');
        return selected === 'true' || `aria-selected=${selected}`;
      });
    }
    await test('A17', 'Aucune erreur JavaScript pendant le parcours', async () => page.errors.length === 0 || page.errors.slice(0, 3).join(' | '));
    await ctx.close();
  }

  // ---------- Géolocalisation ----------
  await test('A18', 'GPS accordé (Nkolbisson) → « Ma position » Yaoundé VII', async () => {
    const { ctx, page } = await newPage(browser, { geolocation: { latitude: 3.874, longitude: 11.456 }, permissions: ['geolocation'] });
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Utiliser ma position' }).click();
    await page.getByText('Prévisions sur 10 jours').waitFor({ timeout: 20000 });
    const t = await page.locator('body').innerText();
    await ctx.close();
    return (t.includes('MA POSITION') || t.includes('Ma position')) && t.includes('Yaoundé VII');
  });
  await test('A19', 'GPS refusé → message et choix manuel possible', async () => {
    const { ctx, page } = await newPage(browser, { permissions: [] });
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Utiliser ma position' }).click();
    await page.getByText(/Position non autorisée/).waitFor({ timeout: 15000 });
    const ok = await page.getByRole('button', { name: 'Choisir une commune' }).isVisible();
    await ctx.close();
    return ok;
  });
  await test('A20', 'Position hors du Cameroun (Paris) → message explicite', async () => {
    const { ctx, page } = await newPage(browser, { geolocation: { latitude: 48.85, longitude: 2.35 }, permissions: ['geolocation'] });
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Utiliser ma position' }).click();
    await page.getByText(/hors du Cameroun/).waitFor({ timeout: 15000 });
    await ctx.close();
    return true;
  });

  // ---------- Liens directs, 404, langue ----------
  for (const [id, route, expect] of [
    ['A21', '/communes', 'Choisir une commune'],
    ['A22', '/sources', 'Méthodes et sources'],
    ['A23', '/fil', 'étape 6'],
  ]) {
    await test(id, `Lien direct ${route}`, async () => {
      const { ctx, page } = await newPage(browser);
      const resp = await page.goto(BASE + route, { waitUntil: 'networkidle' });
      await page.getByText(new RegExp(expect)).first().waitFor({ timeout: 15000 });
      await ctx.close();
      return resp.status() === 200 || `HTTP ${resp.status()}`;
    });
  }
  await test('A24', 'Page inexistante : message 404 en français avec retour à l’accueil', async () => {
    const { ctx, page } = await newPage(browser);
    await page.goto(BASE + '/nexiste-pas', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const t = await page.locator('body').innerText();
    await page.screenshot({ path: path.join(OUT, 'A24-404.png') });
    await ctx.close();
    return (/introuvable/i.test(t) && !/Sitemap/.test(t)) || `texte affiché : ${t.slice(0, 120).replace(/\n/g, ' ')}`;
  });
  await test('A24b', 'Plan du site technique (/_sitemap) non exposé en production', async () => {
    const { ctx, page } = await newPage(browser);
    await page.goto(BASE + '/_sitemap', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    const t = await page.locator('body').innerText();
    await ctx.close();
    return !/Sitemap/i.test(t) || 'la page /_sitemap liste les routes';
  });
  await test('A25', 'Interface en anglais pour un navigateur anglophone', async () => {
    const { ctx, page } = await newPage(browser, { locale: 'en-GB' });
    await page.goto(BASE, { waitUntil: 'networkidle' });
    const ok = await page.getByText('Where are you?').isVisible();
    await ctx.close();
    return ok;
  });
  await test('A26', 'Attribut lang du document conforme à la langue affichée', async () => {
    const { ctx, page } = await newPage(browser);
    await page.goto(BASE, { waitUntil: 'networkidle' });
    const lang = await page.evaluate(() => document.documentElement.lang);
    await ctx.close();
    return lang.startsWith('fr') || `lang="${lang}" alors que l'interface est en français`;
  });

  // ---------- Résilience réseau ----------
  await test('A27', 'API indisponible au relancement : dernières prévisions affichées depuis le cache', async () => {
    const { ctx, page } = await newPage(browser);
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await pickCommune(page, 'douala 5', 'Douala V');
    await page.waitForTimeout(2500); // écriture du cache persistant (throttle 2 s)
    await ctx.route(SUPABASE, (r) => r.abort('internetdisconnected'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByText('Prévisions sur 10 jours').waitFor({ timeout: 20000 });
    await ctx.close();
    return true;
  });
  await test('A28', 'API indisponible sans cache : message clair et bouton Réessayer', async () => {
    const { ctx, page } = await newPage(browser);
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.setItem('vigirisk.place.v1', JSON.stringify({ pcode: 'CM005004005', name: 'Douala V', origin: 'manual' })));
    await ctx.route(SUPABASE, (r) => r.abort('internetdisconnected'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(12000); // 2 nouvelles tentatives
    const t = await page.locator('body').innerText();
    await page.screenshot({ path: path.join(OUT, 'A28-sans-reseau.png') });
    await ctx.close();
    return (/Hors connexion|Pas encore de prévision/.test(t) && t.includes('Réessayer')) || `affiché : ${t.slice(0, 160).replace(/\n/g, ' ')}`;
  });
  await test('A29', 'Recherche sans réseau : message d’erreur (pas de liste vide silencieuse)', async () => {
    const { ctx, page } = await newPage(browser);
    await page.goto(BASE + '/communes', { waitUntil: 'networkidle' });
    await ctx.route(SUPABASE, (r) => r.abort('internetdisconnected'));
    await page.getByPlaceholder('Commune, département, région…').fill('garoua');
    await page.waitForTimeout(9000);
    const t = await page.locator('body').innerText();
    await ctx.close();
    return /connexion|réseau|erreur/i.test(t) || `affiché : ${t.slice(0, 160).replace(/\n/g, ' ')}`;
  });

  // ---------- C. Responsive ----------
  // Un contexte neuf par taille : émulation téléphone (tactile, densité 3) jusqu'à 480 px, tablette ou
  // ordinateur au-delà. Contrôles : pas de débordement horizontal, 5 onglets visibles sans chevauchement,
  // contenu centré.
  const sizes = [[320, 640], [360, 740], [375, 667], [390, 844], [430, 932], [480, 854], [768, 1024], [1024, 768], [1280, 800], [1920, 1080]];
  for (const [w, h] of sizes) {
    await test(`C-${w}x${h}`, `Responsive ${w}×${h} : pas de débordement, barre d’onglets entière, contenu centré`, async () => {
      const mobile = w <= 480;
      const { ctx, page } = await newPage(browser, { viewport: { width: w, height: h }, deviceScaleFactor: mobile ? 3 : w <= 1024 ? 2 : 1, isMobile: mobile, hasTouch: w <= 1024 });
      await page.addInitScript(() => localStorage.setItem('vigirisk.place.v1', JSON.stringify({ pcode: 'CM002007007', name: 'Yaoundé VII', departement: 'Mfoundi', region: 'Centre', origin: 'manual' })));
      await page.goto(BASE, { waitUntil: 'networkidle' });
      await page.getByText('Prévisions sur 10 jours').waitFor({ timeout: 20000 });
      await page.waitForTimeout(400);
      const m = await page.evaluate(() => {
        const sw = document.documentElement.scrollWidth, iw = window.innerWidth;
        const nav = [...document.querySelectorAll('[role="tab"]')].map((e) => e.getBoundingClientRect());
        const outside = nav.filter((r) => r.left < 0 || r.right > iw + 0.5).length;
        let overlap = 0;
        for (let i = 0; i < nav.length; i++) for (let j = i + 1; j < nav.length; j++) if (nav[i].right > nav[j].left + 1 && nav[j].right > nav[i].left + 1 && Math.abs(nav[i].top - nav[j].top) < 30) overlap++;
        const title = [...document.querySelectorAll('[role="heading"]')].find((e) => e.offsetParent);
        const r = title ? title.getBoundingClientRect() : null;
        const offCentre = r ? Math.round(Math.abs(r.left + r.width / 2 - iw / 2)) : -1;
        return { sw, iw, tabs: nav.length, outside, overlap, offCentre };
      });
      await page.screenshot({ path: path.join(OUT, `C-${w}x${h}.png`) });
      await ctx.close();
      return (m.sw <= m.iw && m.tabs === 5 && m.outside === 0 && m.overlap === 0 && m.offCentre >= 0 && m.offCentre <= 2) || JSON.stringify(m);
    });
  }

  // ---------- H. Accessibilité ----------
  for (const [id, route, prep] of [
    ['H01', '/', 'commune'],
    ['H02', '/communes', null],
    ['H03', '/sources', null],
  ]) {
    await test(id, `axe-core WCAG 2.2 A/AA sans violation sérieuse — ${route}`, async () => {
      const { ctx, page } = await newPage(browser);
      await page.goto(BASE, { waitUntil: 'networkidle' });
      if (prep) await pickCommune(page, 'yaounde 7', 'Yaoundé VII');
      if (route !== '/') await page.goto(BASE + route, { waitUntil: 'networkidle' });
      await page.waitForTimeout(800);
      await page.addScriptTag({ content: AXE });
      const r = await page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] })).violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, ex: v.nodes[0]?.target?.join(' ') })));
      fs.writeFileSync(path.join(OUT, `${id}-axe.json`), JSON.stringify(r, null, 2));
      await ctx.close();
      const serious = r.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      return serious.length === 0 || serious.map((v) => `${v.id}(${v.n})`).join(', ');
    });
  }
  await test('H04', 'Clavier : la touche Tab atteint les 5 onglets avec un focus visible', async () => {
    const { ctx, page } = await newPage(browser, { ...devices['Desktop Chrome'], hasTouch: false });
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await pickCommune(page, 'yaounde 7', 'Yaoundé VII');
    const seen = new Set();
    let invisible = 0;
    for (let i = 0; i < 80 && seen.size < 5; i++) {
      await page.keyboard.press('Tab');
      const f = await page.evaluate(() => {
        const e = document.activeElement;
        const cs = getComputedStyle(e);
        return { label: e.getAttribute('aria-label'), role: e.getAttribute('role'), outline: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0, ring: cs.boxShadow !== 'none' };
      });
      if (f.label && ['Météo', 'Groupes', 'Signaler un incident', 'Fil citoyen', 'Profil'].includes(f.label)) {
        seen.add(f.label);
        if (!f.outline && !f.ring) invisible++;
      }
    }
    await page.screenshot({ path: path.join(OUT, 'H04-focus.png') });
    await ctx.close();
    return (seen.size === 5 && invisible === 0) || `onglets atteints : ${seen.size}/5, sans focus visible : ${invisible}`;
  });
  await test('H05', 'Animations : pas de pluie animée si « réduire les animations »', async () => {
    const { ctx, page } = await newPage(browser, { reducedMotion: 'reduce' });
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await pickCommune(page, 'douala 5', 'Douala V');
    const drops = await page.evaluate(() => [...document.querySelectorAll('div')].filter((d) => d.style.width === '1px').length);
    await ctx.close();
    return drops === 0 || `${drops} gouttes animées affichées`;
  });
  await test('H06', 'Zoom texte 200 % : pas de débordement horizontal à 390 px', async () => {
    const { ctx, page } = await newPage(browser);
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await pickCommune(page, 'yaounde 7', 'Yaoundé VII');
    await page.evaluate(() => (document.documentElement.style.fontSize = '200%'));
    await page.setViewportSize({ width: 195, height: 422 }); // équivalent d'un zoom 200 % sur 390 px
    await page.waitForTimeout(500);
    const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
    await page.screenshot({ path: path.join(OUT, 'H06-zoom200.png') });
    await ctx.close();
    return m.sw <= m.iw || JSON.stringify(m);
  });

  // ---------- F. Performances ----------
  for (const [id, label, cond] of [
    ['F01', 'réseau rapide', null],
    ['F02', '3G lente (400 kb/s, 400 ms)', { offline: false, latency: 400, downloadThroughput: 50_000, uploadThroughput: 25_000 }],
  ]) {
    await test(id, `Chargement à froid jusqu’aux prévisions — ${label}`, async () => {
      const { ctx, page } = await newPage(browser);
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Network.enable');
      if (cond) await cdp.send('Network.emulateNetworkConditions', cond);
      let bytes = 0;
      cdp.on('Network.loadingFinished', (e) => (bytes += e.encodedDataLength));
      await page.addInitScript(() => {
        localStorage.setItem('vigirisk.place.v1', JSON.stringify({ pcode: 'CM002007007', name: 'Yaoundé VII', departement: 'Mfoundi', region: 'Centre', origin: 'manual' }));
        window.__lcp = 0; window.__cls = 0;
        new PerformanceObserver((l) => l.getEntries().forEach((e) => (window.__lcp = e.startTime))).observe({ type: 'largest-contentful-paint', buffered: true });
        new PerformanceObserver((l) => l.getEntries().forEach((e) => { if (!e.hadRecentInput) window.__cls += e.value; })).observe({ type: 'layout-shift', buffered: true });
      });
      const t0 = Date.now();
      await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 });
      await page.getByText('Prévisions sur 10 jours').waitFor({ timeout: 120000 });
      const ready = Date.now() - t0;
      await page.waitForTimeout(1000);
      const v = await page.evaluate(() => ({ lcp: Math.round(window.__lcp), cls: Math.round(window.__cls * 1000) / 1000, heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null }));
      await ctx.close();
      const detail = `prêt en ${(ready / 1000).toFixed(1)} s, LCP ${v.lcp} ms, CLS ${v.cls}, ${Math.round(bytes / 1024)} Ko transférés, tas JS ${v.heap} Mo`;
      const budget = cond ? 15000 : 4000;
      return (ready <= budget && v.cls <= 0.1 && `OK: ${detail}`) || `HORS BUDGET (${budget / 1000} s) : ${detail}`;
    });
  }
  await test('F03', 'Stabilité : 3 minutes d’usage simulé sans fuite mémoire notable', async () => {
    const { ctx, page } = await newPage(browser);
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await pickCommune(page, 'yaounde 7', 'Yaoundé VII');
    const heap = () => page.evaluate(() => (performance.memory ? performance.memory.usedJSHeapSize : 0));
    await page.evaluate(() => window.gc && window.gc());
    const h0 = await heap();
    const end = Date.now() + 180_000;
    let cycles = 0;
    while (Date.now() < end) {
      for (const l of ['Groupes', 'Fil citoyen', 'Météo']) await page.getByLabel(l, { exact: true }).click();
      await page.mouse.wheel(0, 600);
      await page.mouse.wheel(0, -600);
      cycles++;
    }
    const h1 = await heap();
    await ctx.close();
    const growth = (h1 - h0) / 1e6;
    return (growth < 30 && `OK: ${cycles} cycles, mémoire ${Math.round(h0 / 1e6)} → ${Math.round(h1 / 1e6)} Mo`) || `croissance ${growth.toFixed(1)} Mo sur ${cycles} cycles`;
  });

  await browser.close();
  fs.writeFileSync(path.join(OUT, 'resultats.json'), JSON.stringify(results, null, 2));
  const ko = results.filter((r) => r.status !== 'RÉUSSI').length;
  console.log(`\n${results.length - ko}/${results.length} réussis`);
})();
