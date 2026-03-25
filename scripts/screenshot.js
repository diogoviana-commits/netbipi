/**
 * NetBIPI — Screenshot automático para portfolio/LinkedIn
 * Uso: npm run screenshot
 * Pré-requisito: docker-compose up -d (aguarde ~60s)
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs   = require('fs');

const BASE_URL = 'http://localhost';
const EMAIL    = process.env.NETBIPI_SCREENSHOT_EMAIL || 'admin@netbipi.local';
const PASSWORD = process.env.NETBIPI_DEMO_PASSWORD || 'NetBIPI@Demo2026';
const OUT_DIR  = path.join(__dirname, '..', 'screenshots');

// Usa pushState para navegar SEM reload — mantém auth do React intacta
const ROUTES = [
  { name: '02-dashboard', path: '/',          desc: 'Dashboard Principal'     },
  { name: '03-alerts',    path: '/alerts',    desc: 'Painel de Alertas'       },
  { name: '04-tickets',   path: '/tickets',   desc: 'Chamados (Service Desk)' },
  { name: '05-assets',    path: '/assets',    desc: 'Inventário de Ativos'    },
  { name: '06-map',       path: '/map',       desc: 'Mapa de Infraestrutura'  },
  { name: '07-network',   path: '/network',   desc: 'Diagnóstico de Rede'     },
  { name: '08-knowledge', path: '/knowledge', desc: 'Base de Conhecimento'    },
  { name: '09-cloud',     path: '/cloud',     desc: 'Painel Cloud'            },
  { name: '10-shift',     path: '/shift',     desc: 'Dashboard por Turno'     },
  { name: '11-reports',   path: '/reports',   desc: 'Relatórios'              },
  { name: '12-logs',      path: '/logs',      desc: 'Logs do Sistema'         },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Define valor em input React (dispara onChange corretamente)
async function setReactInput(page, selector, value) {
  await page.waitForSelector(selector, { timeout: 10000 });
  await page.evaluate((sel, val) => {
    const input = document.querySelector(sel);
    const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    nativeSetter.call(input, val);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, selector, value);
}

// Navega via React Router sem reload de página
async function navigateSPA(page, toPath) {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
  }, toPath);
  await sleep(1800);
}

// Screenshot como buffer + gravação manual (evita ENOENT em alguns sistemas)
async function screenshot(page, filePath) {
  const buf = await Promise.race([
    page.screenshot({ encoding: 'binary' }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout screenshot')), 8000)),
  ]);
  fs.writeFileSync(filePath, buf, 'binary');
}

(async () => {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║   NetBIPI — Captura automática de telas      ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 },
    args: ['--no-sandbox', '--start-maximized'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

  // ── Verifica se está no ar ──
  console.log('🌐 Verificando NetBIPI...');
  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2', timeout: 20000 });
  } catch {
    console.error('❌ NetBIPI não responde. Execute: docker-compose up -d\n');
    await browser.close(); process.exit(1);
  }
  console.log('   Online ✓\n');

  // ── Screenshot da tela de login ──
  await sleep(1500);
  await screenshot(page, path.join(OUT_DIR, '01-login.png'));
  console.log('  ✓  Tela de Login                    → 01-login.png');

  // ── Login via React inputs ──
  console.log('\n🔐 Fazendo login...');
  await setReactInput(page, 'input[type="email"]', EMAIL);
  await setReactInput(page, 'input[type="password"]', PASSWORD);
  await sleep(300);
  await page.click('button[type="submit"]');

  // Espera sair da página de login
  try {
    await page.waitForFunction(
      () => !window.location.pathname.includes('/login'),
      { timeout: 15000 }
    );
  } catch {
    // Se não redirecionou, verifica se há erro na tela
    const errorText = await page.$eval('.text-red-400', el => el.textContent).catch(() => 'sem mensagem');
    console.error(`❌ Login falhou: ${errorText}`);
    console.error('   Verifique se o backend está rodando: docker-compose logs backend\n');
    await page.screenshot({ path: path.join(OUT_DIR, 'debug-login.png') });
    await browser.close(); process.exit(1);
  }

  await sleep(3000);
  console.log('   Logado ✓\n');

  // ── Screenshots navegando SEM reload ──
  console.log('📸 Capturando telas (navegação interna, sem reload)...\n');

  for (const r of ROUTES) {
    try {
      await navigateSPA(page, r.path);
      await screenshot(page, path.join(OUT_DIR, `${r.name}.png`));
      console.log(`  ✓  ${r.desc.padEnd(32)} → ${r.name}.png`);
    } catch (err) {
      console.warn(`  ✗  ${r.desc.padEnd(32)} → ${err.message.split('\n')[0]}`);
    }
  }

  // ── Kiosk (precisa de goto pois é rota separada sem sidebar) ──
  try {
    await page.goto(`${BASE_URL}/kiosk`, { waitUntil: 'networkidle2', timeout: 20000 });
    await sleep(2500);
    await screenshot(page, path.join(OUT_DIR, '13-kiosk.png'));
    console.log(`  ✓  ${'Modo NOC (Quiosque)'.padEnd(32)} → 13-kiosk.png`);
  } catch (err) {
    console.warn(`  ✗  Modo NOC                         → ${err.message.split('\n')[0]}`);
  }

  await browser.close();

  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║   Capturas salvas em: netbipi/screenshots/   ║');
  console.log('╚══════════════════════════════════════════════╝\n');
  console.log('  • Capa do post     →  02-dashboard.png');
  console.log('  • Carrossel top    →  dashboard, map, kiosk, alerts, network\n');
})();
