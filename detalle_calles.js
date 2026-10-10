/* Detalle fino de las calles de la cota 0: S, "entre S y T", T (fotos 08/10) y U, mitad T–U, V, W, entre W y X, X, A (fotos 09/10).
 * Todo sale del relevamiento fotográfico de Julian (08/10/2026, docs/relevamiento_calles.md).
 * Posiciones: ancladas a columnas con cartel (A0x / B0x = n° × 12 m). Medidas y cantidades: ESTIMADAS por foto.
 * Se llama desde app.js con window.DetalleCalles(api). Coordenadas en metros del plano (x al sur, y al este). */
window.DetalleCalles = function (api) {
  "use strict";
  const { THREE, W, N, capa, MOVIL, animar } = api;
  const grupo = capa("detalle");
  const alto = new THREE.Group();   // lo que supera 3,6 m: se oculta con "Cortar muros"
  grupo.add(alto);

  // ------------------------------------------------------------- utilidades
  let semilla = 2026;
  const azar = () => (semilla = (semilla * 16807) % 2147483647) / 2147483647;
  const entre = (a, b) => a + azar() * (b - a);
  const elegir = (l) => l[Math.floor(azar() * l.length)];

  // "Baldes" de cajas por color: todo se junta en UNA malla por color (rápido)
  const baldes = new Map();
  let dz = 0;   // desplazamiento vertical temporal (línea de sellado casi a nivel de piso)
  function caja(color, x0, y0, x1, y1, z0, z1, opc) {
    const k = color + (opc && opc.clave ? "|" + opc.clave : "") + (z1 > 3.6 ? "|alto" : "");
    if (!baldes.has(k)) baldes.set(k, { color, opc: opc || {}, pos: [], alto: z1 > 3.6 });
    const p = baldes.get(k).pos;
    const [a, b] = [Math.min(x0, x1), Math.max(x0, x1)], [c, d] = [Math.min(y0, y1), Math.max(y0, y1)];
    const q = [[a, c], [b, c], [b, d], [a, d]];
    const lo = q.map(([x, y]) => W(x, y, z0 + dz)), hi = q.map(([x, y]) => W(x, y, z1 + dz));
    const tri = (u, v, w) => p.push(u.x, u.y, u.z, v.x, v.y, v.z, w.x, w.y, w.z);
    const quad = (u, v, w, s) => { tri(u, v, w); tri(u, w, s); };
    quad(hi[0], hi[1], hi[2], hi[3]); quad(lo[0], lo[3], lo[2], lo[1]);
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; quad(lo[i], lo[j], hi[j], hi[i]); }
  }
  // Caja centrada (cx, cy) con tamaño (largo en x, ancho en y)
  const bloque = (color, cx, cy, lx, ly, z0, z1, opc) => caja(color, cx - lx / 2, cy - ly / 2, cx + lx / 2, cy + ly / 2, z0, z1, opc);
  // Pintura en el piso
  const pinta = (color, x0, y0, x1, y1, z) => caja(color, x0, y0, x1, y1, z, z + 0.012, { clave: "piso", piso: true });

  const cilindros = [];   // [color, x, y, z0, h, r, eje('z'|'x'|'y')]
  const cil = (color, x, y, z0, h, r, eje) => cilindros.push([color, x, y, z0 + dz, h, r, eje || "z"]);

  // Carteles con texto (textura de canvas)
  const cacheTex = new Map();
  function textura(texto, fondo, tinta, ancho, alto) {
    const k = [texto, fondo, tinta, ancho, alto].join("|");
    if (cacheTex.has(k)) return cacheTex.get(k);
    const cv = document.createElement("canvas");
    cv.width = ancho; cv.height = alto;
    const g = cv.getContext("2d");
    g.fillStyle = fondo; g.fillRect(0, 0, ancho, alto);
    g.strokeStyle = tinta; g.lineWidth = Math.max(2, alto * 0.04); g.strokeRect(g.lineWidth, g.lineWidth, ancho - 2 * g.lineWidth, alto - 2 * g.lineWidth);
    g.fillStyle = tinta; g.textAlign = "center"; g.textBaseline = "middle";
    const lineas = texto.split("\n");
    const fs = Math.min(alto / (lineas.length * 1.25), ancho / (Math.max(...lineas.map(l => l.length)) * 0.62));
    g.font = `bold ${fs}px Segoe UI, Arial, sans-serif`;
    lineas.forEach((l, i) => g.fillText(l, ancho / 2, alto / 2 + (i - (lineas.length - 1) / 2) * fs * 1.15));
    const t = new THREE.CanvasTexture(cv);
    t.anisotropy = 4;
    cacheTex.set(k, t);
    return t;
  }
  // Cartel plano: centro (x,y,z), tamaño (ancho, alto), mirando hacia +y / -y / +x / -x
  function cartel(texto, x, y, z, ancho, alto, mira, fondo, tinta, dobleCara) {
    const px = 128;
    const t = textura(texto, fondo || "#ffffff", tinta || "#111111", Math.round(px * ancho / alto), px);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(ancho, alto),
      new THREE.MeshBasicMaterial({ map: t, side: dobleCara ? THREE.DoubleSide : THREE.FrontSide }));
    m.position.copy(W(x, y, z));
    // la normal del plano (0,0,1) en three = -y del plano
    const rot = { "+y": Math.PI, "-y": 0, "+x": -Math.PI / 2, "-x": Math.PI / 2 }[mira];
    m.rotation.y = rot;
    grupo.add(m);
    return m;
  }

  // Figuras humanas simples (operarios)
  function persona(x, y, orient, chaleco, zb) {
    const cam = chaleco ? "#ffd84d" : elegir(["#ffffff", "#f1f4f8", "#dfe9f5"]), b = zb || 0;
    bloque("#2c3a55", x, y, 0.3, 0.42, b, b + 0.85);
    bloque(cam, x, y, 0.32, 0.5, b + 0.85, b + 1.47);
    bloque("#e2b48c", x, y, 0.22, 0.22, b + 1.47, b + 1.7);
    bloque("#1f2a3a", x, y, 0.24, 0.24, b + 1.7, b + 1.76);
    void orient;
  }

  // Carrocerías (cataforesis: gris dorado, como en las fotos)
  const ECOAT = ["#b8ad8f", "#a9a28c", "#c2b897"];
  // Carrocería en blanco/cataforesis vista por perfil (x = largo). Perfil por tramos: [desde, hasta, z0, z1]
  function perfil(cx, cy, z, largoX, tramos, ancho, color) {
    for (const [a, b, z0, z1, ang] of tramos) {
      const w = (ang || 1) * ancho;
      if (largoX) bloque(color, cx + (a + b) / 2, cy, b - a, w, z + z0, z + z1);
      else bloque(color, cx, cy + (a + b) / 2, w, b - a, z + z0, z + z1);
    }
  }
  function ruedasHueco(cx, cy, z, largoX, ejes, ancho) {
    for (const e of ejes) for (const s of [-1, 1]) {
      const [x, y] = largoX ? [cx + e, cy + s * (ancho / 2 - 0.02)] : [cx + s * (ancho / 2 - 0.02), cy + e];
      cil("#1d2228", x, y, z + 0.32, 0.12, 0.33, largoX ? "y" : "x");
    }
  }
  function sedan(cx, cy, z, largoX, color) {
    const c = color || elegir(ECOAT), A = 1.74;
    // Cronos: capó bajo, cabina, baúl; 4,36 m
    perfil(cx, cy, z, largoX, [
      [-2.18, -1.30, 0.30, 0.82, 0.96], [-1.30, -0.75, 0.30, 0.92], [-0.75, 1.05, 0.30, 0.95],
      [1.05, 1.62, 0.30, 0.98], [1.62, 2.18, 0.34, 0.98, 0.96],
      [-0.85, -0.45, 0.95, 1.22, 0.92], [-0.45, 0.85, 0.95, 1.46, 0.9], [0.85, 1.25, 0.98, 1.3, 0.9],
    ], A, c);
    perfil(cx, cy, z, largoX, [[-0.6, 0.78, 1.0, 1.4, 0.91]], A, "#3b4656");   // vanos de ventanilla (hueco oscuro)
    ruedasHueco(cx, cy, z, largoX, [-1.33, 1.28], A);
  }
  function pickup(cx, cy, z, largoX, soloCaja, color) {
    const c = color || elegir(ECOAT), A = 1.86;
    if (!soloCaja) {   // cabina doble de Titano/Dakota (skid propio)
      perfil(cx, cy, z, largoX, [
        [-1.75, -1.0, 0.45, 1.05, 0.96], [-1.0, 1.35, 0.45, 1.12],
        [-0.95, -0.5, 1.12, 1.45, 0.92], [-0.5, 1.35, 1.12, 1.88, 0.9],
      ], A, c);
      perfil(cx, cy, z, largoX, [[-0.35, 1.2, 1.2, 1.78, 0.91]], A, "#3b4656");
      ruedasHueco(cx, cy, z, largoX, [-1.25], A);
    } else {           // caja de carga abierta (skid propio)
      const L = 1.6;
      perfil(cx, cy, z, largoX, [[-L, L, 0.45, 0.6]], A, c);
      for (const s of [-1, 1]) perfil(cx, cy + (largoX ? s * (A / 2 - 0.05) : 0), z, largoX, [[-L, L, 0.6, 1.12]], 0.1, c);
      perfil(cx, cy, z, largoX, [[-L, -L + 0.08, 0.6, 1.12], [L - 0.08, L, 0.6, 1.12]], A, c);
      ruedasHueco(cx, cy, z, largoX, [0.45], A);
    }
  }
  function skid(cx, cy, z, largoX) {
    const [lx, ly] = largoX ? [5.0, 1.12] : [1.12, 5.0];
    for (const s of [-1, 1]) bloque("#5d6672", cx + (largoX ? 0 : s * 0.45), cy + (largoX ? s * 0.45 : 0), largoX ? lx : 0.12, largoX ? 0.12 : ly, z, z + 0.16);
    for (let k = -2; k <= 2; k++) bloque("#5d6672", cx + (largoX ? k * 1.1 : 0), cy + (largoX ? 0 : k * 1.1), largoX ? 0.1 : 1.0, largoX ? 1.0 : 0.1, z + 0.16, z + 0.3);
  }

  // ------------------------------------------------------------- geometría de las calles (m)
  // S: pared del eje A al este; plataformas de máquinas al oeste.  T: pared del eje B al este; línea de sellado al oeste.
  // Entre S y T: pared del eje B al oeste; cubas / máquinas al este; entrepiso de cota 5 arriba.
  const X0 = 2, X1 = 262;
  const CALLES = [
    { id: "S", y0: 98.0, y1: 103.55, pared: 103.55, ladoPared: +1, senda: [99.9, 100.7], cartel: "CALLE\nS" },
    { id: "ST", y0: 82.0, y1: 86.4, pared: 82.0, ladoPared: -1, senda: null, cartel: null },
    { id: "T", y0: 79.2, y1: 81.6, pared: 81.6, ladoPared: +1, senda: [80.65, 81.45], cartel: "CALLE\nT" },
  ];
  const colsEje = (y) => N.columnas.filter(c => Math.abs(c[1] - y) < 0.1 && c[4] === 0 && c[0] >= 0 && c[0] <= 264).sort((a, b) => a[0] - b[0]);
  const COL_A = colsEje(104.0), COL_B = colsEje(82.0);

  // ============================================================= 1) PISOS MARCADOS
  for (const c of CALLES) {
    // hormigón alisado/epoxi (más oscuro y gastado en la calle entre S y T)
    pinta(c.id === "ST" ? "#7f8790" : "#b7bec6", X0, c.y0, X1, c.y1, 0.02);
    // líneas amarillas de borde (10 cm) a 35 cm de la pared y del borde opuesto
    const yP = c.pared - c.ladoPared * 0.35, yO = (c.ladoPared > 0 ? c.y0 : c.y1) + c.ladoPared * 0.3;
    pinta("#f2c94c", X0, yP - 0.05, X1, yP + 0.05, 0.035);
    pinta("#f2c94c", X0, yO - 0.05, X1, yO + 0.05, 0.035);
    // senda verde con filete amarillo
    if (c.senda) {
      pinta("#f2c94c", X0, c.senda[0] - 0.08, X1, c.senda[1] + 0.08, 0.04);
      pinta("#2e9d6a", X0, c.senda[0], X1, c.senda[1], 0.05);
    }
    // tapas de inspección redondas cada ~37 m
    for (let x = X0 + 18; x < X1; x += 37) cil("#3a3f45", x, (c.y0 + c.y1) / 2 + entre(-0.6, 0.6), 0.03, 0.03, 0.32);
    // cruces peatonales (cebra) cada 48 m
    if (c.id !== "S") for (let x = 30; x < X1 - 4; x += 48)
      for (let k = 0; k < 5; k++) pinta("#ffffff", x + k * 0.9, c.y0 + 0.3, x + k * 0.9 + 0.45, c.y1 - 0.3, 0.06);
  }
  // S: canaleta con rejilla a lo largo del borde de las plataformas
  pinta("#9aa1a8", X0, 98.25, X1, 98.7, 0.12);   // cordón de hormigón al pie de las cubas
  pinta("#2f343a", X0, 98.7, X1, 99.75, 0.025);   // rejilla ancha (fotos pts 2-6)
  for (let x = X0; x < X1; x += 0.35) pinta("#59616b", x, 98.72, x + 0.05, 99.73, 0.04);
  for (let y = 98.8; y < 99.75; y += 0.12) pinta("#4b525a", X0, y, X1, y + 0.02, 0.041);
  pinta("#ffffff", X0, 100.72, X1, 100.8, 0.045);   // filete blanco del lado pared
  // cebras desde las puertas de la pared hasta la senda
  for (const x of [56, 92, 110, 164, 188]) for (let k = 0; k < 4; k++) pinta("#ffffff", x + k * 0.8, 100.9, x + k * 0.8 + 0.4, 103.0, 0.06);
  // ST: manchas verdes (pintura vieja) y huellas de líquido
  for (let i = 0; i < 60; i++) { const x = entre(X0, X1), y = entre(82.6, 86); pinta(elegir(["#3f7d5d", "#4c6b5a", "#5a636c"]), x, y, x + entre(0.8, 3.5), y + entre(0.3, 1.2), 0.03); }
  // T: rectángulos verdes de puesto junto a la línea y cebras con franjas amarillo/negro (pts 25, 28, 30)
  for (let x = 140; x < 250; x += 12) pinta("#2e9d6a", x, 79.35, x + 1.6, 80.3, 0.045);
  for (const x of [118, 182, 236]) {
    for (let k = 0; k < 4; k++) pinta("#ffffff", x + k * 0.8, 79.4, x + k * 0.8 + 0.4, 81.4, 0.06);
    for (let k = 0; k < 8; k++) pinta(k % 2 ? "#1f2328" : "#f2c94c", x + 4 + k * 0.3, 80.0, x + 4.3 + k * 0.3, 81.4, 0.06);
  }
  // zonas demarcadas amarillo/negro frente a portones (S pt 10, ST pt 11)
  function rayado(x0, y0, x1, y1) { for (let x = x0, k = 0; x < x1; x += 0.25, k++) pinta(k % 2 ? "#1f2328" : "#f2c94c", x, y0, Math.min(x + 0.25, x1), y1, 0.065); }
  rayado(236, 98.7, 240, 99.3); rayado(20, 82.3, 26, 82.8); rayado(248, 82.3, 252, 82.8);

  // ============================================================= 2) PAREDES Y COLUMNAS
  // Pared del eje B: en el modelo llega a 3 m; en las fotos sube con chapa trapezoidal hasta la cota 5 y más
  caja("#c7cbcf", X0, 81.72, X1, 81.84, 3.0, 9.0);
  for (let x = X0; x < X1; x += 0.6) { caja("#b3b8bd", x, 81.66, x + 0.18, 81.72, 3.0, 9.0); caja("#b3b8bd", x, 81.84, x + 0.18, 81.9, 3.0, 9.0); }
  // Chapa trapezoidal del cerramiento (eje A) arriba del zócalo, nervios cada 0,6 m
  for (let x = X0; x < X1; x += 0.6) caja("#b3b8bd", x, 103.45, x + 0.18, 103.52, 3.0, 9.0);

  function columnaDetalle(c, linea, cara) {
    const [x, y, w] = c;
    const n = Math.round(x / 12), codigo = linea + String(n).padStart(2, "0");
    const yc = y + cara * (w / 2 + 0.01);
    // pilastra galvanizada al lado de la columna (siempre en las fotos)
    caja("#aeb6be", x + w / 2 + 0.02, yc - cara * 0.25, x + w / 2 + 0.24, yc, 0, 9.0);
    // código de columna pintado (amarillo sobre azul) o etiqueta de papel
    cartel(codigo, x, yc + cara * 0.005, 4.2, 0.6, 0.3, cara > 0 ? "+y" : "-y", "#1d2f6b", "#f2c94c");
    if (linea === "B") cartel(codigo, x, y - cara * (w / 2 + 0.015), 2.6, 0.32, 0.4, cara > 0 ? "-y" : "+y", "#f5efe0", "#333333");
    // boca de incendio (cada columna de B; alterna con matafuego en A)
    if (linea === "B" || n % 2 === 0) {
      bloque("#c0392b", x, yc + cara * 0.13, 0.75, 0.25, 0.9, 1.65);
      bloque("#e8e8e8", x, yc + cara * 0.26, 0.55, 0.02, 1.05, 1.5);
      cartel("◎", x, yc + cara * 0.01, 2.0, 0.42, 0.42, cara > 0 ? "+y" : "-y", "#c0392b", "#ffffff");
      caja("#c0392b", x - w / 2 - 0.12, yc, x - w / 2 - 0.04, yc + cara * 0.08, 1.65, 6.0);   // caño rojo que sube
      cil("#c0392b", x - w / 2 - 0.08, yc + cara * 0.04, 6.0, 0.08, 0.06, "z");
    } else {
      cil("#d0312d", x, yc + cara * 0.12, 0.6, 0.55, 0.09);
      cartel("MATAFUEGO", x, yc + cara * 0.005, 1.6, 0.25, 0.55, cara > 0 ? "+y" : "-y", "#e74c3c", "#ffffff");
    }
    // pulsador de alarma rojo
    bloque("#e74c3c", x + 0.2, yc + cara * 0.04, 0.12, 0.08, 1.45, 1.57);
  }
  COL_A.filter(c => c[2] > 0.6).forEach(c => columnaDetalle(c, "A", -1));
  COL_B.filter(c => c[2] > 0.6).forEach(c => { columnaDetalle(c, "B", -1); columnaDetalle(c, "B", +1); });

  // Tableros eléctricos grises contra las paredes (con luces y número) – S pts 2, 9; T pt 26
  function tablero(x, yPared, cara, ancho, num) {
    const y = yPared - cara * 0.3;
    bloque("#c9cdd1", x, y, ancho, 0.55, 0.1, 2.1);
    bloque("#aab0b6", x, y, ancho + 0.06, 0.6, 0, 0.1);
    for (let i = 0; i < Math.max(2, Math.round(ancho / 0.6)); i++) bloque("#8f969d", x - ancho / 2 + 0.3 + i * 0.6, y - cara * 0.28, 0.02, 0.02, 0.2, 2.0);
    for (let i = 0; i < 6; i++) bloque(elegir(["#2ecc71", "#2ecc71", "#e74c3c", "#f1c40f"]), x - 0.3 + i * 0.12, y - cara * 0.29, 0.06, 0.02, 1.6, 1.66, { clave: "luz", emisivo: true });
    if (num) cartel(String(num), x + ancho / 2 - 0.15, y - cara * 0.281, 1.95, 0.22, 0.16, cara > 0 ? "-y" : "+y", "#f2c94c", "#111111");
    cartel("⚡", x, y - cara * 0.281, 1.2, 0.22, 0.22, cara > 0 ? "-y" : "+y", "#f2c94c", "#111111");
  }
  for (const [x, w, n] of [[30, 1.6], [31.8, 1.6], [33.6, 1.2], [70, 1.2, 128], [106, 1.4], [208, 1.0, 218], [214, 0.8]]) tablero(x, 103.55, +1, w, n);
  for (const [x, w, n] of [[150, 1.0, 186], [222, 1.2, 99], [74, 0.9]]) tablero(x, 81.6, +1, w, n);

  // Puertas en paredes: [x, pared, cara, ancho, color, cartel]
  const PUERTAS = [
    [94, 103.55, +1, 2.2, "#f2b705", "DEPÓSITO\nPRODUCTOS QUÍMICOS"],
    [58, 103.55, +1, 1.8, "#2e8b57", ""], [166, 103.55, +1, 1.2, "#f2b705", "CABINA\nELÉCTRICA"],
    [190, 103.55, +1, 2.4, "#27ae60", "SALIDA DE\nEMERGENCIA"], [112, 103.55, +1, 1.0, "#2e8b57", ""],
    [40, 81.6, +1, 1.4, "#2e8b57", ""], [60, 81.6, +1, 2.6, "#2e8b57", ""], [184, 81.6, +1, 1.4, "#2e8b57", ""],
    [12, 81.6, +1, 2.4, "#f2b705", ""], [20, 82.0, -1, 4.0, "#e3a800", ""], [210, 82.0, -1, 1.4, "#2e8b57", ""],
  ];
  for (const [x, yP, cara, ancho, color, txt] of PUERTAS) {
    const y = yP - cara * 0.02;
    caja(color, x - ancho / 2, y, x + ancho / 2, y - cara * 0.06, 0, 2.3);
    caja("#5b6570", x - ancho / 2 - 0.08, y, x - ancho / 2, y - cara * 0.08, 0, 2.4);
    caja("#5b6570", x + ancho / 2, y, x + ancho / 2 + 0.08, y - cara * 0.08, 0, 2.4);
    caja("#5b6570", x - ancho / 2 - 0.08, y, x + ancho / 2 + 0.08, y - cara * 0.08, 2.3, 2.4);
    if (ancho > 1.6) caja("#e8e8e8", x - ancho / 2 + 0.25, y - cara * 0.065, x + ancho / 2 - 0.25, y - cara * 0.075, 1.2, 1.9, { clave: "vidrio" });
    caja("#c0392b", x - ancho / 2 + 0.2, y - cara * 0.07, x + ancho / 2 - 0.2, y - cara * 0.1, 1.0, 1.05);   // barra antipánico
    cartel("SALIDA →", x, y - cara * 0.01, 2.75, 0.7, 0.24, cara > 0 ? "-y" : "+y", "#1e8449", "#ffffff");
    if (txt) cartel(txt, x - ancho / 2 - 0.7, y - cara * 0.01, 1.7, 1.0, 0.5, cara > 0 ? "-y" : "+y", "#ffffff", "#1f2a3a");
  }
  // Rejas de ventilación (S pt 6) y carteles varios
  for (const x of [146, 148.5]) { caja("#23395d", x, 103.5, x + 1.6, 103.45, 0.8, 1.9); for (let z = 0.9; z < 1.85; z += 0.12) caja("#8e99a6", x + 0.1, 103.44, x + 1.5, 103.42, z, z + 0.05); }
  for (const [x, y, cara, txt, fondo, tinta] of [
    [52, 103.55, +1, "PROHIBIDO\nFUMAR", "#ffffff", "#c0392b"], [130, 103.55, +1, "USO\nOBLIGATORIO\nDE EPP", "#1f6feb", "#ffffff"],
    [226, 103.55, +1, "APAGUEMOS\nTODAS LAS LUCES", "#f2c94c", "#111111"],
    [151, 81.6, +1, "INTERRUPTOR\nDE LUCES ↓", "#1f2a3a", "#ffffff"], [196, 81.6, +1, "INTERRUPTOR\nDE LUCES ↓", "#1f2a3a", "#ffffff"],
    [229, 81.6, +1, "CALIDAD\nES TAREA\nDE TODOS", "#2ecc71", "#ffffff"], [232, 81.6, +1, "SEGURIDAD\nPRIMERO", "#c0392b", "#ffffff"],
    [235, 81.6, +1, "5S", "#1f6feb", "#ffffff"], [112, 82.0, -1, "ACCESO\nRESTRINGIDO", "#ffffff", "#c0392b"],
  ]) cartel(txt, x, y - cara * 0.03, 1.7, 0.9, 0.9, cara > 0 ? "-y" : "+y", fondo, tinta);

  // ============================================================= 3) AÉREO: bandejas, caños, luces, carteles de calle
  for (const c of CALLES) {
    const yW = c.pared - c.ladoPared * 0.6, yM = (c.y0 + c.y1) / 2;
    const zTop = c.id === "ST" ? 4.9 : 6.2;
    // bandejas portacables galvanizadas (2 niveles) con ménsulas cada 3 m
    for (const [dy, z] of [[0, zTop - 0.6], [-c.ladoPared * 0.55, zTop - 1.0]]) {
      caja("#b6bec6", X0, yW + dy - 0.22, X1, yW + dy + 0.22, z, z + 0.04);
      caja("#a3abb3", X0, yW + dy - 0.24, X1, yW + dy - 0.2, z, z + 0.12);
      caja("#a3abb3", X0, yW + dy + 0.2, X1, yW + dy + 0.24, z, z + 0.12);
      for (let x = X0; x < X1; x += 3) caja("#8c949c", x, yW + dy - 0.25, x + 0.05, yW + dy + 0.25, z - 0.05, zTop);
      for (let i = 0; i < 4; i++) caja(elegir(["#2b2f33", "#3d4247", "#1f6feb", "#c0392b"]), X0, yW + dy - 0.15 + i * 0.09, X1, yW + dy - 0.1 + i * 0.09, z + 0.04, z + 0.09);
    }
    // cañerías longitudinales (grises, verdes, una roja de incendio) con abrazaderas
    const canos = c.id === "T" ? [["#aeb7c2", 0.14, -0.9, 5.4], ["#9aa3ad", 0.1, -1.2, 5.7]]
      : [["#aeb7c2", 0.16, -0.9, zTop - 0.2], ["#aeb7c2", 0.12, -1.25, zTop - 0.25], ["#3c8a5a", 0.1, -1.55, zTop - 0.1], ["#c0392b", 0.08, -1.8, zTop - 0.4], ["#d9dde1", 0.2, -2.1, zTop - 0.15]];
    for (const [col, r, dy, z] of canos) {
      const y = c.pared + c.ladoPared * dy;
      cilindros.push([col, (X0 + X1) / 2, y, z, X1 - X0, r, "x"]);
      for (let x = X0; x < X1; x += 6) caja("#7d858d", x, y - r - 0.03, x + 0.06, y + r + 0.03, z - r - 0.05, zTop);
    }
    // luminarias lineales colgantes cada 6 m
    for (let x = X0 + 3; x < X1; x += 6) {
      caja("#e9f2ff", x - 0.6, yM - 0.07, x + 0.6, yM + 0.07, zTop - 1.6, zTop - 1.52, { clave: "luz", emisivo: true });
      caja("#9aa5b1", x - 0.01, yM - 0.01, x + 0.01, yM + 0.01, zTop - 1.52, zTop);
    }
    // carteles "CALLE S" / "CALLE T" colgantes cada 48 m (fondo blanco, como en las fotos)
    if (c.cartel) for (let x = 6; x < X1; x += 48) {
      cartel(c.cartel, x, yM, 3.7, 0.6, 0.7, "+x", "#ffffff", "#111111", true);
      caja("#7d858d", x, yM - 0.25, x + 0.02, yM - 0.23, 4.05, zTop); caja("#7d858d", x, yM + 0.23, x + 0.02, yM + 0.25, 4.05, zTop);
    }
  }
  // extractores/rejillas altas en la pared de la calle T (pts 22–25) y conductos verticales plateados
  for (let x = 12; x < X1; x += 12) {
    bloque("#c2c8ce", x + 3, 81.25, 0.7, 0.55, 5.6, 6.3); for (let z = 5.7; z < 6.25; z += 0.1) bloque("#7d858d", x + 3, 80.97, 0.6, 0.02, z, z + 0.04);
    cil("#cfd5db", x + 5, 80.9, 0, 7.5, 0.16);
  }

  // ============================================================= 4) PLATAFORMAS DE MÁQUINAS (lado oeste de S y este de ST)
  // estructura azul de las cubas (cota 9) cada 3 m en ambos bordes + vigas naranjas
  for (const yb of [98.25, 86.6]) {
    for (let x = X0; x <= X1; x += 3) caja("#23395d", x - 0.13, yb - 0.13, x + 0.13, yb + 0.13, 0, 9.0);
    caja("#e67e22", X0, yb - 0.12, X1, yb + 0.12, 3.4, 3.7);
    caja("#e67e22", X0, yb - 0.12, X1, yb + 0.12, 6.2, 6.5);
    // malla gris baja entre columnas
    caja("#8e99a6", X0, yb - 0.02, X1, yb + 0.02, 0.05, 1.5, { clave: "malla", transparente: 0.35 });
    caja("#6f7a86", X0, yb - 0.04, X1, yb + 0.04, 1.45, 1.52);
  }
  // escaleras amarillas a las plataformas (S pts 2, 5, 8) y a la cota 5 (ST pts 12, 15, 18)
  function escalera(x, y, haciaY, z1, color) {
    const n = Math.round(z1 / 0.2), largo = z1 * 0.9;
    for (let i = 0; i < n; i++) { const t = i / n; bloque("#7f8a95", x + t * largo, y, 0.28, 0.9, t * z1, t * z1 + 0.05); }
    for (const s of [-0.48, 0.48]) {
      for (let i = 0; i < n; i += 2) { const t = i / n; bloque(color, x + t * largo, y + s, 0.06, 0.06, t * z1, t * z1 + 1.0); }
      for (let i = 0; i < n; i++) { const t = i / n; bloque(color, x + t * largo, y + s, largo / n + 0.02, 0.06, t * z1 + 0.95, t * z1 + 1.02); }
    }
    void haciaY;
  }
  for (const x of [22, 58, 94, 130, 166, 198]) escalera(x, 97.6, -1, 1.6, "#f2c94c");
  for (const [x, col] of [[46, "#2e8b57"], [118, "#f2c94c"], [190, "#2e8b57"]]) escalera(x, 82.6, +1, 5.4, col);

  // equipos sobre el piso bajo las cubas: bombas con motor azul, tanques, filtros, IBC, tambores
  for (let x = 13; x < 204; x += entre(3.5, 6)) {   // las cubas terminan ≈ eje 18
    for (const [y0, y1] of [[93.5, 97.4], [87.2, 90.5]]) {
      const y = entre(y0, y1), tipo = azar();
      if (tipo < 0.35) {          // bomba centrífuga: base + motor + voluta + caños
        bloque("#5d6672", x, y, 1.4, 0.6, 0, 0.15);
        cil("#1f5fa8", x - 0.3, y, 0.35, 0.7, 0.22, "x");
        cil("#7f8a95", x + 0.35, y, 0.25, 0.35, 0.3, "x");
        cil("#aeb7c2", x + 0.35, y, 0.6, 1.8, 0.09);
      } else if (tipo < 0.55) {   // tanque/filtro vertical
        const r = entre(0.35, 0.8);
        cil(elegir(["#c9d1da", "#b8c2cc", "#dfe4ea"]), x, y, 0.2, entre(1.4, 2.8), r);
        for (const [dx, dy] of [[r * 0.7, 0], [-r * 0.7, 0], [0, r * 0.7], [0, -r * 0.7]]) bloque("#5d6672", x + dx, y + dy, 0.08, 0.08, 0, 0.2);
      } else if (tipo < 0.7) {    // IBC 1 m³ (bidón blanco con jaula)
        bloque("#eef2f5", x, y, 1.0, 1.2, 0.15, 1.15, { clave: "ibc", transparente: 0.85 });
        bloque("#5d6672", x, y, 1.05, 1.25, 0, 0.15);
        for (const dz of [0.4, 0.7, 1.0]) bloque("#aab0b6", x, y, 1.04, 1.24, dz + 0.15, dz + 0.17);
      } else if (tipo < 0.82) {   // tambores
        for (let k = 0; k < 3; k++) cil(elegir(["#1f5fa8", "#2e8b57", "#c0392b", "#1f5fa8"]), x + k * 0.62, y, 0, 0.9, 0.29);
      } else {                    // tablero de máquina con luz verde
        bloque("#d5d9dd", x, y, 0.8, 0.4, 0, 1.7);
        cil("#2ecc71", x, y, 1.75, 0.15, 0.06);
      }
    }
  }
  // cañería vertical verde y azul bajando de las cubas (cada ~7 m)
  for (let x = X0 + 4; x < X1; x += 7) { cil("#3c8a5a", x, 97.9, 0, 9, 0.09); cil("#2c6fb0", x + 1.3, 87.0, 0, 9, 0.08); }
  // carteles amarillos "SKID n" y verdes de seguridad sobre las barandas
  for (let i = 0, x = 20; x < 200; x += 30, i++) {
    cartel(`SKID ${i + 1}\n${elegir(["LAVADO", "DESENGRASE", "ENJUAGUE", "FOSFATO", "PASIVADO"])}`, x, 98.0, 1.25, 0.8, 0.6, "+y", "#f2c94c", "#111111");
    cartel("SEGURIDAD\n⛑ 👓 🧤", x + 10, 98.0, 1.2, 0.5, 0.7, "+y", "#27ae60", "#ffffff");
  }

  // ============================================================= 5) CALLE ENTRE S Y T
  // cuadros eléctricos de corriente continua y transformadores (pt 11) con baranda amarilla
  for (let i = 0; i < 6; i++) bloque("#c9cdd1", 26 + i * 1.3, 86.0, 1.25, 0.8, 0, 2.3);
  cartel("CUADRO\nELÉCTRICO\nCORRIENTE\nCONTINUA\nNº 1", 31, 85.59, 1.7, 0.7, 0.9, "-y", "#f2c94c", "#111111");
  for (const x of [24, 34]) bloque("#9aa5b1", x, 85.9, 1.8, 1.0, 0, 2.6);
  cartel("TRANSFORMADOR\nNº 2", 34, 85.39, 1.9, 0.9, 0.4, "-y", "#2e86de", "#ffffff");
  caja("#f2c94c", 24, 85.1, 36, 85.16, 0.95, 1.0); for (let x = 24; x <= 36; x += 1.5) caja("#f2c94c", x, 85.1, x + 0.06, 85.16, 0, 1.0);
  // transportador de rodillos dentro de jaula amarilla (pt 15)
  for (let x = 104; x < 124; x += 0.35) cil("#9aa5b1", x, 84.3, 0.35, 1.0, 0.05, "y");
  caja("#7f8a95", 104, 83.75, 124, 83.82, 0, 0.35); caja("#7f8a95", 104, 84.78, 124, 84.85, 0, 0.35);
  for (const x of [114, 117]) {
    for (const [a, b] of [[83.3, 83.36], [85.24, 85.3]]) caja("#f2b705", x, a, x + 0.06, b, 0, 2.6);
    caja("#f2b705", x, 83.3, x + 0.06, 85.3, 2.55, 2.6);
  }
  caja("#f2b705", 114, 83.3, 117, 83.32, 0.1, 2.6, { clave: "mallaA", transparente: 0.25 });
  caja("#f2b705", 114, 85.28, 117, 85.3, 0.1, 2.6, { clave: "mallaA", transparente: 0.25 });
  cartel("ÁREA\nRESTRINGIDA", 115.5, 83.29, 1.8, 0.6, 0.4, "+y", "#f2c94c", "#111111");
  // racks de piezas de pickup, pallets, cajas, tambores, conos, pizarra, carros (pts 12–20)
  for (const x of [212, 216.5, 221]) {
    for (const [dy] of [[0]]) {
      const y = 82.55 + dy;
      for (const sx of [0, 4]) for (const sy of [0, 0.9]) bloque("#4a5462", x + sx - 2, y + sy, 0.08, 0.08, 0, 2.2);
      for (const z of [0.15, 0.85, 1.55, 2.15]) bloque("#4a5462", x, y + 0.45, 4.0, 0.9, z, z + 0.06);
      for (let k = 0; k < 6; k++) bloque(elegir(ECOAT), x - 1.6 + k * 0.6, y + 0.45, 0.5, 0.75, 0.25 + (k % 3) * 0.7, 0.75 + (k % 3) * 0.7);
    }
  }
  for (const x of [52, 236.5, 238.2, 239.9]) { bloque("#b08a5a", x, 85.6, 1.2, 1.0, 0, 0.14); bloque("#c8a774", x, 85.6, 1.15, 0.95, 0.14, entre(0.6, 1.1)); }
  for (let k = 0; k < 3; k++) cil(k === 1 ? "#1f5fa8" : "#2e8b57", 50 + k * 0.62, 83.0, 0, 0.9, 0.29);
  for (const x of [118.8, 195.5]) { cil("#e67e22", x, 85.8, 0, 0.7, 0.16); bloque("#e67e22", x, 85.8, 0.38, 0.38, 0, 0.04); }
  bloque("#ffffff", 190, 85.9, 1.6, 0.05, 0.9, 2.0); bloque("#7d858d", 190, 85.9, 1.7, 0.08, 0, 0.9);   // pizarra (pt 16)
  for (const x of [62, 140]) { bloque("#e67e22", x, 83.2, 1.2, 0.7, 0.3, 0.38); for (const [dx, dy] of [[-0.5, -0.3], [0.5, -0.3], [-0.5, 0.3], [0.5, 0.3]]) cil("#2b2f33", x + dx, 83.2 + dy, 0, 0.3, 0.08); }
  // carrocerías scrap sobre skids (pts 19–20) + cajas de pickup estacionadas en S (pts 2–4)
  for (const x of [226, 232]) { skid(x, 84.3, 0, true); pickup(x, 84.3, 0.3, true, false); }
  for (const x of [26, 44, 52, 92, 140]) { skid(x, 101.6, 0, true); pickup(x - 1, 101.6, 0.3, true, true); pickup(x + 1.4, 101.6, 0.3, true, true); }
  // jaula de madera/naranja (pt 1)
  bloque("#e67e22", 10, 98.9, 1.4, 1.0, 0, 0.9, { clave: "mallaN", transparente: 0.6 });

  // ============================================================= 6) LÍNEA DE SELLADO (lado oeste de la calle T)
  // fotos pts 22–30: la línea va casi a nivel de piso (piso claro con líneas azules); se baja 0,5 m todo el bloque
  pinta("#e8e4d6", X0, 73.6, X1, 79.15, 0.015);
  for (let x = X0; x < X1; x += 6.5) pinta("#2c4f8f", x, 73.7, x + 0.08, 79.0, 0.03);
  pinta("#2c4f8f", X0, 78.95, X1, 79.03, 0.03); pinta("#2c4f8f", X0, 74.2, X1, 74.28, 0.03);
  for (let i = 0; i < 40; i++) { const x = entre(X0, X1), y = entre(74, 78.8); pinta("#7fb38f", x, y, x + entre(0.3, 1.2), y + entre(0.2, 0.6), 0.02); }
  dz = -0.5;
  // plataforma baja blanca con borde amarillo/negro y baranda amarilla
  caja("#e9edf1", X0, 73.8, X1, 79.1, 0.8, 0.9);
  caja("#5b6570", X0, 78.9, X1, 79.1, 0, 0.8);
  for (let x = X0, k = 0; x < X1; x += 0.4, k++) caja(k % 2 ? "#1f2328" : "#f2c94c", x, 78.95, x + 0.4, 79.12, 0.6, 0.9);
  for (let x = X0; x < X1; x += 2) caja("#f2c94c", x, 79.0, x + 0.05, 79.05, 0.9, 1.95);
  caja("#f2c94c", X0, 79.0, X1, 79.05, 1.9, 1.95); caja("#f2c94c", X0, 79.0, X1, 79.05, 1.4, 1.44);
  // transportador de rodillos al centro de la plataforma + carrocerías sobre skids cada 6,5 m
  caja("#7f8a95", X0, 75.9, X1, 75.98, 0.9, 1.2); caja("#7f8a95", X0, 76.9, X1, 76.98, 0.9, 1.2);
  // pórticos/postes azules de la línea y estructura aérea (perchas, mangueras)
  for (let x = X0; x < X1; x += 6) {
    for (const y of [74.0, 78.8]) caja("#23395d", x - 0.1, y - 0.1, x + 0.1, y + 0.1, 0.9, 5.2);
    caja("#23395d", x - 0.08, 74.0, x + 0.08, 78.8, 5.0, 5.2);
    caja("#e67e22", x - 0.04, 76.3, x + 0.04, 76.6, 3.4, 5.0);   // bajada de manguera de sellador
    cil("#2b2f33", x, 76.45, 3.0, 0.4, 0.07);
  }
  caja("#e67e22", X0, 74.0, X1, 74.15, 4.6, 4.75); caja("#e67e22", X0, 78.65, X1, 78.8, 4.6, 4.75);
  // cabinas vidriadas de sellado (pt 22: x 30–42) y celdas con reja amarilla (pts 21, 24)
  for (const [a, b] of [[28, 42], [150, 160]]) {
    caja("#dfe8ef", a, 73.9, b, 79.0, 0.9, 4.0, { clave: "vidrio2", transparente: 0.35 });
    for (let x = a; x <= b; x += 1.4) caja("#1f2a3a", x, 78.95, x + 0.06, 79.05, 0.9, 4.0);
    caja("#1f2a3a", a, 73.9, b, 79.05, 3.95, 4.05);
    caja("#f2c94c", (a + b) / 2 - 0.15, 79.05, (a + b) / 2 + 0.15, 79.1, 0.9, 3.0);
    for (let z = 1.0, k = 0; z < 3.0; z += 0.25, k++) caja(k % 2 ? "#1f2328" : "#f2c94c", (a + b) / 2 - 0.16, 79.1, (a + b) / 2 + 0.16, 79.12, z, z + 0.25);
  }
  for (const [a, b] of [[44, 56]]) {
    caja("#e3a800", a, 78.95, b, 79.0, 0.9, 2.9, { clave: "mallaA", transparente: 0.25 });
    for (let x = a; x <= b; x += 2.4) caja("#e3a800", x, 78.93, x + 0.07, 79.02, 0.9, 2.9);
    caja("#e3a800", a, 78.93, b, 79.02, 2.85, 2.92);
  }
  dz = 0;
  // operarios en la línea (pts 27–29) y uno caminando por T
  for (const x of [162, 171, 178, 196, 204, 213, 221, 240]) persona(x, entre(74.6, 78.3), 0, azar() < 0.15, 0.4);
  for (const x of [44, 182]) persona(x, 80.9, 0, true);
  // ventiladores de pie y carro de herramientas rojo (pts 23, 25)
  for (const x of [110, 168, 230]) { bloque("#7d858d", x, 79.5, 0.06, 0.06, 0, 1.5); cil("#2b2f33", x, 79.5, 1.3, 0.12, 0.35, "y"); }
  bloque("#c0392b", 66, 80.0, 0.9, 0.5, 0.15, 1.0); for (const z of [0.4, 0.65]) bloque("#8f2a20", 66, 80.0, 0.88, 0.52, z, z + 0.02);


  // ============================================================= 7) REFINAMIENTO PUNTO POR PUNTO (fotos en alta, 08/10)
  // 7a. Paredes plateadas de las cubas (aislación) entre columnas azules muy juntas, lado S y lado ST (pts 3, 4, 12)
  for (const [yb, cara] of [[98.12, -1], [86.72, +1]]) {
    caja("#c9ced3", 12, yb - 0.05, 205, yb + 0.05, 1.0, 7.0);
    for (const z of [2.6, 4.2, 5.8]) caja("#aab1b8", 12, yb + cara * 0.06, 205, yb + cara * 0.08, z, z + 0.05);
    for (let x = 12; x <= 205; x += 1.5) caja("#22346a", x - 0.09, yb + cara * 0.06, x + 0.09, yb + cara * 0.3, 0.0, 7.4);
    caja("#f2c94c", 12, yb + cara * 0.05, 205, yb + cara * 0.32, 0.82, 1.0);     // viga amarilla de apoyo
    caja("#e67e22", 12, yb + cara * 0.05, 205, yb + cara * 0.28, 0.52, 0.72);    // viga naranja inferior
    for (let x = 13; x < 205; x += entre(4, 9)) caja("#d6a7a0", x, yb + cara * 0.055, x + entre(0.6, 2), yb + cara * 0.06, entre(1.2, 3), entre(3.2, 6));  // chorreaduras rojizas (pt 4)
  }
  // 7b. Caños "cuello de ganso" que bajan de las cubas a la rejilla (pts 4, 6)
  for (let x = 13.2; x < 205; x += 3) {
    cil("#a5adb5", x, 98.45, 0.45, 3.2, 0.07);
    cil("#a5adb5", x, 98.75, 0.42, 0.65, 0.07, "y");
    cil("#3f6fb5", x, 98.45, 1.6, 0.12, 0.1);   // válvula azul
  }
  // 7c. Área de acopio al sur de las cubas (pts 9–10): piso verde claro, cajones, carros, cortina plástica, tanque rojo
  pinta("#cfe1cf", 205, 86.6, 262, 98.2, 0.022);
  for (const x of [207, 211, 215, 219, 223]) { bloque("#b08a5a", x, 97.0, 1.6, 1.2, 0, 1.3); bloque("#8f6b3f", x, 97.0, 1.62, 1.22, 0, 0.15); }
  for (const x of [226, 230, 234]) { bloque("#d9dfe5", x, 97.1, 1.4, 1.0, 0, 1.1, { clave: "film", transparente: 0.7 }); bloque("#8f6b3f", x, 97.1, 1.42, 1.02, 0, 0.14); }
  caja("#dfe8ef", 208, 92.0, 250, 92.05, 0, 4.2, { clave: "cortina", transparente: 0.4 });
  for (const x of [212, 220, 228]) {   // carros naranjas con herramientas
    bloque("#e67e22", x, 93.2, 1.4, 0.8, 0.15, 0.2); bloque("#e67e22", x, 93.2, 1.4, 0.8, 1.6, 1.65);
    for (const [dx, dy] of [[-0.68, -0.38], [0.68, -0.38], [-0.68, 0.38], [0.68, 0.38]]) { bloque("#e67e22", x + dx, 93.2 + dy, 0.05, 0.05, 0.15, 1.65); cil("#2b2f33", x + dx, 93.2 + dy, 0, 0.15, 0.07); }
    for (let k = 0; k < 6; k++) bloque("#7d858d", x - 0.6 + k * 0.24, 93.2, 0.04, 0.5, 0.6, 1.5);
  }
  for (const x of [216, 222]) bloque("#1f5fa8", x, 94.5, 0.6, 0.4, 0, 0.3);
  bloque("#c0392b", 224, 94.5, 0.6, 0.4, 0, 0.25);
  cil("#c0392b", 214, 97.6, 0, 3.6, 0.38);   // tanque rojo vertical (pt 10)
  // transportador de cadena inclinado dentro de malla amarilla (pt 9)
  for (let i = 0; i < 24; i++) { const s = i / 24; bloque("#8e99a6", 214 + s * 6, 96.0, 0.3, 0.9, s * 4.8, s * 4.8 + 0.2); }
  caja("#e3a800", 213, 95.3, 220, 95.33, 0, 2.2, { clave: "mallaA", transparente: 0.25 }); caja("#e3a800", 213, 96.67, 220, 96.7, 0, 2.2, { clave: "mallaA", transparente: 0.25 });
  for (const x of [213, 216.5, 220]) { caja("#e3a800", x, 95.3, x + 0.06, 95.36, 0, 2.2); caja("#e3a800", x, 96.64, x + 0.06, 96.7, 0, 2.2); }
  // 7d. Bombas verticales con motor azul y caños verdes contra la pared A (pt 6 atrás)
  for (const x of [62, 64.5, 67]) {
    bloque("#5d6672", x, 102.9, 0.9, 0.9, 0, 0.2);
    cil("#3c8a5a", x, 102.9, 0.2, 1.1, 0.16);
    cil("#1f5fa8", x, 102.9, 1.3, 0.8, 0.28);
    cil("#3c8a5a", x + 0.5, 103.1, 0, 7.5, 0.1);
  }
  // 7e. Fila de tableros eléctricos con ventiladores (pt 2 atrás) y número de máquina
  for (let x = 35.4, k = 0; x < 45; x += 1.25, k++) {
    tablero(x, 103.55, +1, 1.2, k === 2 ? 4 : (k === 5 ? 73 : null));
    if (k % 2 === 0) for (const dx of [-0.25, 0.25]) cil("#59616b", x + dx, 103.0, 1.85, 0.04, 0.17, "y");
  }
  // 7f. Tambor de grasa azul con tapa roja y bomba (pt 2) + cajón de madera con trapos (pt 2 atrás)
  cil("#1f5fa8", 46.5, 99.0, 0, 0.88, 0.29); cil("#c0392b", 46.5, 99.0, 0.88, 0.05, 0.3); cil("#c0392b", 46.5, 99.0, 0.93, 0.5, 0.06);
  bloque("#c8a774", 40.5, 100.6, 1.2, 1.0, 0, 0.8); bloque("#eef1f4", 40.5, 100.6, 1.0, 0.8, 0.8, 1.05);
  // 7g. Abertura al lavadero (pt 5 izquierda): vano en la pared y lavarropas industriales amarillos detrás
  caja("#2b2f33", 121, 103.5, 124, 103.58, 0, 2.6);
  for (const x of [121.4, 122.6, 123.8]) { bloque("#f2c94c", x, 105.0, 1.0, 1.0, 0, 1.3); cil("#6f7a86", x, 104.5, 0.7, 0.04, 0.32, "y"); }
  // 7h. Calle entre S y T: columnas del entrepiso de cota 5 en plena calle, piso pintado verde, bidones (pt 12)
  for (let x = 6; x < 202; x += 6) { caja("#23395d", x - 0.1, 84.8, x + 0.1, 85.0, 0, 5.4); caja("#aeb6be", x - 0.16, 84.76, x + 0.16, 85.04, 1.6, 1.85); }
  pinta("#3f8f63", 30, 82.25, 64, 86.3, 0.035);
  for (const x of [47.5, 48.1]) bloque("#eef1f4", x, 82.35, 0.3, 0.2, 0, 0.42);
  bloque("#b08a5a", 54, 82.6, 1.2, 0.8, 0, 0.14); bloque("#a87d4b", 58, 82.3, 0.15, 1.2, 0, 1.0);
  // 7i. Calle T: zócalo azul más alto (2,8 m), aerotermos colgados junto a cada columna, conducto vertical (pts 22–25)
  caja("#5b7fb3", X0, 81.58, X1, 81.64, 2.0, 2.8);
  caja("#f3f5f7", X0, 81.58, X1, 81.64, 2.8, 3.4);
  for (const c of COL_B.filter(c => c[2] > 0.6)) {
    bloque("#aeb4ba", c[0] - 0.9, 81.2, 0.75, 0.6, 4.4, 5.1);
    for (let z = 4.5; z < 5.05; z += 0.08) bloque("#6f7780", c[0] - 0.9, 80.89, 0.65, 0.02, z, z + 0.03);
    cil("#cfd5db", c[0] - 0.9, 81.25, 5.1, 2.5, 0.2);
  }
  // columna con franjas amarillo/negro y puerta vidriada verde en la cabina (pt 22)
  for (let z = 0, k = 0; z < 2.4; z += 0.3, k++) caja(k % 2 ? "#1f2328" : "#f2c94c", 35.6, 78.9, 36.2, 79.25, z, z + 0.3);
  caja("#1e7a4f", 37, 79.1, 38.6, 79.16, 0, 2.3); caja("#dfe8ef", 37.15, 79.17, 38.45, 79.18, 0.4, 2.1, { clave: "vidrio2", transparente: 0.35 });
  // herramientas neumáticas colgando de balanceadores (pt 22): manguera + herramienta
  for (let x = 8; x < 140; x += 6) { cil("#2b2f33", x + 1.5, 78.5, 1.0, 2.6, 0.03); bloque("#3b7dd8", x + 1.5, 78.5, 0.2, 0.25, 0.9, 1.25); }


  // ============================================================= 8) CALLE ENTRE S Y T – extremo norte y punto 15 (fotos en alta)
  // portón amarillo grande al norte (pt 11 atrás), con mirillas
  caja("#e9b10a", -0.7, 82.4, -0.3, 86.2, 0, 4.6);
  for (const y of [83.0, 83.6, 84.2]) for (const z of [1.5, 2.2]) caja("#2b2f33", -0.75, y, -0.72, y + 0.4, z, z + 0.3);
  // espejo convexo en la columna B01
  cil("#c9d6e3", 12.0, 82.45, 2.2, 0.06, 0.32, "y"); cil("#f2c94c", 12.0, 82.42, 2.2, 0.04, 0.36, "y");
  // cabina eléctrica SECAT y transformador Nº 2 con bolardos amarillo/negro y marca roja en el piso
  bloque("#c3c8cd", 5.0, 85.6, 3.2, 1.3, 0, 2.9);
  bloque("#c3c8cd", 8.6, 85.6, 2.6, 1.3, 0, 2.9);
  cartel("CABINA\nELÉCTRICA\nSECAT", 4.2, 84.93, 2.4, 0.7, 0.8, "-y", "#2e86de", "#ffffff");
  cartel("TRANSFORMADOR\nNº 2", 8.6, 84.93, 2.4, 0.9, 0.5, "-y", "#2e86de", "#ffffff");
  cartel("⚠ PELIGRO\nALTA TENSIÓN", 6.6, 84.93, 1.6, 0.6, 0.5, "-y", "#f2c94c", "#111111");
  for (const x of [3.6, 6.6, 9.6]) for (let z = 0, k = 0; z < 1.1; z += 0.22, k++) bloque(k % 2 ? "#1f2328" : "#f2c94c", x, 84.6, 0.16, 0.16, z, z + 0.22);
  for (const [a, b, c, d] of [[2.4, 84.2, 10.6, 84.28], [2.4, 84.2, 2.48, 86.3], [10.52, 84.2, 10.6, 86.3]]) pinta("#c0392b", a, b, c, d, 0.05);
  // cartel colgante "ZONA DE SCRAP" y carros amarillos para carrocerías (pt 11 frente)
  cartel("ZONA DE SCRAP", 30, 84.3, 3.4, 1.0, 0.35, "+x", "#ffffff", "#1f2a3a", true);
  for (const x of [36, 39]) {
    bloque("#e9b10a", x, 85.7, 2.0, 0.9, 0.3, 0.38);
    for (const [dx, dy] of [[-0.95, -0.4], [0.95, -0.4], [-0.95, 0.4], [0.95, 0.4]]) { bloque("#e9b10a", x + dx, 85.7 + dy, 0.06, 0.06, 0.3, 1.2); cil("#2b2f33", x + dx, 85.7 + dy, 0, 0.3, 0.09); }
    for (let k = 0; k < 4; k++) cil("#2e8b57", x - 0.7 + k * 0.45, 85.7, 0.9, 0.9, 0.035, "y");
  }
  // punto 15: puerta corrediza verde hacia la línea de sellado (pared B, lado ST)
  caja("#22834f", 121, 82.0, 123.6, 82.08, 0, 2.6); caja("#dfe8ef", 121.3, 82.09, 122.1, 82.1, 1.3, 1.9, { clave: "vidrio2", transparente: 0.35 });
  cartel("HIDRANTE", 120.3, 82.1, 2.9, 0.6, 0.18, "+y", "#c0392b", "#ffffff");
  cartel("ACCESO\nRESTRINGIDO\nSOLO PERSONAL\nAUTORIZADO", 117.8, 83.3, 0.7, 0.45, 0.6, "+y", "#ffffff", "#c0392b");
  cartel("PRECAUCIÓN\nESCALERAS", 118.6, 83.3, 0.7, 0.5, 0.45, "+y", "#2ecc71", "#ffffff");
  // segundo transportador inclinado (cadena) entrando bajo las cubas (pt 15 izquierda)
  for (let i = 0; i < 24; i++) { const s = i / 24; bloque("#8e99a6", 122 + s * 6, 87.6, 0.3, 0.9, s * 4.6, s * 4.6 + 0.2); }
  for (const x of [121.5, 128.5]) caja("#f2c94c", x, 86.9, x + 0.12, 88.3, 0, 1.2);
  caja("#f2c94c", 121.5, 86.9, 128.6, 87.0, 1.1, 1.2); caja("#f2c94c", 121.5, 88.2, 128.6, 88.3, 1.1, 1.2);
  // tolvas grises bajo las cubas (pt 15): cajas escalonadas que se angostan hacia abajo
  for (const x of [112, 116, 120]) for (let k = 0; k < 5; k++) { const w = 2.2 - k * 0.38; bloque("#a7afb7", x, 90.0, w, w, 4.2 - k * 0.35, 4.55 - k * 0.35); }
  // conos naranjas y caballetes con piezas (pt 15 frente)
  for (const x of [129, 130.2]) { cil("#e67e22", x, 82.5, 0, 0.7, 0.15); bloque("#e67e22", x, 82.5, 0.36, 0.36, 0, 0.04); }
  for (const x of [132, 135, 138]) { bloque("#6b3b2a", x, 83.2, 2.4, 0.08, 0.6, 0.66); for (const dx of [-1.1, 1.1]) bloque("#6b3b2a", x + dx, 83.2, 0.08, 0.6, 0, 0.66); }


  // ============================================================= 9) CALLE T – puntos 25 y 30 (fotos en alta)
  // pt 25: vano grande en la pared B hacia el lado este, con marco verde/amarillo y cebra en el piso
  caja("#2b2f33", 145.0, 81.56, 149.5, 81.66, 0, 3.0);
  caja("#1e7a4f", 144.8, 81.4, 145.0, 81.7, 0, 3.1); caja("#e9b10a", 149.5, 81.4, 149.7, 81.7, 0, 3.1);
  cartel("⚠ ATENCIÓN", 146.0, 81.38, 3.4, 0.5, 0.7, "-y", "#f2c94c", "#111111");
  for (let k = 0; k < 4; k++) pinta("#ffffff", 145.2 + k * 1.1, 79.5, 145.7 + k * 1.1, 81.3, 0.06);
  // pt 25: gigantografía colgada sobre la línea (afiche de seguridad/familia)
  cartel("👨‍👩‍👧 VOLVÉ SANO\nA CASA", 150, 76.5, 6.0, 3.0, 2.0, "+y", "#3a7a43", "#ffffff", true);
  // pt 25: transportador aéreo (power & free) con perchas naranjas sobre la línea
  caja("#9aa5b1", X0, 76.35, X1, 76.55, 6.6, 6.75);
  for (let x = X0 + 1; x < X1; x += 1.5) caja("#e67e22", x, 76.4, x + 0.05, 76.5, 5.9, 6.6);
  // pt 25: pupitres de operador con luz verde junto a la línea
  for (const x of [140, 166, 192, 218]) { bloque("#dfe3e7", x, 79.25, 0.6, 0.5, 0, 1.2); bloque("#c5cbd1", x, 79.25, 0.66, 0.56, 1.2, 1.35); cil("#2ecc71", x + 0.2, 79.1, 1.35, 0.12, 0.05); }
  // pt 25: escalera amarilla a pasarela sobre la línea + pasarela
  escalera(178, 78.4, -1, 2.6, "#f2c94c");
  caja("#8e99a6", 180.4, 74.2, 196, 79.0, 2.45, 2.6);
  for (const y of [74.2, 79.0]) { caja("#f2c94c", 180.4, y - 0.03, 196, y + 0.03, 3.5, 3.56); for (let x = 180.4; x <= 196; x += 1.5) caja("#f2c94c", x, y - 0.03, x + 0.05, y + 0.03, 2.6, 3.56); }
  // pt 30: rampa/contenedor azul basculante sobre estructura amarilla (fin de línea)
  bloque("#2c6aa0", 252, 77.5, 4.0, 3.0, 1.2, 2.6);
  for (const [dx, dy] of [[-1.8, -1.3], [1.8, -1.3], [-1.8, 1.3], [1.8, 1.3]]) bloque("#f2c94c", 252 + dx, 77.5 + dy, 0.12, 0.12, 0, 1.2);
  bloque("#f2c94c", 252, 79.15, 4.0, 0.25, 1.0, 1.2);
  // pt 30: rayado peatonal amarillo/negro a 45° junto a la pared + cebra corta (dos tramos)
  for (const x0 of [236, 254]) for (let k = 0; k < 10; k++) pinta(k % 2 ? "#1f2328" : "#f2c94c", x0 + k * 0.32, 80.9, x0 + k * 0.32 + 0.32, 81.5, 0.065);
  // pt 30: afiches verde, rojo y azul ("soy azul") en la pared
  cartel("♻\nRECICLÁ", 228.0, 81.57, 1.6, 0.7, 1.3, "-y", "#3a8f4f", "#ffffff");
  cartel("✋\nCUIDATE", 229.2, 81.57, 1.6, 0.7, 1.3, "-y", "#c0392b", "#ffffff");
  cartel("soy\nazul", 230.5, 81.57, 1.6, 0.9, 1.4, "-y", "#1f4fb4", "#ffffff");
  // pt 30: cartel "VÍA DE ESCAPE" verde al fondo y portón azul del extremo sur
  cartel("↑ VÍA DE\nESCAPE", 262, 80.4, 3.0, 0.9, 0.5, "-x", "#1e8449", "#ffffff");
  caja("#23395d", 263.3, 79.3, 263.5, 81.5, 0, 3.0);
  // pt 30: piso blanco de la línea con franjas amarillo/negro de borde
  for (let x = 236, k = 0; x < 262; x += 0.35, k++) pinta(k % 2 ? "#1f2328" : "#f2c94c", x, 78.85, x + 0.35, 78.98, 0.04);


  // ============================================================= 10) CALLE S – puntos 7 y 8 (fotos en alta)
  // pt 7: puerta amarilla "CABINA COMANDOS ELÉCTRICOS / CABINA ELÉCTRICA SEP1" con rejas de ventilación a ambos lados
  caja("#e9b10a", 77.2, 103.5, 78.6, 103.56, 0, 2.3);
  caja("#dfe8ef", 77.5, 103.48, 78.3, 103.49, 1.5, 1.95, { clave: "vidrio2", transparente: 0.35 });
  cartel("CABINA\nCOMANDOS ELÉCTRICOS", 77.9, 103.47, 2.85, 1.3, 0.55, "-y", "#ffffff", "#1f2a3a");
  cartel("CABINA\nELÉCTRICA\nSEP1", 77.9, 103.47, 1.3, 0.5, 0.45, "-y", "#2e86de", "#ffffff");
  for (const x of [75.2, 80.0]) { caja("#23395d", x, 103.48, x + 1.6, 103.52, 0.55, 1.75); for (let z = 0.65; z < 1.7; z += 0.12) caja("#e9d9a8", x + 0.1, 103.46, x + 1.5, 103.47, z, z + 0.06, { clave: "luz", emisivo: true }); }
  cartel("HIDRANTE", 82.5, 103.47, 3.2, 0.7, 0.2, "-y", "#c0392b", "#ffffff");
  // pt 7: bomba con motor azul sobre la plataforma y caño verde que baja en "S" hasta la rejilla
  cil("#1f5fa8", 74.5, 96.8, 2.0, 0.8, 0.3, "x"); bloque("#5d6672", 74.5, 96.8, 1.4, 0.6, 1.6, 1.8);
  cil("#3c8a5a", 76.5, 98.3, 0.3, 8.0, 0.12); cil("#3c8a5a", 76.5, 98.6, 0.25, 0.6, 0.12, "y");
  // pt 7: escalera metálica gris con baranda amarilla subiendo a la plataforma
  escalera(72.0, 97.6, -1, 1.6, "#f2c94c");
  // pt 8: equipo "SKID 2 – DESENGRASE 2 INMERSIÓN": filtro rojo, motores, válvulas azules, caños verde-agua
  cil("#c0392b", 88.0, 96.6, 1.6, 1.6, 0.45); for (let k = 0; k < 8; k++) cil("#8f2a20", 88.0, 96.6, 1.7 + k * 0.18, 0.04, 0.47);
  for (const x of [90.5, 92.5]) { cil("#1f5fa8", x, 96.8, 2.0, 0.7, 0.28, "x"); bloque("#5d6672", x, 96.8, 1.3, 0.6, 1.6, 1.75); }
  for (const x of [86, 94]) cil("#2aa198", x, 97.6, 0, 7.2, 0.13);
  for (const x of [89.3, 91.6]) cil("#2c6fb0", x, 97.2, 2.1, 0.2, 0.18, "y");
  cartel("SKID 2\nDESENGRASE 2\nINMERSIÓN", 84.0, 98.0, 1.4, 0.8, 0.6, "+y", "#f2c94c", "#111111");
  // pt 8: puerta doble verde de emergencia con barras antipánico y cartel "EMPUJE – UNIDAD PINTURA"
  caja("#2ea84f", 101.0, 103.5, 103.6, 103.56, 0, 2.5);
  caja("#ffffff", 101.2, 103.48, 102.1, 103.49, 1.4, 2.1); caja("#ffffff", 102.5, 103.48, 103.4, 103.49, 1.4, 2.1);
  caja("#c0392b", 101.2, 103.46, 103.4, 103.48, 1.0, 1.05);
  caja("#e9f2ff", 101.0, 103.3, 103.6, 103.42, 2.6, 2.72, { clave: "luz", emisivo: true });
  cartel("SALIDA DE\nEMERGENCIA ↓", 102.3, 103.47, 3.2, 1.1, 0.55, "-y", "#ffffff", "#1e8449");
  cartel("EMPUJE\nUNIDAD PINTURA", 103.1, 103.47, 1.25, 0.4, 0.3, "-y", "#ffffff", "#c0392b");
  // pt 8: columna A con pintura saltada (parche gris)
  caja("#9aa3ad", 107.8, 103.62, 108.25, 103.63, 0.2, 1.1);
  // pt 8: tablero gris alto contra la pared al sur y cajón negro en la rejilla
  bloque("#c9cdd1", 112.0, 103.2, 0.8, 0.5, 0, 2.3);
  bloque("#2b2f33", 115.0, 99.0, 1.6, 0.9, 0, 1.0);


  // ============================================================= 11) CALLE ENTRE S Y T – puntos 13 y 14 (fotos en alta)
  // pt 13: zona delimitada con cinta roja/blanca, zorras hidráulicas rojas, tambores Petronas, bolsas
  for (let x = 66; x < 82; x += 0.5) caja(((x * 2) | 0) % 2 ? "#ffffff" : "#c0392b", x, 84.2, x + 0.5, 84.22, 0.9, 0.95);
  for (const x of [68, 72]) {
    bloque("#c0392b", x, 85.4, 1.2, 0.55, 0.06, 0.14);
    for (const dy of [-0.18, 0.18]) bloque("#b03a2e", x - 0.3, 85.4 + dy, 1.6, 0.16, 0.0, 0.08);
    bloque("#c0392b", x + 0.7, 85.4, 0.1, 0.1, 0.14, 1.2); bloque("#2b2f33", x + 0.7, 85.4, 0.1, 0.5, 1.15, 1.22);
  }
  for (let k = 0; k < 3; k++) { cil("#1aa088", 76 + k * 0.62, 85.8, 0, 0.9, 0.29); cartel("PETRONAS", 76 + k * 0.62, 85.5, 0.5, 0.45, 0.18, "-y", "#1aa088", "#ffffff"); }
  bloque("#e8c27a", 78.5, 85.2, 0.8, 0.7, 0, 0.9, { clave: "film", transparente: 0.7 });
  // pt 13: puerta verde abierta y carteles ISCOT / "Lavadora hombre a bordo" en la pared B
  caja("#1e7a4f", 56.0, 82.05, 56.06, 83.2, 0, 2.3);
  cartel("LAVADORA HOMBRE\nA BORDO", 75.2, 82.08, 1.9, 0.7, 0.25, "+y", "#ffffff", "#1f2a3a");
  cartel("ISCOT\nRECOMENDACIONES\nDE USO Y\nMANTENIMIENTO", 75.2, 82.08, 1.3, 0.6, 0.85, "+y", "#ffffff", "#1f2a3a");
  cartel("USO\nOBLIGATORIO\nGUANTES", 77.5, 82.08, 1.6, 0.35, 0.45, "+y", "#1f4fb4", "#ffffff");
  // pt 13: volquete metálico con orejas de izaje
  bloque("#4a5462", 79.5, 82.9, 1.6, 1.0, 0.1, 0.9); for (const dx of [-0.6, 0.6]) cil("#4a5462", 79.5 + dx, 82.4, 0.95, 0.05, 0.12, "y");
  // pt 13: grupos de bombas con filtros bajo las cubas (izquierda), en gris acero
  for (const x of [70, 74, 78]) {
    cil("#a7afb7", x, 88.2, 0.3, 1.6, 0.35); cil("#a7afb7", x + 1.0, 88.2, 0.3, 1.6, 0.35);
    cil("#a7afb7", x + 1.8, 88.4, 0.35, 0.8, 0.25, "x"); bloque("#7d858d", x + 1.0, 88.3, 3.4, 1.2, 0, 0.3);
    for (const dx of [0, 1.0]) cil("#7d858d", x + dx, 87.8, 1.5, 0.05, 0.22, "y");   // volantes de válvulas
  }
  // pt 14: tablero gris con tomas industriales azul/roja, termotanque y cañería, cajones con piezas
  bloque("#d5d9dd", 98.6, 82.25, 0.7, 0.4, 0, 2.2);
  bloque("#eef1f4", 99.6, 82.12, 0.45, 0.15, 1.3, 1.8);
  cil("#1f5fa8", 99.5, 82.03, 1.4, 0.05, 0.06, "y"); cil("#c0392b", 99.7, 82.03, 1.4, 0.05, 0.06, "y");
  cil("#9aa1a8", 101.6, 82.45, 0, 1.4, 0.32); cil("#7d858d", 101.6, 82.45, 1.4, 0.5, 0.05);
  caja("#7d858d", 100.5, 82.15, 101.6, 82.2, 1.85, 1.9);
  for (const x of [92, 94]) { bloque("#c8a774", x, 85.8, 1.4, 1.0, 0, 0.8); for (let k = 0; k < 4; k++) bloque("#2b2f33", x - 0.4 + k * 0.28, 85.8, 0.2, 0.6, 0.8, 1.05); }
  // pt 14: carro de herramientas rojo (Bahco), tanque blanco grande con soporte, bomba de trasvase
  bloque("#c0392b", 106.0, 82.6, 0.75, 0.5, 0.1, 1.1); for (let z = 0.3; z < 1.05; z += 0.17) bloque("#8f2a20", 106.0, 82.34, 0.7, 0.02, z, z + 0.02);
  cil("#2b2f33", 105.7, 82.6, 0, 0.1, 0.06); cil("#2b2f33", 106.3, 82.6, 0, 0.1, 0.06);
  cil("#f4f6f8", 107.6, 82.9, 0.35, 1.6, 0.5); bloque("#4a5462", 107.6, 82.9, 1.1, 1.1, 0, 0.35);
  cartel("TANQUE C...", 107.6, 82.39, 1.3, 0.6, 0.15, "-y", "#ffffff", "#1f2a3a");
  // pt 14: carteles de seguridad (verde EPP, acceso restringido) en la baranda de las máquinas
  cartel("SEGURIDAD\nEPP OBLIGATORIO", 103, 86.62, 1.3, 0.55, 0.8, "-y", "#27ae60", "#ffffff");
  cartel("ACCESO\nRESTRINGIDO", 105, 86.62, 0.6, 0.45, 0.55, "-y", "#ffffff", "#c0392b");


  // ============================================================= 12) CALLE ENTRE S Y T – puntos 16 a 18 (fotos en alta)
  // cortinas plásticas: paneles con cintas amarillas colgados de un caño, con pliegues (pts 16–20)
  for (let x = 156; x < 252; x += 2.2) {
    caja("#e4ecf2", x, 86.0 + Math.sin(x) * 0.12, x + 2.1, 86.05 + Math.sin(x) * 0.12, 0, 4.4, { clave: "cortina", transparente: 0.4 });
    caja("#f2c94c", x + 1.0, 85.97, x + 1.06, 85.99, 0.8, 3.8);
  }
  cil("#9aa1a8", 204, 86.0, 4.5, 96, 0.04, "x");
  // tablero de control con baliza verde dentro de la cortina (pt 16)
  bloque("#d5d9dd", 160, 85.6, 0.6, 0.45, 0, 1.6); cil("#2ecc71", 160, 85.6, 1.6, 0.25, 0.06);
  // panel corrugado galvanizado separador (pt 16 atrás)
  caja("#bfc6cc", 162, 85.0, 170, 85.06, 0, 3.4); for (let x = 162; x < 170; x += 0.25) caja("#a6aeb5", x, 84.98, x + 0.08, 85.0, 0, 3.4);
  // pizarra blanca con patas y ruedas (pt 16 frente)
  bloque("#ffffff", 166.5, 83.3, 0.05, 1.5, 0.8, 2.0); bloque("#7d858d", 166.5, 83.3, 0.08, 1.6, 0, 0.8);
  cartel("FINANCIAMIENTO\n— — —  — —\n— —   — — —", 166.47, 83.3, 1.4, 1.4, 1.1, "-x", "#ffffff", "#1f4fb4");
  // rodillera / transportador de rodillos rojo-naranja bajo la cortina, con pupitre (pt 16 izquierda)
  for (let x = 156; x < 176; x += 0.6) cil("#9aa5b1", x, 87.6, 0.55, 1.4, 0.06, "y");
  caja("#e67e22", 156, 86.85, 176, 86.95, 0, 0.55); caja("#e67e22", 156, 88.25, 176, 88.35, 0, 0.55);
  bloque("#dcd8cc", 158.5, 86.6, 0.7, 0.5, 0, 1.3); cil("#2ecc71", 158.5, 86.6, 1.3, 0.3, 0.07);
  for (let k = 0; k < 8; k++) cil(k % 3 ? "#2b2f33" : "#c0392b", 158.25 + (k % 4) * 0.16, 86.34, 1.0 - Math.floor(k / 4) * 0.2, 0.03, 0.04, "y");
  // cadena de seguridad colgando
  for (let z = 0.4; z < 1.4; z += 0.08) cil("#d0d4d8", 177, 86.7, z, 0.06, 0.03);
  // estantería de desechos metálicos con puertas de chapa (pt 16 derecha)
  cartel("DESECHOS\nMETÁLICOS", 170.5, 82.06, 1.5, 0.5, 0.4, "+y", "#ffffff", "#1f2a3a");
  bloque("#5d6672", 170.5, 82.9, 2.2, 1.2, 0, 0.9);
  for (const dx of [-0.7, 0, 0.7]) bloque("#c3c7cb", 170.5 + dx, 82.9, 0.3, 0.05, 0.9, 1.9);
  // escalera verde a la cota 5 (pt 18) con baranda verde
  escalera(194, 82.7, +1, 5.4, "#2e8b57");
  // racks de largueros negros (pt 18 frente, lado pared B)
  for (let x = 196; x < 208; x += 1.0) { bloque("#2b2f33", x, 82.9, 0.08, 1.0, 0, 1.8); for (const z of [0.4, 0.9, 1.4]) bloque("#2b2f33", x, 82.9, 0.9, 1.0, z, z + 0.06); }
  // carrocería tapada con funda blanca sobre skid (pt 18)
  skid(212, 83.4, 0, true); bloque("#f1f3f5", 212, 83.4, 4.4, 1.8, 0.4, 1.9);
  // portón verde y matafuego (pt 18 izquierda / derecha)
  caja("#1e7a4f", 186, 82.03, 189.5, 82.09, 0, 3.0); caja("#ffffff", 186.4, 82.1, 187.4, 82.11, 1.5, 2.1);
  cartel("MATAFUEGO ↓", 203.6, 82.08, 2.6, 0.3, 0.6, "+y", "#ffffff", "#c0392b");
  cil("#d0312d", 203.6, 82.2, 0.8, 0.55, 0.09);


  // ============================================================= 13) CALLE T – puntos 21 y 24 (fotos en alta)
  // pt 21 atrás: extremo norte con ventanales altos, puerta amarilla, espejo convexo y cartel PARE/DETENGA
  caja("#dfe8ef", -0.6, 79.0, -0.55, 81.5, 3.2, 6.5, { clave: "vidrio2", transparente: 0.35 });
  for (const y of [79.0, 79.8, 80.6, 81.4]) caja("#5b6570", -0.62, y, -0.54, y + 0.06, 3.2, 6.5);
  for (const z of [3.2, 4.8, 6.4]) caja("#5b6570", -0.62, 79.0, -0.54, 81.5, z, z + 0.06);
  caja("#e9b10a", 1.0, 81.55, 2.2, 81.62, 0, 2.3); caja("#2b2f33", 1.25, 81.54, 1.95, 81.55, 1.3, 1.9);
  cil("#c9d6e3", 0.5, 79.6, 2.6, 0.05, 0.3, "x");
  for (let k = 0; k < 10; k++) pinta(k % 2 ? "#1f2328" : "#f2c94c", 0.2 + k * 0.3, 79.3, 0.5 + k * 0.3, 79.8, 0.065);
  cartel("PARE\nDETENGA\nSU PASO EN UN\nLUGAR SEGURO", 3.0, 79.15, 1.0, 0.6, 0.9, "+x", "#ffffff", "#c0392b", true);
  // pt 21 derecha: jaula de malla naranja con tambores amarillos de residuos y pallets
  for (const [a, b] of [[3, 14], [16, 26]]) {
    caja("#e3a800", a, 78.95, b, 79.0, 0.0, 2.4, { clave: "mallaN2", transparente: 0.3 });
    for (let x = a; x <= b; x += 1.6) caja("#d98c0a", x, 78.93, x + 0.07, 79.02, 0, 2.4);
    caja("#d98c0a", a, 78.93, b, 79.02, 2.35, 2.42);
  }
  for (const x of [5, 6.4, 8, 18, 19.6]) { cil("#f2c94c", x, 78.0, 0, 0.95, 0.32); cil("#2b2f33", x, 78.0, 0.95, 0.03, 0.33); }
  for (const x of [11, 22]) { bloque("#b08a5a", x, 78.0, 1.2, 1.0, 0, 0.14); }
  // pt 21 frente: contenedor azul de residuos "COLA..." junto a la reja
  bloque("#2a72c4", 28, 78.6, 1.8, 1.0, 0, 1.2); cartel("COLAUTO", 28, 79.11, 1.2, 0.8, 0.2, "+y", "#2a72c4", "#ffffff");
  // pt 21: conducto plateado de extracción que baja en zigzag desde el techo (cada columna)
  for (const c of COL_B.filter(c => c[2] > 0.6 && c[0] < 60)) {
    cil("#cfd5db", c[0] + 1.5, 81.0, 3.4, 3.0, 0.24); cil("#cfd5db", c[0] + 1.5, 80.75, 3.4, 0.5, 0.24, "y");
  }
  // pt 24: pasarela elevada larga con baranda amarilla y escalera sobre la línea (Cronos)
  caja("#e9edf1", 60, 77.4, 100, 79.1, 2.2, 2.32);
  for (let x = 60; x <= 100; x += 3) { caja("#23395d", x, 78.98, x + 0.1, 79.08, 0, 2.2); caja("#f2c94c", x, 79.04, x + 0.05, 79.09, 2.32, 3.35); }
  caja("#f2c94c", 60, 79.04, 100, 79.09, 3.3, 3.36); caja("#f2c94c", 60, 79.04, 100, 79.09, 2.8, 2.84);
  escalera(56.5, 78.4, -1, 2.2, "#f2c94c");
  // pt 24 derecha: reja amarilla alta de la celda con carrocerías Cronos oscuras dentro
  caja("#e3a800", 100, 78.95, 140, 79.0, 0.9, 3.6, { clave: "mallaA", transparente: 0.25 });
  for (let x = 100; x <= 140; x += 2.4) caja("#e3a800", x, 78.93, x + 0.08, 79.03, 0.9, 3.6);
  // pt 24 atrás: tablero con cartel de riesgo eléctrico junto a la reja
  bloque("#d5d9dd", 98, 79.3, 0.6, 0.35, 0, 1.5); cartel("⚡ RIESGO\nELÉCTRICO", 98, 79.12, 1.1, 0.4, 0.3, "-y", "#f2c94c", "#111111");


  // =============================================================================================
  // RELEVAMIENTO 09/10: calles U, mitad T–U, V, W, entre W y X (= X norte del plano), X, A, B y C (fotos pts 31–86).
  // Alineado al DXF (calles B01, recintos A08, transportadores B02/B03, escaleras B23, máquinas C15, grilla de columnas 303).
  // Ubicación por carteles de columna (C02…C20, D05…D20, E10…E22, B01/C01/D01) y por el plano.
  // Medidas, cantidades y colores: ESTIMADOS por foto (supuesto).
  // =============================================================================================
  const BIW = ["#d3d6da", "#c5c9cd", "#dfe2e5", "#b9bec3"];                 // chapa en blanco (sin pintar)
  const PINTADO = ["#f2f2f2", "#16181c", "#1f3f9e", "#8d949b", "#5b2a2a", "#c9ccd0", "#f2f2f2", "#16181c"];
  const SKID_GRIS = "#5d6672";

  // ---- utilidades nuevas
  // barra diagonal (riostras en X, cerchas, escaleras de gato) con cajitas escalonadas
  function diag(color, x0, y0, z0, x1, y1, z1, w) {
    const L = Math.hypot(x1 - x0, y1 - y0, z1 - z0), n = Math.max(2, Math.ceil(L / 0.3));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, dx = Math.abs(x1 - x0) / n, dy = Math.abs(y1 - y0) / n, dzz = Math.abs(z1 - z0) / n;
      const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, z = z0 + (z1 - z0) * t;
      caja(color, x - (w + dx) / 2, y - (w + dy) / 2, x + (w + dx) / 2, y + (w + dy) / 2, z - (w + dzz) / 2, z + (w + dzz) / 2);
    }
  }
  // transportador de rodillos rojo con largueros (fotos U, mitad T–U, calesita)
  function rodillosRojos(x0, x1, y, z, ancho, enX) {
    const a = ancho || 1.3, h = z || 0.45;
    if (enX !== false) {
      caja("#c8462f", x0, y - a / 2, x1, y - a / 2 + 0.12, h - 0.18, h);
      caja("#c8462f", x0, y + a / 2 - 0.12, x1, y + a / 2, h - 0.18, h);
      for (let x = x0; x < x1; x += 1.6) for (const s of [-1, 1]) caja("#9b3524", x, y + s * a / 2 - 0.06, x + 0.1, y + s * a / 2 + 0.06, 0, h - 0.18);
      for (let x = x0 + 0.2; x < x1; x += 0.8) for (const s of [-1, 1]) cil("#e0573c", x, y + s * (a / 2 - 0.06), h - 0.06, 0.16, 0.07, "y");
    } else {
      caja("#c8462f", y - a / 2, x0, y - a / 2 + 0.12, x1, h - 0.18, h);
      caja("#c8462f", y + a / 2 - 0.12, x0, y + a / 2, x1, h - 0.18, h);
      for (let x = x0; x < x1; x += 1.6) for (const s of [-1, 1]) caja("#9b3524", y + s * a / 2 - 0.06, x, y + s * a / 2 + 0.06, x + 0.1, 0, h - 0.18);
      for (let x = x0 + 0.2; x < x1; x += 0.8) for (const s of [-1, 1]) cil("#e0573c", y + s * (a / 2 - 0.06), x, h - 0.06, 0.16, 0.07, "x");
    }
  }
  // baranda amarilla de dos travesaños a lo largo de x (o de y)
  function baranda(x0, x1, y, enX, color, alto) {
    const c = color || "#f2c94c", H = alto || 1.1;
    if (enX !== false) {
      for (let x = x0; x <= x1 + 0.01; x += 2) caja(c, x, y - 0.03, x + 0.06, y + 0.03, 0, H);
      caja(c, x0, y - 0.03, x1, y + 0.03, H - 0.06, H); caja(c, x0, y - 0.03, x1, y + 0.03, H * 0.5, H * 0.5 + 0.05);
    } else {
      for (let x = x0; x <= x1 + 0.01; x += 2) caja(c, y - 0.03, x, y + 0.03, x + 0.06, 0, H);
      caja(c, y - 0.03, x0, y + 0.03, x1, H - 0.06, H); caja(c, y - 0.03, x0, y + 0.03, x1, H * 0.5, H * 0.5 + 0.05);
    }
  }
  // cerco de malla (azul de la calesita, amarillo de jaulas) con postes y tope amarillo al pie
  function cercoMalla(x0, x1, y, enX, color, alto, topes) {
    const H = alto || 2.0, k = "malla" + color;
    if (enX !== false) {
      caja(color, x0, y - 0.015, x1, y + 0.015, 0.1, H, { clave: k, transparente: 0.3 });
      for (let x = x0; x <= x1 + 0.01; x += 2.5) { caja(color, x, y - 0.04, x + 0.06, y + 0.04, 0, H); if (topes) caja("#f2c94c", x - 0.5, y - 0.18, x + 0.5, y + 0.18, 0, 0.18); }
      caja(color, x0, y - 0.03, x1, y + 0.03, H - 0.05, H);
    } else {
      caja(color, y - 0.015, x0, y + 0.015, x1, 0.1, H, { clave: k, transparente: 0.3 });
      for (let x = x0; x <= x1 + 0.01; x += 2.5) { caja(color, y - 0.04, x, y + 0.04, x + 0.06, 0, H); if (topes) caja("#f2c94c", y - 0.18, x - 0.5, y + 0.18, x + 0.5, 0, 0.18); }
      caja(color, y - 0.03, x0, y + 0.03, x1, H - 0.05, H);
    }
  }
  // carro-soporte de carrocería (patas largas en "U" de las fotos de acopio)
  function soporte(cx, cy, largoX) {
    const [lx, ly] = largoX ? [4.6, 1.3] : [1.3, 4.6];
    for (const s of [-1, 1]) {
      if (largoX) bloque("#6b737d", cx, cy + s * 0.55, lx, 0.14, 0, 0.14); else bloque("#6b737d", cx + s * 0.55, cy, 0.14, ly, 0, 0.14);
    }
    for (const t of [-1.4, 1.4]) {
      if (largoX) { bloque("#7d858d", cx + t, cy, 0.12, 1.2, 0.14, 0.26); for (const s of [-0.45, 0.45]) bloque("#7d858d", cx + t, cy + s, 0.1, 0.1, 0.26, 0.55); }
      else { bloque("#7d858d", cx, cy + t, 1.2, 0.12, 0.14, 0.26); for (const s of [-0.45, 0.45]) bloque("#7d858d", cx + s, cy + t, 0.1, 0.1, 0.26, 0.55); }
    }
  }
  // camioneta terminada (cabina + caja + ruedas) para auditoría
  function camioneta(cx, cy, largoX, color) {
    const d = largoX ? [1, 0] : [0, 1];
    pickup(cx - d[0] * 1.15, cy - d[1] * 1.15, 0.15, largoX, false, color);
    pickup(cx + d[0] * 1.75, cy + d[1] * 1.75, 0.15, largoX, true, color);
    for (const e of [-2.45, 2.15]) for (const s of [-1, 1]) {
      const [x, y] = largoX ? [cx + e, cy + s * 0.86] : [cx + s * 0.86, cy + e];
      cil("#1b1e22", x, y, 0.38, 0.28, 0.38, largoX ? "y" : "x");
    }
    if (largoX) bloque("#2b2f33", cx - 3.0, cy, 0.25, 1.7, 0.45, 0.8); else bloque("#2b2f33", cx, cy - 3.0, 1.7, 0.25, 0.45, 0.8);
  }
  // pared de chapa galvanizada (recintos altos de máquinas) con montantes azules
  function galvanizado(x0, x1, y, enX, z1, cara) {
    const H = z1 || 7.0;
    if (enX !== false) {
      caja("#b9c0c6", x0, y - 0.04, x1, y + 0.04, 0, H);
      for (let x = x0; x < x1; x += 0.5) caja("#a5adb4", x, y + cara * 0.04, x + 0.16, y + cara * 0.07, 0, H);
      for (let x = x0; x <= x1 + 0.01; x += 3) caja("#22346a", x - 0.12, y + cara * 0.04, x + 0.12, y + cara * 0.3, 0, H);
      caja("#22346a", x0, y + cara * 0.04, x1, y + cara * 0.12, 3.6, 3.75);
    } else {
      caja("#b9c0c6", y - 0.04, x0, y + 0.04, x1, 0, H);
      for (let x = x0; x < x1; x += 0.5) caja("#a5adb4", y + cara * 0.04, x, y + cara * 0.07, x + 0.16, 0, H);
      for (let x = x0; x <= x1 + 0.01; x += 3) caja("#22346a", y + cara * 0.04, x - 0.12, y + cara * 0.3, x + 0.12, 0, H);
      caja("#22346a", y + cara * 0.04, x0, y + cara * 0.12, x1, 3.6, 3.75);
    }
  }
  // arco de luces de inspección (túnel de luz: pórticos blancos a dos aguas con tubos LED)
  function tunelLuz(x0, x1, cy, ancho) {
    const a = (ancho || 4.2) / 2;
    for (let x = x0; x <= x1; x += 1.4) {
      for (const s of [-1, 1]) { caja("#eef1f4", x, cy + s * a - 0.05, x + 0.08, cy + s * a + 0.05, 0, 2.2); diag("#eef1f4", x + 0.04, cy + s * a, 2.2, x + 0.04, cy, 3.1, 0.07); }
      for (const s of [-1, 1]) caja("#f7fbff", x + 0.1, cy + s * a * 0.55 - 0.03, x + 1.3, cy + s * a * 0.55 + 0.03, 2.62, 2.68, { clave: "luz", emisivo: true });
    }
    caja("#f7fbff", x0, cy - 0.03, x1 + 0.08, cy + 0.03, 3.08, 3.14, { clave: "luz", emisivo: true });
  }
  // código de columna (amarillo sobre azul) en cualquier línea de ejes
  function codigosLinea(yEje, letra, caras) {
    for (const c of colsEje(yEje).filter(c => c[2] > 0.45)) {
      const n = Math.round(c[0] / 12);
      if (Math.abs(c[0] - n * 12) > 1.0) continue;
      for (const cara of caras) cartel(letra + String(n).padStart(2, "0"), c[0], c[1] + cara * (c[2] / 2 + 0.02), 4.0, 0.55, 0.3, cara > 0 ? "+y" : "-y", "#1d2f6b", "#f2c94c");
    }
  }
  // banda amarilla abulonada en columnas (fotos U, T–U, V, W: forro amarillo de 1–2,4 m)
  function forroAmarillo(yEje, xa, xb) {
    for (const c of colsEje(yEje).filter(c => c[0] >= xa && c[0] <= xb)) {
      const w = c[2] / 2 + 0.03;
      caja("#f2c230", c[0] - w, c[1] - w, c[0] + w, c[1] + w, 0.9, 2.4);
      caja("#8f979f", c[0] - w - 0.01, c[1] - w - 0.01, c[0] + w + 0.01, c[1] + w + 0.01, 2.4, 2.7);
    }
  }
  // calle peatonal genérica a lo largo de x: piso, bordes amarillos, senda verde opcional, cebras, carteles colgantes
  function calleX(x0, x1, y0, y1, senda, rotulo, zTop) {
    pinta("#b4bbc3", x0, y0, x1, y1, 0.02);
    pinta("#f2c94c", x0, y0 + 0.2, x1, y0 + 0.3, 0.035); pinta("#f2c94c", x0, y1 - 0.3, x1, y1 - 0.2, 0.035);
    if (senda) { pinta("#f2c94c", x0, senda[0] - 0.08, x1, senda[1] + 0.08, 0.04); pinta("#2e9d6a", x0, senda[0], x1, senda[1], 0.05); pinta("#ffffff", x0, senda[0] - 0.2, x1, senda[0] - 0.12, 0.045); }
    for (let x = x0 + 26; x < x1 - 4; x += 48) for (let k = 0; k < 5; k++) pinta("#ffffff", x + k * 0.9, y0 + 0.35, x + k * 0.9 + 0.45, y1 - 0.35, 0.06);
    for (let x = x0 + 9; x < x1; x += 37) cil("#3a3f45", x, (y0 + y1) / 2, 0.03, 0.03, 0.32);
    const yM = (y0 + y1) / 2, zt = zTop || 6.2;
    for (let x = x0 + 3; x < x1; x += 6) { caja("#e9f2ff", x - 0.6, yM - 0.07, x + 0.6, yM + 0.07, zt - 1.6, zt - 1.52, { clave: "luz", emisivo: true }); caja("#9aa5b1", x - 0.01, yM - 0.01, x + 0.01, yM + 0.01, zt - 1.52, zt); }
    if (rotulo) for (let x = x0 + 4; x < x1; x += 48) {
      cartel("CALLE\n" + rotulo, x, yM, 3.7, 0.6, 0.7, "+x", "#ffffff", "#111111", true);
      caja("#7d858d", x, yM - 0.25, x + 0.02, yM - 0.23, 4.05, zt); caja("#7d858d", x, yM + 0.23, x + 0.02, yM + 0.25, 4.05, zt);
    }
  }
  // fila de carrocerías sobre soportes (largo a lo ancho de la calle = transversal)
  function filaAcopio(x0, x1, cy, paso, colores, mezcla) {
    for (let x = x0; x <= x1; x += paso) {
      soporte(x, cy, false);
      const t = azar();
      if (t < (mezcla || 0.45)) sedan(x, cy, 0.55, false, elegir(colores));
      else if (t < 0.75) pickup(x, cy - 0.6, 0.55, false, false, elegir(colores));
      else pickup(x, cy, 0.55, false, true, elegir(colores));
    }
  }

  // escalera que sube en +y (las del plano capa B23 que corren a lo largo de y)
  function escaleraY(x, y, z1, color) {
    const n = Math.round(z1 / 0.2), largo = z1 * 0.9;
    for (let i = 0; i < n; i++) { const t = i / n; bloque("#7f8a95", x, y + t * largo, 0.9, 0.28, t * z1, t * z1 + 0.05); }
    for (const s of [-0.48, 0.48]) {
      for (let i = 0; i < n; i += 2) { const t = i / n; bloque(color, x + s, y + t * largo, 0.06, 0.06, t * z1, t * z1 + 1.0); }
      for (let i = 0; i < n; i++) { const t = i / n; bloque(color, x + s, y + t * largo, 0.06, largo / n + 0.02, t * z1 + 0.95, t * z1 + 1.02); }
    }
    bloque("#8e99a6", x, y + largo + 0.6, 1.0, 1.2, z1 - 0.08, z1);   // descanso arriba
  }
  // transferencia (carro que traslada skids entre carriles): 2 rieles + carros con cruz, baranda alrededor
  function transferencia(xa, xb, ya, yb, carros) {
    for (const x of [xa, xb]) caja("#c8462f", x - 0.12, ya, x + 0.12, yb, 0, 0.35);
    for (const y of carros) {
      caja("#e9a21a", xa + 0.2, y - 0.5, xb - 0.2, y + 0.5, 0.35, 0.5);
      diag("#9b3524", xa + 0.3, y - 0.45, 0.52, xb - 0.3, y + 0.45, 0.52, 0.05);
      diag("#9b3524", xa + 0.3, y + 0.45, 0.52, xb - 0.3, y - 0.45, 0.52, 0.05);
    }
  }
  // tractor eléctrico de arrastre (verde, fotos calle C pts 85–86) con número
  function tractor(x, y, num) {
    bloque("#2f9a4a", x, y, 2.0, 1.15, 0.25, 1.05);
    bloque("#2f9a4a", x - 0.35, y, 1.0, 1.15, 1.05, 2.0, { clave: "cabTr", transparente: 0.35 });
    for (const [dx, dy] of [[-0.85, -0.55], [-0.85, 0.55], [0.15, -0.55], [0.15, 0.55]]) bloque("#2f9a4a", x - 0.35 + dx * 0.5, y + dy, 0.06, 0.06, 1.05, 2.0);
    bloque("#2f9a4a", x - 0.35, y, 1.05, 1.2, 1.98, 2.05);
    for (const dx of [-0.65, 0.65]) for (const s of [-1, 1]) cil("#1b1e22", x + dx, y + s * 0.6, 0.25, 0.2, 0.25, "y");
    cartel(String(num), x + 1.01, y, 0.7, 0.5, 0.25, "+x", "#ffffff", "#111111");
  }
  function carro(x, y, color, alto) {
    bloque(color, x, y, 2.2, 1.1, 0.3, 0.3 + (alto || 1.1));
    for (const dx of [-0.8, 0.8]) for (const s of [-1, 1]) cil("#1b1e22", x + dx, y + s * 0.5, 0.15, 0.12, 0.15, "y");
  }
  // autoelevador (amarillo tipo CAT) estático
  function autoelevadorFijo(x, y) {
    bloque("#e3b420", x, y, 1.9, 1.1, 0.25, 1.1); bloque("#2b2f33", x + 0.6, y, 0.7, 1.0, 1.1, 1.25);
    for (const s of [-1, 1]) bloque("#2b2f33", x - 0.2, y + s * 0.5, 0.06, 0.06, 1.1, 2.2);
    bloque("#2b2f33", x - 0.2, y, 1.0, 1.06, 2.15, 2.22);
    for (const s of [-0.35, 0.35]) { bloque("#3a3f45", x - 1.0, y + s, 0.06, 0.12, 0.1, 2.4); bloque("#3a3f45", x - 1.6, y + s, 1.1, 0.12, 0.05, 0.12); }
    for (const dx of [-0.6, 0.55]) for (const s of [-1, 1]) cil("#1b1e22", x + dx, y + s * 0.5, 0.25, 0.2, 0.25, "y");
  }
  const LETRA_Y = [["E", 0], ["D1", 13], ["D", 26], ["C2", 36.2], ["C1", 45.8], ["C", 52], ["B2", 61.7], ["B1", 71.7], ["B", 82], ["A", 104]];

  // ============================================================= 14) CALLE U (plano: y 62,0–64,3) – pts 31–40
  // En el plano la calle U (verde) llega hasta x ≈ 120; en las fotos sigue como pasillo hasta la calle C (cartel "CALLE U" visto desde C, pt 84.2)
  calleX(2, 258, 62.0, 64.3, [62.05, 62.7], "U");
  forroAmarillo(61.7, 0, 100); forroAmarillo(52.0, 0, 100);
  codigosLinea(52.0, "C", [+1]);
  // 14a. CENTRAL P.V.C. (pt 31.4): jaula de malla amarilla dentro del local del plano (x 5,2–16,6 · y 65,1–76)
  for (const [a, b, y, enX] of [[5.8, 16.0, 65.6, true], [5.8, 16.0, 73.3, true], [65.6, 73.3, 5.8, false], [65.6, 73.3, 16.0, false]]) cercoMalla(a, b, y, enX, "#e3a800", 2.6);
  cartel("CENTRAL P.V.C.", 11, 65.55, 2.0, 2.6, 0.9, "-y", "#ffffff", "#111111");
  cil("#e67e22", 9.0, 69.0, 0, 2.6, 1.0); cil("#c9d1da", 9.0, 69.0, 2.6, 0.4, 0.3);
  for (const [x, y] of [[12.5, 66.6], [13.3, 66.6], [14.1, 66.6], [12.5, 67.4]]) { cil("#f2c94c", x, y, 0, 0.9, 0.3); cil("#2b2f33", x, y, 0.9, 0.04, 0.31); }
  for (const x of [11.5, 13.5]) { bloque("#5d6672", x, 70.8, 1.2, 0.6, 0, 0.2); cil("#1f5fa8", x, 70.8, 0.2, 1.2, 0.18); cil("#aeb7c2", x + 0.4, 70.8, 1.0, 1.8, 0.05); }
  bloque("#c9cdd1", 6.6, 72.6, 1.6, 0.5, 0, 2.0);
  // 14b. CABINA PVC (pts 32.3–32.4): recinto vidriado sobre la huella del plano (x 27,7–76,8 · y 65,2–70,2)
  for (const y of [65.2, 70.2]) {
    caja("#f1f2f0", 27.7, y - 0.05, 76.8, y + 0.05, 0, 1.15);
    caja("#dfe8ef", 27.7, y - 0.02, 76.8, y + 0.02, 1.15, 3.0, { clave: "vidrio2", transparente: 0.35 });
    caja("#cdd3d8", 27.7, y - 0.05, 76.8, y + 0.05, 3.0, 4.3);
    for (let x = 27.7; x <= 76.9; x += 2.45) caja("#1d2f6b", x - 0.07, y - 0.08, x + 0.07, y + 0.08, 0, 4.3);
    caja("#1d2f6b", 27.7, y - 0.08, 76.8, y + 0.08, 1.1, 1.2); caja("#1d2f6b", 27.7, y - 0.08, 76.8, y + 0.08, 2.95, 3.05);
  }
  for (const x of [27.7, 76.8]) caja("#cdd3d8", x - 0.05, 65.2, x + 0.05, 70.2, 0, 4.3);
  caja("#d5dadf", 27.7, 65.2, 76.8, 70.2, 4.3, 4.4);
  caja("#2e8b57", 33.0, 65.08, 34.1, 65.14, 0, 2.2); caja("#dfe8ef", 33.15, 65.07, 33.95, 65.08, 1.0, 2.0, { clave: "vidrio2", transparente: 0.35 });
  cartel("DOMINIO 5\nAPLICACIÓN PISO PVC\nESTACIÓN 42", 38.5, 65.1, 1.9, 1.0, 0.75, "-y", "#ffffff", "#7a6a2a");
  cartel("CABINA PVC", 52, 65.1, 3.6, 2.4, 0.5, "-y", "#1d2f6b", "#ffffff");
  // 14c. Línea TRP-05 (plano y 67,7) dentro de la cabina y hasta el MASTER; TRP-04 (x 80,5) con transferencia
  rodillosRojos(20, 101, 67.7, 0.45);
  baranda(77, 101, 66.6); baranda(77, 101, 68.8);
  transferencia(79.6, 81.4, 65.8, 78.4, [68.4, 71.6, 74.6]);
  // 14d. Lado oeste (pts 31–33): cabinas y cajas de pickup en blanco sobre soportes, en fila junto a la calle
  for (let x = 30, i = 0; x < 62; x += 5.4, i++) { soporte(x, 58.6, true); if (i % 2) pickup(x, 58.6, 0.55, true, true, elegir(BIW)); else pickup(x, 58.6, 0.55, true, false, elegir(["#d3d6da", "#4a4f57", "#bfc3c7"])); }
  cartel("A DISPOSICIÓN DE\nLABORATORIO\n←", 36.0, 61.42, 1.7, 0.75, 0.7, "-y", "#ffffff", "#c0392b");
  cartel("BOX CHAPA\n⇆", 60.0, 61.42, 1.8, 0.75, 0.45, "-y", "#ffffff", "#111111");
  // puesto de trabajo de chapa (pt 31.2): escritorio, silla, carro, cesto, lockers azules
  bloque("#e8e1cc", 42.5, 56.0, 1.4, 0.7, 0, 0.75); bloque("#2b4f8f", 41.5, 56.0, 0.6, 0.7, 0, 0.9);
  bloque("#2b2f33", 43.4, 55.1, 0.5, 0.5, 0.45, 0.5); bloque("#9aa1a8", 40.0, 55.3, 1.0, 0.7, 0.4, 0.45);
  cil("#7d858d", 44.6, 56.1, 0, 0.7, 0.25);
  for (const x of [37, 37.6, 38.2]) bloque("#1d3f8f", x, 54.5, 0.55, 0.5, 0, 1.9);
  // 14e. MASTER DE SELLADO (pts 35–36): recinto del plano (x 100,8–112,6 · y 52,6–61,6) con lazo TRP-05/08 y plataforma
  caja("#8e99a6", 100.8, 52.6, 112.6, 61.6, 4.4, 4.55, { clave: "rejilla", transparente: 0.75 });
  for (const [x, y] of [[100.9, 52.7], [112.5, 52.7], [100.9, 61.5], [112.5, 61.5], [106.7, 52.7], [106.7, 61.5]]) caja("#23395d", x - 0.12, y - 0.12, x + 0.12, y + 0.12, 0, 4.4);
  for (const y of [52.6, 61.6]) { caja("#f2c94c", 100.8, y - 0.03, 112.6, y + 0.03, 5.5, 5.56); for (let x = 100.8; x <= 112.6; x += 1.5) caja("#f2c94c", x, y - 0.03, x + 0.05, y + 0.03, 4.55, 5.56); }
  escalera(108.6, 53.6, +1, 4.4, "#f2c94c");   // escalera del plano (B23) dentro del recinto
  cartel("AREA DE MASTER:\nSELLADO E\nINSONORIZANTE", 106.7, 61.66, 5.0, 1.7, 0.9, "-y", "#ffffff", "#c0392b", true);
  rodillosRojos(103.5, 110, 55.5, 0.45); rodillosRojos(103.5, 110, 58.5, 0.45);
  for (const x of [104.5, 108.6]) { skid(x, 58.5, 0.45, true); pickup(x, 58.5, 0.75, true, true); }
  tunelLuz(103, 109, 55.5, 3.6);
  // 14f. RELAX (pts 35.1, 36.3): piso azul, mesas y bancos (las del plano, x 113–122), expendedoras, dispenser
  pinta("#2f62c8", 113.2, 55.0, 121.8, 61.0, 0.03);
  for (const [x, y] of [[115.0, 56.4], [115.0, 58.2], [118.6, 56.4], [118.6, 58.2], [118.6, 60.0]]) {
    bloque("#b6bec6", x, y, 2.4, 0.75, 0.72, 0.77); for (const dx of [-1.05, 1.05]) bloque("#7d858d", x + dx, y, 0.06, 0.6, 0, 0.72);
    for (const dy of [-0.65, 0.65]) { bloque("#9aa3ad", x, y + dy, 2.4, 0.3, 0.43, 0.47); for (const dx of [-1.0, 1.0]) bloque("#7d858d", x + dx, y + dy, 0.05, 0.25, 0, 0.43); }
  }
  bloque("#c0392b", 113.6, 60.4, 0.9, 0.8, 0, 1.85); cartel("Coca-Cola", 113.6, 59.99, 1.3, 0.7, 0.4, "-y", "#c0392b", "#ffffff");
  bloque("#1f2328", 114.6, 60.4, 0.9, 0.8, 0, 1.85); bloque("#dfe8ef", 114.6, 60.0, 0.6, 0.02, 0.6, 1.6, { clave: "vidrio2", transparente: 0.35 });
  bloque("#f4f6f8", 115.6, 60.5, 0.35, 0.35, 0, 1.05); cil("#3b8fd8", 115.6, 60.5, 1.05, 0.45, 0.14);
  bloque("#1f3f9e", 121.2, 55.6, 0.9, 0.9, 0, 2.0); cartel("STELLANTIS", 121.2, 55.14, 1.6, 0.8, 0.2, "-y", "#1f3f9e", "#ffffff");
  for (const x of [120.6, 121.3]) cil("#2b2f33", x, 61.1, 0, 0.9, 0.28);
  cartel("“TU SEGURIDAD TAMBIÉN ES LA DE ELLOS”\n“YOUR SAFETY IS ALSO THEIRS...”", 112.0, 63.2, 5.6, 6.0, 1.6, "+x", "#2c3e7a", "#ffffff", true);
  cartel("“PASOS FIRMES Y SEGUROS EN EL TRABAJO\nPARA DISFRUTAR LOS PRIMEROS DE TUS HIJOS”", 131.0, 63.2, 5.6, 6.0, 1.8, "-x", "#3c6f9a", "#ffffff", true);
  // cruce peatonal "PASSAGGIO PEDONALE (PED. SENSIBILE)" del plano sobre la línea TRP-06 (x ≈ 145)
  for (let k = 0; k < 6; k++) pinta("#ffffff", 143.4 + k * 0.6, 64.4, 143.7 + k * 0.6, 70.1, 0.06);
  cartel("PASO PEATONAL\n(PED. SENSIBLE)", 145.0, 67.7, 3.6, 2.0, 0.6, "+x", "#ffffff", "#c0392b", true);
  // 14g. UTE 1 (pt 36.2): oficina del plano (x 122,5–127,7 · y 55,3–59,7), marcos naranjas, paneles y vidrio
  for (const [a, b, y, enX] of [[122.5, 127.7, 55.3, true], [122.5, 127.7, 59.7, true], [55.3, 59.7, 122.5, false], [55.3, 59.7, 127.7, false]]) {
    if (enX) { caja("#f4f4f2", a, y - 0.05, b, y + 0.05, 0, 1.0); caja("#dfe8ef", a, y - 0.02, b, y + 0.02, 1.0, 2.4, { clave: "vidrio2", transparente: 0.35 }); caja("#d7dbdf", a, y - 0.05, b, y + 0.05, 2.4, 3.0); for (let x = a; x <= b; x += 1.3) caja("#e67e22", x, y - 0.07, x + 0.06, y + 0.07, 0, 3.0); }
    else { caja("#f4f4f2", y - 0.05, a, y + 0.05, b, 0, 1.0); caja("#dfe8ef", y - 0.02, a, y + 0.02, b, 1.0, 2.4, { clave: "vidrio2", transparente: 0.35 }); caja("#d7dbdf", y - 0.05, a, y + 0.05, b, 2.4, 3.0); for (let x = a; x <= b; x += 1.3) caja("#e67e22", y - 0.07, x, y + 0.07, x + 0.06, 0, 3.0); }
  }
  caja("#2350a8", 126.8, 59.72, 127.4, 59.78, 0.6, 2.6); cartel("U\nT\nE\n1", 127.1, 59.79, 1.6, 0.5, 1.8, "+y", "#2350a8", "#ffffff");
  bloque("#ffffff", 124.4, 57.4, 2.4, 0.9, 0.72, 0.76); persona(124.4, 58.3, 0, false);
  // vestuario / baños del plano (x 124–142 · y 55,6–60,2): mesadas y piletas visibles por la puerta
  for (let x = 131.2; x < 141.5; x += 1.6) { bloque("#f4f6f8", x, 56.4, 1.3, 1.3, 0, 0.45); bloque("#e9ecef", x, 55.85, 1.3, 0.12, 0, 2.0); }
  cartel("BAÑOS", 136.5, 60.3, 1.6, 0.9, 0.35, "+y", "#1f6feb", "#ffffff");
  // 14h. TRP-06 (plano y 67,7, x 78–248): rodillos rojos con baranda amarilla y carrocerías (pts 37–46)
  pinta("#cfe0d2", 78, 65.2, 248, 70.0, 0.018);
  for (let x = 78, k = 0; x < 248; x += 0.4, k++) pinta(k % 2 ? "#1f2328" : "#f2c94c", x, 65.25, x + 0.4, 65.55, 0.035);
  rodillosRojos(78, 248, 67.7, 0.5, 1.4);
  baranda(113, 248, 66.4); baranda(113, 248, 69.0);
  for (const x of [128, 150, 172, 196, 220, 240]) { bloque("#dfe3e7", x, 65.9, 0.6, 0.5, 0, 1.2); bloque("#c5cbd1", x, 65.9, 0.66, 0.56, 1.2, 1.35); cil("#2ecc71", x + 0.2, 65.8, 1.35, 0.12, 0.05); }
  // 14i. Entrepiso de cota 5,4 sobre la línea y la mitad T–U: apoya en las columnas reales del plano (filas y 64,2 y 72,8)
  const colsEntre = colsEje(64.2).filter(c => c[0] >= 108 && c[0] <= 252).map(c => c[0]);
  for (const y of [64.2, 72.8]) {
    caja("#e67e22", 108, y - 0.1, 252, y + 0.1, 4.6, 4.75); caja("#e67e22", 108, y - 0.1, 252, y + 0.1, 5.25, 5.4);
    for (let x = 108; x < 252; x += 1.5) diag("#e67e22", x, y, 4.7, x + 1.5, y, 5.3, 0.07);
    for (let x = 108; x <= 252; x += 1.5) caja("#f2c94c", x, y - 0.03, x + 0.05, y + 0.03, 5.45, 6.5);
    caja("#f2c94c", 108, y - 0.03, 252, y + 0.03, 6.45, 6.5); caja("#f2c94c", 108, y - 0.03, 252, y + 0.03, 5.95, 6.0);
  }
  for (const x of colsEntre) caja("#e67e22", x - 0.08, 64.2, x + 0.08, 72.8, 4.9, 5.4);
  for (let x = 114; x < 252; x += 6) if (!colsEntre.some(c => Math.abs(c - x) < 1)) caja("#e67e22", x - 0.06, 64.2, x + 0.06, 72.8, 5.1, 5.4);
  caja("#8e99a6", 108, 64.2, 252, 72.8, 5.4, 5.45, { clave: "rejilla", transparente: 0.75 });
  escalera(138.5, 63.6, -1, 5.4, "#f2c94c"); escalera(206.5, 63.6, -1, 5.4, "#f2c94c");
  // carteles 5S de WCM colgados del entrepiso sobre la línea, mirando a la calle U (pts 37–40)
  for (const [x, txt, fondo] of [[168, "1° SEIRI\nSEPARAR", "#3c78c8"], [182, "2° SEITON\nORDENAR", "#e9c23a"], [196, "3° SEISO\nLIMPIAR", "#d6578a"], [210, "4° SEIKETSU\nESTANDARIZAR", "#c0392b"], [224, "5° SHITSUKE\nDISCIPLINA", "#4aa3df"]])
    cartel(txt, x, 64.35, 3.9, 3.0, 1.2, "-y", fondo, "#ffffff", true);
  cartel("AYUDA VISUAL\nSeguridad", 140.0, 64.47, 1.7, 0.6, 0.8, "-y", "#ffffff", "#1f2a3a");
  // 14j. Estructura de cota 9 del lado oeste de U: grilla de columnas azules del plano (capa 303, cruces azules) cada 5 m
  const GRILLA9 = [[43.0, 100, 250], [49.3, 100, 250], [54.1, 135, 250], [60.3, 135, 250], [37.5, 100, 125], [37.5, 230, 250]];
  for (const [y, a, b] of GRILLA9) {
    for (let x = a; x <= b; x += 5) {
      if (y === 54.1 && x === 245) continue;
      caja("#22346a", x - 0.15, y - 0.15, x + 0.15, y + 0.15, 0, 9.0);
      caja("#aeb6be", x - 0.2, y - 0.2, x + 0.2, y + 0.2, 0, 0.12);   // placa base
    }
    caja("#e67e22", a, y - 0.1, b, y + 0.1, 7.4, 7.55); caja("#e67e22", a, y - 0.1, b, y + 0.1, 8.6, 8.75);
    for (let x = a; x < b; x += 2.5) diag("#e67e22", x, y, 7.5, x + 2.5, y, 8.65, 0.07);
  }
  for (let x = 100; x <= 250; x += 10) caja("#e67e22", x - 0.08, 37.5, x + 0.08, 60.3, 8.0, 8.6);
  for (const x0 of [140, 185, 225]) { diag("#22346a", x0, 60.3, 0.2, x0 + 5, 60.3, 7.4, 0.25); diag("#22346a", x0 + 5, 60.3, 0.2, x0, 60.3, 7.4, 0.25); }
  // cajones de acero inoxidable con nervios blancos y escalera de gato amarilla (pts 37.2, 38.3), entre filas 54,1 y 60,3
  for (const [a, b] of [[181, 193.5], [198.5, 221.5]]) {
    caja("#c6ccd1", a, 54.6, b, 59.8, 0.4, 4.6);
    for (let x = a; x <= b; x += 1.5) caja("#eef1f4", x, 54.5, x + 0.12, 59.9, 0.4, 4.6);
    for (const z of [1.4, 2.4, 3.4]) caja("#eef1f4", a, 54.5, b, 59.9, z, z + 0.1);
    for (let x = a + 2; x < b; x += 4) for (const dy of [-0.8, 0.8]) caja("#7d858d", x, 57.2 + dy, x + 0.15, 57.2 + dy + 0.15, 0, 0.4);
    for (let x = a + 3; x < b; x += 7) for (let k = 0; k < 4; k++) { const w = 2.6 - k * 0.5; bloque("#aab2b9", x, 57.2, w, w, 6.6 - k * 0.45, 7.05 - k * 0.45); }
    caja("#f2c94c", a + 1.0, 60.0, a + 1.06, 60.05, 0, 6.2); caja("#f2c94c", a + 1.5, 60.0, a + 1.56, 60.05, 0, 6.2);
    for (let z = 0.3; z < 6.2; z += 0.3) caja("#f2c94c", a + 1.0, 60.0, a + 1.56, 60.04, z, z + 0.04);
  }
  // MAQ-02 (máquina sin nombre del plano, capa C15): recinto galvanizado + grupos motor-bomba al extremo sur
  galvanizado(153.4, 175.2, 59.9, true, 7.0, +1); galvanizado(153.4, 175.2, 55.1, true, 7.0, -1);
  for (const x of [153.4, 175.2]) galvanizado(55.1, 59.9, x, false, 7.0, x < 160 ? -1 : 1);
  rodillosRojos(150, 180, 56.9, 0.45);
  function motores(x0, ys) {
    for (const y of ys) { bloque("#5d6672", x0 + 1.4, y, 2.8, 0.7, 0, 0.2); cil("#1f5fa8", x0 + 0.7, y, 0.55, 1.1, 0.3, "x"); cil("#7f8a95", x0 + 2.0, y, 0.55, 0.8, 0.38, "x"); cil("#aeb7c2", x0 + 2.6, y, 0.55, 3.0, 0.1); }
  }
  motores(175.4, [55.9, 56.9, 57.9]); bloque("#7d858d", 176.5, 59.2, 1.6, 1.0, 0, 1.2);
  // escalera del plano (B23, x 148–150 · y 54–60) a la cota 9 y carrocerías tapadas con nylon (pt 39.2)
  escaleraY(149.0, 54.2, 7.4, "#2e8b57");
  for (const x of [128, 133, 138]) { soporte(x, 51.6, true); bloque("#e6eaee", x, 51.6, 4.2, 1.8, 0.55, 1.75, { clave: "film", transparente: 0.7 }); }
  // tablero B1 y camilla naranja de rescate (pt 36.4), contra la fila de columnas
  bloque("#cfd3d7", 133.0, 61.0, 1.4, 0.5, 0, 2.2); cartel("TABLERO\nB1", 133.0, 61.26, 2.3, 0.5, 0.35, "+y", "#f2c94c", "#111111");
  bloque("#e67e22", 136.5, 61.2, 0.5, 0.15, 0.2, 2.0);

  // ============================================================= 15) MITAD DE CALLE ENTRE T Y U (plano: y 70,1–72,5, x 124–258) – pts 41–46
  pinta("#b4bbc3", 124, 70.1, 258, 72.5, 0.021);
  pinta("#2e9d6a", 124, 70.15, 258, 70.75, 0.05); pinta("#ffffff", 124, 70.8, 258, 70.88, 0.05); pinta("#f2c94c", 124, 72.3, 258, 72.4, 0.05);
  for (let x = 124 + 26; x < 256; x += 48) for (let k = 0; k < 4; k++) pinta("#ffffff", x + k * 0.9, 70.2, x + k * 0.9 + 0.45, 72.4, 0.06);
  // cerramiento de la cabina de sellado (SIGILLATURA, plano y 73,4): panel gris verdoso, marcos naranjas, ventanas
  caja("#93a6a3", 124.8, 73.3, 235.1, 73.4, 0, 1.6);
  caja("#dfe8ef", 124.8, 73.33, 235.1, 73.37, 1.6, 2.9, { clave: "vidrio2", transparente: 0.35 });
  caja("#a7b3b4", 124.8, 73.3, 235.1, 73.4, 2.9, 4.0);
  for (const z of [1.55, 2.88]) caja("#e67e22", 124.8, 73.26, 235.1, 73.3, z, z + 0.07);
  for (let x = 124.8; x <= 235.2; x += 1.6) caja("#e67e22", x, 73.26, x + 0.06, 73.3, 0, 4.0);
  // lockers amarillos, dispensers y atriles contra el cerramiento, entre columnas (fila 72,8)
  for (const x0 of [126.5, 146.5, 170.5, 205.5, 224.5]) for (let k = 0; k < 4; k++) { bloque("#e9c23a", x0 + k * 0.62, 73.0, 0.58, 0.5, 0, 1.9); bloque("#c9a52c", x0 + k * 0.62, 72.74, 0.5, 0.02, 1.0, 1.8); }
  for (const x of [134, 186, 214]) { bloque("#f4f6f8", x, 73.0, 0.35, 0.35, 0, 1.05); cil("#3b8fd8", x, 73.0, 1.05, 0.45, 0.14); }
  for (const x of [138, 188, 218]) cartel("¡SECOS!", x, 73.22, 1.0, 0.5, 0.3, "-y", "#e67e22", "#ffffff");
  for (const x of [130, 162, 198]) { bloque("#f2c94c", x, 73.0, 1.4, 0.5, 0.7, 0.75); diag("#f2c94c", x - 0.6, 72.8, 0, x - 0.6, 73.2, 0.7, 0.05); diag("#f2c94c", x + 0.6, 72.8, 0, x + 0.6, 73.2, 0.7, 0.05); bloque("#c7c9c4", x, 73.0, 1.3, 0.45, 0.9, 1.0); }
  cartel("↑ VÍA DE\nESCAPE", 252, 71.3, 3.2, 0.8, 0.6, "-x", "#1e8449", "#ffffff", true);
  for (const x of [119, 121, 152, 199]) persona(x, entre(66.6, 68.8), 0, false);
  persona(176, 71.6, 0, false); persona(232, 71.9, 0, true);

  // ============================================================= 16) CALLES V y W NORTE + CALESITA (pts 48–55)
  calleX(2, 96, 42.9, 45.5, null, "V");
  calleX(2, 96, 33.0, 36.0, null, "W");
  codigosLinea(26.0, "D", [+1, -1]);
  // 16a. acopio de carrocerías en blanco (BIW) sobre soportes, transversales a las calles (pts 48.1, 49.x, 50.x)
  filaAcopio(5, 62, 39.4, 2.5, BIW, 0.55);
  filaAcopio(30, 61, 48.7, 2.5, BIW.concat(["#16181c", "#1f3f9e"]), 0.5);
  cartel("BOX CHAPA\n←", 48.0, 46.1, 1.8, 0.7, 0.4, "+y", "#ffffff", "#111111");
  cartel("MANTENIMIENTO PINTURA", 0.4, 52.0, 3.8, 5.0, 0.55, "+x", "#ffffff", "#1f2a3a");
  for (const x of [63.5, 64.5]) { cil("#e67e22", x, 45.9, 0, 0.7, 0.15); bloque("#e67e22", x, 45.9, 0.36, 0.36, 0, 0.04); }
  // CENTRALE SIGILLANTE: 3 bombas de sellador con tambor horizontal sobre patín (plano, x 72–83 · y 49–51)
  for (const x of [73.5, 78.0, 81.4]) { bloque("#5d6672", x, 49.9, 2.6, 2.0, 0, 0.2); cil("#c9d1da", x, 49.9, 0.85, 1.8, 0.62, "x"); for (const dx of [-1.15, 1.15]) bloque("#1f5fa8", x + dx, 49.9, 0.3, 0.5, 0.2, 1.0); }
  // 16b. CALESITA (plano: TRP-13/16 en y 30,9 y 22,9; transferencias en x 4,6–8,4 y 91,3–94,8)
  cercoMalla(3.8, 96, 32.7, true, "#2a55b8", 2.0, true);
  cercoMalla(3.8, 96, 19.0, true, "#2a55b8", 2.0, true);
  cercoMalla(19.0, 32.7, 3.8, false, "#2a55b8", 2.0, false); cercoMalla(19.0, 32.7, 95.9, false, "#2a55b8", 2.0, false);
  for (const y of [30.9, 22.9]) rodillosRojos(9.0, 91.0, y, 0.45, 1.4);
  transferencia(4.6, 8.4, 21.9, 32.1, [31.0, 27.8, 25.6, 23.0]);
  transferencia(91.3, 94.8, 21.9, 32.1, [31.0, 28.4, 25.7, 23.0]);
  filaAcopio(14, 86, 26.9, 2.8, PINTADO, 0.3);   // zona de acumulo dentro de la calesita (pt 61.3)
  for (const [x, y] of [[50, 32.4], [93, 19.5], [20, 19.4]]) { bloque("#d9d5c8", x, y, 0.8, 0.5, 0, 1.3); bloque("#c4c0b2", x, y, 0.86, 0.56, 1.3, 1.45); for (let k = 0; k < 6; k++) cil(elegir(["#2ecc71", "#c0392b", "#f1c40f", "#2b2f33"]), x - 0.3 + k * 0.12, y - 0.29, 1.15, 0.04, 0.035, "y"); }
  cartel("HIDRANTE", 52.0, 33.4, 3.2, 0.7, 0.2, "+x", "#c0392b", "#ffffff");

  // ============================================================= 16c) CALLE X NORTE = "entre W y X" de las fotos (plano: y 10,4–12,7, x 0–96) – pts 60–62
  calleX(2, 96, 10.4, 12.7, [10.5, 11.1], "X");
  // pared galvanizada alta del lado de los locales (Box chapistería, talleres, depósito, pañol), plano y ≈ 9,6
  galvanizado(0.5, 53.0, 9.45, true, 6.5, +1); galvanizado(55.0, 79.0, 9.45, true, 6.5, +1);
  for (const [x, w] of [[30, 1.0], [31.4, 1.2], [33.0, 1.2]]) bloque(elegir(["#b08a5a", "#c8a774"]), x, 9.9, w, 0.7, 0, 0.6);
  cil("#c0392b", 28.6, 9.95, 0, 0.6, 0.3);
  // franja entre la calle X y la calesita (y 12,9–18,8): fila de cajas/cabinas de pickup sobre soportes + pasillo (pts 61–62)
  for (let x = 8, i = 0; x < 92; x += 5.4, i++) { soporte(x, 14.3, true); pickup(x, 14.3, 0.55, true, i % 3 !== 0, elegir(i % 4 === 0 ? ["#4a4f57", "#16181c"] : BIW)); }
  cartel("MANTENIMIENTO PINTURA", 74, 13.0, 3.6, 4.4, 0.5, "+y", "#ffffff", "#1f2a3a");
  cartel("↑ VÍA DE\nESCAPE", 4.0, 16.0, 3.0, 0.8, 0.5, "-x", "#1e8449", "#ffffff", true);

  // ============================================================= 17) CALLE B (plano: x 95,6–98,4, y 1–62; cartel "CALLE B" en x 98, y 26,6) – pts 80–83
  pinta("#b4bbc3", 95.6, 1.2, 98.4, 62.0, 0.021);
  pinta("#f2c94c", 95.7, 1.2, 95.8, 62.0, 0.035); pinta("#f2c94c", 98.2, 1.2, 98.3, 62.0, 0.035);
  pinta("#ffffff", 97.45, 1.2, 97.53, 62.0, 0.045);
  for (const [a, b] of [[10.4, 12.7], [19.4, 20.2], [33.0, 36.0], [42.9, 45.5]]) for (let k = 0; k < 4; k++) pinta("#ffffff", 95.7, a + k * 0.7, 98.3, a + k * 0.7 + 0.35, 0.06);
  for (let y = 8; y < 62; y += 24) {
    cartel("CALLE\nB", 97.0, y, 3.7, 0.6, 0.7, "+y", "#ffffff", "#111111", true);
    caja("#7d858d", 96.75, y, 96.77, y + 0.02, 4.05, 6.2); caja("#7d858d", 97.23, y, 97.25, y + 0.02, 4.05, 6.2);
  }
  for (let y = 4; y < 62; y += 6) { caja("#e9f2ff", 96.93, y - 0.6, 97.07, y + 0.6, 4.6, 4.68, { clave: "luz", emisivo: true }); }
  // pórticos azules con diagonales en X y vigas amarillas (pts 81.3–81.4), junto a la grilla de cota 9
  for (const y of [38.0, 49.3]) { caja("#22346a", 99.6, y - 0.2, 100.0, y + 0.2, 0, 9); diag("#22346a", 99.8, y, 0.2, 99.8, y + 5.0, 7.2, 0.3); diag("#22346a", 99.8, y + 5.0, 0.2, 99.8, y, 7.2, 0.3); caja("#f2c94c", 99.6, y, 100.0, y + 5.0, 7.2, 7.5); }
  // malla baja y baranda del entrepiso a lo largo de la calle (pt 80.2)
  caja("#6f7a86", 99.0, 43.0, 99.03, 60.3, 0.1, 2.0, { clave: "malla#6f7a86", transparente: 0.3 });
  caja("#f2c94c", 99.0, 43.0, 99.06, 60.3, 6.4, 6.46); caja("#f2c94c", 99.0, 43.0, 99.06, 60.3, 5.9, 5.95);
  for (let y = 43; y <= 60.3; y += 1.5) caja("#f2c94c", 99.0, y, 99.06, y + 0.05, 5.4, 6.46);
  // jaula de malla amarilla con cajas (pt 80.2 izq.)
  for (const [a, b, y, enX] of [[91.6, 95.2, 53.0, true], [91.6, 95.2, 57.0, true], [53.0, 57.0, 91.6, false]]) cercoMalla(a, b, y, enX, "#e3a800", 2.4);
  for (const [x, y] of [[92.6, 54.0], [94.0, 54.0], [92.6, 55.8], [94.0, 56.0]]) bloque("#e3b420", x, y, 1.0, 1.0, 0, 1.1);
  cartel("ATENCIÓN\nVEHÍCULOS\nINDUSTRIALES", 95.45, 27.0, 1.8, 0.6, 0.7, "-x", "#f2c94c", "#111111");

  // ============================================================= 18) ENTRE W Y X SUR: calle B → Box de retoques (plano: senda y 19,4–20,2) – pts 63–69
  pinta("#b4bbc3", 98.4, 18.8, 139.0, 26.2, 0.021);
  pinta("#f2c94c", 98.4, 18.9, 139.0, 19.0, 0.035); pinta("#f2c94c", 98.4, 26.0, 139.0, 26.1, 0.035);
  // recinto galvanizado alto del plano (x 100–130,5 · y 26,5–37,3) con cartel CALLE B en la esquina (pts 63.1, 81.1)
  galvanizado(100, 130.5, 26.5, true, 7.5, -1); galvanizado(26.5, 37.3, 130.5, false, 7.5, +1);
  for (let x = 100.5, k = 0; x < 130; x += 0.5, k++) caja(k % 2 ? "#1f2328" : "#f2c94c", x, 26.3, x + 0.5, 26.42, 0, 0.18);
  cartel("CALLE\nB", 99.2, 26.3, 4.2, 0.7, 0.8, "-y", "#ffffff", "#111111");
  cartel("↑ VÍA DE\nESCAPE", 100.6, 26.35, 4.2, 0.7, 0.5, "-y", "#1e8449", "#ffffff");
  caja("#c8ccd1", 130.55, 32.2, 130.6, 35.9, 0, 2.6);   // portón doble del plano (x 130,6 · y 32–36)
  // AREA MACRO C.P.A. (plano: recinto en U x 107,8–119,6 · y 5,6–15,2 con 2 carrocerías): túnel de luces e inspección
  for (const yC of [9.0]) {
    caja("#e9eef3", 108.0, 5.8, 119.4, 15.0, 3.4, 3.5);
    for (let x = 108.5; x < 119.2; x += 1.2) for (const y of [6.6, 8.4, 9.6, 11.4, 13.2]) caja("#f7fbff", x, y, x + 0.9, y + 0.06, 3.3, 3.36, { clave: "luz", emisivo: true });
    for (const x of [107.95, 119.45]) for (let y = 6.2; y < 15; y += 1.4) caja("#f7fbff", x - 0.03, y, x + 0.03, y + 0.9, 1.0, 1.06, { clave: "luz", emisivo: true });
    void yC;
  }
  for (const x of [110.5, 116.1]) { skid(x, 9.0, 0, false); sedan(x, 9.0, 0.3, false, elegir(PINTADO)); persona(x + 1.5, 12.2, 0, false); }
  bloque("#ffffff", 113.3, 14.3, 1.6, 0.7, 0.75, 0.8); for (const dx of [-0.7, 0.7]) bloque("#7d858d", 113.3 + dx, 14.3, 0.05, 0.6, 0, 0.75);
  for (const x of [100.5, 102.5, 104.5]) { bloque("#f2c94c", x, 4.0, 1.2, 0.08, 0.9, 1.0); for (const dx of [-0.5, 0.5]) diag("#f2c94c", x + dx, 3.7, 0, x + dx, 4.3, 0.9, 0.06); }
  // TRP-17 (y 17,4, x 100–130): rodillos rojos con Cronos; TRP-19/20/18: elevador en jaula amarilla (pt 83.4)
  rodillosRojos(100.3, 125.5, 17.4, 0.45);
  for (const [a, b, y, enX] of [[125.2, 132.6, 11.2, true], [125.2, 132.6, 19.6, true], [11.2, 19.6, 125.2, false], [11.2, 19.6, 132.6, false]]) cercoMalla(a, b, y, enX, "#e3a800", 2.6);
  transferencia(126.4, 130.2, 6.8, 19.4, [12.3, 14.5, 17.4]);
  rodillosRojos(130.2, 137.3, 14.5, 0.45);
  cartel("PRECAUCIÓN\nINGRESO A ZONA TÉCNICA\nVERIFICAR AUSENCIA DE\nENERGÍAS PELIGROSAS", 132.65, 16.0, 1.4, 1.0, 0.9, "+x", "#f2c94c", "#111111");
  // PRUEBA DE LUZ (plano x 126,2–132 · y 26,4–30,7): tubos de luz interiores y cartel
  for (let x = 126.8; x < 131.6; x += 0.8) caja("#f7fbff", x, 26.8, x + 0.06, 30.3, 3.0, 3.06, { clave: "luz", emisivo: true });
  cartel("PRUEBA\nDE LUZ", 129.1, 26.35, 2.6, 1.6, 0.6, "-y", "#ffffff", "#1f2a3a");
  escalera(145.0, 26.9, +1, 5.4, "#f2c94c");   // escalera del plano (B23, x 145–149)
  // BOX DE RETOQUES (plano "BOX RITTOCCHI": recinto x 148–176 · y 12,7–25,6, 4 boxes entre y 19,4 y 25,6) – pts 65–68
  pinta("#dfe2e2", 148.2, 12.9, 175.8, 25.4, 0.025);
  const BOXES = [[148.2, 160.2], [160.4, 165.4], [165.6, 170.1], [170.3, 175.8]];
  BOXES.forEach(([a, b], i) => {
    for (let x = a + 0.4; x < b - 0.6; x += 1.1) diag("#f7fbff", x, 20.0, 2.9, x, 25.0, 3.2, 0.06);   // tubos fluorescentes inclinados (pt 66.4)
    for (const y of [20.1, 25.3]) for (let x = a + 0.6; x < b - 0.5; x += 1.4) caja("#f7fbff", x, y - 0.03, x + 0.06, y + 0.03, 0.6, 2.2, { clave: "luz", emisivo: true });
    const xc = (a + b) / 2;
    skid(xc, 22.6, 0, false);
    if (i === 1) pickup(xc, 22.0, 0.3, false, false, "#c0262b"); else if (i === 3) pickup(xc, 22.0, 0.3, false, false, "#16181c"); else sedan(xc, 22.6, 0.3, false, elegir(PINTADO));
    cartel(String(i + 1), xc, 25.4, 2.6, 0.4, 0.4, "-y", "#f2c94c", "#111111");
    bloque("#c9cdd1", a + 0.5, 24.8, 0.5, 0.4, 0, 1.3);
  });
  // frente vidriado con paneles crema y marcos azules sobre y 19,4, con puerta y cartel (pts 65.1, 67.3)
  for (const [a, b] of BOXES) {
    caja("#e9e4cf", a, 19.32, b, 19.42, 0, 1.0);
    caja("#dfe8ef", a, 19.35, b, 19.39, 1.0, 2.6, { clave: "vidrio2", transparente: 0.35 });
    caja("#c7ccd1", a, 19.32, b, 19.42, 2.6, 3.3);
    for (let x = a; x <= b + 0.01; x += 1.25) caja("#23395d", x - 0.05, 19.28, x + 0.05, 19.46, 0, 3.3);
  }
  cartel("BOX DE RETOQUES", 154.0, 19.26, 3.0, 2.6, 0.45, "-y", "#ffffff", "#1f2a3a");
  // armarios para inflamables amarillos, armarios blancos, lockers, mesa de capós y dispenser de agua (pts 66.2, 67.4, 68.3)
  bloque("#e9c23a", 146.6, 21.0, 1.2, 0.5, 0, 1.8); cartel("PELIGRO\nINFLAMABLE", 146.6, 20.74, 1.2, 0.8, 0.5, "-y", "#e9c23a", "#c0392b");
  for (const y of [19.9, 22.2]) bloque("#eceae2", 146.6, y, 1.0, 0.5, 0, 1.9);
  for (let y = 23.2; y < 25.3; y += 0.55) bloque("#e9c23a", 147.4, y, 0.5, 0.52, 0, 1.9);
  bloque("#f4f6f8", 147.5, 17.6, 0.35, 0.35, 0, 1.05); cil("#3b8fd8", 147.5, 17.6, 1.05, 0.45, 0.14);
  for (let k = 0; k < 6; k++) cil("#3b8fd8", 146.4 + (k % 3) * 0.32, 17.2 + Math.floor(k / 3) * 0.32, 0, 0.45, 0.14);
  bloque("#ffffff", 143.5, 16.0, 1.6, 1.0, 0.85, 0.9); for (const dx of [-0.7, 0.7]) bloque("#e0e3e6", 143.5 + dx, 16.0, 0.05, 0.9, 0, 0.85);
  bloque("#eef1f4", 143.5, 16.0, 1.5, 0.9, 0.9, 1.05);   // capó apoyado
  // pasillo interior del recinto (y 12,9–19,2) con carros y operario (pt 67.3)
  for (const x of [152, 158]) { bloque("#e3b420", x, 16.0, 1.0, 0.6, 0.2, 1.0); for (const dx of [-0.4, 0.4]) cil("#2b2f33", x + dx, 16.0, 0, 0.2, 0.08); }
  persona(164, 15.6, 0, false);
  // zona delimitada del plano (verde, x 139–184 · y 4,8–32): borde verde/amarillo en el piso
  for (const [a, b, c, d] of [[139.3, 4.9, 184.4, 5.05], [139.3, 31.9, 184.4, 32.05], [139.3, 4.9, 139.45, 32.05], [184.25, 4.9, 184.4, 32.05]]) pinta("#2e9d6a", a, b, c, d, 0.05);

  // ============================================================= 19) CALLE V SUR, MÁQUINAS SIN NOMBRE 1 y 3 y SALÓN DE ACOPIO DE W SUR (pts 51–53, 56–59, 69)
  // recintos galvanizados de MAQ-01 y MAQ-03 (plano C15) con transportador interior y grupos motor-bomba al sur
  for (const [a, b, m] of [[118.8, 131.4, 135.8], [188.4, 205.9, 210.3]]) {
    galvanizado(a, m, 44.1, true, 7.0, -1); galvanizado(a, m, 48.9, true, 7.0, +1);
    for (const x of [a, m]) galvanizado(44.1, 48.9, x, false, 7.0, x === a ? -1 : 1);
    rodillosRojos(a - 1.5, m + 3.6, 45.9, 0.45);
    motores(m + 0.2, [44.9, 46.9]); bloque("#9aa1a8", m - 2.2, 48.4, 4.4, 1.0, 0, 1.6);   // filtro rayado del plano
    void b;
  }
  cartel("GIUNTO", 155.7, 44.0, 3.2, 1.6, 0.4, "+x", "#ffffff", "#1f2a3a", true);
  // calle V sur: pasillo entre la pared alta (y 37,3) y la fila de columnas y 43
  calleX(98, 250, 38.4, 42.4, [41.6, 42.2], "V", 5.6);
  escaleraY(113.0, 44.4, 5.0, "#aeb6be");   // escaleras del plano (B23)
  // DOSIFICACIÓN DOJO / CABINAS y RECOLECCIÓN DE SOLVENTES (locales del plano): carteles y escalera interior
  cartel("DOSIFICACIÓN\nDOJO / CABINAS", 172.7, 42.75, 1.9, 1.4, 0.6, "-y", "#ffffff", "#1f2a3a");
  cartel("RECOLECCIÓN\nSOLVENTES", 181.6, 42.75, 1.9, 1.4, 0.6, "-y", "#ffffff", "#c0392b");
  escaleraY(179.5, 43.7, 5.0, "#e67e22");
  for (const [x, y] of [[171.2, 44.0], [172.0, 44.0], [183.0, 44.0], [184.0, 44.0]]) cil(elegir(["#1f5fa8", "#c0392b", "#2e8b57"]), x, y, 0, 0.9, 0.29);
  // MINI CENTRAL DE PINTURA (plano x 225,3–233,3 · y 43,3–49): recinto bajo con tanques, bombas y tambores
  for (const [a, b, y, enX] of [[225.3, 233.3, 43.3, true], [225.3, 233.3, 49.0, true], [43.3, 49.0, 225.3, false], [43.3, 49.0, 233.3, false]]) cercoMalla(a, b, y, enX, "#e3a800", 2.2);
  for (const x of [227, 229, 231]) { cil("#d9dee3", x, 47.6, 0, 1.8, 0.55); cil("#7d858d", x, 47.6, 1.8, 0.4, 0.2); }
  for (const x of [227.5, 230.5]) { bloque("#5d6672", x, 45.0, 1.4, 0.6, 0, 0.2); cil("#1f5fa8", x - 0.3, 45.0, 0.35, 0.7, 0.2, "x"); }
  for (let k = 0; k < 4; k++) cil("#2b4f8f", 232.3, 44.2 + k * 0.62, 0, 0.9, 0.29);
  cartel("MINI CENTRAL\nDE PINTURA", 229.3, 43.25, 2.6, 2.0, 0.6, "-y", "#ffffff", "#c0392b");
  // ELEVADOR A LÍNEA FONDO (plano: mesa giratoria Ø4,6 en x 243,2 · y 57,7 + elevador x 245–249,6): sube a cota 9
  rodillosRojos(59.9, 67.0, 243.2, 0.45, 1.4, false);   // TRP-07 (plano x 243,2)
  cil("#c8462f", 243.2, 57.7, 0, 0.35, 2.3); for (let y = 56.2; y < 59.3; y += 0.4) cil("#e0573c", 243.2, y, 0.42, 1.0, 0.06, "x");
  rodillosRojos(243.2 - 0.0, 243.2 + 0.0, 57.7, 0.45);
  for (const [x, y] of [[244.9, 56.6], [249.9, 56.6], [244.9, 58.8], [249.9, 58.8]]) caja("#aeb6be", x - 0.15, y - 0.15, x + 0.15, y + 0.15, 0, 9.4);
  for (const z of [3, 6, 9.2]) caja("#22346a", 244.75, 56.45, 250.05, 58.95, z, z + 0.2);
  bloque("#c8462f", 247.4, 57.7, 4.4, 2.0, 0.5, 0.8);
  for (const [a, b, y, enX] of [[240.6, 250.6, 55.0, true], [240.6, 250.6, 60.4, true]]) cercoMalla(a, b, y, enX, "#e3a800", 2.4);
  cartel("ELEVADOR A\nLÍNEA FONDO", 247.4, 54.95, 2.6, 2.0, 0.6, "-y", "#f2c94c", "#111111");
  escalera(253.2, 65.5, +1, 5.4, "#2e8b57");   // escalera del plano (B23, x 253–258)
  // SALÓN DE ACOPIO de W sur (plano: recinto x 191,5–252 · y 13,3–37,2; pared alta a lo largo de y 37,3 desde x 100)
  galvanizado(100, 252, 37.3, true, 7.5, -1); galvanizado(100, 252, 37.3, true, 7.5, +1);
  galvanizado(13.3, 32.0, 191.5, false, 7.5, +1); galvanizado(36.0, 37.2, 191.5, false, 7.5, +1);
  galvanizado(13.3, 37.2, 252.0, false, 7.5, -1); galvanizado(191.5, 252, 13.3, true, 7.5, +1);
  for (const [a, b, y] of [[191.5, 252, 13.3]]) { caja("#f2c94c", a, y - 0.03, b, y + 0.03, 8.5, 8.56); for (let x = a; x <= b; x += 1.5) caja("#f2c94c", x, y - 0.03, x + 0.05, y + 0.03, 7.5, 8.56); }   // baranda arriba (pt 58.2)
  for (const [x, txt, fondo] of [[194, "CARROCERÍAS\nDELIBERADAS\nUTE 3", "#2f7fd1"], [214, "CARROCERÍAS\nLISTAS PARA MACRO", "#2f7fd1"],
    [228, "CARROCERÍAS LUEGO\nDE MACRO PARA REPARAR", "#e23a77"], [240, "CARROCERÍAS\nLISTAS PARA MONTAJE", "#7cc242"]])
    cartel(txt, x, 37.0, 3.4, 3.4, 0.9, "-y", fondo, "#ffffff");
  cartel("SALIDA →", 244.5, 37.0, 3.8, 1.1, 0.4, "-y", "#1e8449", "#ffffff");
  pinta("#a9b0b8", 132, 27.0, 251.5, 31.0, 0.021);
  for (let x = 132, k = 0; x < 251.5; x += 0.6, k++) pinta(k % 2 ? "#1f2328" : "#f2c94c", x, 27.0, x + 0.6, 27.5, 0.04);
  // cajas de pickup en soportes en peine contra la pared alta (pts 56.1, 56.4, 57.4, 58.3)
  for (let x = 132, i = 0; x < 211; x += 2.4, i++) {
    if (x > 189 && x < 194.5) continue;
    soporte(x, 34.6, false);
    pickup(x, 34.6, 0.55, false, true, elegir(i % 5 === 0 ? ["#16181c", "#1f3f9e"] : BIW));
  }
  cartel("BOX", 150, 32.2, 1.6, 0.4, 0.25, "-y", "#ffffff", "#111111");
  // lado de la línea D: conductos de extracción galvanizados, tablero y escalera verde (pts 56.2–56.3)
  for (let x = 132; x < 246; x += 12) { caja("#aeb6be", x + 0.4, 25.2, x + 1.6, 26.4, 0, 9.0); caja("#aeb6be", x + 0.4, 26.4, x + 1.6, 27.0, 2.0, 3.4); }
  bloque("#d5d2c6", 170, 26.6, 1.2, 0.5, 0, 2.0); cartel("B1", 170, 26.86, 2.0, 0.3, 0.2, "+y", "#f2c94c", "#111111");
  escalera(172.5, 25.4, -1, 5.4, "#2e8b57");
  escalera(245.0, 30.7, +1, 5.4, "#f2c94c");   // escalera del plano (B23, x 245–250) a la plataforma
  // cajones de madera, pallets y bandejas negras (pts 58.1, 59.x)
  for (let x = 214; x < 243; x += 2.2) {
    const y = entre(31.5, 35.5);
    bloque("#c8a774", x, y, 2.0, 1.2, 0, 0.14);
    if (azar() < 0.5) { bloque("#d4b483", x, y, 1.9, 1.1, 0.14, entre(0.9, 1.6), { clave: "film", transparente: 0.85 }); for (let k = 0; k < 3; k++) bloque("#a07a48", x - 0.9 + k * 0.9, y, 0.1, 1.15, 0.14, 1.0); }
    else for (let k = 0; k < 4; k++) bloque("#202327", x, y, 1.8, 1.0, 0.14 + k * 0.2, 0.3 + k * 0.2);
  }
  // estanterías con largueros naranjas y operario con chaleco (pt 59.2); autoelevador CAT con luz roja (pt 69.4)
  for (let x = 222; x < 236; x += 2.8) { for (const dx of [-1.3, 1.3]) for (const dy of [-0.45, 0.45]) bloque("#22346a", x + dx, 22.0 + dy, 0.08, 0.08, 0, 2.6); for (const z of [0.2, 1.0, 1.8, 2.5]) bloque("#e67e22", x, 22.0, 2.7, 1.0, z, z + 0.08); for (let k = 0; k < 4; k++) bloque(elegir(["#c8a774", "#f2c94c", "#ffffff"]), x - 1 + k * 0.6, 22.0, 0.5, 0.7, 1.08, 1.5); }
  persona(228, 24.2, 0, true);
  autoelevadorFijo(206, 29.0);
  for (const [a, b, c, d] of [[203.5, 27.6, 208.5, 27.7], [203.5, 30.3, 208.5, 30.4]]) pinta("#ff2a2a", a, b, c, d, 0.07);

  // ============================================================= 20) CALLE X SUR – fachada oeste, PINTO y BUFFER FINAL (pts 70–76)
  calleX(98, 262, 0.4, 3.6, [0.45, 1.15], "X", 6.0);
  codigosLinea(0.0, "E", [+1]);
  for (const c of colsEje(0.0).filter(c => c[0] > 98 && c[0] < 263)) {
    const x = c[0];
    bloque("#c0392b", x + 0.5, 0.55, 0.75, 0.25, 0.4, 1.15); bloque("#e8e8e8", x + 0.5, 0.68, 0.55, 0.02, 0.5, 1.05);
    cil("#c0392b", x - 0.55, 0.45, 0.4, 6.0, 0.06);
    bloque("#aeb4ba", x + 1.4, 0.6, 0.75, 0.6, 3.6, 4.3); for (let z = 3.7; z < 4.25; z += 0.08) bloque("#6f7780", x + 1.4, 0.91, 0.65, 0.02, z, z + 0.03);
  }
  for (const x of [118, 154, 202, 250]) {
    caja("#2ea84f", x - 1.2, -0.72, x + 1.2, -0.66, 0, 2.4);
    caja("#ffffff", x - 1.0, -0.65, x - 0.2, -0.64, 1.3, 1.9); caja("#ffffff", x + 0.2, -0.65, x + 1.0, -0.64, 1.3, 1.9);
    caja("#c0392b", x - 1.0, -0.64, x + 1.0, -0.62, 1.0, 1.05);
    cartel("SALIDA ↓", x, -0.63, 2.75, 0.8, 0.28, "+y", "#1e8449", "#ffffff");
    cartel("POR FAVOR\nMANTENER LA\nPUERTA CERRADA", x + 0.6, -0.62, 1.6, 0.45, 0.3, "+y", "#c0392b", "#ffffff");
  }
  // estación de válvulas de incendio, CAMILLA y BEBEDERO (pts 73.1–73.2), tableros 101 con pulsadores
  for (const x of [190.5, 191.1]) cil("#c0392b", x, 0.5, 0, 3.4, 0.09);
  cil("#c0392b", 190.8, 0.6, 0.45, 1.6, 0.13, "x");
  bloque("#1e8449", 186.0, 0.45, 0.7, 0.3, 0.6, 1.9); cartel("✚\nCAMILLA", 186.0, 0.61, 1.25, 0.6, 0.7, "+y", "#1e8449", "#ffffff");
  cartel("BEBEDERO", 193.2, 0.3, 2.0, 0.8, 0.22, "+y", "#ffffff", "#111111");
  for (const x of [194.5, 195.6]) { bloque("#cfd3d7", x, 0.5, 0.9, 0.4, 0.4, 2.2); cartel("101", x, 0.71, 1.9, 0.25, 0.2, "+y", "#f2c94c", "#111111"); }
  caja("#e9b10a", 108.5, -0.72, 112.5, -0.64, 0, 4.6);
  for (let x = 254, i = 0; x < 262; x += 1.3, i++) caja(i % 2 ? "#e0a50a" : "#e9b10a", x, -0.72, x + 1.25, -0.6, 0, 5.2);
  cartel("AREA\nMACRO C.P.A.", 100.5, 6.0, 3.6, 2.2, 1.0, "-y", "#ffffff", "#1e6b35", true);
  // cabinas de retoque PINTO02…05 (plano: cabinas sobre TRP-22, y 5,6–12,4) de plástico y perfilería de aluminio (pts 72.1–72.4)
  for (const [a, b, n] of [[134.8, 147.6, 2], [147.6, 162.5, 3], [162.6, 176.4, 4], [176.4, 184.8, 5]]) {
    caja("#e9eef3", a, 5.6, b, 12.4, 3.6, 3.7, { clave: "film", transparente: 0.7 });
    for (const y of [5.6, 12.4]) caja("#eef3f7", a, y - 0.02, b, y + 0.02, 0, 3.6, { clave: "cortina", transparente: 0.4 });
    for (const x of [a, b]) caja("#eef3f7", x - 0.02, 5.6, x + 0.02, 12.4, 0, 3.6, { clave: "cortina", transparente: 0.4 });
    for (let x = a; x <= b + 0.01; x += 2.1) for (const y of [5.6, 12.4]) caja("#cfd6dc", x - 0.05, y - 0.05, x + 0.05, y + 0.05, 0, 3.7);
    caja("#aeb6be", a, 5.55, b, 5.6, 0.1, 1.4, { clave: "mallaG", transparente: 0.4 });
    for (let z = 0, k = 0; z < 2.4; z += 0.3, k++) caja(k % 2 ? "#1f2328" : "#f2c94c", a - 0.08, 5.5, a + 0.08, 5.6, z, z + 0.3);
    cartel("PINTO" + String(n).padStart(2, "0"), a + 1.0, 5.53, 3.2, 0.9, 0.35, "-y", "#ffffff", "#1f2a3a");
    for (let x = a + 1; x < b - 0.5; x += 1.6) caja("#f7fbff", x, 8.4, x + 1.2, 8.46, 3.5, 3.56, { clave: "luz", emisivo: true });
    persona(a + 3, 6.6, 0, false);
  }
  rodillosRojos(121, 185.5, 8.9, 0.45, 1.3);
  // carros de malla naranja para piezas contra las cabinas (pt 72.1)
  for (const x of [122, 124.1, 126.2, 128.3, 130.4]) {
    const y = 4.4;
    bloque("#e67e22", x, y, 1.8, 0.8, 0.3, 0.35);
    bloque("#e67e22", x, y, 1.8, 0.8, 0.35, 1.3, { clave: "mallaN", transparente: 0.6 });
    for (const [dx, dy] of [[-0.8, -0.35], [0.8, -0.35], [-0.8, 0.35], [0.8, 0.35]]) cil("#2b2f33", x + dx, y + dy, 0, 0.3, 0.08);
    bloque("#1f5fa8", x, y, 0.6, 0.4, 0.4, 0.6);
  }
  // BUFFER FINAL (plano: 3 carriles y 6,0 · 8,5 · 11,4 con estaciones cada ~4,4 m; transferencias x 186–191, 228–234, 246–251)
  cercoMalla(186, 252, 3.75, true, "#2a55b8", 2.2, false);
  for (let x = 188; x <= 252; x += 6) for (const y of [4.1, 13.0]) caja("#eef1f4", x - 0.15, y - 0.15, x + 0.15, y + 0.15, 0, 3.8);
  caja("#e6e3d6", 186, 3.9, 252, 13.3, 3.8, 3.95, { clave: "rejilla2", transparente: 0.85 });
  caja("#f2c94c", 186, 3.85, 252, 4.0, 3.95, 4.45);
  for (const y of [6.0, 8.5, 11.4]) {
    caja("#dfe3e7", 191.5, y - 0.65, 250.7, y - 0.55, 0.15, 0.45); caja("#dfe3e7", 191.5, y + 0.55, 250.7, y + 0.65, 0.15, 0.45);
    for (let x = 192; x < 250.7; x += 0.9) cil("#c9ced3", x, y, 0.38, 1.1, 0.05, "y");
    for (let x = 194; x < 250; x += 4.5) bloque("#f2c94c", x, y, 0.3, 1.4, 0.15, 0.3);
  }
  transferencia(186.4, 190.6, 4.9, 12.8, [11.4, 8.5]);
  transferencia(228.6, 233.6, 4.9, 12.8, [6.0, 8.5, 11.4]);
  transferencia(246.6, 251.0, 4.9, 12.8, [11.4]);
  escalera(186.5, 3.0, -1, 3.8, "#f2c94c");
  // TRP-23: salida del buffer hacia Montaje (y 8,9, atraviesa la fachada) con mesa elevadora y escalera del plano
  rodillosRojos(252, 264.5, 8.9, 0.45, 1.3);
  bloque("#c8462f", 256.5, 8.9, 4.0, 1.6, 0.3, 0.55); for (const s of [-1, 1]) diag("#9b3524", 254.8, 8.9 + s * 0.6, 0.05, 258.2, 8.9 - s * 0.6, 0.3, 0.06);
  escalera(253.0, 13.5, +1, 3.8, "#f2c94c");
  for (const x of [252.6, 253.2, 253.8]) { cil("#e67e22", x, 3.0, 0, 0.7, 0.15); bloque("#e67e22", x, 3.0, 0.36, 0.36, 0, 0.04); }

  // ============================================================= 21) CALLE C – fachada sur (plano: franja x 259,7–264,4; pts 84–86)
  // En el plano esta franja figura como "CALLE B" (rótulo en x 260,9 · y 44,5); en planta los carteles dicen CALLE C (fotos 85.1, 86.1)
  pinta("#b4bbc3", 259.7, 1.0, 264.3, 72.0, 0.021); pinta("#b4bbc3", 261.6, 72.0, 264.3, 103.0, 0.021);
  pinta("#f2c94c", 259.75, 1.0, 259.85, 72.0, 0.035);
  pinta("#ffffff", 262.45, 1.0, 262.55, 103.0, 0.045);
  pinta("#f2c94c", 262.6, 1.0, 263.6, 103.0, 0.04); pinta("#2e9d6a", 262.65, 1.0, 263.55, 103.0, 0.05);
  // baranda amarilla entre senda y calle, con topes amarillo/negro (pts 85.1, 85.3, 86.3)
  for (let y = 1.0; y <= 103; y += 2) caja("#f2c94c", 262.5, y, 262.56, y + 0.06, 0, 1.1);
  caja("#f2c94c", 262.5, 1.0, 262.56, 103, 1.04, 1.1); caja("#f2c94c", 262.5, 1.0, 262.56, 103, 0.55, 0.6);
  for (let y = 4; y < 103; y += 6) for (let z = 0, k = 0; z < 0.4; z += 0.1, k++) caja(k % 2 ? "#1f2328" : "#f2c94c", 262.45, y, 262.61, y + 0.4, z, z + 0.1);
  // pared de fachada (cara interior x ≈ 264,4): zócalo azul alto, franja blanca, caños rojos de incendio arriba
  caja("#5b7fb3", 264.84, 1.0, 264.88, 103, 0, 2.6); caja("#f3f5f7", 264.84, 1.0, 264.88, 103, 2.6, 4.8);
  for (const z of [5.2, 5.6]) cil("#c0392b", 264.6, 52.0, z, 102, 0.12, "y");
  for (let y = 3; y < 103; y += 6) caja("#7d858d", 264.45, y, 264.84, y + 0.06, 5.0, 5.8);
  // columnas del eje 23 con código (C23, B23…), aerotermo, espejo convexo y forro amarillo
  for (const c of N.columnas.filter(c => Math.abs(c[0] - 264) < 0.3 && c[4] === 0 && c[1] > 0.5 && c[1] < 103.5)) {
    const lin = LETRA_Y.find(([, y]) => Math.abs(c[1] - y) < 0.8);
    if (lin) cartel(lin[0] + "23", c[0] - c[2] / 2 - 0.02, c[1], 3.8, 0.6, 0.3, "-x", "#1d2f6b", "#f2c94c");
    caja("#f2c230", c[0] - c[2] / 2 - 0.06, c[1] + c[3] / 2 - 0.12, c[0] - c[2] / 2, c[1] + c[3] / 2, 0, 5.0);
    bloque("#aeb4ba", c[0] - 0.9, c[1] + 1.0, 0.6, 0.75, 4.2, 4.9);
    for (let z = 4.3; z < 4.85; z += 0.08) bloque("#6f7780", c[0] - 1.21, c[1] + 1.0, 0.02, 0.65, z, z + 0.03);
  }
  cil("#c9d6e3", 263.7, 25.4, 2.4, 0.05, 0.35, "x"); cil("#f2c94c", 263.75, 25.4, 0, 2.4, 0.03);
  // carteles CALLE C colgantes, VÍA DE ESCAPE y SALIDA
  for (const y of [14, 38, 62, 86]) { cartel("CALLE\nC", 261.5, y, 3.7, 0.6, 0.7, "+y", "#ffffff", "#111111", true); caja("#7d858d", 261.26, y, 261.28, y + 0.02, 4.05, 6.2); caja("#7d858d", 261.72, y, 261.74, y + 0.02, 4.05, 6.2); }
  cartel("↑ VÍA DE\nESCAPE", 261.5, 50, 4.4, 0.9, 0.5, "+y", "#1e8449", "#ffffff", true);
  for (const y of [20, 44, 70, 94]) cartel("SALIDA →", 264.83, y, 3.2, 0.8, 0.28, "-x", "#1e8449", "#ffffff");
  // portones de fachada: madera/naranja con mirillas (pt 84.3) y rápido amarillo (pt 85.3); puerta verde de emergencia (pt 86.3)
  caja("#c98b3c", 264.78, 44.0, 264.84, 48.6, 0, 4.6); for (const y of [44.6, 45.6, 46.6, 47.6]) caja("#f7e9c8", 264.75, y, 264.77, y + 0.5, 2.2, 2.6, { clave: "luz", emisivo: true });
  caja("#e9b10a", 264.78, 20.6, 264.84, 24.6, 0, 4.6); for (let z = 0.5; z < 4.6; z += 0.5) caja("#c99400", 264.75, 20.6, 264.77, 24.6, z, z + 0.05);
  caja("#2ea84f", 264.78, 56.0, 264.84, 58.4, 0, 2.4); caja("#ffffff", 264.76, 56.3, 264.77, 57.0, 1.3, 1.9); caja("#ffffff", 264.76, 57.4, 264.77, 58.1, 1.3, 1.9);
  caja("#c0392b", 264.73, 56.2, 264.75, 58.2, 1.0, 1.05);
  bloque("#cfd3d7", 264.7, 59.2, 0.3, 0.7, 1.0, 1.9);
  // tablero de gestión (LPP) con fotos en la pared (pt 85.3) y cuadro eléctrico en columna (pt 85.4)
  caja("#ffffff", 264.8, 30.0, 264.86, 32.4, 1.0, 2.6); for (let k = 0; k < 8; k++) caja("#8a1f2b", 264.78, 30.2 + (k % 4) * 0.55, 264.79, 30.5 + (k % 4) * 0.55, 1.3 + Math.floor(k / 4) * 0.7, 1.7 + Math.floor(k / 4) * 0.7);
  bloque("#d5d9dd", 263.5, 52.6, 0.25, 0.6, 1.6, 2.4);
  // tractores eléctricos verdes 900/901, carros azules y contenedor naranja "KP1 03" (pt 85.1); autoelevadores y cajones (pts 85.3, 86.3)
  tractor(260.8, 36.0, 901); tractor(260.8, 39.5, 900);
  carro(260.8, 32.6, "#2f5fb8", 1.2); carro(260.8, 30.0, "#2f5fb8", 1.2);
  bloque("#e8611c", 260.8, 27.0, 2.6, 1.4, 0.3, 2.3); cartel("KP1 03", 260.8, 26.29, 1.9, 0.9, 0.35, "-y", "#e8611c", "#ffffff");
  autoelevadorFijo(260.6, 16.0); autoelevadorFijo(260.6, 12.0);
  for (const y of [6, 8.2]) { bloque("#c8a774", 260.6, y, 1.6, 2.0, 0, 0.14); bloque("#d4b483", 260.6, y, 1.5, 1.9, 0.14, 0.9, { clave: "film", transparente: 0.85 }); for (let k = 0; k < 3; k++) bloque("#a07a48", 260.6, y - 0.8 + k * 0.8, 1.55, 0.1, 0.14, 0.9); }
  persona(261.0, 48.0, 0, true);
  // estructura del ELEVADOR: plataforma con escaleras verdes y baranda amarilla (pt 86.1), cartel CALLE C al frente
  caja("#8e99a6", 252.5, 60.5, 258.6, 64.4, 5.4, 5.55, { clave: "rejilla", transparente: 0.75 });
  for (const [x, y] of [[252.6, 60.6], [258.5, 60.6], [252.6, 64.3], [258.5, 64.3]]) caja("#22346a", x - 0.12, y - 0.12, x + 0.12, y + 0.12, 0, 5.4);
  for (const y of [60.5, 64.4]) { caja("#f2c94c", 252.5, y - 0.03, 258.6, y + 0.03, 6.5, 6.56); for (let x = 252.5; x <= 258.6; x += 1.5) caja("#f2c94c", x, y - 0.03, x + 0.05, y + 0.03, 5.55, 6.56); }
  for (let x = 253, k = 0; x < 258; x += 0.5, k++) bloque(elegir(["#3c4b5c", "#56657a"]), x, 59.6, 0.45, 0.5, 0, 1.9);   // armarios/lockers grises (pt 86.1)
  bloque("#c8a774", 256.0, 66.8, 1.8, 1.2, 0, 0.9); cartel("PROHIBIDO\nEL PASO", 256.0, 66.19, 0.8, 0.4, 0.3, "-y", "#ffffff", "#c0392b");

  // ============================================================= 22) CALLE A – fachada norte y AUDITORÍA (pts 77–79)
  pinta("#b4bbc3", 0.4, 10.0, 3.4, 102, 0.021);
  pinta("#f2c94c", 3.1, 10.0, 3.2, 102, 0.035); pinta("#f2c94c", 0.55, 10.0, 0.65, 102, 0.035);
  for (const c of N.columnas.filter(c => Math.abs(c[0]) < 0.6 && c[4] === 0 && c[1] > 1 && c[1] < 103)) {
    const lin = LETRA_Y.find(([, y]) => Math.abs(c[1] - y) < 0.8);
    if (lin) cartel(lin[0] + "01", c[0] + c[2] / 2 + 0.02, c[1], 4.0, 0.55, 0.3, "+x", "#1d2f6b", "#f2c94c");
    caja("#f2c230", c[0] + c[2] / 2, c[1] - 0.3, c[0] + c[2] / 2 + 0.06, c[1] + 0.3, 0.1, 2.0);
  }
  for (const y of [14, 38, 86]) { cartel("CALLE\nA", 1.9, y, 3.7, 0.6, 0.7, "+y", "#ffffff", "#111111", true); caja("#7d858d", 1.66, y, 1.68, y + 0.02, 4.05, 6.2); caja("#7d858d", 2.12, y, 2.14, y + 0.02, 4.05, 6.2); }
  // puerta de emergencia verde + estación de válvulas de incendio con caños rojos (pt 78.2)
  caja("#2ea84f", 0.12, 44.0, 0.2, 46.4, 0, 2.4); caja("#ffffff", 0.21, 44.3, 0.22, 45.1, 1.3, 1.9);
  cartel("EXIT", 0.25, 45.2, 2.6, 1.6, 0.25, "+x", "#1e8449", "#ffffff");
  for (const y of [47.0, 47.6, 48.2]) cil("#c0392b", 0.5, y, 0, 3.4, 0.09);
  cil("#c0392b", 0.6, 47.6, 0.45, 2.4, 0.13, "y"); cil("#c0392b", 0.6, 47.0, 1.2, 0.3, 0.16, "x");
  for (const y of [46.8, 48.4]) bloque("#cfd3d7", 0.3, y + 1.4, 0.2, 0.5, 1.3, 1.9);
  for (let z = 0, k = 0; z < 1.6; z += 0.2, k++) caja(k % 2 ? "#1f2328" : "#f2c94c", 0.9, 46.6, 0.96, 46.66, z, z + 0.2);
  // AUDITORÍA (plano: dos elevadores en x 16–23 · y 52–56): piso turquesa, elevadores COBI, túnel de luz, camionetas terminadas
  pinta("#5fb3ae", 5.0, 46.5, 26.0, 59.0, 0.025);
  for (let y = 46.5, k = 0; y < 59; y += 0.5, k++) pinta(k % 2 ? "#1f2328" : "#f2c94c", 4.6, y, 5.0, y + 0.5, 0.04);
  for (const xc of [18.3, 21.8]) {
    for (const s of [-1, 1]) bloque("#1f3fa0", xc + s * 1.7, 53.7, 0.45, 0.45, 0, 3.6);
    for (const s of [-1, 1]) bloque("#c8462f", xc + s * 0.9, 53.7, 0.25, 3.4, 0, 0.12);
  }
  cartel("C\nO\nB\nI", 16.36, 53.7, 1.9, 0.35, 1.6, "-x", "#1f3fa0", "#ffffff");
  camioneta(18.3, 53.7, false, "#7d838a"); camioneta(21.8, 53.7, false, "#f2f2f2");
  tunelLuz(7.0, 12.6, 50.5, 4.4);
  camioneta(9.8, 50.5, true, "#16181c");
  camioneta(9.0, 57.2, true, "#f2f2f2"); camioneta(24.6, 48.6, false, "#16181c");
  bloque("#c9cdd1", 5.6, 53.0, 0.5, 0.4, 0, 1.1); bloque("#eef1f4", 14.2, 48.0, 1.0, 0.6, 0.8, 0.85);
  persona(13.0, 52.0, 0, false); persona(16.0, 56.5, 0, false);
  bloque("#cfd3d7", 0.35, 72.0, 0.3, 0.7, 0, 1.9);
  // esquina con la calle X norte: cajones, butacas y cajas en espera contra la pared galvanizada (pt 79.1)
  for (const [x, y] of [[1.3, 10.0], [2.5, 10.0]]) { bloque("#c8a774", x, y, 1.0, 0.8, 0, 0.8); bloque("#d9c19a", x, y, 0.9, 0.7, 0.8, 1.1); }
  cil("#e6a12a", 3.4, 10.0, 0, 0.9, 0.3);


  // =============================================================================================
  // 23) MÁS DETALLE (10/10): servicios aéreos de las calles nuevas, seguridad en columnas, acopio de Cronos,
  //     tableros CIEM, flechas y manchas en el piso, y FLUJO ANIMADO de carrocerías sobre los transportadores.
  //     Todo ilustrativo (supuesto): cantidades, velocidades y separación de skids no son datos de producción.
  // =============================================================================================
  // 23a. Servicios aéreos: dos bandejas portacables, caños (aire gris, agua verde, incendio rojo) y rociadores
  function serviciosX(x0, x1, yB, zTop, lado) {
    const s = lado || 1;
    for (const [dy, z] of [[0, zTop - 0.6], [s * 0.6, zTop - 1.0]]) {
      caja("#b6bec6", x0, yB + dy - 0.22, x1, yB + dy + 0.22, z, z + 0.04);
      caja("#a3abb3", x0, yB + dy - 0.24, x1, yB + dy - 0.2, z, z + 0.12); caja("#a3abb3", x0, yB + dy + 0.2, x1, yB + dy + 0.24, z, z + 0.12);
      for (let x = x0; x < x1; x += 3) caja("#8c949c", x, yB + dy - 0.25, x + 0.05, yB + dy + 0.25, z - 0.05, zTop);
      for (let i = 0; i < 3; i++) caja(elegir(["#2b2f33", "#3d4247", "#1f6feb", "#c0392b"]), x0, yB + dy - 0.12 + i * 0.09, x1, yB + dy - 0.07 + i * 0.09, z + 0.04, z + 0.09);
    }
    for (const [col, r, dy, z] of [["#aeb7c2", 0.12, s * 1.2, zTop - 0.25], ["#3c8a5a", 0.09, s * 1.5, zTop - 0.15], ["#c0392b", 0.08, s * 1.8, zTop - 0.4]]) {
      cilindros.push([col, (x0 + x1) / 2, yB + dy, z, x1 - x0, r, "x"]);
      for (let x = x0; x < x1; x += 6) caja("#7d858d", x, yB + dy - r - 0.03, x + 0.06, yB + dy + r + 0.03, z - r - 0.05, zTop);
      if (col === "#c0392b") for (let x = x0 + 1.5; x < x1; x += 3) { caja("#c0392b", x, yB + dy - 0.02, x + 0.04, yB + dy + 0.02, z - 0.35, z); cil("#d9b03a", x + 0.02, yB + dy, z - 0.42, 0.07, 0.05); }
    }
  }
  function serviciosY(y0, y1, xB, zTop, lado) {
    const s = lado || 1;
    caja("#b6bec6", xB - 0.22, y0, xB + 0.22, y1, zTop - 0.6, zTop - 0.56);
    caja("#a3abb3", xB - 0.24, y0, xB - 0.2, y1, zTop - 0.6, zTop - 0.48); caja("#a3abb3", xB + 0.2, y0, xB + 0.24, y1, zTop - 0.6, zTop - 0.48);
    for (let y = y0; y < y1; y += 3) caja("#8c949c", xB - 0.25, y, xB + 0.25, y + 0.05, zTop - 0.65, zTop);
    for (const [col, r, dx, z] of [["#aeb7c2", 0.12, s * 0.9, zTop - 0.25], ["#c0392b", 0.08, s * 1.3, zTop - 0.4]]) {
      cilindros.push([col, xB + dx, (y0 + y1) / 2, z, y1 - y0, r, "y"]);
      for (let y = y0; y < y1; y += 6) caja("#7d858d", xB + dx - r - 0.03, y, xB + dx + r + 0.03, y + 0.06, z - r - 0.05, zTop);
    }
  }
  serviciosX(2, 258, 63.6, 6.2, -1);     // U
  serviciosX(124, 258, 71.8, 4.9, -1);   // mitad T–U (bajo el entrepiso)
  serviciosX(2, 96, 44.9, 6.2, -1);      // V norte
  serviciosX(98, 250, 41.8, 5.4, -1);    // V sur
  serviciosX(2, 96, 35.4, 6.2, -1);      // W norte
  serviciosX(2, 96, 10.9, 6.0, +1);      // X norte
  serviciosX(98, 262, 1.0, 5.8, +1);     // X sur
  serviciosY(1.2, 62, 97.0, 6.2, +1);    // B
  serviciosY(1.0, 103, 263.3, 6.0, -1);  // C
  serviciosY(10, 102, 1.0, 6.2, +1);     // A

  // 23b. Seguridad en columnas de las líneas C, C1, C2, D, D1 junto a las calles: boca de incendio, matafuego, pulsador, cartel
  function seguridadColumna(c, cara, k) {
    const [x, y, w] = c, yc = y + cara * (w / 2 + 0.01);
    if (k % 2 === 0) {
      bloque("#c0392b", x, yc + cara * 0.13, 0.75, 0.25, 0.9, 1.65); bloque("#e8e8e8", x, yc + cara * 0.26, 0.55, 0.02, 1.05, 1.5);
      cartel("HIDRANTE", x, yc + cara * 0.01, 2.0, 0.7, 0.18, cara > 0 ? "+y" : "-y", "#c0392b", "#ffffff");
      caja("#c0392b", x - w / 2 - 0.12, yc, x - w / 2 - 0.04, yc + cara * 0.08, 1.65, 6.0);
    } else {
      cil("#d0312d", x, yc + cara * 0.12, 0.6, 0.55, 0.09);
      cartel("MATAFUEGO", x, yc + cara * 0.005, 1.6, 0.25, 0.55, cara > 0 ? "+y" : "-y", "#e74c3c", "#ffffff");
    }
    bloque("#e74c3c", x + 0.2, yc + cara * 0.04, 0.12, 0.08, 1.45, 1.57);
    if (k % 3 === 1) { bloque("#aeb4ba", x, yc + cara * 0.4, 0.75, 0.6, 3.6, 4.3); for (let z = 3.7; z < 4.25; z += 0.08) bloque("#6f7780", x, yc + cara * 0.71, 0.65, 0.02, z, z + 0.03); }   // aerotermo
  }
  for (const [yL, cara, xa, xb] of [[61.7, +1, 1, 97], [45.8, -1, 1, 97], [36.2, -1, 1, 97], [13.0, -1, 1, 97], [26.0, +1, 99, 251], [52.0, +1, 99, 251]])
    colsEje(yL).filter(c => c[0] >= xa && c[0] <= xb && c[2] >= 0.45).forEach((c, k) => seguridadColumna(c, cara, k));

  // 23c. Acopio de Cronos y cajas sobre soportes entre TRP-17 y el recinto galvanizado (pts 63.3, 81.2)
  for (let x = 101.5, i = 0; x < 137; x += 2.5, i++) {
    if (x > 124.5 && x < 133) continue;   // jaula del elevador
    soporte(x, 23.6, false);
    if (i % 4 === 3) pickup(x, 23.6, 0.55, false, true, elegir(BIW)); else sedan(x, 23.6, 0.55, false, elegir(BIW.concat(["#16181c", "#8d949b"])));
  }
  for (let k = 0; k < 5; k++) pinta("#ffffff", 98.6 + k * 0.8, 20.4, 99.0 + k * 0.8, 21.6, 0.06);

  // 23d. Tableros eléctricos CIEM con pantalla táctil dentro de malla azul junto al buffer y las PINTO (pts 71.4, 73.4)
  function tableroCIEM(x, y, cara, n) {
    for (let i = 0; i < n; i++) {
      const xi = x + i * 0.85;
      bloque("#e7eaec", xi, y, 0.8, 0.5, 0.1, 2.1); bloque("#b9bec3", xi, y, 0.82, 0.52, 0, 0.1);
      caja("#2b2f33", xi - 0.36, y - cara * 0.25, xi + 0.36, y - cara * 0.26, 1.98, 2.0);
      caja("#dfe8ef", xi - 0.25, y - cara * 0.252, xi - 0.02, y - cara * 0.262, 0.6, 1.7, { clave: "vidrio2", transparente: 0.35 });
      if (i === 1) caja("#2a7fd4", xi - 0.2, y - cara * 0.252, xi + 0.2, y - cara * 0.262, 1.3, 1.6, { clave: "luz", emisivo: true });
      bloque("#f2c94c", xi + 0.25, y - cara * 0.255, 0.12, 0.01, 1.05, 1.17);
    }
    cartel("CIEM", x + 0.4, y - cara * 0.27, 2.0, 0.4, 0.15, cara > 0 ? "-y" : "+y", "#ffffff", "#c0392b");
    cil("#2ecc71", x, y, 2.1, 0.12, 0.05); cil("#e74c3c", x, y, 2.22, 0.12, 0.05);
  }
  tableroCIEM(196, 4.3, -1, 3); tableroCIEM(219, 4.3, -1, 2); tableroCIEM(236, 4.3, -1, 3); tableroCIEM(165, 4.5, -1, 2);
  // estanterías blancas con transportador inclinado de piezas (PINTO05, pt 71.1)
  for (let x = 177; x < 184; x += 1.8) {
    for (const dx of [-0.85, 0.85]) for (const dy of [-0.4, 0.4]) bloque("#f1f3f5", x + dx, 4.6 + dy, 0.06, 0.06, 0, 2.2);
    for (const z of [0.5, 1.3, 2.15]) bloque("#f1f3f5", x, 4.6, 1.8, 0.86, z, z + 0.05);
    diag("#d5dadf", x - 0.8, 4.6, 0.7, x + 0.8, 4.6, 1.2, 0.5);
  }
  // caballetes de seguridad amarillos y mesa con sillas del puesto de macro (pt 70.4)
  bloque("#e9e4cf", 106.0, 5.0, 1.2, 0.8, 0.72, 0.76); for (const dx of [-0.8, 0.8]) bloque("#2b2f33", 106.0 + dx, 5.0, 0.45, 0.45, 0.42, 0.46);
  cartel("DIRECTO", 106.0, 4.58, 1.3, 0.6, 0.2, "-y", "#ffffff", "#1f2a3a");

  // 23e. Flechas de sentido pintadas junto a los transportadores y numeración de lugares de acopio
  function flecha(x, y, dir) {
    const d = dir > 0 ? 1 : -1;
    pinta("#f2f2f2", x - 0.7, y - 0.07, x + 0.4, y + 0.07, 0.065);
    for (let k = 0; k < 5; k++) { const t = k * 0.1; pinta("#f2f2f2", x + d * (0.4 + t), y - 0.3 + t * 0.6, x + d * (0.5 + t), y + 0.3 - t * 0.6, 0.066); }
  }
  for (let x = 90; x < 245; x += 24) flecha(x, 66.0, +1);
  for (let x = 20; x < 90; x += 24) { flecha(x, 32.1, -1); flecha(x + 6, 21.7, +1); }
  for (let x = 125; x < 185; x += 12) flecha(x, 7.4, +1);
  for (let x = 196; x < 250; x += 16) flecha(x, 4.9, +1);
  for (let x = 132, n = 1; x < 211; x += 2.4, n++) if (!(x > 189 && x < 194.5)) cartel(String(n), x, 32.15, 0.15, 0.35, 0.25, "+y", "#ffffff", "#111111");
  // manchas de líquido y desgaste en las calles nuevas
  for (const [x0, x1, y0, y1, n] of [[2, 258, 62.1, 64.2, 70], [124, 258, 70.2, 72.4, 40], [2, 96, 43, 45.4, 25], [2, 96, 33.1, 35.9, 25], [2, 96, 10.5, 12.6, 25], [98, 262, 0.5, 3.5, 50], [259.8, 262.4, 1, 72, 30], [95.7, 98.3, 1.3, 62, 20], [132, 251, 27.6, 31, 40]])
    for (let i = 0; i < n; i++) { const x = entre(x0, x1), y = entre(y0, y1); pinta(elegir(["#8f979f", "#9aa2aa", "#a3abb2", "#7f8890"]), x, y, x + entre(0.4, 2.2), y + entre(0.2, 0.8), 0.028); }

  // 23f. Calle C: rectángulos amarillos de estacionamiento, cajones apilados y sala galvanizada con escalera (pt 86.2)
  for (const [a, b] of [[253.0, 255.8], [256.2, 259.0]]) for (const [p, q, r, s] of [[a, 67.2, b, 67.3], [a, 71.2, b, 71.3], [a, 67.2, a + 0.1, 71.3], [b - 0.1, 67.2, b, 71.3]]) pinta("#f2c94c", p, q, r, s, 0.06);
  for (const [x, y, h] of [[254.4, 69.2, 2], [257.6, 69.2, 1]]) for (let k = 0; k < h; k++) { bloque("#c8a774", x, y, 2.2, 1.4, k * 0.95, k * 0.95 + 0.12); bloque("#d4b483", x, y, 2.1, 1.3, k * 0.95 + 0.12, k * 0.95 + 0.9, { clave: "film", transparente: 0.85 }); for (let j = 0; j < 3; j++) bloque("#a07a48", x - 1.0 + j * 1.0, y, 0.1, 1.35, k * 0.95 + 0.12, k * 0.95 + 0.9); }
  autoelevadorFijo(258.0, 74.0);

  // 23g. Más gente trabajando (estático): retoques, macro, PINTO, calle C, buffer
  for (const [x, y, ch] of [[151, 22.0, false], [162.5, 21.2, false], [173, 23.4, false], [112, 7.0, false], [141, 10.8, false], [170, 6.6, false], [261.0, 34.2, true], [221, 4.3, false], [130, 16.0, true]]) persona(x, y, 0, ch);

  // 23h. FLUJO ANIMADO: carrocerías sobre skid que avanzan por los transportadores del plano
  const flujo = new THREE.Group(); grupo.add(flujo);
  const geoCaja = (lx, ly, lz, cx, cy, cz) => { const g = new THREE.BoxGeometry(lx, lz, ly); g.translate(cx, cz, -cy); return g; };
  function unir(gs) {
    gs = gs.map(g => g.index ? g.toNonIndexed() : g); let n = 0; for (const g of gs) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0; const idx = [];
    for (const g of gs) { const gi = g; pos.set(gi.attributes.position.array, o * 3); nor.set(gi.attributes.normal.array, o * 3); for (let i = 0; i < gi.attributes.position.count; i++) idx.push(o + i); o += gi.attributes.position.count; }
    const r = new THREE.BufferGeometry(); r.setAttribute("position", new THREE.BufferAttribute(pos.slice(0, o * 3), 3)); r.setAttribute("normal", new THREE.BufferAttribute(nor.slice(0, o * 3), 3)); return r;
  }
  // geometrías en coordenadas locales (x = largo, y = ancho, z = alto), base del skid en z = 0
  const G_SKID = unir([geoCaja(5.0, 0.12, 0.16, 0, -0.45, 0.08), geoCaja(5.0, 0.12, 0.16, 0, 0.45, 0.08), ...[-2, -1, 0, 1, 2].map(k => geoCaja(0.1, 1.0, 0.14, k * 1.1, 0, 0.23))]);
  const G_SEDAN = unir([[-2.18, -1.3, 0.3, 0.82], [-1.3, -0.75, 0.3, 0.92], [-0.75, 1.05, 0.3, 0.95], [1.05, 2.18, 0.3, 0.98], [-0.45, 0.85, 0.95, 1.46], [-0.85, -0.45, 0.95, 1.22], [0.85, 1.25, 0.98, 1.3]].map(([a, b, z0, z1]) => geoCaja(b - a, 1.68, z1 - z0, (a + b) / 2, 0, 0.3 + (z0 + z1) / 2)));
  const G_CABINA = unir([[-1.75, -1.0, 0.45, 1.05], [-1.0, 1.35, 0.45, 1.12], [-0.5, 1.35, 1.12, 1.88], [-0.95, -0.5, 1.12, 1.45]].map(([a, b, z0, z1]) => geoCaja(b - a, 1.8, z1 - z0, (a + b) / 2, 0, 0.3 + (z0 + z1) / 2)));
  const G_CAJA = unir([geoCaja(3.2, 1.86, 0.15, 0, 0, 0.82), geoCaja(3.2, 0.1, 0.52, 0, 0.88, 1.16), geoCaja(3.2, 0.1, 0.52, 0, -0.88, 1.16), geoCaja(0.08, 1.86, 0.52, 1.56, 0, 1.16), geoCaja(0.08, 1.86, 0.52, -1.56, 0, 1.16)]);
  const G_VIDRIO = unir([geoCaja(1.3, 1.7, 0.4, 0.2, 0, 1.5)]);
  const matCache = new Map();
  const matDe = (c) => { if (!matCache.has(c)) matCache.set(c, new THREE.MeshLambertMaterial({ color: c })); return matCache.get(c); };
  function carroceriaMovil(tipo, color) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(G_SKID, matDe("#5d6672")));
    const body = new THREE.Mesh(tipo === "sedan" ? G_SEDAN : tipo === "cabina" ? G_CABINA : G_CAJA, matDe(color));
    body.castShadow = !MOVIL; g.add(body);
    if (tipo === "sedan") g.add(new THREE.Mesh(G_VIDRIO, matDe("#3b4656")));
    flujo.add(g); return g;
  }
  // recorrido = polilínea en metros del plano; z = altura del transportador
  // recorrido = polilínea en metros del plano [x, y, z?]; z por punto (si falta, la del recorrido). Admite tramos verticales (elevadores)
  function recorrido(pts, z) {
    const P = pts.map(p => [p[0], p[1], p.length > 2 ? p[2] : z]);
    const seg = []; let L = 0, angPrev = 0;
    for (let i = 0; i < P.length - 1; i++) {
      const [a, b] = [P[i], P[i + 1]]; const lp = Math.hypot(b[0] - a[0], b[1] - a[1]); const l = Math.hypot(lp, b[2] - a[2]);
      const ang = lp > 1e-6 ? Math.atan2(b[1] - a[1], b[0] - a[0]) : angPrev; angPrev = ang;
      seg.push({ a, b, l, L0: L, ang }); L += l;
    }
    return { seg, L, z, punto(s) { s = ((s % L) + L) % L; const g = seg.find(q => s <= q.L0 + q.l) || seg[seg.length - 1]; const t = (s - g.L0) / g.l; return [g.a[0] + (g.b[0] - g.a[0]) * t, g.a[1] + (g.b[1] - g.a[1]) * t, g.ang, g.a[2] + (g.b[2] - g.a[2]) * t]; } };
  }
  const LINEAS = [
    // SELLADO (Julian 10/10): TRP-03 por la cabina de sellado hacia −x → giro en U por la transferencia TRP-04 (x 80,5) →
    // vuelve por TRP-06 hacia +x → TRP-07 baja a la mesa giratoria (x 243,2) → ELEVADOR A LÍNEA FONDO → sube a cota 9
    { r: recorrido([[254, 76.45, 0.72], [80.5, 76.45, 0.72], [80.5, 67.7, 0.48], [243.2, 67.7, 0.48], [243.2, 57.7, 0.48], [247.4, 57.7, 0.8], [247.4, 57.7, 9.4]], 0.48), n: 64, v: 0.9, abierta: true, tipos: ["sedan", "cabina", "caja"], colores: ECOAT },
    // TRP-05: lazo de la cabina PVC y el master de sellado (plano: y 67,7 hacia +x, master, vuelve por y 76 y gira en x 18)
    { r: recorrido([[19.7, 67.7], [78, 67.7], [101.3, 67.7], [102.8, 66.2], [102.8, 57], [104.3, 55.5], [109.3, 55.5], [110.8, 57], [110.8, 74.5], [109.3, 76.45], [19.7, 76.45], [18.2, 74.5], [18.2, 69.2], [19.7, 67.7]], 0.48), n: 10, v: 0.5, abierta: false, tipos: ["sedan", "cabina", "caja"], colores: ECOAT },
    // CALESITA: lazo TRP-13 → 14 → 16 → 15 (y 30,9 hacia −x; y 22,9 hacia +x)
    { r: recorrido([[92.8, 30.9], [7.2, 30.9], [7.2, 22.9], [92.8, 22.9], [92.8, 30.9]], 0.48), n: 22, v: 0.7, abierta: false, tipos: ["sedan", "cabina", "caja"], colores: PINTADO },
    // TRP-22 (macro → PINTO) y transferencia al buffer final, carril central y 8,5
    { r: recorrido([[121, 8.9], [186.5, 8.9], [188.6, 8.5], [250.7, 8.5], [264.5, 8.9]], 0.48), n: 12, v: 0.6, abierta: true, salida: true, tipos: ["sedan", "cabina", "caja"], colores: PINTADO },
    { r: recorrido([[188.6, 11.4], [250.7, 11.4]], 0.48), n: 9, v: 0.35, abierta: true, salida: true, tipos: ["sedan"], colores: PINTADO },
    { r: recorrido([[188.6, 6.0], [250.7, 6.0]], 0.48), n: 9, v: 0.45, abierta: true, salida: true, tipos: ["cabina", "caja"], colores: PINTADO },
    // TRP-17 (entrada a macro, y 17,4)
    { r: recorrido([[100.3, 17.4], [125.5, 17.4]], 0.48), n: 4, v: 0.5, abierta: true, tipos: ["sedan"], colores: PINTADO },
    // TRP-11 / 10 / 12 dentro de las máquinas sin nombre (túneles)
    { r: recorrido([[117, 45.9], [139.3, 45.9]], 0.48), n: 4, v: 0.5, abierta: true, tipos: ["sedan"], colores: ECOAT },
    { r: recorrido([[186.6, 45.9], [213.9, 45.9]], 0.48), n: 4, v: 0.5, abierta: true, tipos: ["sedan"], colores: ECOAT },
  ];
  const moviles = [];
  for (const ln of LINEAS) {
    const paso = ln.r.L / ln.n;
    for (let i = 0; i < ln.n; i++) {
      if (azar() < 0.15 && ln.abierta) continue;   // huecos en la línea
      const tipo = ln.tipos[i % ln.tipos.length];
      // Titano/Dakota: cabina y caja van en skids separados pero seguidos y del mismo color (flujo cabina–caja)
      const color = tipo === "caja" && ln.ultimoColor ? ln.ultimoColor : elegir(ln.colores);
      ln.ultimoColor = tipo === "cabina" ? color : null;
      moviles.push({ ln, s: i * paso + entre(-0.3, 0.3), g: carroceriaMovil(tipo, color) });
    }
  }
  const zona = (x, y) => x > 142.5 && x < 147.5 && Math.abs(y - 67.7) < 1;   // el cruce peatonal: los skids pasan igual (es un paso a nivel)
  void zona;
  function ubicar(m) {
    const [x, y, ang, z] = m.ln.r.punto(m.s);
    m.g.position.copy(W(x, y, z));
    m.g.rotation.y = ang;
  }
  moviles.forEach(ubicar);
  if (animar) animar.push((dt) => { if (!grupo.visible) return; for (const m of moviles) { const v0 = Math.floor(m.s / m.ln.r.L); m.s += m.ln.v * dt; if (m.ln.salida && Math.floor(m.s / m.ln.r.L) > v0) { contador++; dibujarAndon(); } ubicar(m); } });


  // =============================================================================================
  // 24) PROCESO DE LA COTA 0 (fuentes: Overview Unidad Pintura 2026 diap. 4; Trazabilidad Caja-Cabina diap. 16 y 24;
  //     "Zona difusión dibujo"; cronología de puesto CRUZCOTTO DX/SX; calculadora "disposición de skids").
  //     Secuencia: cabina de sellado (desde cota 5,4/9 y vuelve a cota 9) · bajada desde Finish Line (cota 9) →
  //     Assembly friso – others / ÓLEO (estación C) → Reparation box (estación R) → Buffer KP1 / Difusión (estación D) → Montaje KP1.
  //     Ubicación de cada etapa sobre el plano: interpretación de Claude (supuesto) salvo Difusión (plano del PDF).
  // =============================================================================================
  // 24a. Carteles de etapa colgados (estilo señalética de planta)
  function cartelEtapa(txt, x, y, z, ancho, mira, fondo) {
    cartel(txt, x, y, z, ancho, ancho * 0.28, mira, fondo || "#1d2f6b", "#ffffff", true);
    const dx = mira === "+x" || mira === "-x" ? 0 : ancho * 0.4, dy = dx ? 0 : ancho * 0.4;
    for (const s of [-1, 1]) caja("#7d858d", x + s * dx - 0.01, y + s * dy - 0.01, x + s * dx + 0.01, y + s * dy + 0.01, z + ancho * 0.14, 9.0);
  }
  cartelEtapa("CABINA DE SELLADO · SIGILLATURA", 180, 76.4, 5.6, 7.0, "+y", "#1d2f6b");
  cartelEtapa("BAJADA DESDE FINISH LINE (COTA 9)", 128.8, 15.4, 6.2, 5.0, "-y", "#6b2fa0");
  cartelEtapa("ÓLEO · ASSEMBLY FRISO – OTHERS", 158, 8.9, 5.0, 6.5, "-y", "#1d2f6b");
  cartelEtapa("REPARATION BOX · BOX DE RETOQUES", 162, 16.0, 4.6, 6.0, "-y", "#c0392b");
  cartelEtapa("DIFUSIÓN · BUFFER KP1  →  MONTAJE KP1", 219, 8.6, 5.6, 8.0, "-y", "#2e7d32");
  cartelEtapa("CALESITA · ACUMULO (CAJA, CABINA, CRONOS)", 50, 26.9, 4.8, 7.0, "+y", "#e67e22");
  cartelEtapa("BOX MANTENIMIENTO", 65.6, 10.0, 3.8, 3.4, "-y", "#455a64");

  // 24b. Estaciones de conteo MIP (cubos amarillos con letra, como en el boceto de Trazabilidad) + lector y PC
  function estacionMIP(letra, x, y, txt) {
    bloque("#5d6672", x, y, 0.5, 0.5, 0, 0.1); bloque("#7d858d", x, y, 0.12, 0.12, 0.1, 1.1);
    bloque("#2b2f33", x, y, 0.55, 0.06, 1.1, 1.5); bloque("#dfe8ef", x, y - 0.035, 0.48, 0.01, 1.14, 1.46, { clave: "luz", emisivo: true });
    bloque("#f2c94c", x + 0.35, y, 0.12, 0.08, 1.0, 1.2);   // lector de código de barras
    bloque("#e0a800", x, y, 0.7, 0.7, 2.3, 3.0);
    for (const m of ["+y", "-y", "+x", "-x"]) {
      const o = 0.36;
      const [cx, cy] = { "+y": [x, y + o], "-y": [x, y - o], "+x": [x + o, y], "-x": [x - o, y] }[m];
      cartel(letra, cx, cy, 2.65, 0.6, 0.6, m, "#e0a800", "#ffffff");
    }
    cartel(txt, x, y - 0.38, 1.85, 1.1, 0.3, "-y", "#ffffff", "#1f2a3a");
  }
  estacionMIP("C", 122.2, 6.6, "ESTACIÓN C\nASSEMBLY FRISO");
  estacionMIP("R", 177.2, 18.4, "ESTACIÓN R\nREPARATION");
  estacionMIP("D", 251.4, 4.6, "ESTACIÓN D\nBUFFER KP1");

  // 24c. Andón de producción sobre la difusión: datos del Overview (necesidad, objetivos por turno, capacidad);
  //      el contador es SIMULADO (cuenta las carrocerías animadas que salen hacia Montaje)
  const cvA = document.createElement("canvas"); cvA.width = 1024; cvA.height = 384;
  const texA = new THREE.CanvasTexture(cvA); texA.anisotropy = 4;
  let contador = 0;
  function dibujarAndon() {
    const g = cvA.getContext("2d");
    g.fillStyle = "#0d1117"; g.fillRect(0, 0, 1024, 384);
    g.strokeStyle = "#2e7d32"; g.lineWidth = 10; g.strokeRect(5, 5, 1014, 374);
    g.fillStyle = "#9be29b"; g.font = "bold 44px Consolas, monospace"; g.fillText("PINTURA · COTA 0 · DIFUSIÓN → KP1", 34, 70);
    g.fillStyle = "#ffffff"; g.font = "bold 38px Consolas, monospace";
    g.fillText("NECESIDAD PO: 300 skids/día", 34, 135);
    g.fillText("TURNO 1  OBJ 197   ·   TURNO 2  OBJ 103", 34, 190);
    g.fillText("CAPACIDAD 26,7 SPH (SPH x OPE)", 34, 245);
    g.fillStyle = "#ffd54f"; g.font = "bold 64px Consolas, monospace"; g.fillText("SALIDAS: " + String(contador).padStart(3, "0"), 34, 330);
    g.fillStyle = "#8b949e"; g.font = "24px Consolas, monospace"; g.fillText("contador simulado", 700, 330);
    texA.needsUpdate = true;
  }
  dibujarAndon();
  const andon = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 2.4), new THREE.MeshBasicMaterial({ map: texA, side: THREE.DoubleSide }));
  andon.position.copy(W(238, 12.85, 6.2)); andon.rotation.y = 0;
  grupo.add(andon);
  bloque("#1f2328", 238, 13.0, 6.6, 0.14, 4.95, 7.45);
  for (const s of [-1, 1]) caja("#7d858d", 238 + s * 2.8, 12.99, 238 + s * 2.8 + 0.02, 13.01, 7.45, 9.0);

  // 24d. Mesa pantógrafo de ingreso a la cabina de sellado (proyecto CPU9 "mesa pantógrafo", sensores inductivos y centradores)
  const pant = new THREE.Group(); grupo.add(pant);
  pinta("#f2c94c", 255.2, 74.6, 260.6, 78.3, 0.05);
  for (let x = 255.2, k = 0; x < 260.6; x += 0.4, k++) { pinta(k % 2 ? "#1f2328" : "#f2c94c", x, 74.6, x + 0.4, 74.85, 0.06); pinta(k % 2 ? "#1f2328" : "#f2c94c", x, 78.05, x + 0.4, 78.3, 0.06); }
  for (const [x, y] of [[255.5, 74.9], [260.3, 74.9], [255.5, 78.0], [260.3, 78.0]]) { bloque("#5d6672", x, y, 0.14, 0.14, 0, 1.3); bloque("#2ecc71", x, y, 0.1, 0.1, 1.3, 1.36, { clave: "luz", emisivo: true }); }
  const matPant = new THREE.MeshLambertMaterial({ color: "#c8462f" }), matTijera = new THREE.MeshLambertMaterial({ color: "#3a3f45" });
  const mesa = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.16, 2.2), matPant); pant.add(mesa);
  const tijeras = [];
  for (const s of [-1, 1]) for (const d of [-1, 1]) { const t = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.08, 0.08), matTijera); t.userData = { s, d }; pant.add(t); tijeras.push(t); }
  const cargaPant = carroceriaMovil("sedan", ECOAT[0]); flujo.remove(cargaPant); pant.add(cargaPant);
  const cPant = W(257.9, 76.45, 0);
  function moverPantografo(t) {
    const h = 0.35 + 0.85 * (0.5 + 0.5 * Math.sin(t * 0.5));
    mesa.position.set(cPant.x, h, cPant.z);
    cargaPant.position.set(cPant.x, h + 0.08, cPant.z);
    const ang = Math.asin(Math.min(0.95, h / 4.2));
    for (const tj of tijeras) { tj.position.set(cPant.x, h / 2, cPant.z + tj.userData.s * 0.95); tj.rotation.z = tj.userData.d * ang; }
  }
  moverPantografo(0);

  // 24e. Elevador de bajada desde cota 9 (Finish Line → cota 0): torre de 4 parantes y plataforma que baja con una carrocería
  for (const [x, y] of [[126.0, 12.6], [130.6, 12.6], [126.0, 18.4], [130.6, 18.4]]) caja("#aeb6be", x - 0.15, y - 0.15, x + 0.15, y + 0.15, 0, 9.4);
  for (const z of [3.0, 6.0, 9.2]) { caja("#22346a", 125.85, 12.45, 130.75, 12.6, z, z + 0.2); caja("#22346a", 125.85, 18.4, 130.75, 18.55, z, z + 0.2); }
  caja("#e3a800", 125.9, 12.5, 130.7, 12.55, 2.6, 9.2, { clave: "malla#e3a800", transparente: 0.3 });
  const elev = new THREE.Group(); grupo.add(elev);
  const plat = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.2, 4.2), matPant); elev.add(plat);
  const cargaElev = carroceriaMovil("cabina", PINTADO[2]); flujo.remove(cargaElev); elev.add(cargaElev);
  const cElev = W(128.3, 15.5, 0);
  let tElev = 0;
  function moverElevador(dt) {
    tElev = (tElev + dt) % 40;           // ciclo de 40 s: baja cargado, espera, sube vacío
    let z, cargado = true;
    if (tElev < 14) z = 9.2 - (tElev / 14) * 7.8;
    else if (tElev < 20) z = 1.4;
    else if (tElev < 34) { z = 1.4 + ((tElev - 20) / 14) * 7.8; cargado = false; }
    else z = 9.2;
    if (tElev >= 18 && tElev < 20) cargado = false;
    plat.position.set(cElev.x, z, cElev.z);
    cargaElev.position.set(cElev.x, z + 0.1, cElev.z); cargaElev.visible = cargado;
  }
  moverElevador(0);

  // 24f. Puestos de la cabina de sellado (cronología CRUZCOTTO DX/SX): casetta de distanciales, mesa con kellers,
  //      medallones y masa termoendurente, soporte de pistola de sellador con manguera, pincel; operarios en ambos lados
  for (let x = 130, k = 0; x < 232; x += 13, k++) {
    for (const [y, lado] of [[74.35, "SX"], [78.55, "DX"]]) {
      const zb = 0.4;   // plataforma de la línea (bajada 0,5 m en la sección 6)
      bloque("#2e7d4f", x + 2.2, y, 0.9, 0.45, zb, zb + 1.7);                      // casetta de distanciales
      for (let j = 0; j < 4; j++) bloque("#d0d4d8", x + 1.9 + j * 0.2, y + (lado === "SX" ? 0.24 : -0.24), 0.05, 0.05, zb + 1.2, zb + 1.5);
      bloque("#e9e4cf", x - 1.6, y, 1.2, 0.6, zb + 0.85, zb + 0.9);                   // mesa de trabajo
      for (const dx of [-0.5, 0.5]) bloque("#7d858d", x - 1.6 + dx, y, 0.05, 0.5, zb, zb + 0.85);
      for (let j = 0; j < 3; j++) bloque(elegir(["#1f5fa8", "#c0392b", "#f2c94c"]), x - 2.0 + j * 0.4, y, 0.32, 0.4, zb + 0.9, zb + 1.05);   // cajas de kellers / medallones
      bloque("#5d6672", x + 0.3, y, 0.25, 0.25, zb, zb + 1.3);                       // soporte de pistola
      cil("#2b2f33", x + 0.3, y, zb + 1.3, 4.0 - zb - 1.3, 0.025);                    // manguera de sellador que baja del aéreo
      bloque("#c9d1da", x + 0.3, y + (lado === "SX" ? 0.15 : -0.15), 0.08, 0.3, zb + 1.1, zb + 1.3);
      if (k % 2 === 0) cartel("CRUZCOTTO " + lado, x - 1.6, y + (lado === "SX" ? -0.31 : 0.31), zb + 1.6, 1.4, 0.3, lado === "SX" ? "-y" : "+y", "#ffffff", "#1d2f6b");
    }
  }

  // 24g. Zonas de skids de la calculadora "disposición de skids" (capacidad geométrica): las zonas C, D y E coinciden
  //      con las franjas del plano entre calles (C: X norte–W 20,2 m; D: W–V 7,0 m; E: V–U 16,5 m; largo ≈ 90 m)
  for (const [txt, x, y, w] of [["ZONA C · 160 SKIDS (cap. geométrica)", 48, 13.2, 7], ["ZONA D · 48 SKIDS", 48, 36.4, 5], ["ZONA E · 138 SKIDS", 60, 46.0, 5]]) {
    pinta("#f2f2f2", x - w / 2, y - 0.25, x + w / 2, y + 0.25, 0.066);
    cartel(txt, x, y, 4.3, w, 0.5, "+y", "#1d2f6b", "#ffffff", true);
    for (const s of [-1, 1]) caja("#7d858d", x + s * w * 0.4, y - 0.01, x + s * w * 0.4 + 0.02, y + 0.01, 4.55, 6.2);
  }
  if (animar) { let tp = 0; animar.push((dt) => { if (!grupo.visible) return; tp += dt; moverPantografo(tp); moverElevador(dt); }); }

  // ============================================================= construir mallas
  for (const { color, opc, pos, alto: esAlto } of baldes.values()) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    const m = new THREE.MeshLambertMaterial({
      color, transparent: !!opc.transparente, opacity: opc.transparente || 1,
      emissive: opc.emisivo ? color : 0x000000, emissiveIntensity: opc.emisivo ? 0.6 : 0,
      polygonOffset: !!opc.piso, polygonOffsetFactor: opc.piso ? -3 : 0, depthWrite: !opc.transparente,
    });
    const mesh = new THREE.Mesh(g, m);
    mesh.castShadow = !opc.piso && !opc.transparente && !MOVIL;
    mesh.receiveShadow = true;
    (esAlto ? alto : grupo).add(mesh);
  }
  // cilindros agrupados por color/eje en InstancedMesh
  const porTipo = new Map();
  for (const c of cilindros) { const k = c[0] + c[6] + (c[6] === "z" && c[3] + c[4] > 3.6 || c[6] !== "z" && c[3] > 3.6 ? "|alto" : ""); if (!porTipo.has(k)) porTipo.set(k, []); porTipo.get(k).push(c); }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
  for (const [k, lista] of porTipo) {
    const [color, , , , , , eje] = lista[0];
    const im = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 12), new THREE.MeshLambertMaterial({ color }), lista.length);
    lista.forEach(([, x, y, z0, h, r], i) => {
      if (eje === "z") { q.identity(); v.copy(W(x, y, z0 + h / 2)); }
      else if (eje === "x") { q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2); v.copy(W(x, y, z0)); }
      else { q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2); v.copy(W(x, y, z0)); }
      m4.compose(v, q, s.set(r, h, r)); im.setMatrixAt(i, m4);
    });
    im.castShadow = !MOVIL;
    (k.endsWith("|alto") ? alto : grupo).add(im);
  }
  return { alto, flujo, moviles, cajas: [...baldes.values()].reduce((n, b) => n + b.pos.length / 108, 0), cilindros: cilindros.length, carteles: cacheTex.size };
};
