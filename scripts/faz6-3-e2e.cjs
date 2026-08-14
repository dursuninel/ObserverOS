/**
 * Faz 6/3 gerçek etkileşim kapısı — kod yazmadan protokol oluştur → Kontrol Et → düzelt → Uygula.
 *
 * Sentetik olay YOK: gerçek tıklama, gerçek <select> seçimi, gerçek fare sürüklemesi.
 * Kanıtlar `docs/agent-results/TASK-MSSXSDKE5X5GY-screenshots/` altına yazılır.
 */
const fs = require('node:fs');
const path = require('node:path');

const PLAYWRIGHT = 'C:/Users/Reawakened/AppData/Roaming/npm/node_modules/openclaw/node_modules/playwright-core';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://localhost:5173';
const OUT = path.resolve(process.cwd(), 'docs/agent-results/TASK-MSSXSDKE5X5GY-screenshots');

const { chromium } = require(PLAYWRIGHT);

const log = [];
function say(line) {
  log.push(line);
  console.log(line);
}

async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  say(`  [ekran] ${path.basename(file)}`);
}

/** dt metnine göre tanım listesinden dd değerini okur. */
async function readDefinition(page, label) {
  return page.evaluate((text) => {
    for (const dt of Array.from(document.querySelectorAll('dt'))) {
      if (dt.textContent.trim() === text) return dt.nextElementSibling?.textContent?.trim() ?? null;
    }
    return null;
  }, label);
}

async function dragHandle(page, fromSelector, toSelector) {
  const from = await page.locator(fromSelector).boundingBox();
  const to = await page.locator(toSelector).boundingBox();
  if (from === null || to === null) throw new Error(`baglanti noktasi bulunamadi: ${fromSelector} -> ${toSelector}`);
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 24 });
  await page.mouse.up();
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 950 } });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('favicon')) consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(String(error)));

  try {
    await page.goto(`${BASE}/protocols`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="protocol-manager"]');
    say(`1) PROTOKOLLER acildi · <title>="${await page.title()}"`);
    await shot(page, '01-manager');

    // --- 2. Kod yazmadan yeni protokol ---------------------------------------
    await page.click('[data-testid="protocol-create"]');
    await page.waitForSelector('[data-testid="protocol-editor"]');
    say(`2) Yeni protokol olusturuldu · url=${page.url()}`);
    say(`   durum rozeti="${(await page.textContent('.protocol-editor-identity .protocol-badge')).trim()}"`);
    await shot(page, '02-yeni-bos-protokol');

    // --- 3. Bos grafikte Kontrol Et ------------------------------------------
    say(`3) Kontrol Et oncesi Uygula kapali mi: ${await page.isDisabled('[data-testid="protocol-apply"]')}`);
    say(`   kapali olma gerekcesi="${await page.getAttribute('[data-testid="protocol-apply"]', 'title')}"`);
    await page.click('[data-testid="protocol-check"]');
    await page.waitForSelector('[data-testid="protocol-check-result"]');
    say(`   sonuc="${(await page.textContent('[data-testid="protocol-check-result"]')).replace(/\s+/g, ' ').trim()}"`);
    say(`   Uygula hala kapali mi: ${await page.isDisabled('[data-testid="protocol-apply"]')}`);
    await shot(page, '03-kontrol-et-bos-graf');

    // --- 4. Paletten iki dugum ve alanlarin doldurulmasi ----------------------
    await page.click('[data-testid="protocol-palette-trigger"]');
    await page.waitForSelector('[data-testid="protocol-field-sensorId"]');
    await page.selectOption('[data-testid="protocol-field-facilityId"]', 'mine-01');
    await page.selectOption('[data-testid="protocol-field-sensorId"]', 'facility-condition');
    await page.selectOption('[data-testid="protocol-field-operator"]', '<');
    await page.fill('[data-testid="protocol-field-threshold"]', '99');
    say('4) Tetikleyici alanlari secildi (Maden · kondisyon · altina duserse · 99)');
    await shot(page, '04-tetikleyici-alanlari');

    await page.click('[data-testid="protocol-palette-action"]');
    await page.waitForSelector('[data-testid="protocol-field-actionId"]');
    await page.selectOption('[data-testid="protocol-field-facilityId"]', 'mine-01');
    await page.selectOption('[data-testid="protocol-field-actionId"]', 'set-mode');
    await page.waitForSelector('[data-testid="protocol-field-value"]');
    await page.selectOption('[data-testid="protocol-field-value"]', 'eco');
    say('5) Eylem alanlari secildi (Maden · calisma modu · Eco)');
    await shot(page, '05-eylem-alanlari');

    // --- 5. Gecersiz baglanti gercek surukleme ile denenir --------------------
    await page.click('[data-testid="protocol-palette-sensor"]');
    await page.click('[data-testid="protocol-fit-view"]');
    await page.waitForTimeout(300);
    await dragHandle(
      page,
      '.react-flow__node[data-id="sensor-1"] .react-flow__handle-right',
      '.react-flow__node[data-id="action-1"] .react-flow__handle-left',
    );
    await page.waitForTimeout(200);
    say(`6) Gecersiz baglanti denendi · aciklama="${(await page.textContent('[data-testid="protocol-connection-notice"]')).trim()}"`);
    say(`   kurulan baglanti sayisi=${await page.locator('.react-flow__edge').count()}`);
    await shot(page, '06-gecersiz-baglanti-turkce');

    await page.click('.react-flow__node[data-id="sensor-1"]');
    await page.click('[data-testid="protocol-detail-delete"]');
    say('   fazla dugum silindi');

    // --- 6. Gecerli baglanti --------------------------------------------------
    await page.click('[data-testid="protocol-fit-view"]');
    await page.waitForTimeout(300);
    await dragHandle(
      page,
      '.react-flow__node[data-id="trigger-1"] .react-flow__handle-right',
      '.react-flow__node[data-id="action-1"] .react-flow__handle-left',
    );
    await page.waitForTimeout(200);
    say(`7) Gecerli baglanti kuruldu · baglanti sayisi=${await page.locator('.react-flow__edge').count()}`);

    await page.click('[data-testid="protocol-check"]');
    await page.waitForSelector('[data-testid="protocol-check-result"]');
    say(`8) Kontrol Et="${(await page.textContent('[data-testid="protocol-check-headline"]')).trim()}"`);
    say(`   Uygula acildi mi: ${!(await page.isDisabled('[data-testid="protocol-apply"]'))}`);
    await shot(page, '07-kontrol-et-temiz');

    // --- 7. Uygula -----------------------------------------------------------
    await page.click('[data-testid="protocol-apply"]');
    await page.waitForTimeout(300);
    say(`9) Uygula sonucu="${(await page.textContent('[data-testid="protocol-connection-notice"]')).trim()}"`);
    say(`   durum rozeti="${(await page.textContent('.protocol-editor-identity .protocol-badge')).trim()}"`);
    await shot(page, '08-uygulandi');

    // --- 8. Simulasyon duraklamadi -------------------------------------------
    // Sayfa YENIDEN YUKLENMEZ: yeniden yukleme motoru ve protokol kitapligini sifirlar.
    await page.click(`.app-navigation a[href="/colony"]`);
    await page.waitForSelector('[data-testid="simulation-diagnostic"]');
    const first = await readDefinition(page, 'GEÇEN SİM. DAKİKASI');
    const world = await readDefinition(page, 'DÜNYA GÖRSEL DURUMU');
    await page.waitForTimeout(6000);
    const second = await readDefinition(page, 'GEÇEN SİM. DAKİKASI');
    say(`10) Uygula sonrasi saat: ${first} -> ${second} sim. dk. · durum="${world}"`);
    await shot(page, '09-simulasyon-duraklamadi');

    // --- 9. Protokol gercekten kostu -----------------------------------------
    let lastRun = null;
    let mode = null;
    const deadline = Date.now() + 180_000;
    while (Date.now() < deadline) {
      mode = await readDefinition(page, 'MOD');
      if (mode !== null && mode.startsWith('Eco')) break;
      await page.waitForTimeout(3000);
    }
    const elapsed = await readDefinition(page, 'GEÇEN SİM. DAKİKASI');
    say(`11) Maden modu="${mode}" (sim. dk. ${elapsed}) — protokol komutu yetkili duruma islendi`);
    await shot(page, '10-koloni-maden-eco');

    await page.click(`.app-navigation a[href="/protocols"]`);
    await page.waitForSelector('[data-testid="protocol-manager"]');
    await page.waitForTimeout(1500);
    lastRun = await page.evaluate(() => {
      const link = document.querySelector('[data-testid="protocol-card-edit-protokol-1"]');
      const card = link?.closest('[data-testid="protocol-card"]');
      return card?.querySelector('[data-testid="protocol-card-last-run"]')?.textContent?.trim() ?? null;
    });
    say(`12) Kart "SON CALISMA"="${lastRun}"`);
    await shot(page, '11-manager-son-calisma');

    say(`13) Konsol hatasi sayisi=${consoleErrors.length}${consoleErrors.length === 0 ? '' : ` :: ${consoleErrors.join(' | ')}`}`);
  } finally {
    fs.writeFileSync(path.join(OUT, 'e2e-cikti.txt'), log.join('\n'), 'utf8');
    await browser.close();
  }
})().catch((error) => {
  console.error('E2E BASARISIZ:', error);
  process.exit(1);
});
