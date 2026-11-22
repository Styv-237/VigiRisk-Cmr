// Démonstration web de l'étape 2 : choisit « Yaoundé VII » et capture l'accueil. Usage : node scripts/demo-web.cjs <dossier_captures>
const { chromium, devices } = require('playwright');
const out = process.argv[2];
(async () => {
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  const browser = await chromium.launch(proxy ? { proxy: { server: proxy, bypass: 'localhost,127.0.0.1' } } : {});
  const ctx = await browser.newContext({ ...devices['Pixel 7'], locale: 'fr-FR', timezoneId: 'Africa/Douala' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(process.env.DEMO_URL || 'http://localhost:8091/', { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${out}/1-choix.png` });
  await page.getByText('Choisir une commune').first().click();
  await page.getByPlaceholder('Commune, département, région…').fill('yaounde 7');
  await page.getByText('Yaoundé VII', { exact: true }).first().waitFor({ timeout: 15000 });
  await page.screenshot({ path: `${out}/2-recherche.png` });
  await page.getByText('Yaoundé VII', { exact: true }).first().click();
  await page.getByText('Prévisions sur 10 jours').waitFor({ timeout: 15000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/3-accueil.png` });
  await page.screenshot({ path: `${out}/4-accueil-complet.png`, fullPage: true });
  const text = await page.locator('body').innerText();
  console.log(text.slice(0, 1500));
  console.log('ERREURS:', JSON.stringify(errors.slice(0, 5)));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
