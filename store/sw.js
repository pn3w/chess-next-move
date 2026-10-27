// Service worker:
// 1) ทำให้ติดตั้งเป็นแอปได้ + เปิดได้แม้ยังไม่ได้รัน start.bat (ใช้ไฟล์ที่เคยโหลดไว้)
//    กลยุทธ์ "network-first": ถ้าเซิร์ฟเวอร์ทำงานอยู่ ใช้ไฟล์ล่าสุดเสมอ (ไม่มีปัญหาโค้ดเก่าค้าง)
//    แล้วเก็บสำเนาไว้ใน cache — ถ้าติดต่อเซิร์ฟเวอร์ไม่ได้ ค่อยใช้สำเนาจาก cache
// 2) บนโฮสต์ที่ตั้ง header เองไม่ได้ (GitHub Pages) เติม COOP/COEP ให้ → หน้าเว็บเป็น cross-origin isolated
//    → Stockfish ใช้หลาย thread ได้ (เทคนิคเดียวกับ coi-serviceworker)
const CACHE = 'cnm-v1';
// ไม่เก็บ: API (สำรองข้อมูล), เอนจิน Full NNUE ~95MB, การสื่อสาร HMR ของ vite
const SKIP = [/\/api\//, /stockfish-19-single\./, /\/@vite\/client/, /[?&]t=\d+/, /[?&]import&/];

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

/** เติม header ให้เป็น cross-origin isolated (ถ้าเซิร์ฟเวอร์ยังไม่ได้ส่งมา เช่นตอนรันผ่าน vite จะมีอยู่แล้ว) */
function isolate(res) {
  if (!res || res.status === 0 || res.headers.get('Cross-Origin-Embedder-Policy')) return res;
  const h = new Headers(res.headers);
  h.set('Cross-Origin-Embedder-Policy', 'require-corp');
  h.set('Cross-Origin-Opener-Policy', 'same-origin');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (SKIP.some((re) => re.test(url.pathname + url.search))) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await fetch(req);
      if (res.ok && res.type === 'basic') cache.put(req, res.clone());
      return isolate(res);
    } catch (err) {
      const hit = await cache.match(req) || (req.mode === 'navigate' && await cache.match(self.registration.scope));
      if (hit) return isolate(hit);
      throw err;
    }
  })());
});
