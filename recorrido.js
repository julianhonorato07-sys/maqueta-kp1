/* Recorrido de la carrocería por las cotas 0 · +3,2 · +5,4 · +9 de la Unidad de Pintura.
 *  (a) FLUJO CONTINUO: carrocerías sobre skid en las líneas de las cotas superiores, elevadores, skids vacíos que vuelven.
 *  (b) RECORRIDO GUIADO: una carrocería que se sigue paso a paso de Chapistería a Montaje, con texto de cada etapa
 *      (los mismos textos que el artefacto "Recorrido de la carrocería", revisados por Julian).
 * Recorridos sobre los ejes de transportadores de los planos 303-N00, 303-N5400 y 303-N9000 (coordenadas del plano, m).
 * Lo inferido está marcado "a confirmar" (docs/proceso_por_cotas.md). Velocidades y cantidades: ILUSTRATIVAS.
 * Se llama desde app.js: window.Recorrido(api). */
window.Recorrido = function (api) {
  "use strict";
  const { THREE, W, capa, MOVIL, animar, camara, controles, cotas, maqueta } = api;
  const { alto } = cotas;
  const flujo = capa("flujo_cotas");
  const tour = capa("tour");

  let semilla = 77;
  const azar = () => (semilla = (semilla * 16807) % 2147483647) / 2147483647;
  const elegir = (l) => l[Math.floor(azar() * l.length)];

  // ---------------------------------------------------------------- geometrías (x = largo, y = ancho, z = alto; base del skid z = 0)
  const geoCaja = (lx, ly, lz, cx, cy, cz) => { const g = new THREE.BoxGeometry(lx, lz, ly); g.translate(cx, cz, -cy); return g; };
  function unir(gs) {
    gs = gs.map(g => g.index ? g.toNonIndexed() : g); let n = 0; for (const g of gs) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
    for (const g of gs) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; }
    const r = new THREE.BufferGeometry(); r.setAttribute("position", new THREE.BufferAttribute(pos, 3)); r.setAttribute("normal", new THREE.BufferAttribute(nor, 3)); return r;
  }
  const G_SKID = unir([geoCaja(5.0, 0.12, 0.16, 0, -0.45, 0.08), geoCaja(5.0, 0.12, 0.16, 0, 0.45, 0.08), ...[-2, -1, 0, 1, 2].map(k => geoCaja(0.1, 1.0, 0.14, k * 1.1, 0, 0.23))]);
  const G_SEDAN = unir([[-2.18, -1.3, 0.3, 0.82], [-1.3, -0.75, 0.3, 0.92], [-0.75, 1.05, 0.3, 0.95], [1.05, 2.18, 0.3, 0.98], [-0.45, 0.85, 0.95, 1.46], [-0.85, -0.45, 0.95, 1.22], [0.85, 1.25, 0.98, 1.3]].map(([a, b, z0, z1]) => geoCaja(b - a, 1.68, z1 - z0, (a + b) / 2, 0, 0.3 + (z0 + z1) / 2)));
  const G_CABINA = unir([[-1.75, -1.0, 0.45, 1.05], [-1.0, 1.35, 0.45, 1.12], [-0.5, 1.35, 1.12, 1.88], [-0.95, -0.5, 1.12, 1.45]].map(([a, b, z0, z1]) => geoCaja(b - a, 1.8, z1 - z0, (a + b) / 2, 0, 0.3 + (z0 + z1) / 2)));
  const G_CAJA = unir([geoCaja(3.2, 1.86, 0.15, 0, 0, 0.82), geoCaja(3.2, 0.1, 0.52, 0, 0.88, 1.16), geoCaja(3.2, 0.1, 0.52, 0, -0.88, 1.16), geoCaja(0.08, 1.86, 0.52, 1.56, 0, 1.16), geoCaja(0.08, 1.86, 0.52, -1.56, 0, 1.16)]);
  const G_VIDRIO = unir([geoCaja(1.3, 1.7, 0.4, 0.2, 0, 1.5)]);
  const G_COLG = unir([geoCaja(0.08, 0.08, 1, -1.5, 0, 0.5), geoCaja(0.08, 0.08, 1, 1.5, 0, 0.5), geoCaja(3.4, 0.3, 0.1, 0, 0, 1.0), geoCaja(0.6, 0.4, 0.25, 0, 0, 1.12)]);
  const RIEL_PENDULAR = 4.0;   // m sobre el piso de cota 9 (dentro del túnel de piletas)
  const GEO = { sedan: G_SEDAN, cabina: G_CABINA, caja: G_CAJA };

  // colores por estado de la carrocería (como en el artefacto) y pintura final
  const EST = { chapa: "#c3cad3", fosfato: "#93a4b6", cata: "#a9a28c", sellado: "#9d977f" };
  const PINTURAS = ["#c21f37", "#eef1f4", "#9aa3ad", "#1f2328", "#2a4d8f", "#b8bec6", "#7a1f2b", "#d9d4c7"];
  const SKID_RICO = "#c79a1a", SKID_POBRE = "#5d6672";

  // ---------------------------------------------------------------- inmersión en las piletas (transportador pendular)
  // Sobre la banda de piletas la carrocería va colgada a +1,8 m y se sumerge en cada pileta (perfil ilustrativo).
  const TANQUES = [];
  { const et = (204.2 - 21.5) / 9; for (let k = 0; k < 9; k++) { const a = 21.5 + k * et + 0.4; TANQUES.push([a, a + et - 0.8, 96.99, 1.8]); } }
  TANQUES.push([21.8, 51.2, 90.73, 2.0]);
  for (let k = 0; k < 5; k++) { const a = 51.6 + k * 12 + 0.4; TANQUES.push([a, a + 11.2, 90.73, 1.6]); }
  const suave = (s) => s * s * (3 - 2 * s);
  function inmersion(x, y, n) {
    if (n !== 9) return 0;
    // rampas de subida/bajada en la entrada (x 204–210) y salida (x 111,7–118) de la banda, y el transferidor oeste (x 3)
    if (Math.abs(y - 96.99) < 0.3 && x >= 204.2 && x < 210) return 1.3 * (210 - x) / 5.8;
    if (Math.abs(y - 90.73) < 0.3 && x >= 111.7 && x < 118) return 1.3 * (118 - x) / 6.3;
    if (Math.abs(x - 3.0) < 0.3 && y > 90.5 && y < 97.2) return 1.3;
    const enPretrat = Math.abs(y - 96.99) < 0.3 && x > 0 && x < 204.2, enCata = Math.abs(y - 90.73) < 0.3 && x > 0 && x < 111.7;
    if (!enPretrat && !enCata) return 0;
    for (const [a, b, ye, prof] of TANQUES) if (Math.abs(y - ye) < 0.3 && x > a && x < b) {
      const t = (x - a) / (b - a), s = t < 0.22 ? t / 0.22 : t > 0.78 ? (1 - t) / 0.22 : 1;
      return 1.3 - prof * suave(s);
    }
    return 1.3;
  }

  // ---------------------------------------------------------------- rutas: puntos [x, y, h sobre el piso, cota, estado?, marca?]
  // Una ruta mide en metros reales (planta + vertical): la velocidad no cambia al separar los pisos.
  function ruta(pts) {
    let e = null;
    const P = pts.map(p => { if (p[4]) e = p[4]; return { x: p[0], y: p[1], h: p[2], n: p[3], e, m: p[5] || null }; });
    const seg = []; let L = 0, ang = 0;
    for (let i = 0; i < P.length - 1; i++) {
      const a = P[i], b = P[i + 1];
      const lp = Math.hypot(b.x - a.x, b.y - a.y), lz = Math.abs((b.n + b.h) - (a.n + a.h)), l = Math.hypot(lp, lz);
      if (lp > 1e-6) ang = Math.atan2(b.y - a.y, b.x - a.x);
      seg.push({ a, b, l: Math.max(l, 1e-6), L0: L, ang, vert: lp < 1e-6 }); L += Math.max(l, 1e-6);
    }
    function punto(s, out) {
      s = Math.max(0, Math.min(L, s));
      let lo = 0, hi = seg.length - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (seg[mid].L0 + seg[mid].l < s) lo = mid + 1; else hi = mid; }
      const g = seg[lo], t = (s - g.L0) / g.l;
      out.x = g.a.x + (g.b.x - g.a.x) * t; out.y = g.a.y + (g.b.y - g.a.y) * t;
      out.z = alto(g.a.n, g.a.h) + (alto(g.b.n, g.b.h) - alto(g.a.n, g.a.h)) * t;
      out.ang = g.ang; out.e = g.a.e; out.vert = g.vert; out.n = t < 0.5 ? g.a.n : g.b.n; out.seg = lo; out.m = g.a.m;
      out.dip = g.vert ? 0 : inmersion(out.x, out.y, out.n);
      out.z += out.dip;
      return out;
    }
    return { P, seg, L, punto };
  }

  // ---- Tramos del recorrido de la carrocería (en orden). Cada tramo arranca donde terminó el anterior.
  const T_CHAPA = [[62.82, 141.5, 5.0, 9, "chapa", "rico"], [62.82, 141.5, 1.7, 9], [62.82, 129.28, 1.7, 9], [68.82, 129.28, 1.7, 9], [68.82, 120.0, 1.7, 9], [68.82, 117.0, 0.5, 9], [68.82, 101.75, 0.5, 9]];
  const T_PREP = [[254.27, 101.75, 0.5, 9], [254.27, 96.99, 0.5, 9], [221.5, 96.99, 0.5, 9]];
  const T_PRETRAT = [[204.2, 96.99, 0.5, 9, "fosfato"], [3.0, 96.99, 0.5, 9]];
  const T_CATA = [[3.0, 90.73, 0.5, 9], [21.5, 90.73, 0.5, 9, "cata"], [111.7, 90.73, 0.5, 9]];
  const T_HCATA = [[133.6, 90.73, 0.5, 9], [255.06, 90.73, 0.5, 9], [257.5, 90.7, 0.5, 9]];
  const T_CSKID = [[257.5, 90.7, 0.5, 5.4], [257.5, 86.8, 0.5, 5.4], [257.2, 82.3, 0.5, 5.4, null, "pobre"], [257.9, 76.45, 0.5, 5.4]];
  const T_BAJA0 = [[257.9, 76.45, 0.72, 0], [254.0, 76.45, 0.72, 0]];
  const T_SELLADO = [[230, 76.45, 0.72, 0, "sellado"], [80.5, 76.45, 0.72, 0], [80.5, 67.7, 0.48, 0], [243.2, 67.7, 0.48, 0]];
  const T_SUBE9 = [[243.2, 57.7, 0.48, 0], [247.4, 57.7, 0.8, 0], [247.4, 57.73, 0.45, 9]];
  const T_FONDO = [[205.2, 57.73, 0.45, 9], [140.0, 57.73, 0.45, 9], [140.0, 59.48, 0.45, 9], [7.31, 59.48, 0.45, 9]];
  const T_REVCATA = [[7.31, 68.01, 0.45, 9], [12.81, 68.01, 0.45, 9], [29.33, 68.01, 0.45, 9], [29.33, 70.51, 0.45, 9], [97.65, 70.51, 0.45, 9], [97.65, 68.01, 0.45, 9], [255.42, 68.01, 0.45, 9]];
  const T_ESMALTE = [[255.42, 45.99, 0.45, 9], [250.2, 45.99, 0.45, 9, "pint"], [105.41, 45.99, 0.45, 9]];
  const T_HESM = [[105.41, 47.74, 0.45, 9], [9.25, 47.74, 0.45, 9], [7.31, 47.74, 0.45, 9], [7.31, 44.24, 0.45, 9]];
  const T_REVFIN = [[12.81, 44.24, 0.45, 9], [12.81, 29.22, 0.45, 9], [18.32, 29.22, 0.45, 9], [18.32, 22.71, 0.45, 9], [23.83, 22.71, 0.45, 9], [106.66, 22.71, 0.45, 9], [106.66, 17.21, 0.45, 9], [128.3, 17.21, 0.45, 9], [128.3, 15.5, 0.45, 9]];
  const T_BAJAFIN = [[128.3, 15.5, 0.48, 0], [128.33, 8.91, 0.48, 0]];
  const T_BAJADEF = [[128.3, 15.5, 0.48, 0], [128.33, 13.2, 0.48, 0]];
  const T_MULABOX = [[134.0, 13.2, 0.9, 0], [134.0, 20.5, 0.9, 0], [160.0, 20.5, 0.9, 0]];
  const T_VUELVE = [[142.0, 20.5, 0.9, 0], [142.0, 9.4, 0.9, 0], [142.0, 8.91, 0.48, 0]];
  const T_OLEO = [[185.48, 8.91, 0.48, 0]];
  const T_L32 = [[188.6, 8.9, 0.48, 0], [188.6, 8.9, 0.45, 3.2], [188.6, 11.4, 0.45, 3.2], [250.7, 11.4, 0.45, 3.2], [252.5, 9.4, 0.45, 3.2], [256.2, 9.4, 0.45, 3.2]];
  const T_TUNEL = [[256.2, 8.9, 0.45, 3.2], [256.2, 8.9, 0.3, 9], [262.0, 8.9, 0.3, 9], [300.0, 8.9, 0.3, 9]];
  const T_BUFFER = [[188.6, 8.5, 0.48, 0], [221.5, 8.5, 0.48, 0]];
  const T_LINEA = [[190.5, 8.5, 0.48, 0], [190.5, 14.3, 0.48, 0], [252.0, 14.3, 0.48, 0], [252.0, 30.5, 0.48, 0]];
  const T_DIFUSION = [[257.5, 30.5, 0.48, 0]];
  const T_MONTAJEKP1 = [[257.5, 30.5, 1.0, 0], [264.5, 31.0, 1.0, 0], [285.0, 31.0, 1.0, 0]];

  // ---------------------------------------------------------------- (a) FLUJO CONTINUO en las cotas superiores (instanciado)
  // F1: Chapa → piletas → horno cata → cota 5,4 (cambio de skid) → hasta el elevador GR1 (de ahí sigue el flujo de cota 0)
  // F2: elevador a línea de fondo → toda la cota 9 → elevador CPU11 GR08 hasta cota 0
  // F3: Cronos: sube a +3,2 m a la salida de Óleo → sobre el buffer → elevador Montaje → túnel
  // F4: skid rico vacío: cambio de skid → +3,2 (acumulo) → elevador doble → cota 9 → carril de retorno a la carga de Chapa
  // F5: skid pobre vacío: elevador de retorno (zona elevador Montaje) → +3,2 por la pared → CPU4 GR7 → cambio de skid
  const cat = (...l) => [].concat(...l);
  const F = [
    { r: ruta(cat(T_CHAPA, T_PREP, T_PRETRAT, T_CATA, T_HCATA, T_CSKID)), paso: MOVIL ? 16 : 8.5, v: 0.75, tipos: ["sedan", "cabina", "caja"] },
    { r: ruta(cat([[247.4, 57.7, 0.8, 0, "sellado", "pobre"]], T_SUBE9.slice(2), T_FONDO, T_REVCATA, T_ESMALTE, T_HESM, T_REVFIN, [[128.3, 15.5, 0.48, 0]])), paso: MOVIL ? 16 : 8.5, v: 0.75, tipos: ["sedan", "cabina", "caja"] },
    { r: ruta(cat([[185.48, 8.91, 0.48, 0, "pint", "pobre"]], T_L32, T_TUNEL)), paso: MOVIL ? 18 : 10, v: 0.55, tipos: ["sedan"] },
    { r: ruta([[257.2, 82.3, 0.5, 5.4, null, "rico"], [248.07, 80.25, 0.5, 5.4], [149.63, 80.25, 0.5, 5.4], [149.63, 84.25, 0.5, 5.4], [122.1, 84.25, 0.5, 5.4], [122.1, 84.75, 0.5, 5.4], [122.1, 84.75, 0.45, 3.2], [13.8, 84.75, 0.45, 3.2], [13.8, 84.75, 0.45, 9], [8.51, 84.73, 0.45, 9], [8.51, 101.75, 0.45, 9], [51.3, 101.75, 0.45, 9], [51.3, 104.5, 0.75, 9], [51.3, 129.28, 0.75, 9], [62.82, 129.28, 1.7, 9]]), paso: MOVIL ? 22 : 11, v: 0.9, vacio: true },
    { r: ruta([[262.05, 4.6, 0.48, 0, null, "pobre"], [262.05, 4.6, 0.45, 3.2], [262.05, 82.3, 0.45, 3.2], [262.05, 82.3, 0.45, 5.4], [257.2, 82.3, 0.5, 5.4]]), paso: MOVIL ? 22 : 11, v: 0.9, vacio: true },
  ];
  // movers + InstancedMesh por tipo
  const movers = [];
  for (const [fi, f] of F.entries()) {
    const n = Math.floor(f.r.L / f.paso);
    let ult = null;
    for (let i = 0; i < n; i++) {
      if (azar() < 0.12) continue;   // huecos en la línea
      const tipo = f.vacio ? null : f.tipos[i % f.tipos.length];
      const pintura = tipo === "caja" && ult ? ult : elegir(PINTURAS);
      ult = tipo === "cabina" ? pintura : null;
      movers.push({ f, fi, s: i * f.paso + azar() * 0.5, tipo, pintura, idx: {} });
    }
  }
  const mSkid = new THREE.MeshLambertMaterial({ color: 0xffffff }), mBody = new THREE.MeshLambertMaterial({ color: 0xffffff }), mVid = new THREE.MeshLambertMaterial({ color: "#3b4656" });
  const IM = {
    skid: new THREE.InstancedMesh(G_SKID, mSkid, movers.length),
    sedan: new THREE.InstancedMesh(G_SEDAN, mBody, Math.max(1, movers.filter(m => m.tipo === "sedan").length)),
    cabina: new THREE.InstancedMesh(G_CABINA, mBody, Math.max(1, movers.filter(m => m.tipo === "cabina").length)),
    caja: new THREE.InstancedMesh(G_CAJA, mBody, Math.max(1, movers.filter(m => m.tipo === "caja").length)),
    vidrio: new THREE.InstancedMesh(G_VIDRIO, mVid, Math.max(1, movers.filter(m => m.tipo === "sedan").length)),
    // colgador del transportador pendular (dos barras + carro), solo sobre la banda de piletas
    colg: new THREE.InstancedMesh(G_COLG, new THREE.MeshLambertMaterial({ color: "#3b434c" }), movers.length),
  };
  const cont = { skid: 0, sedan: 0, cabina: 0, caja: 0, vidrio: 0, colg: 0 };
  for (const m of movers) { m.idx.skid = cont.skid++; m.idx.colg = cont.colg++; if (m.tipo) { m.idx.body = cont[m.tipo]++; if (m.tipo === "sedan") m.idx.vidrio = cont.vidrio++; } }
  const col = new THREE.Color();
  for (const k in IM) { IM[k].instanceMatrix.setUsage(THREE.DynamicDrawUsage); IM[k].castShadow = !MOVIL; flujo.add(IM[k]); }
  // inicializar colores (si no, three no crea el buffer de color)
  for (const m of movers) { IM.skid.setColorAt(m.idx.skid, col.set(SKID_RICO)); if (m.tipo) IM[m.tipo].setColorAt(m.idx.body, col.set(EST.chapa)); }
  for (const k of ["sedan", "cabina", "caja"]) if (!IM[k].instanceColor) IM[k].setColorAt(0, col.set("#ffffff"));

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v3 = new THREE.Vector3(), uno = new THREE.Vector3(1, 1, 1);
  const pt = {};
  function colorDe(e, pintura) { return e === "pint" ? pintura : EST[e] || EST.chapa; }
  // solo se muestran las carrocerías de las cotas visibles (botones "Pisos")
  const nivelVisible = (n) => { const p = maqueta.estado.piso; return p === "todas" || (p === "0" && n === 0) || (p === "5" && (n === 3.2 || n === 5.4)) || (p === "9" && n === 9); };
  const cero = new THREE.Vector3(0, 0, 0), escCol = new THREE.Vector3();
  function actualizarFlujo(dt) {
    for (const m of movers) {
      m.s += m.f.v * dt * 1.0;
      if (m.s > m.f.r.L) m.s -= m.f.r.L;
      m.f.r.punto(m.s, pt);
      v3.copy(W(pt.x, pt.y, 0)); v3.y = pt.z;
      q.setFromAxisAngle(up, pt.ang);
      const ver = nivelVisible(pt.n);
      if (pt.dip && ver) { const y0 = pt.z + 1.35, L = alto(9, RIEL_PENDULAR) - y0; v3.y = y0; m4.compose(v3, q, escCol.set(1, Math.max(0.05, L), 1)); IM.colg.setMatrixAt(m.idx.colg, m4); v3.y = pt.z; }
      else { m4.compose(v3, q, cero); IM.colg.setMatrixAt(m.idx.colg, m4); }
      m4.compose(v3, q, ver ? uno : cero);
      IM.skid.setMatrixAt(m.idx.skid, m4);
      const rico = m.f.r.P[0].m === "rico" ? !(pt.seg >= rutaSwapSeg(m.f)) : false;
      IM.skid.setColorAt(m.idx.skid, col.set(m.f.vacio ? (m.fi === 3 ? SKID_RICO : SKID_POBRE) : rico ? SKID_RICO : SKID_POBRE));
      if (m.tipo) {
        IM[m.tipo].setMatrixAt(m.idx.body, m4);
        IM[m.tipo].setColorAt(m.idx.body, col.set(colorDe(pt.e, m.pintura)));
        if (m.tipo === "sedan") IM.vidrio.setMatrixAt(m.idx.vidrio, m4);
      }
      m.pt = { x: pt.x, y: pt.y, z: pt.z, ang: pt.ang, n: pt.n, vert: pt.vert };
    }
    for (const k in IM) { IM[k].instanceMatrix.needsUpdate = true; if (IM[k].instanceColor) IM[k].instanceColor.needsUpdate = true; }
  }
  // en F1 el skid es rico hasta el pórtico de cambio de skid (punto marcado "pobre")
  const swapCache = new Map();
  function rutaSwapSeg(f) {
    if (swapCache.has(f)) return swapCache.get(f);
    const i = f.r.seg.findIndex(s => s.a.m === "pobre");
    swapCache.set(f, i < 0 ? Infinity : i); return swapCache.get(f);
  }

  // ---------------------------------------------------------------- elevadores y mesas giratorias siguen a las carrocerías
  const plats = Object.values(cotas.plataformas);
  function actualizarElevadores(dt) {
    for (const p of plats) {
      const e = p.e;
      // ¿hay una carrocería en el tramo vertical de este elevador?
      let y = null;
      for (const m of movers) if (m.pt && m.pt.vert && Math.abs(m.pt.x - e.x) < 0.8 && Math.abs(m.pt.y - e.y) < 0.8) { y = m.pt.z - 0.12; break; }
      if (tourEstado.activo && tourPt.vert && Math.abs(tourPt.x - e.x) < 0.8 && Math.abs(tourPt.y - e.y) < 0.8) y = tourPt.z - 0.12;
      const y0 = alto(e.n0, e.h0) - 0.12, y1 = alto(e.n1, e.h1) - 0.12;
      if (y === null) { p.t += dt; const k = 0.5 + 0.5 * Math.sin(p.t * 0.25); y = y0 + (y1 - y0) * k; }   // vacío: sube y baja despacio
      p.plat.position.y += (y - p.plat.position.y) * Math.min(1, dt * 6);
    }
    for (const g of cotas.giratorias) {
      for (const m of movers) if (m.pt && !m.pt.vert && Math.abs(m.pt.n - g.n) < 0.1 && Math.hypot(m.pt.x - g.x, m.pt.y - g.y) < 2.6) { g.g.rotation.y += (m.pt.ang - g.g.rotation.y) * Math.min(1, dt * 4); break; }
    }
  }

  // ---------------------------------------------------------------- cota 0: línea de salida KP1, mesa transferidora, mula de difusión
  const c0 = capa("procesos");
  {
    const mRod = new THREE.MeshLambertMaterial({ color: "#c9ced3" }), mMarco = new THREE.MeshLambertMaterial({ color: "#4a525c" });
    const rod = [];
    for (let x = 245.5; x <= 252.0; x += 0.9) rod.push([x, 14.3, 0]);
    for (let y = 14.3; y <= 30.5; y += 0.9) rod.push([252.0, y, 90]);
    for (let x = 252.0; x <= 257.5; x += 0.9) rod.push([x, 30.5, 0]);
    const geoR = new THREE.CylinderGeometry(0.05, 0.05, 1.1, 8); geoR.rotateX(Math.PI / 2);
    const im = new THREE.InstancedMesh(geoR, mRod, rod.length);
    rod.forEach(([x, y, a], i) => { q.setFromAxisAngle(up, a * Math.PI / 180); const p = W(x, y, 0.38); m4.compose(p, q, uno); im.setMatrixAt(i, m4); });
    c0.add(im);
    for (const [a, b, c, d] of [[245.5, 13.7, 252.6, 14.9], [251.4, 14.3, 252.6, 30.5], [252.0, 29.9, 257.5, 31.1]]) {
      const g = new THREE.Mesh(new THREE.BoxGeometry(c - a, 0.3, d - b), mMarco); g.position.copy(W((a + c) / 2, (b + d) / 2, 0.15)); c0.add(g);
    }
  }
  // mesa transferidora (se mueve de costado) en la entrada del buffer: lleva la pieza del carril y 8,5 a la línea de salida y 14,3
  const mesaTr = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.22, 2.4), new THREE.MeshLambertMaterial({ color: "#f2c230" }));
  c0.add(mesaTr);
  for (const s of [-1.3, 1.3]) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 7.8), new THREE.MeshLambertMaterial({ color: "#8d97a3" })); r.position.copy(W(190.5 + s, 11.4, 0.04)); c0.add(r); }
  // mula con carrito en difusión: carga cabina + caja del mismo color y sale por la abertura hacia PS2 (a confirmar)
  const mula = new THREE.Group();
  {
    const add = (g, c, x, z) => { const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: c })); m.position.set(x, z, 0); m.castShadow = true; mula.add(m); return m; };
    add(new THREE.BoxGeometry(1.6, 0.9, 1.0), "#2ea84f", 2.6, 0.6); add(new THREE.BoxGeometry(0.7, 0.7, 0.9), "#1d2a33", 2.3, 1.4);
    add(new THREE.BoxGeometry(7.6, 0.12, 1.9), "#f2c94c", -2.2, 0.55);
    const cp = PINTURAS[2];
    const cab = new THREE.Mesh(G_CABINA, new THREE.MeshLambertMaterial({ color: cp })); cab.position.set(-0.4, 0.3, 0); mula.add(cab);
    const cj = new THREE.Mesh(G_CAJA, new THREE.MeshLambertMaterial({ color: cp })); cj.position.set(-4.0, 0.3, 0); mula.add(cj);
    c0.add(mula);
  }
  const RUTA_MULA = ruta([[255.0, 31.2, 0, 0], [264.5, 31.2, 0, 0], [290.0, 31.2, 0, 0]]);
  let tMula = 0;
  function actualizarCota0(dt) {
    // mesa transferidora: ida y vuelta entre y 8,5 y 14,3 (ciclo 16 s)
    const k = 0.5 - 0.5 * Math.cos(((performance.now() / 1000) % 16) / 16 * Math.PI * 2);
    mesaTr.position.copy(W(190.5, 8.5 + (14.3 - 8.5) * k, 0.3));
    // mula: espera cargando (8 s), sale (ida) y vuelve vacía
    tMula = (tMula + dt) % 40;
    const ida = tMula < 8 ? 0 : tMula < 24 ? (tMula - 8) / 16 : 1 - (tMula - 24) / 16;
    RUTA_MULA.punto(ida * RUTA_MULA.L, pt);
    mula.position.copy(W(pt.x, pt.y, 0)); mula.rotation.y = tMula < 24 ? 0 : Math.PI;
    mula.children.slice(3).forEach(c => { c.visible = tMula < 24; });
  }

  // ---------------------------------------------------------------- (b) RECORRIDO GUIADO
  const tourEstado = { activo: false, play: false, modelo: "cronos", def: false, paso: 0, s: 0, seguir: true };
  const tourPt = {};
  function pasos() {
    const K = tourEstado.modelo === "kp1", D = tourEstado.def, S = [];
    const a = (o) => S.push(o);
    a({ cota: 9, tit: "Llega de Chapistería", pts: T_CHAPA,
      txt: "La carrocería llega en chapa desnuda (<i>body in white</i>) por el puente desde Chapistería. El <b>elevador scocca BIW</b> la baja y en la zona de carga se la apoya sobre un <b>skid rico</b> (<i>deep skid</i>), que la <b>traba con rosetas</b> para que no se mueva en las piletas. Baja por su carril (de +1,70 m a +0,50 m), se verifica que esté bien enganchada y entra a la línea." + (K ? " La pickup viene en dos partes, <b>cabina y caja</b>, cada una en su skid. Hacen el mismo recorrido y recién se juntan en el buffer." : ""),
      dato: "Plano N9000: Elevador scocca BIW · Carga s/ skid pintura · Ingreso scoccas N+1,70 · Verificación skid enganchado" });
    a({ cota: 9, tit: "Preparación manual", pts: T_PREP, txt: "Antes de entrar a las piletas, operarios la limpian y la revisan a mano.", dato: "7 lugares (Layout 3 WET)" });
    a({ cota: 9, tit: "Pretratamiento", pts: T_PRETRAT, txt: "Pasa por un túnel de piletas: primero la desengrasan y la lavan, después le dan una capa de <b>fosfato</b>, que la protege del óxido y hace que la pintura agarre bien.", dato: "Bonder · 30 lugares · 9 skids de proceso (árbol de máquinas)" });
    a({ cota: 9, tit: "Cataforesis", pts: T_CATA, txt: "Un transferidor la pasa a la otra línea y se sumerge entera en la <b>cuba de cataforesis</b>, con corriente eléctrica: la pintura se pega en toda la chapa, también por dentro de los huecos. Es la primera capa contra la corrosión. Después pasa por los lavados.", dato: "19 lugares · cuba ED + LAVAGGI del plano" });
    a({ cota: 9, tit: "Horno de cataforesis", pts: T_HCATA, txt: "Pasa el túnel de conexión y entra al horno, donde la capa de cataforesis se endurece. Al final, un enfriador la baja de temperatura.", dato: "26 lugares · cuello de botella: 32 JPH" });
    a({ cota: 5.4, tit: "Baja a la cota 5,4 y cambia de skid", pts: T_CSKID, swap: true, txt: "Un elevador la baja al piso intermedio. Primero, en la <b>mesa de desbloqueo</b>, las rosetas giran 90° y la sueltan. Después, en el pórtico de <b>cambio de skid</b>, pasa del skid rico al <b>skid pobre</b> (<i>paint skid</i>), que solo la apoya. El skid rico vacío vuelve por el acumulo de +3,2 m y un elevador doble a la carga de Chapa.", dato: "CPU5 GR3 cambio de skid · retorno skid rico CPU5 (+3,2) y CPU1 · ubicación del pórtico: a confirmar" });
    a({ cota: 0, tit: "Baja a la cota 0", pts: T_BAJA0, txt: "El elevador CPU6 GR1 la baja a planta baja, sobre la mesa pantógrafo de entrada al sellado.", dato: "CPU6 GR1 · elevador" });
    a({ cota: 0, tit: "Sellado", pts: T_SELLADO, txt: "En la cabina de sellado se pone sellador en las uniones de chapa, para que no entre agua ni polvo. Al fondo, una <b>mesa giratoria</b> la gira y un transferidor la pasa al carril de al lado, por donde vuelve.", dato: "Sellado upperbody · 26 lugares · giro en U: CPU6 GR5" });
    a({ cota: 9, tit: "Vuelve a subir a la cota 9", pts: T_SUBE9, txt: "Al final del carril de vuelta, otra <b>mesa giratoria</b> la gira para que entre derecho al <b>elevador a línea de fondo</b>, que la sube a la cota 9. Desde acá hasta la revisión final, todo pasa en la cota 9.", dato: "Mesas giratorias CPU6 GR10 · elevador CPU6 GR11" });
    a({ cota: 9, tit: "Bajo carrocería y horno de pregelado", pts: T_FONDO, txt: "Después de una preparación manual, entra a la <b>cabina de fondo</b>: robots aplican sellador y PVC en la parte de abajo (piso y pasaruedas), que la protege de piedras, agua y ruido. Después pasa por el <b>horno de pregelado</b>, que seca ese material.", dato: "Robot UBS & UBC · 21 lugares · 29 JPH: el más lento de la planta · horno de fondo 22 lugares" });
    a({ cota: 9, tit: "Revisión de cataforesis", pts: T_REVCATA, txt: "Una mesa giratoria la lleva a la <b>estación I</b>, donde se registra el color con que se va a pintar, y al <b>acumulo lote colores</b>, que arma los lotes. Después entra a la revisión: se lija y se revisa toda la superficie para que quede lisa antes de pintar.", dato: "Revisione fondo · 26 lugares · acumulo lote colores 50 lugares" });
    a({ cota: 9, tit: "Cabina de esmalte", pts: T_ESMALTE, txt: "Baja a la fila de pintura. Primero la <b>EMU</b> (plumeros) y el blower le sacan el polvo. Después pasa por la cabina manual de base, los <b>robots de base</b>, la completación, el flash-off y el <b>clear</b> (barniz) manual y con robots.", dato: "30 lugares · cuello de botella: 30 JPH · robots R1–R7 del plano" });
    a({ cota: 9, tit: "Hornos de esmalte", pts: T_HESM, txt: "Entra a uno de los dos hornos en paralelo (SX y DX): la pintura se hornea para que quede dura y brillante.", dato: "30 lugares" });
    a({ cota: 9, tit: "Revisión final", pts: T_REVFIN, txt: "Mesas giratorias la llevan a la <b>revisión final</b>: inspectores revisan la pintura bajo luz fuerte. Acá se decide si está bien o si tiene algún defecto para retocar.", dato: "Revisión final esmalte · collaudo delibera · 28 lugares" });
    if (!D) a({ cota: 0, tit: "Baja a la cota 0", pts: T_BAJAFIN, txt: "El elevador CPU11 GR08 la baja a planta baja. Como está bien, sigue directo por rodillos de fricción hacia Óleo.", dato: "CPU11 GR08 · elevador" });
    else {
      a({ cota: 0, tit: "Baja a la cota 0", pts: T_BAJADEF, txt: "El elevador CPU11 GR08 la baja a planta baja. Como tiene defectos, no sigue por la línea.", dato: "CPU11 GR08 · elevador" });
      a({ cota: 0, tit: "La mula la lleva al box de retoques", pts: T_MULABOX, mula: true, txt: "Una <b>mula</b> (tractor eléctrico chico) la saca de la línea y la lleva al <b>box de retoques</b>, que está justo atrás de Óleo. Ahí se corrige el defecto a mano. Si el box está lleno, la deja en el acumulo para box.", dato: "Box de retoques · estación R" });
      a({ cota: 0, tit: "Reparada, vuelve a la línea", pts: T_VUELVE, mula: true, txt: "Una vez retocada, la mula la vuelve a cargar en la línea (transporte \"fuera de línea\") para seguir hacia Óleo.", dato: "CPU12 transporte fuera de línea · mesa GR2 · camino a confirmar" });
    }
    a({ cota: 0, tit: "Óleo", pts: T_OLEO, txt: "En Óleo se le sacan los <b>distanciales</b> (los separadores que la sostienen sobre el skid) y una máquina le rola el friso del techo. Justo atrás está el box de retoques.", dato: "Línea extracción distanciales · estación C · 16 lugares" });
    if (!K) {
      a({ cota: 3.2, tit: "Sube a +3,2 m y pasa sobre el buffer", pts: T_L32, txt: "Apenas sale de Óleo, el Cronos sube a <b>+3,2 m</b> (el Level 3200) y avanza por arriba del buffer de las pickups. No pasa por el buffer ni por difusión.", dato: "Level 3200 (Layout Pintura sep. 2026)" });
      a({ cota: 9, tit: "El elevador Montaje lo sube y cruza el túnel", pts: T_TUNEL, txt: "Al final, el <b>elevador Montaje</b> lo sube a la cota 9 y la carrocería cruza el túnel elevado hasta la nave de Montaje del Cronos. Acá termina su paso por Pintura.", dato: "CPU12 GR8 · elevador Montaje · al lado, el retorno de skid pobre (CPU4)" });
    } else {
      a({ cota: 0, tit: "Buffer KP1: se juntan cabina y caja", pts: T_BUFFER, txt: "Al salir de Óleo va al <b>buffer</b>: carriles de rodillos donde cabinas y cajas se acumulan, cada una en su skid pobre. Se lee el código QR de cada pieza. Avanza hasta la <b>mitad del buffer</b> y ahí <b>se ancla</b> con su pareja: una cabina con una caja del mismo color.", dato: "Transporte buffer CIEM (CPU13) · unos 30 skids ≈ 3,5 h" });
      a({ cota: 0, tit: "Las dos van por la línea de salida", pts: T_LINEA, txt: "Ya ancladas, salen del buffer por la <b>mesa transferidora</b>, que se mueve de costado y las pasa a la <b>línea de salida</b>: un transportador de rodillos junto al buffer que dobla y llega a la zona de difusión.", dato: "Actualización del layout KP1 (dibujo de Julian, oct. 2026) · posición de la mesa: a confirmar" });
      a({ cota: 0, tit: "En difusión, la mula las carga", pts: T_DIFUSION, mula: true, txt: "En la zona de difusión viene una <b>mula</b> con un carrito y las carga: <b>primero la cabina y después la caja</b>, del mismo color. Los skids pobres quedan vacíos y vuelven a la cota 5,4 por el retorno de skids pobres (CPU4).", dato: "SOP en difusión para hermanar cabina y caja" });
      a({ cota: 0, tit: "La mula sale para Montaje KP1", pts: T_MONTAJEKP1, mula: true, txt: "Con la cabina y la caja arriba del carrito, la mula sale por la abertura de la fachada (hacia PS2) para la nave de Montaje de las pickups. Acá termina su paso por Pintura.", dato: "Traslado manual difusión → Montaje · salida exacta: a confirmar" });
    }
    return S;
  }
  let PASOS = [], RT = null;
  function armarTour() {
    PASOS = pasos();
    const todos = []; const inicio = [];
    for (const p of PASOS) { inicio.push(todos.length); todos.push(...p.pts); }
    RT = ruta(todos);
    // longitud acumulada donde empieza cada paso
    PASOS.forEach((p, i) => { const k = Math.max(0, inicio[i] - 1); p.s0 = k === 0 ? 0 : RT.seg[Math.min(k, RT.seg.length - 1)].L0 + (k >= RT.seg.length ? RT.seg[RT.seg.length - 1].l : 0); });
    PASOS.forEach((p, i) => { p.s1 = i + 1 < PASOS.length ? PASOS[i + 1].s0 : RT.L; });
    $("rc-total").textContent = "/ " + String(PASOS.length).padStart(2, "0");
  }
  const $ = (id) => document.getElementById(id);

  // carrocería del recorrido (no instanciada, con halo)
  const carro = new THREE.Group();
  const cSkid = new THREE.Mesh(G_SKID, new THREE.MeshLambertMaterial({ color: SKID_RICO })); carro.add(cSkid);
  const mCuerpo = new THREE.MeshLambertMaterial({ color: EST.chapa, emissive: 0x1f6feb, emissiveIntensity: 0.18 });
  const cuerpo = new THREE.Mesh(G_SEDAN, mCuerpo); carro.add(cuerpo);
  const vid = new THREE.Mesh(G_VIDRIO, new THREE.MeshLambertMaterial({ color: "#3b4656" })); carro.add(vid);
  const colgT = new THREE.Mesh(G_COLG, new THREE.MeshLambertMaterial({ color: "#3b434c" })); colgT.position.y = 1.35; carro.add(colgT);
  const halo = new THREE.Mesh(new THREE.RingGeometry(3.2, 3.7, 40), new THREE.MeshBasicMaterial({ color: 0x1f6feb, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
  halo.rotation.x = -Math.PI / 2; halo.position.y = 0.05; carro.add(halo);
  const marca = document.createElement("div"); marca.className = "cota-et"; marca.style.cssText = "background:#1f6feb;color:#fff;font:700 12px Segoe UI,Arial,sans-serif;padding:3px 9px;border-radius:6px;box-shadow:0 2px 6px rgba(0,0,0,.35);white-space:nowrap;pointer-events:none";
  const marcaO = new THREE.CSS2DObject(marca); marcaO.position.set(0, 4.6, 0); carro.add(marcaO);
  // mula del recorrido (para los pasos con mula)
  const mulaT = new THREE.Group();
  { const m1 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 1.0), new THREE.MeshLambertMaterial({ color: "#2ea84f" })); m1.position.set(4.0, 0.6, 0); mulaT.add(m1); const m2 = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.12, 2.0), new THREE.MeshLambertMaterial({ color: "#f2c94c" })); m2.position.set(-1.3, 0.5, 0); mulaT.add(m2); }
  carro.add(mulaT);
  tour.add(carro); tour.visible = false;
  // pareja de la cabina (KP1): la caja del mismo color se ancla con ella en la mitad del buffer y la sigue hasta la mula
  const pareja = new THREE.Group();
  const pSkid = new THREE.Mesh(G_SKID, new THREE.MeshLambertMaterial({ color: SKID_POBRE })); pareja.add(pSkid);
  const pCaja = new THREE.Mesh(G_CAJA, new THREE.MeshLambertMaterial({ color: "#eef1f4", emissive: 0x1f6feb, emissiveIntensity: 0.12 })); pareja.add(pCaja);
  tour.add(pareja); pareja.visible = false;
  const ptPar = {};

  function pasoDe(s) { let i = 0; while (i < PASOS.length - 1 && PASOS[i + 1].s0 <= s + 1e-6) i++; return i; }
  const COTA_TXT = { 0: "COTA 0", 3.2: "LEVEL +3,2", 5.4: "COTA +5,4", 9: "COTA +9" };
  const COTA_COL = { 0: "#e67e22", 3.2: "#5d6d7e", 5.4: "#c79a1a", 9: "#1f6feb" };
  function mostrarPaso(i) {
    const p = PASOS[i]; if (!p) return;
    $("rc-num").textContent = String(i + 1).padStart(2, "0");
    $("rc-tit").textContent = p.tit; $("rc-txt").innerHTML = p.txt; $("rc-dato").textContent = p.dato || "";
    const chip = $("rc-cota"); chip.textContent = COTA_TXT[p.cota]; chip.style.background = COTA_COL[p.cota];
    marca.textContent = p.tit;
    // si los pisos están juntos, se muestra la cota del paso
    const M = maqueta;
    if (M.estado.sep === 0) { const piso = p.cota === 9 ? "9" : p.cota === 0 ? "0" : "5"; if (M.estado.piso !== piso) M.verPiso(piso); }
  }
  function ubicarCarro() {
    RT.punto(tourEstado.s, tourPt);
    carro.position.copy(W(tourPt.x, tourPt.y, 0)); carro.position.y = tourPt.z;
    carro.rotation.y = tourPt.ang;
    colgT.visible = !!tourPt.dip; if (tourPt.dip) colgT.scale.y = Math.max(0.05, alto(9, RIEL_PENDULAR) - (tourPt.z + 1.35));
    const i = pasoDe(tourEstado.s), p = PASOS[i];
    const swapI = PASOS.findIndex(x => x.swap);
    const pobre = i > swapI || (i === swapI && tourEstado.s > (p.s0 + p.s1) / 2);
    cSkid.material.color.set(pobre ? SKID_POBRE : SKID_RICO);
    mCuerpo.color.set(tourPt.e === "pint" ? (tourEstado.modelo === "kp1" ? "#eef1f4" : "#c21f37") : EST[tourPt.e] || EST.chapa);
    mulaT.visible = !!p.mula;
    cuerpo.position.y = p.mula ? 0.25 : 0; cSkid.visible = !p.mula || i < PASOS.length - 1;
    // pareja KP1: aparece cuando la cabina llega a la mitad del buffer; después va 5,5 m detrás (en la mula, sobre el carro)
    const iBuf = PASOS.findIndex(x => x.tit.startsWith("Buffer KP1"));
    const verPar = tourEstado.modelo === "kp1" && iBuf >= 0 && (i > iBuf || (i === iBuf && tourEstado.s > PASOS[iBuf].s1 - 0.6));
    pareja.visible = verPar;
    if (verPar) {
      if (p.mula) { pareja.position.copy(carro.position); pareja.rotation.y = carro.rotation.y; pareja.translateX(-3.4); pareja.position.y = carro.position.y + 0.25; pSkid.visible = false; }
      else {
        const sAnc = PASOS[iBuf].s1, sp = i === iBuf ? sAnc : Math.max(sAnc, tourEstado.s - 5.5);
        RT.punto(sp, ptPar);
        pareja.position.copy(W(ptPar.x, ptPar.y, 0)); pareja.position.y = ptPar.z; pareja.rotation.y = ptPar.ang; pSkid.visible = true;
        if (i === iBuf) { pareja.position.copy(W(ptPar.x, ptPar.y - 2.5, 0)); pareja.position.y = ptPar.z; }   // anclada en el carril de al lado
      }
    }
    const prog = tourEstado.s / RT.L; $("rc-prog").style.width = (prog * 100).toFixed(1) + "%";
    if (i !== tourEstado.paso) { tourEstado.paso = i; mostrarPaso(i); }
  }
  const tgt = new THREE.Vector3(), arribaPantalla = new THREE.Vector3();
  function seguirCamara(dt, saltar) {
    if (!tourEstado.seguir) return;
    tgt.copy(carro.position);
    // en celular el panel tapa la mitad de abajo: la carrocería se muestra en el tercio de arriba de la pantalla
    if (MOVIL) { arribaPantalla.set(0, 1, 0).applyQuaternion(camara.quaternion); tgt.addScaledVector(arribaPantalla, -0.24 * (camara.top - camara.bottom) / camara.zoom); }
    const k = saltar ? 1 : Math.min(1, dt * 2.5);
    const d = tgt.clone().sub(controles.target).multiplyScalar(k);
    controles.target.add(d); camara.position.add(d);
    if (saltar && camara.zoom < 2.6) { camara.zoom = 3.2; camara.updateProjectionMatrix(); }
  }
  function irAPaso(i) {
    i = Math.max(0, Math.min(PASOS.length - 1, i));
    tourEstado.s = PASOS[i].s0 + 0.01; tourEstado.paso = -1; ubicarCarro(); seguirCamara(0, true);
  }
  function setModelo() {
    cuerpo.geometry = tourEstado.modelo === "kp1" ? G_CABINA : G_SEDAN; vid.visible = tourEstado.modelo !== "kp1";
    const i = Math.min(tourEstado.paso, 99); armarTour(); irAPaso(Math.min(i < 0 ? 0 : i, PASOS.length - 1));
  }
  function abrir() {
    tourEstado.activo = true; tour.visible = true; $("recorrido").hidden = false; document.body.classList.add("con-recorrido");
    maqueta.estado.recorrido = true; maqueta.aplicarVista();
    if (!PASOS.length) armarTour();
    // vista alta y en diagonal: así los muros de la nave no tapan la carrocería
    camara.position.copy(controles.target).add(new THREE.Vector3(0.55, 1.25, 0.9).normalize().multiplyScalar(400));
    irAPaso(0);
  }
  function cerrar() { tourEstado.activo = false; tourEstado.play = false; tour.visible = false; $("recorrido").hidden = true; $("rc-play").textContent = "▶ Reproducir"; document.body.classList.remove("con-recorrido"); maqueta.estado.recorrido = false; maqueta.aplicarVista(); }
  $("abrir-recorrido").addEventListener("click", () => (tourEstado.activo ? cerrar() : abrir()));
  $("rc-cerrar").addEventListener("click", cerrar);
  $("rc-ant").addEventListener("click", () => { tourEstado.play = false; $("rc-play").textContent = "▶ Reproducir"; irAPaso(tourEstado.paso - 1); });
  $("rc-sig").addEventListener("click", () => { tourEstado.play = false; $("rc-play").textContent = "▶ Reproducir"; irAPaso(tourEstado.paso + 1); });
  $("rc-play").addEventListener("click", () => { tourEstado.play = !tourEstado.play; $("rc-play").textContent = tourEstado.play ? "❚❚ Pausa" : "▶ Reproducir"; if (tourEstado.play && tourEstado.s >= RT.L - 0.1) irAPaso(0); });
  $("rc-seguir").addEventListener("change", (e) => { tourEstado.seguir = e.target.checked; if (tourEstado.seguir) seguirCamara(0, true); });
  document.querySelectorAll("#rc-modelo button").forEach(b => b.addEventListener("click", () => { tourEstado.modelo = b.dataset.v; document.querySelectorAll("#rc-modelo button").forEach(x => x.classList.toggle("activo", x === b)); setModelo(); }));
  document.querySelectorAll("#rc-def button").forEach(b => b.addEventListener("click", () => { tourEstado.def = b.dataset.v === "def"; document.querySelectorAll("#rc-def button").forEach(x => x.classList.toggle("activo", x === b)); setModelo(); }));
  // al arrastrar la vista se deja de seguir (se puede volver a tildar "Seguir")
  controles.addEventListener("start", () => { if (tourEstado.activo && tourEstado.play) return; });

  function actualizarTour(dt) {
    if (!tourEstado.activo) return;
    if (tourEstado.play) {
      const p = PASOS[tourEstado.paso] || PASOS[0];
      const v = p && (p.cota === 0 || p.mula) ? 7 : 11;   // m/s del recorrido (rápido: es para verlo, no es la velocidad real)
      tourEstado.s = Math.min(RT.L, tourEstado.s + v * dt);
      if (tourEstado.s >= RT.L) { tourEstado.play = false; $("rc-play").textContent = "▶ Reproducir"; }
    }
    ubicarCarro();
    seguirCamara(dt, false);
    halo.material.opacity = 0.35 + 0.25 * Math.sin(performance.now() / 300);
  }

  if (animar) animar.push((dt) => {
    marcaO.visible = tourEstado.activo;
    if (flujo.visible) actualizarFlujo(dt);
    actualizarElevadores(dt);
    actualizarCota0(dt);
    actualizarTour(dt);
  });

  return {
    alCambiarVista() { if (tourEstado.activo && RT) ubicarCarro(); },
    abrir, cerrar, estado: tourEstado, F,
  };
};
