// Saca las capturas del README (docs/*.webp) con Chrome sin ventana.
//
// Uso:
//   npm run build && npm start          # la versión compilada: el modo dev muestra el ícono de Next.js
//   npm run capturas                     # en otra terminal; guarda en docs/
//   npm run capturas -- --restaurar-demo # antes rehace la demo local (las pruebas dejan clientes de más)
//
// Variables: BASE (por defecto http://127.0.0.1:3210), CHROME (ruta al ejecutable) y, para
// --restaurar-demo, NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SECRET_KEY de .env.local.
//
// Habla CDP por tubería (--remote-debugging-pipe) en lugar de un puerto: en algunas PC el
// antivirus o el firewall cortan las conexiones de Node al puerto de depuración.
// Emula prefers-reduced-motion para que las animaciones queden quietas en su estado final.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';

const args = process.argv.slice(2);
const SALIDA = resolve(args.find(a => !a.startsWith('--')) ?? 'docs');
const BASE = process.env.BASE ?? 'http://127.0.0.1:3210';
const espera = ms => new Promise(r => setTimeout(r, ms));
const NUL = String.fromCharCode(0);

const CHROME = process.env.CHROME ?? [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find(existsSync);
if (!CHROME) throw new Error('No encontré Chrome: indicá la ruta en la variable CHROME.');

if (args.includes('--restaurar-demo')) await restaurarDemo();
mkdirSync(SALIDA, { recursive: true });

/** Rehace los negocios de ejemplo. Solo contra una base local, nunca contra la de producción. */
async function restaurarDemo() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url)) throw new Error(`--restaurar-demo solo corre contra Supabase local, no contra ${url || '(sin URL)'}`);
  const db = createClient(url, process.env.SUPABASE_SECRET_KEY ?? '', { auth: { persistSession: false } });
  const { error } = await db.rpc('restaurar_demo');
  if (error) throw new Error('restaurar_demo: ' + error.message);
  console.log('demo restaurada');
}

// ── CDP por tubería: mensajes JSON separados por NUL en los descriptores 3 (escritura) y 4 (lectura)
const perfil = mkdtempSync(join(tmpdir(), 'talon-cdp-'));
const chrome = spawn(CHROME, [
  '--headless=new', '--remote-debugging-pipe', '--user-data-dir=' + perfil, '--hide-scrollbars',
  '--force-color-profile=srgb', '--no-first-run', 'about:blank',
], { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });

let id = 0, sesion = null, resto = '';
const pendientes = new Map();
chrome.stdio[4].on('data', trozo => {
  resto += trozo.toString('utf8');
  let corte;
  while ((corte = resto.indexOf(NUL)) >= 0) {
    const m = JSON.parse(resto.slice(0, corte));
    resto = resto.slice(corte + 1);
    if (m.id && pendientes.has(m.id)) {
      const p = pendientes.get(m.id); pendientes.delete(m.id);
      m.error ? p.mal(new Error(m.error.message)) : p.ok(m.result);
    }
  }
});
function enviar(method, params = {}, conSesion = true) {
  return new Promise((ok, mal) => {
    const n = ++id;
    pendientes.set(n, { ok, mal });
    const msj = { id: n, method, params };
    if (conSesion && sesion) msj.sessionId = sesion;
    chrome.stdio[3].write(JSON.stringify(msj) + NUL);
  });
}
const cdp = (m, p) => enviar(m, p, true);

async function conectar() {
  for (let i = 0; i < 40; i++) {
    const { targetInfos } = await enviar('Target.getTargets', {}, false);
    const pagina = targetInfos.find(t => t.type === 'page');
    if (pagina) {
      ({ sessionId: sesion } = await enviar('Target.attachToTarget', { targetId: pagina.targetId, flatten: true }, false));
      return;
    }
    await espera(250);
  }
  throw new Error('Chrome no abrió ninguna página');
}

async function tamaño(ancho, alto, movil = false) {
  await cdp('Emulation.setDeviceMetricsOverride', { width: ancho, height: alto, deviceScaleFactor: movil ? 2 : 1, mobile: movil });
}
async function ir(ruta, ms = 3500) {
  await cdp('Page.navigate', { url: BASE + ruta });
  await espera(ms);
}
async function js(codigo) {
  const r = await cdp('Runtime.evaluate', { expression: '(async () => { ' + codigo + ' })()', awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description ?? ''));
  return r.result.value;
}
async function foto(nombre) {
  const { data } = await cdp('Page.captureScreenshot', { format: 'png' });
  await sharp(Buffer.from(data, 'base64')).webp({ quality: 82 }).toFile(join(SALIDA, nombre + '.webp'));
  console.log('ok', nombre);
}

// Ayudantes que corren dentro de la página.
const AYUDA = `
  const boton = t => [...document.querySelectorAll('button')].find(x => x.textContent.includes(t));
  const esperar = ms => new Promise(r => setTimeout(r, ms));
  const escribir = (n, v) => { const i = document.querySelector('input[name=' + n + ']'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, v); i.dispatchEvent(new Event('input', { bubbles: true })); };
  const horas = () => [...document.querySelectorAll('[role=radiogroup] button')].filter(x => /^[0-9]{2}:[0-9]{2}$/.test(x.textContent.trim()));
`;

try {
  await conectar();
  await cdp('Page.enable');
  await cdp('Runtime.enable');
  await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });

  await tamaño(1440, 900);
  await ir('/');
  await foto('inicio');

  // El teléfono usa el prefijo 0000, que no existe en Paraguay: ninguna captura muestra un número de alguien.
  await ir('/la-navaja');
  await js(AYUDA + `
    boton('Corte y barba').click(); await esperar(2500);
    boton('Tati').click(); await esperar(2500);
    [...document.querySelectorAll('[aria-label="Día"] button:not([disabled])')][2].click(); await esperar(1200);
    horas()[2].click(); await esperar(600);
    escribir('nombre', 'Marta Ramírez'); escribir('telefono', '0000 555 321');
    window.scrollTo(0, document.getElementById('t-servicio').getBoundingClientRect().top + scrollY - 40); await esperar(600);`);
  await foto('reserva');

  await js(AYUDA + `document.querySelector('button[type=submit]').click(); await esperar(4500);
    window.scrollTo(0, document.querySelector('.vaho').getBoundingClientRect().top + scrollY - 140); await esperar(800);`);
  await foto('numero');

  await tamaño(390, 844, true);
  await ir('/kine-mburucuya');
  await js(AYUDA + `boton('Drenaje').click(); await esperar(2500);
    window.scrollTo(0, document.getElementById('t-cuando').getBoundingClientRect().top + scrollY - 20); await esperar(800);`);
  await foto('reserva-celular');

  await tamaño(1440, 900);
  await ir('/panel/entrar');
  await foto('entrar');
  await js(AYUDA + `boton('Ramón').click(); await esperar(5000);`);
  const dia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Asuncion' }).format(new Date(Date.now() + 4 * 864e5));
  await ir('/panel/la-navaja?fecha=' + dia + '&vista=dia', 4500);
  await foto('agenda');
  await js(AYUDA + `
    const bloques = [...document.querySelectorAll('section[aria-label="Agenda del día"] button')];
    bloques[Math.min(3, bloques.length - 1)].click(); await esperar(1200);
    boton('Mover turno').click(); await esperar(3500);`);
  await foto('ficha');

  await ir('/panel/la-navaja?fecha=' + dia + '&vista=semana', 4500);
  await foto('semana');
  await ir('/panel/la-navaja/mensajes?ver=todos', 4000);
  await foto('mensajes');
  await ir('/panel/la-navaja/catalogo', 4000);
  await js(AYUDA + `[...document.querySelectorAll('[role=tab]')].find(b => b.textContent === 'Horarios').click(); await esperar(1500);`);
  await foto('horarios');
} catch (e) {
  console.error('fallo:', e.message);
  process.exitCode = 1;
} finally {
  chrome.kill();
}
