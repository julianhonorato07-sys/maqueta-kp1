/* Detalle fino de las calles de la cota 0: S, "entre S y T", T (fotos 08/10) y U, mitad T–U, V, W, entre W y X, X, A (fotos 09/10).
 * Todo sale del relevamiento fotográfico de Julian (08/10/2026, docs/relevamiento_calles.md).
 * Posiciones: ancladas a columnas con cartel (A0x / B0x = n° × 12 m). Medidas y cantidades: ESTIMADAS por foto.
 * Se llama desde app.js con window.DetalleCalles(api). Coordenadas en metros del plano (x al sur, y al este). */
window.DetalleCalles = function (api) {
  "use strict";
  const { THREE, W, N, capa, MOVIL } = api;
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
  for (let x = X0 + 4, i = 0; x < X1 - 3; x += 6.5, i++) {
    skid(x, 76.45, 1.2, true);
    if (i % 3 === 2) pickup(x, 76.45, 1.5, true, false); else sedan(x, 76.45, 1.5, true);
  }
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
  // RELEVAMIENTO 09/10: calles U, mitad T–U, V, W, entre W y X, X y A (fotos pts 31–79).
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

  // ============================================================= 14) CALLE U (y ≈ 60,6–63,4) – pts 31–40
  calleX(2, 262, 60.6, 63.4, [62.55, 63.15], "U");
  forroAmarillo(61.7, 0, 264); forroAmarillo(52.0, 120, 264);
  codigosLinea(52.0, "C", [+1]);
  // 14a. CENTRAL P.V.C. (pt 31.4): jaula de malla amarilla con tanque naranja, tambores y bombas
  for (const [a, b, y, enX] of [[5.6, 16.4, 64.8, true], [5.6, 16.4, 73.3, true], [64.8, 73.3, 5.6, false], [64.8, 73.3, 16.4, false]]) cercoMalla(a, b, y, enX, "#e3a800", 2.6);
  cartel("CENTRAL P.V.C.", 11, 64.75, 2.0, 2.6, 0.9, "-y", "#ffffff", "#111111");
  cil("#e67e22", 9.0, 68.5, 0, 2.6, 1.0); cil("#c9d1da", 9.0, 68.5, 2.6, 0.4, 0.3);
  for (const [x, y] of [[12.5, 66.2], [13.3, 66.2], [14.1, 66.2], [12.5, 67.0]]) { cil("#f2c94c", x, y, 0, 0.9, 0.3); cil("#2b2f33", x, y, 0.9, 0.04, 0.31); }
  for (const x of [11.5, 13.5]) { bloque("#5d6672", x, 70.5, 1.2, 0.6, 0, 0.2); cil("#1f5fa8", x, 70.5, 0.2, 1.2, 0.18); cil("#aeb7c2", x + 0.4, 70.5, 1.0, 1.8, 0.05); }
  bloque("#c9cdd1", 6.6, 72.3, 1.6, 0.5, 0, 2.0);
  // 14b. CABINA PVC (pts 32.3–32.4): recinto vidriado, marco azul oscuro, zócalo blanco, cartel de estación
  for (const y of [65.2, 70.2]) {
    const cara = y < 68 ? -1 : 1;
    caja("#f1f2f0", 27.7, y - 0.05, 76.8, y + 0.05, 0, 1.15);
    caja("#dfe8ef", 27.7, y - 0.02, 76.8, y + 0.02, 1.15, 3.0, { clave: "vidrio2", transparente: 0.35 });
    caja("#cdd3d8", 27.7, y - 0.05, 76.8, y + 0.05, 3.0, 4.3);
    for (let x = 27.7; x <= 76.9; x += 2.45) caja("#1d2f6b", x - 0.07, y - 0.08, x + 0.07, y + 0.08, 0, 4.3);
    caja("#1d2f6b", 27.7, y - 0.08, 76.8, y + 0.08, 1.1, 1.2); caja("#1d2f6b", 27.7, y - 0.08, 76.8, y + 0.08, 2.95, 3.05);
    void cara;
  }
  for (const x of [27.7, 76.8]) caja("#cdd3d8", x - 0.05, 65.2, x + 0.05, 70.2, 0, 4.3);
  caja("#d5dadf", 27.7, 65.2, 76.8, 70.2, 4.3, 4.4);
  caja("#2e8b57", 33.0, 65.08, 34.1, 65.14, 0, 2.2); caja("#dfe8ef", 33.15, 65.07, 33.95, 65.08, 1.0, 2.0, { clave: "vidrio2", transparente: 0.35 });
  cartel("DOMINIO 5\nAPLICACIÓN PISO PVC\nESTACIÓN 42", 38.5, 65.1, 1.9, 1.0, 0.75, "-y", "#ffffff", "#7a6a2a");
  cartel("CABINA PVC", 52, 65.1, 3.6, 2.4, 0.5, "-y", "#1d2f6b", "#ffffff");
  // 14c. Línea TRP-05 dentro de la cabina y tramo hasta el MASTER (rodillos rojos + carrocerías)
  rodillosRojos(20, 101, 67.7, 0.45);
  for (let x = 23, i = 0; x < 100; x += 6.2, i++) { skid(x, 67.7, 0.45, true); if (i % 3 === 1) pickup(x, 67.7, 0.75, true, i % 2 === 0); else sedan(x, 67.7, 0.75, true); }
  baranda(77, 101, 66.6); baranda(77, 101, 68.8);
  // 14d. Lado oeste norte (pts 31–33): cabinas y cajas de pickup en blanco sobre soportes, en fila junto a la calle
  for (let x = 8, i = 0; x < 62; x += 5.4, i++) { soporte(x, 58.6, true); if (i % 2) pickup(x, 58.6, 0.55, true, true, elegir(BIW)); else pickup(x, 58.6, 0.55, true, false, elegir(["#d3d6da", "#4a4f57", "#bfc3c7"])); }
  // carteles en columnas forradas (pts 32.2 y 33.2)
  cartel("A DISPOSICIÓN DE\nLABORATORIO\n←", 36.0, 61.32, 1.7, 0.75, 0.7, "-y", "#ffffff", "#c0392b");
  cartel("BOX CHAPA\n⇆", 60.0, 61.32, 1.8, 0.75, 0.45, "-y", "#ffffff", "#111111");
  // puesto de trabajo de chapa (pt 31.2): escritorio, silla, carro, cesto
  bloque("#e8e1cc", 20.5, 57.5, 1.4, 0.7, 0, 0.75); bloque("#2b4f8f", 19.5, 57.5, 0.6, 0.7, 0, 0.9);
  bloque("#2b2f33", 21.4, 56.6, 0.5, 0.5, 0.45, 0.5); bloque("#9aa1a8", 18.0, 56.8, 1.0, 0.7, 0.4, 0.45);
  cil("#7d858d", 22.6, 57.6, 0, 0.7, 0.25);
  for (const x of [15, 15.6, 16.2]) bloque("#1d3f8f", x, 56.0, 0.55, 0.5, 0, 1.9);   // lockers azules
  // 14e. MASTER DE SELLADO (pts 35–36): plataforma elevada con baranda amarilla y cartel
  caja("#8e99a6", 100.8, 52.6, 112.6, 61.6, 4.4, 4.55, { clave: "rejilla", transparente: 0.75 });
  for (const [x, y] of [[100.9, 52.7], [112.5, 52.7], [100.9, 61.5], [112.5, 61.5], [106.7, 52.7], [106.7, 61.5]]) caja("#23395d", x - 0.12, y - 0.12, x + 0.12, y + 0.12, 0, 4.4);
  for (const y of [52.6, 61.6]) { caja("#f2c94c", 100.8, y - 0.03, 112.6, y + 0.03, 5.5, 5.56); for (let x = 100.8; x <= 112.6; x += 1.5) caja("#f2c94c", x, y - 0.03, x + 0.05, y + 0.03, 4.55, 5.56); }
  escalera(96.5, 62.2, -1, 4.4, "#f2c94c");
  cartel("AREA DE MASTER:\nSELLADO E\nINSONORIZANTE", 106.7, 61.66, 5.0, 1.7, 0.9, "-y", "#ffffff", "#c0392b", true);
  rodillosRojos(103.5, 110, 55.5, 0.45); rodillosRojos(103.5, 110, 58.5, 0.45);
  for (const x of [104.5, 108.6]) { skid(x, 58.5, 0.45, true); pickup(x, 58.5, 0.75, true, true); }
  tunelLuz(103, 109, 55.5, 3.6);
  // 14f. RELAX (pts 35.1, 36.3): piso azul, mesas y bancos metálicos, máquinas expendedoras, dispenser
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
  cartel("“TU SEGURIDAD TAMBIÉN ES LA DE ELLOS”\n“YOUR SAFETY IS ALSO THEIRS...”", 112.0, 62.0, 5.6, 6.0, 1.6, "+x", "#2c3e7a", "#ffffff", true);
  cartel("“PASOS FIRMES Y SEGUROS EN EL TRABAJO\nPARA DISFRUTAR LOS PRIMEROS DE TUS HIJOS”", 131.0, 62.0, 5.6, 6.0, 1.8, "-x", "#3c6f9a", "#ffffff", true);
  // pizarras de gestión con patas (pt 36.3)
  for (const x of [123.5, 125.5]) { bloque("#ffffff", x, 63.6, 1.8, 0.05, 0.6, 2.0); bloque("#7d858d", x, 63.6, 1.9, 0.08, 0, 0.6); }
  // 14g. UTE 1 (pt 36.2): oficina con marcos naranjas sobre azul, paneles blancos y vidrio
  for (const [a, b, y, enX] of [[122.5, 127.7, 55.3, true], [122.5, 127.7, 59.7, true], [55.3, 59.7, 122.5, false], [55.3, 59.7, 127.7, false]]) {
    if (enX) { caja("#f4f4f2", a, y - 0.05, b, y + 0.05, 0, 1.0); caja("#dfe8ef", a, y - 0.02, b, y + 0.02, 1.0, 2.4, { clave: "vidrio2", transparente: 0.35 }); caja("#d7dbdf", a, y - 0.05, b, y + 0.05, 2.4, 3.0); for (let x = a; x <= b; x += 1.3) caja("#e67e22", x, y - 0.07, x + 0.06, y + 0.07, 0, 3.0); }
    else { caja("#f4f4f2", y - 0.05, a, y + 0.05, b, 0, 1.0); caja("#dfe8ef", y - 0.02, a, y + 0.02, b, 1.0, 2.4, { clave: "vidrio2", transparente: 0.35 }); caja("#d7dbdf", y - 0.05, a, y + 0.05, b, 2.4, 3.0); for (let x = a; x <= b; x += 1.3) caja("#e67e22", y - 0.07, x, y + 0.07, x + 0.06, 0, 3.0); }
  }
  caja("#1d3f8f", 122.5, 59.75, 127.7, 59.8, 0, 0.12);
  caja("#2350a8", 126.8, 59.72, 127.4, 59.78, 0.6, 2.6); cartel("U\nT\nE\n1", 127.1, 59.79, 1.6, 0.5, 1.8, "+y", "#2350a8", "#ffffff");
  bloque("#ffffff", 124.4, 57.4, 2.4, 0.9, 0.72, 0.76); persona(124.4, 58.3, 0, false);
  // 14h. TRP-06: línea de rodillos rojos con baranda amarilla a lo largo de U sur (pts 37–46)
  pinta("#cfe0d2", 78, 65.8, 248, 69.7, 0.018);
  for (let x = 78, k = 0; x < 248; x += 0.4, k++) pinta(k % 2 ? "#1f2328" : "#f2c94c", x, 65.85, x + 0.4, 66.15, 0.035);
  rodillosRojos(78, 248, 67.7, 0.5, 1.4);
  baranda(113, 248, 66.4); baranda(113, 248, 69.0);
  for (let x = 116, i = 0; x < 246; x += 6.3, i++) {
    skid(x, 67.7, 0.5, true);
    if (i % 4 === 3) pickup(x, 67.7, 0.8, true, false); else if (i % 4 === 1) pickup(x, 67.7, 0.8, true, true); else sedan(x, 67.7, 0.8, true);
  }
  for (const x of [128, 150, 172, 196, 220, 240]) { bloque("#dfe3e7", x, 66.1, 0.6, 0.5, 0, 1.2); bloque("#c5cbd1", x, 66.1, 0.66, 0.56, 1.2, 1.35); cil("#2ecc71", x + 0.2, 66.0, 1.35, 0.12, 0.05); }
  // 14i. Entrepiso de cota 5,4 sobre la línea: columnas azules, cerchas naranjas, rejilla y baranda amarilla (pts 41–46)
  for (let x = 114; x <= 246; x += 6) {
    for (const y of [64.2, 71.2]) caja("#22346a", x - 0.15, y - 0.15, x + 0.15, y + 0.15, 0, 5.4);
    caja("#e67e22", x - 0.08, 64.2, x + 0.08, 71.2, 4.9, 5.4);
  }
  for (const y of [64.2, 71.2]) {
    caja("#e67e22", 114, y - 0.1, 246, y + 0.1, 4.6, 4.75); caja("#e67e22", 114, y - 0.1, 246, y + 0.1, 5.25, 5.4);
    for (let x = 114; x < 246; x += 1.5) diag("#e67e22", x, y, 4.7, x + 1.5, y, 5.3, 0.07);
    for (let x = 114; x <= 246; x += 1.5) caja("#f2c94c", x, y - 0.03, x + 0.05, y + 0.03, 5.45, 6.5);
    caja("#f2c94c", 114, y - 0.03, 246, y + 0.03, 6.45, 6.5); caja("#f2c94c", 114, y - 0.03, 246, y + 0.03, 5.95, 6.0);
  }
  caja("#8e99a6", 114, 64.2, 246, 71.2, 5.4, 5.45, { clave: "rejilla", transparente: 0.75 });
  escalera(142, 63.8, -1, 5.4, "#f2c94c"); escalera(206, 63.8, -1, 5.4, "#f2c94c");
  // carteles 5S de WCM colgados sobre la línea, mirando a la calle U (pts 37–40)
  for (const [x, txt, fondo] of [[168, "1° SEIRI\nSEPARAR", "#3c78c8"], [182, "2° SEITON\nORDENAR", "#e9c23a"], [196, "3° SEISO\nLIMPIAR", "#d6578a"], [210, "4° SEIKETSU\nESTANDARIZAR", "#c0392b"], [224, "5° SHITSUKE\nDISCIPLINA", "#4aa3df"]])
    cartel(txt, x, 71.1, 4.4, 3.0, 1.2, "-y", fondo, "#ffffff", true);
  // pizarrón de seguridad "AYUDA VISUAL" en columna (pt 35.2)
  cartel("AYUDA VISUAL\nSeguridad", 140.0, 64.02, 1.7, 0.6, 0.8, "-y", "#ffffff", "#1f2a3a");
  // 14j. Lado oeste de U sur: estructura de soporte de cota 9 (columnas azules, cerchas naranjas, riostras en X)
  for (let x = 126; x <= 246; x += 6) {
    caja("#22346a", x - 0.2, 60.2, x + 0.2, 60.6, 0, 9.0);
    caja("#22346a", x - 0.2, 50.8, x + 0.2, 51.2, 0, 9.0);
    caja("#e67e22", x - 0.08, 50.8, x + 0.08, 60.6, 7.6, 8.2);
  }
  for (const y of [60.4, 51.0]) { caja("#e67e22", 126, y - 0.1, 246, y + 0.1, 7.4, 7.55); caja("#e67e22", 126, y - 0.1, 246, y + 0.1, 8.6, 8.75); for (let x = 126; x < 246; x += 2) diag("#e67e22", x, y, 7.5, x + 2, y, 8.65, 0.08); }
  for (const x0 of [132, 186, 228]) { diag("#22346a", x0, 60.4, 0.2, x0 + 6, 60.4, 7.4, 0.3); diag("#22346a", x0 + 6, 60.4, 0.2, x0, 60.4, 7.4, 0.3); }
  // tanques/cajones de acero inoxidable con nervios blancos y escalera de gato amarilla (pts 37.2, 38.3)
  for (const [a, b] of [[128, 150], [182, 200], [204, 226]]) {
    caja("#c6ccd1", a, 53.0, b, 59.0, 0.4, 4.6);
    for (let x = a; x <= b; x += 1.5) caja("#eef1f4", x, 52.9, x + 0.12, 59.1, 0.4, 4.6);
    for (const z of [1.4, 2.4, 3.4]) caja("#eef1f4", a, 52.9, b, 59.1, z, z + 0.1);
    for (let x = a + 2; x < b; x += 4) for (const dy of [-0.8, 0.8]) caja("#7d858d", x, 56 + dy, x + 0.15, 56 + dy + 0.15, 0, 0.4);
    // tolvas arriba
    for (let x = a + 3; x < b; x += 7) for (let k = 0; k < 4; k++) { const w = 2.6 - k * 0.5; bloque("#aab2b9", x, 56, w, w, 6.6 - k * 0.45, 7.05 - k * 0.45); }
    caja("#f2c94c", a + 1.0, 52.75, a + 1.06, 52.8, 0, 6.2); caja("#f2c94c", a + 1.5, 52.75, a + 1.56, 52.8, 0, 6.2);
    for (let z = 0.3; z < 6.2; z += 0.3) caja("#f2c94c", a + 1.0, 52.74, a + 1.56, 52.78, z, z + 0.04);
    for (let z = 2.2; z < 6.2; z += 0.6) caja("#f2c94c", a + 0.85, 52.4, a + 1.7, 52.46, z, z + 0.05);
  }
  // MAQ-02 (máquina sin nombre del plano): recinto de chapa galvanizada con transportador TRP-10
  galvanizado(153.4, 178.3, 59.9, true, 7.0, +1); galvanizado(153.4, 178.3, 55.1, true, 7.0, -1);
  for (const x of [153.4, 178.3]) galvanizado(55.1, 59.9, x, false, 7.0, x < 160 ? -1 : 1);
  rodillosRojos(150, 182, 56.9, 0.45);
  // escalera verde a la cota 9 y carrocerías tapadas con nylon (pt 39.2)
  escalera(176, 52.2, -1, 7.6, "#2e8b57");
  for (const x of [131, 136, 141]) { soporte(x, 51.8, true); bloque("#e6eaee", x, 51.8, 4.2, 1.8, 0.55, 1.75, { clave: "film", transparente: 0.7 }); }
  // tablero B1 y camilla naranja de rescate (pt 36.4)
  bloque("#cfd3d7", 134.0, 63.6, 1.4, 0.5, 0, 2.2); cartel("TABLERO\nB1", 134.0, 63.34, 2.3, 0.5, 0.35, "-y", "#f2c94c", "#111111");
  bloque("#e67e22", 136.0, 64.0, 0.5, 0.15, 0.2, 2.0);
  // lockers amarillos detrás de la línea (pts 37.4, 38.4)
  for (let x = 228; x < 236; x += 0.6) bloque("#e9c23a", x, 70.8, 0.55, 0.5, 0, 1.9);

  // ============================================================= 15) MITAD DE CALLE ENTRE T Y U (y ≈ 70,4–73,3) – pts 41–46
  pinta("#b4bbc3", 124, 69.8, 240, 73.3, 0.021);
  pinta("#2e9d6a", 124, 70.0, 240, 70.6, 0.05); pinta("#ffffff", 124, 70.7, 240, 70.78, 0.05); pinta("#f2c94c", 124, 73.0, 240, 73.1, 0.05);
  // cerramiento de la cabina de sellado (SIGILLATURA): panel gris verdoso, marcos naranjas, ventanas
  caja("#93a6a3", 124.8, 73.3, 235.1, 73.4, 0, 1.6);
  caja("#dfe8ef", 124.8, 73.33, 235.1, 73.37, 1.6, 2.9, { clave: "vidrio2", transparente: 0.35 });
  caja("#a7b3b4", 124.8, 73.3, 235.1, 73.4, 2.9, 4.0);
  for (const z of [1.55, 2.88]) caja("#e67e22", 124.8, 73.26, 235.1, 73.3, z, z + 0.07);
  for (let x = 124.8; x <= 235.2; x += 1.6) caja("#e67e22", x, 73.26, x + 0.06, 73.3, 0, 4.0);
  for (let x = 126; x <= 235; x += 6) caja("#1d2f6b", x - 0.1, 73.12, x + 0.1, 73.3, 0, 4.0);
  // lockers amarillos, dispensers de agua y carteles contra el cerramiento
  for (const x0 of [127, 147, 171, 203, 226]) for (let k = 0; k < 4; k++) { bloque("#e9c23a", x0 + k * 0.62, 72.95, 0.58, 0.5, 0, 1.9); bloque("#c9a52c", x0 + k * 0.62, 72.69, 0.5, 0.02, 1.0, 1.8); }
  for (const x of [134, 184, 214]) { bloque("#f4f6f8", x, 72.95, 0.35, 0.35, 0, 1.05); cil("#3b8fd8", x, 72.95, 1.05, 0.45, 0.14); }
  for (const x of [138, 188, 218]) cartel("¡SECOS!", x, 73.22, 1.0, 0.5, 0.3, "-y", "#e67e22", "#ffffff");
  cartel("↑ VÍA DE\nESCAPE", 238, 71.5, 3.2, 0.8, 0.6, "-x", "#1e8449", "#ffffff", true);
  // atriles con piezas (capós) y bancos de trabajo amarillos inclinados (pts 43.1, 46.3)
  for (const x of [131, 160, 192]) { bloque("#f2c94c", x, 72.5, 1.4, 0.7, 0.7, 0.75); diag("#f2c94c", x - 0.6, 72.3, 0, x - 0.6, 72.7, 0.7, 0.05); diag("#f2c94c", x + 0.6, 72.3, 0, x + 0.6, 72.7, 0.7, 0.05); bloque("#c7c9c4", x, 72.5, 1.3, 0.6, 0.9, 1.0); }
  // operarios trabajando en la línea y caminando (pts 41.2, 45.4)
  for (const x of [119, 121, 152, 199]) persona(x, entre(66.6, 68.8), 0, false);
  persona(176, 71.6, 0, false); persona(232, 72.4, 0, true);

  // ============================================================= 16) CALLES V y W NORTE + CALESITA (pts 48–55, 60–63)
  calleX(2, 96, 42.6, 45.4, null, "V");
  calleX(2, 96, 33.6, 36.4, null, "W");
  codigosLinea(26.0, "D", [+1, -1]);
  // 16a. acopio de carrocerías en blanco (BIW) sobre soportes, transversales a las calles (pts 48.1, 49.x, 50.x)
  filaAcopio(5, 62, 39.4, 2.5, BIW, 0.55);
  filaAcopio(14, 62, 48.6, 2.5, BIW.concat(["#16181c", "#1f3f9e"]), 0.5);
  // carrocería azul suelta y cartel BOX CHAPA en columna (pt 49.4)
  cartel("BOX CHAPA\n←", 48.0, 46.1, 1.8, 0.7, 0.4, "+y", "#ffffff", "#111111");
  // carteles "MANTENIMIENTO PINTURA" al fondo (pts 49.2, 50.2)
  cartel("MANTENIMIENTO PINTURA", 3.0, 52.0, 3.8, 5.0, 0.55, "+x", "#ffffff", "#1f2a3a");
  // equipos de dosificación con tambor azul (pt 50.3–50.4) junto a V y conos
  for (const x of [66, 70]) { caja("#22346a", x - 0.9, 46.2, x + 0.9, 46.3, 0, 2.6); bloque("#cfd3d7", x - 0.4, 46.6, 0.6, 0.3, 1.2, 1.9); cil("#1f5fa8", x + 0.3, 46.8, 0, 1.1, 0.42); for (const dx of [-0.85, 0.85]) caja("#22346a", x + dx, 46.2, x + dx + 0.08, 47.6, 0, 2.6); }
  for (const x of [63.5, 64.5]) { cil("#e67e22", x, 45.6, 0, 0.7, 0.15); bloque("#e67e22", x, 45.6, 0.36, 0.36, 0, 0.04); }
  // 16b. CALESITA: cercos de malla azul con topes amarillos y transportadores de rodillos rojos (pts 54–55, 61–63)
  cercoMalla(4, 96, 33.3, true, "#2a55b8", 2.0, true);
  cercoMalla(4, 96, 19.0, true, "#2a55b8", 2.0, true);
  for (const y of [30.9, 22.9]) rodillosRojos(4.6, 95, y, 0.45, 1.4);
  rodillosRojos(20.1, 33, 7.2, 0.45, 1.4, false); rodillosRojos(20.1, 33, 92.8, 0.45, 1.4, false);
  for (const [y, desde] of [[30.9, 8], [22.9, 11]]) for (let x = desde, i = 0; x < 92; x += 6.4, i++) {
    skid(x, y, 0.45, true);
    const col = elegir(PINTADO);
    if (i % 3 === 0) sedan(x, y, 0.75, true, col); else pickup(x, y, 0.75, true, i % 3 === 2, col);
  }
  // zona de acumulo dentro de la calesita: carrocerías pintadas en soportes (pt 61.2)
  filaAcopio(12, 88, 26.9, 2.8, PINTADO, 0.3);
  // pupitres de mando con botonera (pts 54.1, 63.4, 79.4)
  for (const [x, y] of [[50, 33.0], [94, 20.0], [20, 19.3]]) { bloque("#d9d5c8", x, y, 0.8, 0.5, 0, 1.3); bloque("#c4c0b2", x, y, 0.86, 0.56, 1.3, 1.45); for (let k = 0; k < 6; k++) cil(elegir(["#2ecc71", "#c0392b", "#f1c40f", "#2b2f33"]), x - 0.3 + k * 0.12, y - 0.29, 1.15, 0.04, 0.035, "y"); }
  cartel("HIDRANTE", 52.0, 34.0, 3.2, 0.7, 0.2, "+x", "#c0392b", "#ffffff");
  // 16c. Calle entre W y X (lado oeste de la calesita, y ≈ 16–18,8): pared galvanizada alta y transferencias naranjas (pts 60–61)
  calleX(2, 96, 16.0, 18.8, [18.0, 18.6], null);
  galvanizado(12, 96, 15.8, true, 7.5, +1);
  for (const x of [6, 9]) { bloque("#e9a21a", x, 18.2, 2.4, 1.2, 0.3, 0.45); baranda(4, 11, 19.2, true, "#e9a21a"); }
  bloque("#7d858d", 30, 16.4, 0.6, 0.6, 0, 0.9); bloque("#c0392b", 31, 16.4, 0.5, 0.5, 0, 0.5);   // cesto y cajones (pt 60.2)
  for (const x of [32, 33.4]) bloque("#b08a5a", x, 16.5, 1.2, 0.8, 0, 0.5);

  // ============================================================= 17) CALLES V y W SUR (pts 51–53, 56–59)
  // recintos galvanizados de MAQ-01 y MAQ-03 con transportador interior (túnel con carrocerías, pt 51.1)
  for (const [a, b] of [[118.8, 138.8], [188.4, 213.3]]) {
    galvanizado(a, b, 44.1, true, 7.0, -1); galvanizado(a, b, 48.9, true, 7.0, +1);
    for (const x of [a, b]) galvanizado(44.1, 48.9, x, false, 7.0, x === a ? -1 : 1);
    rodillosRojos(a - 1.5, b + 1.5, 45.9, 0.45);
    for (let x = a + 3, i = 0; x < b - 2; x += 6.2, i++) { skid(x, 45.9, 0.45, true); sedan(x, 45.9, 0.75, true); }
  }
  // calle V sur (y ≈ 41,2–43,8) con senda verde y vigas naranjas arriba
  calleX(98, 250, 41.2, 43.8, [43.0, 43.6], "V", 5.6);
  for (let x = 100; x < 250; x += 6) caja("#e9a21a", x - 0.1, 38.0, x + 0.1, 44.0, 5.0, 5.35);
  escalera(140, 43.4, -1, 5.0, "#aeb6be"); escalera(214, 43.4, -1, 5.0, "#aeb6be");
  // pared galvanizada muy alta del lado este de W sur con carteles de acopio (pts 56–59)
  galvanizado(126, 246, 37.6, true, 12.0, -1);
  for (const [x, txt, fondo] of [[168, "CARROCERÍAS\nDELIBERADAS\nUTE 3", "#2f7fd1"], [192, "CARROCERÍAS\nLISTAS PARA MACRO", "#2f7fd1"],
    [222, "CARROCERÍAS LUEGO\nDE MACRO PARA REPARAR", "#e23a77"], [238, "CARROCERÍAS\nLISTAS PARA MONTAJE", "#7cc242"]])
    cartel(txt, x, 37.3, 3.4, 3.4, 0.9, "-y", fondo, "#ffffff");
  cartel("SALIDA →", 242, 37.3, 3.8, 1.1, 0.4, "-y", "#1e8449", "#ffffff");
  // calle W sur: piso gastado con franjas amarillo/negro junto a las columnas D
  pinta("#a9b0b8", 126, 27.0, 246, 31.0, 0.021);
  for (let x = 126, k = 0; x < 246; x += 0.6, k++) pinta(k % 2 ? "#1f2328" : "#f2c94c", x, 27.0, x + 0.6, 27.5, 0.04);
  // cajas de pickup en soportes, en peine contra la pared (pts 56.1, 56.4, 57.4, 58.3)
  for (let x = 130, i = 0; x < 212; x += 2.4, i++) {
    soporte(x, 34.6, false);
    pickup(x, 34.6, 0.55, false, true, elegir(i % 5 === 0 ? ["#16181c", "#1f3f9e"] : BIW));
  }
  cartel("BOX", 150, 32.2, 1.6, 0.4, 0.25, "-y", "#ffffff", "#111111");
  // lado oeste (línea D): conductos de extracción galvanizados, tableros y escalera verde (pts 56.2–56.3)
  for (let x = 132; x < 246; x += 12) { caja("#aeb6be", x + 0.4, 25.2, x + 1.6, 26.4, 0, 9.0); caja("#aeb6be", x + 0.4, 26.4, x + 1.6, 27.0, 2.0, 3.4); }
  bloque("#d5d2c6", 170, 26.6, 1.2, 0.5, 0, 2.0); cartel("B1", 170, 26.86, 2.0, 0.3, 0.2, "+y", "#f2c94c", "#111111");
  escalera(176, 26.0, -1, 5.4, "#2e8b57");
  // cajones de madera, pallets y bandejas negras (pts 58.1, 59.x)
  for (let x = 214; x < 244; x += 2.2) {
    const y = entre(31.5, 35.5);
    bloque("#c8a774", x, y, 2.0, 1.2, 0, 0.14);
    if (azar() < 0.5) { bloque("#d4b483", x, y, 1.9, 1.1, 0.14, entre(0.9, 1.6), { clave: "film", transparente: 0.85 }); for (let k = 0; k < 3; k++) bloque("#a07a48", x - 0.9 + k * 0.9, y, 0.1, 1.15, 0.14, 1.0); }
    else for (let k = 0; k < 4; k++) bloque("#202327", x, y, 1.8, 1.0, 0.14 + k * 0.2, 0.3 + k * 0.2);
  }
  // estanterías de repuestos con largueros naranjas y operario con chaleco (pt 59.2)
  for (let x = 222; x < 236; x += 2.8) { for (const dx of [-1.3, 1.3]) for (const dy of [-0.45, 0.45]) bloque("#22346a", x + dx, 24.0 + dy, 0.08, 0.08, 0, 2.6); for (const z of [0.2, 1.0, 1.8, 2.5]) bloque("#e67e22", x, 24.0, 2.7, 1.0, z, z + 0.08); for (let k = 0; k < 4; k++) bloque(elegir(["#c8a774", "#f2c94c", "#ffffff"]), x - 1 + k * 0.6, 24.0, 0.5, 0.7, 1.08, 1.5); }
  persona(228, 26.6, 0, true);

  // ============================================================= 18) CALLE X SUR – fachada oeste, PINTO y BUFFER FINAL (pts 70–76)
  calleX(98, 262, 0.4, 3.6, [0.75, 1.35], "X", 6.0);
  codigosLinea(0.0, "E", [+1]);
  // fachada interior: bocas de incendio con caño rojo, aerotermos, carteles SALIDA, tableros
  for (const c of colsEje(0.0).filter(c => c[0] > 98 && c[0] < 263)) {
    const x = c[0];
    bloque("#c0392b", x + 0.5, 0.55, 0.75, 0.25, 0.4, 1.15); bloque("#e8e8e8", x + 0.5, 0.68, 0.55, 0.02, 0.5, 1.05);
    cil("#c0392b", x - 0.55, 0.45, 0.4, 6.0, 0.06);
    bloque("#aeb4ba", x + 1.4, 0.6, 0.75, 0.6, 3.6, 4.3); for (let z = 3.7; z < 4.25; z += 0.08) bloque("#6f7780", x + 1.4, 0.91, 0.65, 0.02, z, z + 0.03);
  }
  for (const x of [118, 154, 202, 250]) {   // puertas dobles verdes de emergencia (pts 70.2, 76.2)
    caja("#2ea84f", x - 1.2, 0.12, x + 1.2, 0.18, 0, 2.4);
    caja("#ffffff", x - 1.0, 0.19, x - 0.2, 0.2, 1.3, 1.9); caja("#ffffff", x + 0.2, 0.19, x + 1.0, 0.2, 1.3, 1.9);
    caja("#c0392b", x - 1.0, 0.2, x + 1.0, 0.22, 1.0, 1.05);
    cartel("SALIDA ↓", x, 0.2, 2.75, 0.8, 0.28, "+y", "#1e8449", "#ffffff");
    cartel("POR FAVOR\nMANTENER LA\nPUERTA CERRADA", x + 0.6, 0.21, 1.6, 0.45, 0.3, "+y", "#c0392b", "#ffffff");
  }
  caja("#e9b10a", 108.5, 0.12, 112.5, 0.2, 0, 4.6);   // portón rápido amarillo (pt 70.1)
  for (let x = 254, i = 0; x < 262; x += 1.3, i++) caja(i % 2 ? "#e0a50a" : "#e9b10a", x, 0.12, x + 1.25, 0.24, 0, 5.2);   // portones plegables (pt 76.1)
  // AREA MACRO CPA: cartel colgante (pt 70.1)
  cartel("AREA\nMACRO C.P.A.", 100.5, 6.0, 3.6, 2.2, 1.0, "-y", "#ffffff", "#1e6b35", true);
  // cabinas de retoque PINTO (plástico transparente, perfilería de aluminio, malla abajo) sobre TRP-22 (pts 72.1–72.4)
  for (const [a, n] of [[134, 2], [143, 3], [152, 4], [161, 5]]) {
    const b = a + 8.4;
    caja("#e9eef3", a, 4.0, b, 12.2, 3.6, 3.7, { clave: "film", transparente: 0.7 });
    for (const y of [4.0, 12.2]) caja("#eef3f7", a, y - 0.02, b, y + 0.02, 0, 3.6, { clave: "cortina", transparente: 0.4 });
    for (const x of [a, b]) caja("#eef3f7", x - 0.02, 4.0, x + 0.02, 12.2, 0, 3.6, { clave: "cortina", transparente: 0.4 });
    for (let x = a; x <= b + 0.01; x += 2.1) for (const y of [4.0, 12.2]) caja("#cfd6dc", x - 0.05, y - 0.05, x + 0.05, y + 0.05, 0, 3.7);
    caja("#aeb6be", a, 3.95, b, 4.0, 0.1, 1.4, { clave: "mallaG", transparente: 0.4 });
    for (let z = 0, k = 0; z < 2.4; z += 0.3, k++) caja(k % 2 ? "#1f2328" : "#f2c94c", a - 0.08, 3.9, a + 0.08, 4.0, z, z + 0.3);
    cartel("PINTO" + String(n).padStart(2, "0"), a + 1.0, 3.93, 3.2, 0.9, 0.35, "-y", "#ffffff", "#1f2a3a");
    for (let x = a + 1; x < b; x += 1.6) caja("#f7fbff", x, 6.5, x + 1.2, 6.56, 3.5, 3.56, { clave: "luz", emisivo: true });
  }
  rodillosRojos(121, 185, 8.9, 0.45, 1.3);
  for (let x = 136, i = 0; x < 170; x += 9, i++) { skid(x, 8.9, 0.45, true); sedan(x, 8.9, 0.75, true, elegir(PINTADO)); }
  for (const x of [139, 157]) persona(x, 6.4, 0, false);
  // carros de malla naranja para piezas (pt 72.1)
  for (const [x, y] of [[124, 3.4], [126, 3.4], [128, 3.4], [124, 0.9], [126.2, 0.9], [128.4, 0.9], [130.6, 0.9]]) {
    bloque("#e67e22", x, y, 1.8, 0.8, 0.3, 0.35);
    bloque("#e67e22", x, y, 1.8, 0.8, 0.35, 1.3, { clave: "mallaN", transparente: 0.6 });
    for (const [dx, dy] of [[-0.8, -0.35], [0.8, -0.35], [-0.8, 0.35], [0.8, 0.35]]) cil("#2b2f33", x + dx, y + dy, 0, 0.3, 0.08);
    bloque("#1f5fa8", x, y, 0.6, 0.4, 0.4, 0.6);
  }
  // BUFFER FINAL LÍNEA: cerco de malla azul, entrepiso blanco con borde amarillo y transportadores (pts 74–76)
  cercoMalla(186, 252, 3.75, true, "#2a55b8", 2.2, false);
  for (let x = 188; x <= 252; x += 6) for (const y of [4.1, 13.0]) caja("#eef1f4", x - 0.15, y - 0.15, x + 0.15, y + 0.15, 0, 3.8);
  caja("#e6e3d6", 186, 3.9, 252, 13.3, 3.8, 3.95, { clave: "rejilla2", transparente: 0.85 });
  caja("#f2c94c", 186, 3.85, 252, 4.0, 3.95, 4.45);
  for (const y of [6.0, 8.5, 11.4]) {
    caja("#dfe3e7", 191.5, y - 0.65, 250.7, y - 0.55, 0.15, 0.45); caja("#dfe3e7", 191.5, y + 0.55, 250.7, y + 0.65, 0.15, 0.45);
    for (let x = 192; x < 250.7; x += 0.9) cil("#c9ced3", x, y, 0.38, 1.1, 0.05, "y");
    for (let x = 194; x < 250; x += 4.5) bloque("#f2c94c", x, y, 0.3, 1.4, 0.15, 0.3);
  }
  for (const [x, y] of [[198, 6.0], [214, 8.5], [230, 11.4], [242, 6.0]]) { skid(x, y, 0.45, true); sedan(x, y, 0.75, true, elegir(PINTADO)); }
  escalera(186.5, 3.0, -1, 3.8, "#f2c94c");
  // depósito con cajones bajo entrepiso al extremo sur (pt 76.1)
  for (const [x, y] of [[255, 6], [257.5, 6], [255, 8.5], [257.5, 9], [260, 7]]) { bloque("#c8a774", x, y, 2.0, 1.4, 0, 0.9); bloque("#b08a5a", x, y, 2.0, 1.4, 0.9, 1.6); }
  for (const x of [252.6, 253.2, 253.8]) { cil("#e67e22", x, 3.2, 0, 0.7, 0.15); bloque("#e9c23a", x, 3.0, 0.4, 0.3, 0, 0.9); }

  // ============================================================= 19) CALLE A – fachada norte y auditoría de producto terminado (pts 77–79)
  pinta("#b4bbc3", 0.4, 2, 3.4, 100, 0.021);
  pinta("#f2c94c", 3.1, 2, 3.2, 100, 0.035); pinta("#f2c94c", 0.55, 2, 0.65, 100, 0.035);
  for (const c of N.columnas.filter(c => Math.abs(c[0]) < 0.6 && c[4] === 0 && c[1] > 1 && c[1] < 103)) {
    const lin = [["A", 103.98], ["B", 82], ["B1", 71.7], ["B2", 61.7], ["C", 52], ["C1", 45.8], ["C2", 36.2], ["D", 26], ["D1", 13]].find(([, y]) => Math.abs(c[1] - y) < 0.8);
    if (lin && lin[0].length === 1) cartel(lin[0] + "01", c[0] + c[2] / 2 + 0.02, c[1], 4.0, 0.55, 0.3, "+x", "#1d2f6b", "#f2c94c");
    caja("#f2c230", c[0] + c[2] / 2, c[1] - 0.3, c[0] + c[2] / 2 + 0.06, c[1] + 0.3, 0.1, 2.0);   // forro amarillo de pie
  }
  // puerta de emergencia verde + estación de válvulas de incendio con caños rojos (pt 78.2)
  caja("#2ea84f", 0.12, 44.0, 0.2, 46.4, 0, 2.4); caja("#ffffff", 0.21, 44.3, 0.22, 45.1, 1.3, 1.9);
  cartel("EXIT", 0.25, 45.2, 2.6, 1.6, 0.25, "+x", "#1e8449", "#ffffff");
  for (const y of [47.0, 47.6, 48.2]) cil("#c0392b", 0.5, y, 0, 3.4, 0.09);
  cil("#c0392b", 0.6, 47.6, 0.45, 2.4, 0.13, "y"); cil("#c0392b", 0.6, 47.0, 1.2, 0.3, 0.16, "x");
  for (const y of [46.8, 48.4]) bloque("#cfd3d7", 0.3, y + 1.4, 0.2, 0.5, 1.3, 1.9);
  for (let z = 0, k = 0; z < 1.6; z += 0.2, k++) caja(k % 2 ? "#1f2328" : "#f2c94c", 0.9, 46.6, 0.96, 46.66, z, z + 0.2);
  // auditoría: piso turquesa, elevador de 2 columnas "COBI", túnel de luz y camionetas terminadas (pts 48.2–48.4, 78.1, 78.4, 79.3)
  pinta("#5fb3ae", 4.0, 38.0, 14.0, 58.0, 0.025);
  for (let y = 38, k = 0; y < 58; y += 0.5, k++) pinta(k % 2 ? "#1f2328" : "#f2c94c", 3.6, y, 4.0, y + 0.5, 0.04);
  for (const s of [-1, 1]) { bloque("#1f3fa0", 8.5 + s * 1.7, 52.5, 0.45, 0.45, 0, 3.6); }
  cartel("C\nO\nB\nI", 8.5 - 1.7 - 0.24, 52.5, 1.9, 0.35, 1.6, "-x", "#1f3fa0", "#ffffff");
  for (const dy of [-0.9, 0.9]) bloque("#c8462f", 8.5, 52.5 + dy, 3.4, 0.25, 0, 0.12);
  camioneta(8.5, 52.5, true, "#7d838a");
  tunelLuz(6.0, 11.6, 44.0, 4.4);
  camioneta(8.8, 44.0, true, "#f2f2f2");
  camioneta(6.5, 39.5, true, "#16181c"); camioneta(11.5, 56.8, true, "#f2f2f2"); camioneta(5.6, 56.8, true, "#16181c");
  bloque("#c9cdd1", 4.6, 49.0, 0.5, 0.4, 0, 1.1); bloque("#eef1f4", 12.6, 48.5, 1.0, 0.6, 0.8, 0.85);
  persona(10.8, 41.5, 0, false); persona(7.0, 50.0, 0, false);
  // jaula de malla amarilla y tablero gris junto a la fachada (pt 78.3)
  for (const [a, b, y, enX] of [[3.8, 9.5, 62.0, true], [3.8, 9.5, 68.0, true], [62.0, 68.0, 9.5, false]]) cercoMalla(a, b, y, enX, "#e3a800", 2.2);
  cil("#e67e22", 7.0, 65.0, 0, 1.8, 0.7);
  bloque("#cfd3d7", 1.0, 72.0, 0.4, 0.7, 0, 1.9);
  // cajones y butacas en espera junto a la pared (pt 79.1)
  for (const [x, y] of [[1.6, 26.0], [1.6, 27.4], [2.4, 29.0]]) { bloque("#c8a774", x, y, 1.0, 1.2, 0, 0.8); bloque("#d9c19a", x, y, 0.9, 1.1, 0.8, 1.1); }
  bloque("#e8eaec", 1.4, 30.6, 0.6, 0.6, 0, 0.9); cil("#e6a12a", 1.4, 31.6, 0, 0.9, 0.3);

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
  return { alto, cajas: [...baldes.values()].reduce((n, b) => n + b.pos.length / 108, 0), cilindros: cilindros.length, carteles: cacheTex.size };
};
