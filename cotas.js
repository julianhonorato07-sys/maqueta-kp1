/* Cotas superiores de la Unidad de Pintura: Level +3,20 · cota +5,40 · cota +9,00.
 * Geometría base: planos 303-N5400 y 303-N9000 "SISTEMAS PINTURA" (SharePoint UTE23, LAYOUT UND. PINTURA 2018),
 * convertidos por etl/cotas3d.py → window.COTAS. Coordenadas en metros del plano de cota 0 (x al sur, y al este).
 * Posiciones y medidas en planta: del plano. Alturas, colores, cantidad de robots y detalles: ESTIMADOS (supuesto,
 * ver docs/briefing.md §10). Recorrido del proceso: docs/proceso_por_cotas.md.
 * Se llama desde app.js: window.Cotas(api) → { setSep, alto, rutas, ... } (lo usa recorrido.js). */
window.Cotas = function (api) {
  "use strict";
  const { THREE, W, capa, MOVIL, animar } = api;
  const D = window.COTAS;
  if (!D) return null;

  // ---------------------------------------------------------------- niveles y separación
  const G = { 9: capa("cota9"), 5.4: capa("cota5"), 3.2: capa("cota3") };
  const vert = capa("verticales");            // elevadores y montantes que unen cotas (se estiran al separar)
  const KS = { 0: 0, 3.2: 0.5, 5.4: 1, 9: 2 };  // cuánto se despega cada cota por metro de "separar"
  let SEP = 0;
  const off = (n) => KS[n] * SEP;
  const alto = (n, h) => n + h + off(n);      // altura mostrada de un punto a h m sobre el piso de la cota n
  const verticales = [];                       // { obj, n0, h0, n1, h1 } → se reubican al cambiar SEP
  function setSep(v) {
    SEP = v;
    for (const n of [9, 5.4, 3.2]) G[n].position.y = off(n);
    for (const t of verticales) {
      const y0 = alto(t.n0, t.h0), y1 = alto(t.n1, t.h1);
      t.obj.position.y = y0; t.obj.scale.y = Math.max(0.001, (y1 - y0) / t.L);
    }
    ubicarEtiquetasElev();
  }

  // ---------------------------------------------------------------- utilidades
  let semilla = 909;
  const azar = () => (semilla = (semilla * 16807) % 2147483647) / 2147483647;
  const entre = (a, b) => a + azar() * (b - a);
  const elegir = (l) => l[Math.floor(azar() * l.length)];
  const rad = (g) => g * Math.PI / 180;

  /** Lote: junta cajas del mismo color en una sola malla por destino (rápido). Coordenadas absolutas del plano. */
  function lote(destino) {
    const baldes = new Map(), cils = [];
    function push(color, opc, q, z0, z1) {
      const k = color + "|" + JSON.stringify(opc || {});
      if (!baldes.has(k)) baldes.set(k, { color, opc: opc || {}, pos: [] });
      const p = baldes.get(k).pos;
      const lo = q.map(([x, y]) => W(x, y, z0)), hi = q.map(([x, y]) => W(x, y, z1));
      const tri = (u, v, w) => p.push(u.x, u.y, u.z, v.x, v.y, v.z, w.x, w.y, w.z);
      const quad = (u, v, w, s) => { tri(u, v, w); tri(u, w, s); };
      quad(hi[0], hi[1], hi[2], hi[3]); quad(lo[0], lo[3], lo[2], lo[1]);
      for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; quad(lo[i], lo[j], hi[j], hi[i]); }
    }
    const L = {
      caja(color, x0, y0, x1, y1, z0, z1, opc) {
        const [a, b] = [Math.min(x0, x1), Math.max(x0, x1)], [c, d] = [Math.min(y0, y1), Math.max(y0, y1)];
        push(color, opc, [[a, c], [b, c], [b, d], [a, d]], z0, z1);
      },
      bloque(color, cx, cy, lx, ly, z0, z1, opc) { L.caja(color, cx - lx / 2, cy - ly / 2, cx + lx / 2, cy + ly / 2, z0, z1, opc); },
      /** caja girada: largo la sobre el ángulo ang (grados), ancho an */
      rot(color, cx, cy, la, an, ang, z0, z1, opc) {
        const c = Math.cos(rad(ang)), s = Math.sin(rad(ang)), ux = c * la / 2, uy = s * la / 2, vx = -s * an / 2, vy = c * an / 2;
        push(color, opc, [[cx - ux - vx, cy - uy - vy], [cx + ux - vx, cy + uy - vy], [cx + ux + vx, cy + uy + vy], [cx - ux + vx, cy - uy + vy]], z0, z1);
      },
      /** barra entre dos puntos en planta (muros, rieles, barandas) */
      barra(color, x1, y1, x2, y2, e, z0, z1, opc) {
        const l = Math.hypot(x2 - x1, y2 - y1); if (l < 1e-3) return;
        L.rot(color, (x1 + x2) / 2, (y1 + y2) / 2, l, e, Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI, z0, z1, opc);
      },
      pinta(color, x0, y0, x1, y1, z) { L.caja(color, x0, y0, x1, y1, z, z + 0.012, { piso: 1 }); },
      cil(color, x, y, z0, h, r, eje) { cils.push([color, x, y, z0, h, r, eje || "z"]); },
      cerrar() {
        for (const { color, opc, pos } of baldes.values()) {
          const g = new THREE.BufferGeometry();
          g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
          g.computeVertexNormals();
          const m = new THREE.MeshLambertMaterial({
            color, transparent: !!opc.tr, opacity: opc.tr || 1, side: opc.tr ? THREE.DoubleSide : THREE.FrontSide,
            emissive: opc.luz ? color : 0x000000, emissiveIntensity: opc.luz ? 0.75 : 0,
            polygonOffset: !!opc.piso, polygonOffsetFactor: opc.piso ? -3 : 0, depthWrite: !opc.tr,
          });
          const mesh = new THREE.Mesh(g, m);
          mesh.castShadow = !opc.piso && !opc.tr && !MOVIL; mesh.receiveShadow = true;
          if (opc.tr) mesh.renderOrder = 2;
          destino.add(mesh);
        }
        const porTipo = new Map();
        for (const c of cils) { const k = c[0] + c[6]; if (!porTipo.has(k)) porTipo.set(k, []); porTipo.get(k).push(c); }
        const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
        for (const lista of porTipo.values()) {
          const [color, , , , , , eje] = lista[0];
          const im = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 10), new THREE.MeshLambertMaterial({ color }), lista.length);
          lista.forEach(([, x, y, z0, h, r], i) => {
            if (eje === "z") { q.identity(); v.copy(W(x, y, z0 + h / 2)); }
            else if (eje === "x") { q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2); v.copy(W(x, y, z0)); }
            else { q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2); v.copy(W(x, y, z0)); }
            m4.compose(v, q, s.set(r, h, r)); im.setMatrixAt(i, m4);
          });
          im.castShadow = !MOVIL; im.receiveShadow = true;
          destino.add(im);
        }
        baldes.clear(); cils.length = 0;
      },
    };
    return L;
  }

  // Carteles con texto (textura de canvas), como la señalética de planta
  const cacheTex = new Map();
  function textura(texto, fondo, tinta, ancho, altoPx) {
    const k = [texto, fondo, tinta, ancho, altoPx].join("|");
    if (cacheTex.has(k)) return cacheTex.get(k);
    const cv = document.createElement("canvas"); cv.width = ancho; cv.height = altoPx;
    const g = cv.getContext("2d");
    g.fillStyle = fondo; g.fillRect(0, 0, ancho, altoPx);
    g.strokeStyle = tinta; g.lineWidth = Math.max(2, altoPx * 0.04); g.strokeRect(g.lineWidth, g.lineWidth, ancho - 2 * g.lineWidth, altoPx - 2 * g.lineWidth);
    g.fillStyle = tinta; g.textAlign = "center"; g.textBaseline = "middle";
    const lineas = texto.split("\n");
    const fs = Math.min(altoPx / (lineas.length * 1.25), ancho / (Math.max(...lineas.map(l => l.length)) * 0.6));
    g.font = `bold ${fs}px Segoe UI, Arial, sans-serif`;
    lineas.forEach((l, i) => g.fillText(l, ancho / 2, altoPx / 2 + (i - (lineas.length - 1) / 2) * fs * 1.15));
    const t = new THREE.CanvasTexture(cv); t.anisotropy = 4;
    cacheTex.set(k, t);
    return t;
  }
  /** cartel plano centrado en (x,y,z) mirando a +y/-y/+x/-x; dobleCara para los colgados */
  function cartel(dest, texto, x, y, z, ancho, altoC, mira, fondo, tinta, dobleCara) {
    const t = textura(texto, fondo || "#ffffff", tinta || "#111111", Math.round(128 * ancho / altoC), 128);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(ancho, altoC), new THREE.MeshBasicMaterial({ map: t, side: dobleCara ? THREE.DoubleSide : THREE.FrontSide }));
    m.position.copy(W(x, y, z));
    m.rotation.y = { "+y": Math.PI, "-y": 0, "+x": -Math.PI / 2, "-x": Math.PI / 2 }[mira];
    dest.add(m);
    return m;
  }

  // Etiquetas flotantes (HTML). nivel 1 = siempre; 2 = de cerca. Se ocultan si su cota está oculta.
  const etiquetas = [];
  function etiqueta(dest, x, y, z, titulo, sub, color, nivel) {
    const div = document.createElement("div");
    const n2 = nivel === 2;
    div.className = "cota-et";
    div.style.cssText = `background:${color};color:#fff;padding:${n2 ? "2px 6px" : "3px 9px"};border-radius:6px;font:600 ${n2 ? 10.5 : 12.5}px Segoe UI,Arial,sans-serif;box-shadow:0 1px 4px rgba(0,0,0,.35);text-align:center;line-height:1.25;max-width:240px;pointer-events:none;white-space:nowrap`;
    div.innerHTML = `<div>${titulo}</div>` + (sub ? `<div class="sub" style="font-weight:400;font-size:10px;opacity:.95;white-space:normal;display:none">${sub}</div>` : "");
    const o = new THREE.CSS2DObject(div); o.position.copy(W(x, y, z)); dest.add(o);
    etiquetas.push({ o, nivel: nivel || 1, sub: div.querySelector(".sub") });
    return o;
  }
  const visibleDe = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };

  // Colores por etapa (los mismos que el recorrido del artefacto)
  const ET = { chapa: "#6b7c8f", pretrat: "#1f8fd6", cata: "#4f6278", horno: "#e8590c", skid: "#c79a1a", sellado: "#1f6feb",
    fondo: "#7a5af8", revision: "#2b8a3e", esmalte: "#d6336c", final: "#6b2fa0", servicio: "#b7950b", elev: "#5d6d7e", sala: "#455a64" };
  const COL = { losa: "#c9d0d7", losaBorde: "#9aa4ad", rejilla: "#8a939d", acero: "#23395d", amarillo: "#f2c94c", negro: "#1f2328",
    galv: "#b9c2ca", panel: "#eef1f4", marco: "#d5dbe1", vidrio: "#cfe6f5", plenum: "#e7ebef", horno: "#c3c9cf", hornoJ: "#a5adb5",
    marcoT: "#4a525c", rodillo: "#9aa3ab", motor: "#2e5c9a", robot: "#eef1f4", robotJ: "#8e99a6" };

  // ================================================================================================
  // 1) LOSAS Y PISOS
  // ================================================================================================
  const L9 = lote(G[9]), L5 = lote(G[5.4]), L3 = lote(G[3.2]);
  function losaPoligono(dest, pts, z, esp, color, huecos) {
    const sh = new THREE.Shape(pts.map(([x, y]) => { const p = W(x, y, 0); return new THREE.Vector2(p.x, -p.z); }));
    for (const h of huecos || []) sh.holes.push(new THREE.Path(h.map(([x, y]) => { const p = W(x, y, 0); return new THREE.Vector2(p.x, -p.z); })));
    const g = new THREE.ExtrudeGeometry(sh, { depth: esp, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color }));
    m.position.y = z - esp; m.receiveShadow = true; m.castShadow = !MOVIL;
    dest.add(m);
    const borde = new THREE.LineSegments(new THREE.EdgesGeometry(g, 30), new THREE.LineBasicMaterial({ color: COL.losaBorde }));
    borde.position.y = m.position.y; dest.add(borde);
    return m;
  }
  // Cota +9,00: contorno del plano N9000 (capa B55), con la escotadura sureste del elevador de Montaje / túnel
  const LOSA9 = [[0.41, 0.41], [254.05, 0.41], [254.05, 17.05], [255.05, 18.05], [263.65, 18.05], [263.65, 81.53], [0.41, 81.53]];
  // banda de piletas (entre calles S y T de cota 0) con el hueco del acopio de skids vacíos (se ve la cota 5,4 abajo)
  const BANDA9 = [[0.41, 81.53], [263.65, 81.53], [263.65, 103.6], [0.41, 103.6]];
  const HUECO_SKIDS = [[52.31, 81.98], [104.86, 81.98], [104.86, 87.48], [52.31, 87.48]];
  // huecos en las losas por donde pasan los elevadores (5,6 × 3,6 m, recortados al borde de cada losa)
  const hueco = (x, y, r) => { const [a, b, c, d] = r; const x0 = Math.max(a + 0.1, x - 2.8), x1 = Math.min(c - 0.1, x + 2.8), y0 = Math.max(b + 0.1, y - 1.8), y1 = Math.min(d - 0.1, y + 1.8); return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]; };
  const marcoHueco = (Lt, h, z) => { baranda(Lt, [h[0], h[1]], z, 1.1); baranda(Lt, [h[2], h[3]], z, 1.1); };   // los lados de entrada quedan libres
  const H9 = [hueco(247.4, 57.7, [0.41, 0.41, 263.65, 81.53]), hueco(128.3, 15.5, [0.41, 0.41, 263.65, 81.53])];
  const HB9 = [hueco(251.5, 90.73, [0.41, 81.53, 263.65, 103.6]), hueco(13.8, 84.75, [0.41, 81.53, 263.65, 103.6])];
  const losa9 = losaPoligono(G[9], LOSA9, 9.0, 0.35, COL.losa, H9);
  losaPoligono(G[9], BANDA9, 9.0, 0.35, "#c3cbd2", [HUECO_SKIDS, ...HB9]);
  // baranda del hueco del acopio de skids
  baranda(L9, [[52.31, 81.98], [104.86, 81.98], [104.86, 87.48], [52.31, 87.48], [52.31, 81.98]], 9.0);

  // Cota +5,40: banda de transportadores de skids bajo las piletas (plano N5400) y acumulo de 2 pisos
  const BANDA5 = [[13.0, 82.0], [113.1, 82.0], [113.1, 79.0], [264.0, 71.5], [264.0, 103.6], [104.0, 103.6], [104.0, 87.6], [13.0, 87.6]];
  const R5a = [13.0, 82.0, 118.8, 87.6], R5b = [104.0, 78.0, 264.0, 103.6], R5c = [238.5, 71.5, 264.0, 78.0];
  const rp = ([a, b, c, d]) => [[a, b], [c, b], [c, d], [a, d]];
  const H5a = [hueco(13.8, 84.75, R5a)], H5b = [hueco(133.0, 90.51, R5b), hueco(262.05, 93.01, R5b)], H5c = [hueco(257.9, 76.45, R5c)];
  losaPoligono(G[5.4], rp(R5a), 5.4, 0.25, COL.rejilla, H5a);
  losaPoligono(G[5.4], rp(R5b), 5.4, 0.25, COL.rejilla, H5b);
  losaPoligono(G[5.4], rp(R5c), 5.4, 0.25, COL.rejilla, H5c);
  void BANDA5;
  // Level +3,20: pasarela del acumulo inferior de skids ricos, retorno de skids pobres por la pared y nivel 3200 del Cronos
  const R3b = [260.6, 4.0, 263.5, 103.0], R3c = [186.6, 4.4, 258.6, 13.2];
  const H3b = [hueco(262.05, 4.6, R3b)], H3c = [hueco(188.6, 8.9, R3c)];
  losaPoligono(G[3.2], [[13.0, 83.2], [118.8, 83.2], [118.8, 86.3], [13.0, 86.3]], 3.2, 0.2, COL.rejilla);
  losaPoligono(G[3.2], rp(R3b), 3.2, 0.2, COL.rejilla, H3b);
  losaPoligono(G[3.2], rp(R3c), 3.2, 0.2, COL.rejilla, H3c);
  for (const h of H9.concat(HB9)) marcoHueco(L9, h, 9.0);
  for (const h of H5a.concat(H5b, H5c)) marcoHueco(L5, h, 5.4);
  for (const h of H3c) marcoHueco(L3, h, 3.2);

  /** baranda amarilla (pasamanos + intermedio + zócalo + parantes) sobre una polilínea a la altura z */
  function baranda(Lt, pts, z, h) {
    const hh = h || 1.1;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[i + 1], l = Math.hypot(x2 - x1, y2 - y1);
      Lt.barra(COL.amarillo, x1, y1, x2, y2, 0.06, z + hh - 0.06, z + hh);
      Lt.barra(COL.amarillo, x1, y1, x2, y2, 0.05, z + hh / 2, z + hh / 2 + 0.05);
      Lt.barra(COL.amarillo, x1, y1, x2, y2, 0.03, z, z + 0.15);
      for (let t = 0; t <= l; t += 1.5) { const f = t / l; Lt.bloque(COL.amarillo, x1 + (x2 - x1) * f, y1 + (y2 - y1) * f, 0.06, 0.06, z, z + hh); }
    }
  }
  // barandas perimetrales de las pasarelas de 5,4 y 3,2
  baranda(L5, [[13.0, 82.0], [118.8, 82.0]], 5.4); baranda(L5, [[13.0, 87.6], [104.0, 87.6]], 5.4); baranda(L5, [[13.0, 82.0], [13.0, 87.6]], 5.4);
  baranda(L5, [[104.0, 78.0], [238.5, 78.0], [238.5, 71.5], [264.0, 71.5]], 5.4);
  baranda(L3, [[13.0, 83.2], [118.8, 83.2]], 3.2); baranda(L3, [[13.0, 86.3], [118.8, 86.3]], 3.2);
  baranda(L3, [[260.6, 4.0], [260.6, 103.0]], 3.2);
  baranda(L3, [[186.6, 4.4], [258.6, 4.4]], 3.2); baranda(L3, [[186.6, 13.2], [253.6, 13.2]], 3.2);

  // Estructura que sostiene 5,4 y 3,2: columnas azules (perfiles) cada 6 m y vigas (estimado: fotos de cota 0)
  for (let x = 16; x <= 118; x += 6) for (const y of [82.3, 87.3]) { L5.bloque(COL.acero, x, y, 0.3, 0.3, 0, 5.15); }
  for (let x = 107; x <= 262; x += 6) for (const y of [78.3, 103.3]) { L5.bloque(COL.acero, x, y, 0.3, 0.3, 0, 5.15); }
  for (let x = 16; x <= 118; x += 6) L5.caja("#e67e22", x - 0.12, 82.0, x + 0.12, 87.6, 5.15 - 0.35, 5.15);
  for (let x = 107; x <= 262; x += 6) L5.caja("#e67e22", x - 0.12, 78.0, x + 0.12, 103.6, 5.15 - 0.35, 5.15);
  for (let y = 6; y <= 100; y += 6) L3.bloque(COL.acero, 262.0, y, 0.3, 0.3, 0, 3.0);
  for (let x = 190; x <= 256; x += 6) for (const y of [4.6, 13.0]) L3.bloque(COL.acero, x, y, 0.3, 0.3, 0, 3.0);
  for (let x = 190; x <= 256; x += 6) L3.caja("#e67e22", x - 0.12, 4.4, x + 0.12, 13.2, 2.65, 3.0);

  // Piso de la cota 9: sendas peatonales verdes con borde amarillo y líneas amarillas junto a los transportadores (estimado)
  function senda(Lt, x0, y0, x1, y1, z) {
    Lt.pinta(COL.amarillo, x0, y0, x1, y1, z + 0.01);
    const enX = x1 - x0 > y1 - y0;
    Lt.pinta("#2e9d6a", enX ? x0 : x0 + 0.12, enX ? y0 + 0.12 : y0, enX ? x1 : x1 - 0.12, enX ? y1 - 0.12 : y1, z + 0.02);
  }
  for (const [x0, y0, x1, y1] of [[24, 50.2, 250, 52.0], [24, 38.6, 258, 40.4], [26, 62.0, 135, 63.8], [136, 61.4, 205, 63.0], [100, 26.6, 255, 28.4], [3.6, 30, 5.4, 76], [100, 72.0, 104, 76.5]])
    senda(L9, x0, y0, x1, y1, 9.0);
  // pasos peatonales del plano (cebras) en x 97,9 · y 9,2 y x 123,1 · y 70,9
  for (const [cx, cy] of [[97.89, 7.6], [123.13, 68.0]]) for (let k = -3; k <= 3; k++) L9.pinta("#ffffff", cx - 1.6, cy + k * 0.45 - 0.15, cx + 1.6, cy + k * 0.45 + 0.15, 9.03);

  // ================================================================================================
  // 2) TRANSPORTADORES DEL PLANO (ejes B02, módulos B03, mesas giratorias)
  // ================================================================================================
  // Altura sobre el piso de cada zona (la conexión con Chapa va a +1,70 / +0,75 m, rótulos del plano)
  const hTransp = (x, y) => (y > 104 ? (x > 60 ? 1.7 : 0.75) : 0.45);
  const rodillos = [];   // [x, y, z, largo, ang] para un InstancedMesh por cota
  function transportadores(Lt, C, n, filtro) {
    const z0 = n;
    for (const [x1, y1, x2, y2] of C.ejes) {
      if (filtro && !filtro(x1, y1, x2, y2)) continue;
      const l = Math.hypot(x2 - x1, y2 - y1); if (l < 0.5) continue;
      const h = hTransp((x1 + x2) / 2, (y1 + y2) / 2), ang = Math.atan2(y2 - y1, x2 - x1), nx = -Math.sin(ang), ny = Math.cos(ang);
      // dos largueros a ±0,5 m del eje, travesaños y patas cada 2,5 m
      for (const s of [-0.5, 0.5]) Lt.barra(COL.marcoT, x1 + nx * s, y1 + ny * s, x2 + nx * s, y2 + ny * s, 0.1, z0 + h - 0.16, z0 + h);
      for (let t = 0; t <= l; t += 2.5) {
        const f = t / l, cx = x1 + (x2 - x1) * f, cy = y1 + (y2 - y1) * f;
        Lt.rot(COL.marcoT, cx, cy, 0.08, 1.05, ang * 180 / Math.PI, z0 + h - 0.14, z0 + h - 0.06);
        for (const s of [-0.48, 0.48]) Lt.bloque("#3b434c", cx + nx * s, cy + ny * s, 0.08, 0.08, z0, z0 + h - 0.14);
      }
    }
    for (const [cx, cy, la, an, ang, conX] of C.mesas) {
      if (filtro && !filtro(cx, cy, cx, cy)) continue;
      if (la < 1.5 || an < 0.5) continue;
      const h = hTransp(cx, cy);
      if (conX) {
        // mesa elevadora / transferidor: base con franjas amarillo y negro, motor azul
        Lt.rot(COL.amarillo, cx, cy, la, an, ang, z0 + 0.02, z0 + h - 0.12);
        for (let k = -2; k <= 2; k++) Lt.rot(COL.negro, cx + Math.cos(rad(ang)) * k * la / 5.5, cy + Math.sin(rad(ang)) * k * la / 5.5, la / 11, an + 0.02, ang, z0 + 0.05, z0 + h - 0.15);
        Lt.rot(COL.motor, cx, cy, 0.6, 0.45, ang, z0 + h - 0.12, z0 + h + 0.05);
      } else {
        Lt.rot(COL.marcoT, cx, cy, la, Math.min(an, 1.3), ang, z0 + h - 0.22, z0 + h - 0.05);
      }
      // rodillos transversales cada 0,35 m (en los módulos de 1 m de ancho = transportador de rodillos para skid)
      if (an <= 1.3) for (let t = -la / 2 + 0.2; t < la / 2 - 0.1; t += 0.35) rodillos.push([n, cx + Math.cos(rad(ang)) * t, cy + Math.sin(rad(ang)) * t, z0 + h - 0.02, an * 0.92, ang]);
    }
  }
  const giratorias = [];   // mesas giratorias (discos) que giran con la carrocería
  function mesasGiratorias(dest, Lt, C, n) {
    for (const [x, y, r] of C.giros) {
      const h = hTransp(x, y);
      Lt.cil(COL.marcoT, x, y, n, h - 0.25, r + 0.15);
      Lt.cil(COL.amarillo, x, y, n + h - 0.25, 0.06, r + 0.2);
      const g = new THREE.Group();
      const disco = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.12, 32), new THREE.MeshLambertMaterial({ color: "#7d858d" }));
      disco.position.y = 0.06; g.add(disco);
      for (const s of [-0.5, 0.5]) { const b = new THREE.Mesh(new THREE.BoxGeometry(2 * r - 0.4, 0.12, 0.12), new THREE.MeshLambertMaterial({ color: COL.marcoT })); b.position.set(0, 0.18, s); g.add(b); }
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.3), new THREE.MeshLambertMaterial({ color: COL.amarillo })); m.position.set(r - 0.6, 0.15, 0); g.add(m);
      g.position.copy(W(x, y, n + h - 0.19)); dest.add(g);
      giratorias.push({ g, x, y, n });
    }
  }
  // en la banda de piletas no van rodillos a nivel del piso: la carrocería cuelga del transportador pendular (riel aéreo)
  const enPiletas = (x1, y1, x2, y2) => Math.min(y1, y2) > 85.5 && Math.max(y1, y2) < 99.5 && Math.min(x1, x2) > 12 && Math.max(x1, x2) < 254;
  transportadores(L9, D.N9000, 9, (x1, y1, x2, y2) => !enPiletas(x1, y1, x2, y2));
  mesasGiratorias(G[9], L9, D.N9000, 9);
  for (const [x0, x1, y] of [[3.0, 204.2, 96.99], [3.0, 133.6, 90.73]]) {
    L9.barra("#3b434c", x0, y, x1, y, 0.28, 9 + 4.0 + 0.1, 9 + 4.0 + 0.4);
    for (let x = x0 + 2; x < x1; x += 6) L9.barra("#3b434c", x, y, x, y + 0.01, 0.1, 9 + 4.4, 9 + 4.6);
  }
  // N5400: banda de skids a +5,40; acumulo inferior (y 84,75) y retorno por la pared este a +3,20 (tableros: CPU5 GR4-9 y
  // CPU4 GR8-13 en cota 3,2); los 3 carriles sobre el buffer = nivel 3200 del Cronos. Lo demás de ese plano es de cota 0.
  const en32 = (x1, y1, x2, y2) => (Math.abs(y1 - 84.75) < 0.2 && Math.abs(y2 - 84.75) < 0.2) || (Math.abs(x1 - 262.05) < 0.2 && Math.abs(x2 - 262.05) < 0.2) || (Math.max(y1, y2) < 14 && Math.min(x1, x2) > 186);
  const en54 = (x1, y1, x2, y2) => !en32(x1, y1, x2, y2) && Math.min(y1, y2) > 71 && Math.min(x1, x2) > 12;
  transportadores(L5, D.N5400, 5.4, en54);
  transportadores(L3, D.N5400, 3.2, en32);
  mesasGiratorias(G[5.4], L5, D.N5400, 5.4);
  // tramos de 3,20 que el plano no dibuja como eje: subida del Cronos (x 188,6) y llegada al elevador de Montaje
  transportadores(L3, { ejes: [[186.6, 8.9, 188.6, 8.9], [252.5, 9.4, 256.2, 9.4], [262.05, 3.5, 262.05, 5.42]], mesas: [] }, 3.2);

  // Rodillos instanciados por cota
  {
    const geo = new THREE.CylinderGeometry(0.05, 0.05, 1, 8); geo.rotateX(Math.PI / 2);   // eje a lo largo de z local
    const mat = new THREE.MeshLambertMaterial({ color: COL.rodillo });
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    for (const n of [9, 5.4, 3.2]) {
      const lista = rodillos.filter(r => r[0] === n); if (!lista.length) continue;
      const im = new THREE.InstancedMesh(geo, mat, lista.length);
      lista.forEach(([, x, y, z, l, ang], i) => { q.setFromAxisAngle(up, rad(ang)); m4.compose(W(x, y, z), q, s.set(1, 1, l)); im.setMatrixAt(i, m4); });
      G[n].add(im);
    }
  }

  // Flechas de sentido del plano (bloque FLECHA: apunta a +y con giro 0) pintadas en el piso junto al transportador
  for (const [x, y, rot] of D.N9000.flechas) {
    if (y > 104) continue;
    const a = rad(rot + 90), dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx;
    for (const s of [-1.1, 1.1]) {
      const bx = x + nx * s, by = y + ny * s;
      for (let k = 0; k < 6; k++) { const t = k * 0.1; L9.rot("#ffffff", bx + dx * (0.2 + t), by + dy * (0.2 + t), 0.1, 0.62 - t * 0.9, rot + 90, 9.025, 9.035, { piso: 1 }); }
      L9.rot("#ffffff", bx - dx * 0.25, by - dy * 0.25, 0.9, 0.14, rot + 90, 9.025, 9.035, { piso: 1 });
    }
  }

  // ================================================================================================
  // 3) EQUIPOS DE PROCESO DE LA COTA 9 (huellas del plano N9000; alturas estimadas)
  // ================================================================================================
  const Z9 = 9.0;
  const nombres9 = [];   // para el panel del recorrido: { nom, r, etapa }

  /** Cabina de pintura / proceso: paredes de paneles con ventanas, columnas, plenum superior, luminarias, puertas y cartel */
  function cabina(r, nom, etapa, opc) {
    const [x0, y0, x1, y1] = r, o = opc || {}, H = o.h || 4.2, P = o.plenum === undefined ? 1.4 : o.plenum, z = Z9;
    // piso de rejilla dentro de la cabina
    L9.caja("#5d6672", x0 + 0.1, y0 + 0.1, x1 - 0.1, y1 - 0.1, z + 0.01, z + 0.04, { piso: 1 });
    // paredes: zócalo de panel ciego 1 m + vidrio + dintel; columnas cada 2 m
    for (const [a, b, c, d] of [[x0, y0, x1, y0], [x0, y1, x1, y1], [x0, y0, x0, y1], [x1, y0, x1, y1]]) {
      L9.barra(COL.panel, a, b, c, d, 0.12, z, z + 1.0);
      L9.barra(o.vidrio || COL.vidrio, a, b, c, d, 0.05, z + 1.0, z + H - 0.4, { tr: o.opacidad || 0.38 });
      L9.barra(COL.panel, a, b, c, d, 0.12, z + H - 0.4, z + H);
      const l = Math.hypot(c - a, d - b);
      for (let t = 0; t <= l + 0.01; t += 2) { const f = t / l; L9.bloque(COL.marco, a + (c - a) * f, b + (d - b) * f, 0.14, 0.14, z, z + H); }
    }
    // plenum de aire (techo de la cabina) y equipos de inyección arriba
    if (P > 0) {
      // plenum traslúcido (en la realidad es ciego, con filtros): así se ven los robots y la línea desde arriba
      L9.caja(COL.plenum, x0 - 0.1, y0 - 0.1, x1 + 0.1, y1 + 0.1, z + H, z + H + P, { tr: 0.3 });
      for (const [a, b, c, d] of [[x0, y0, x1, y0], [x0, y1, x1, y1], [x0, y0, x0, y1], [x1, y0, x1, y1]]) L9.barra(COL.marco, a, b, c, d, 0.14, z + H + P - 0.12, z + H + P + 0.04);
      for (let x = x0 + 2; x < x1 - 1; x += 4) L9.barra(COL.marco, x, y0, x, y1, 0.08, z + H + P - 0.1, z + H + P);
      // equipos de inyección de aire, chicos y sobre el borde (no tapan la vista de adentro)
      for (let x = x0 + 2.5; x < x1 - 1.5; x += 7) for (const y of [y0 + 0.1, y1 - 1.0]) L9.caja("#cfd5db", x, y, x + 1.4, y + 0.9, z + H + P, z + H + P + 0.6);
    }
    // luminarias a lo largo de las paredes interiores (franjas encendidas)
    for (const y of [y0 + 0.16, y1 - 0.16]) for (let x = x0 + 0.6; x < x1 - 0.6; x += 2) L9.caja("#fffbe6", x, y - 0.04, x + 1.4, y + 0.04, z + 1.6, z + H - 0.6, { luz: 1 });
    // cartel con el nombre sobre la cabina, de los dos lados
    const w = Math.min(x1 - x0 - 1, 9);
    for (const [yy, mira] of [[y0 - 0.14, "-y"], [y1 + 0.14, "+y"]]) cartel(G[9], nom, (x0 + x1) / 2, yy, z + H - 0.2, w, 0.55, mira, "#ffffff", ET[etapa] || "#1f2a3a");
    nombres9.push({ nom, r, etapa });
  }

  /** Horno: cuerpo de paneles aislados, juntas cada 1,2 m, sellos de aire en los extremos, quemadores y conductos arriba */
  function horno(r, nom, carriles, opc) {
    const [x0, y0, x1, y1] = r, o = opc || {}, H = o.h || 4.6, z = Z9;
    L9.caja(COL.horno, x0, y0, x1, y1, z, z + H);
    for (let x = x0; x <= x1; x += 1.2) for (const y of [y0 - 0.02, y1 + 0.02]) L9.caja(COL.hornoJ, x - 0.04, y - 0.02, x + 0.04, y + 0.02, z, z + H);
    L9.caja(COL.hornoJ, x0 - 0.05, y0 - 0.05, x1 + 0.05, y1 + 0.05, z + H, z + H + 0.12);
    // zócalo oscuro
    L9.caja("#7d858d", x0 - 0.03, y0 - 0.03, x1 + 0.03, y1 + 0.03, z, z + 0.3);
    // sellos de aire (vestíbulos) en los dos extremos
    for (const xe of [x0, x1]) L9.caja("#b3bac1", xe - (xe === x0 ? 0 : 3.2), y0 - 0.15, xe + (xe === x0 ? 3.2 : 0), y1 + 0.15, z, z + H + 0.6);
    // quemadores / unidades de aire caliente sobre el techo, con conductos y chimeneas hacia el techo de la nave
    for (let x = x0 + 8; x < x1 - 6; x += o.cada || 18) {
      L9.caja("#9aa4ae", x, (y0 + y1) / 2 - 1.4, x + 4.2, (y0 + y1) / 2 + 1.4, z + H + 0.12, z + H + 2.4);
      L9.caja("#c0392b", x + 0.3, (y0 + y1) / 2 - 1.42, x + 0.9, (y0 + y1) / 2 - 1.3, z + H + 1.2, z + H + 1.8);   // tablero del quemador
      L9.cil("#b9c2ca", x + 3.4, (y0 + y1) / 2, z + H + 2.4, 17.5 - (z + H + 2.4), 0.35);
      L9.cil("#b9c2ca", x + 1.0, (y0 + y1) / 2 + 0.6, z + H + 2.4, 1.2, 0.45);
      L9.barra("#b9c2ca", x + 1.0, (y0 + y1) / 2 + 0.6, x - 2.5, (y0 + y1) / 2 + 0.6, 0.8, z + H + 3.2, z + H + 4.0);
    }
    // puertas de acceso del plano en los laterales (cada ~24 m)
    for (let x = x0 + 12; x < x1 - 6; x += 24) for (const [y, m] of [[y0 - 0.05, -1], [y1 + 0.05, 1]]) {
      L9.caja("#8e99a6", x, y - 0.03 * m, x + 1.0, y + 0.03 * m, z, z + 2.1);
      L9.caja(COL.amarillo, x + 0.75, y + 0.05 * m, x + 0.9, y + 0.08 * m, z + 1.0, z + 1.1);
    }
    for (const [yy, mira] of [[y0 - 0.1, "-y"], [y1 + 0.1, "+y"]]) cartel(G[9], nom, (x0 + x1) / 2, yy, z + H - 0.7, Math.min(10, x1 - x0 - 8), 0.7, mira, "#ffffff", ET.horno);
    // advertencia de temperatura
    for (const xx of [x0 + 4, x1 - 4]) cartel(G[9], "⚠ ALTA\nTEMPERATURA", xx, y0 - 0.1, z + 2.0, 1.2, 0.8, "-y", "#f2c94c", "#111111");
    void carriles;
    nombres9.push({ nom, r, etapa: "horno" });
  }

  /** Revisión / inspección: túnel abierto de luces blancas, plataformas a los dos lados (módulos de 1,9 m del plano) */
  function revision(r, nom, etapa, modulos) {
    const [x0, y0, x1, y1] = r, z = Z9, H = 3.8;
    // pórticos de luz cada 2 m
    for (let x = x0; x <= x1 + 0.01; x += 2) {
      for (const y of [y0, y1]) L9.bloque(COL.marco, x, y, 0.12, 0.12, z, z + H);
      L9.caja(COL.marco, x - 0.06, y0, x + 0.06, y1, z + H - 0.12, z + H);
    }
    for (const y of [y0 + 0.1, y1 - 0.1]) L9.caja("#ffffff", x0, y - 0.04, x1, y + 0.04, z + 1.2, z + H - 0.3, { luz: 1 });
    for (let x = x0 + 1; x < x1; x += 2) L9.caja("#ffffff", x - 0.6, (y0 + y1) / 2 - 1.2, x + 0.6, (y0 + y1) / 2 + 1.2, z + H - 0.2, z + H - 0.12, { luz: 1 });
    L9.caja("#e2e7ec", x0, y0, x1, y1, z + H, z + H + 0.25);
    // piso pintado claro (zona de revisión) y plataformas (módulos del plano)
    L9.pinta("#e9eef2", x0, y0, x1, y1, z + 0.005);
    for (const [cx, cy, a, b] of modulos || []) {
      L9.caja("#8a939d", cx - a / 2, cy - b / 2, cx + a / 2, cy + b / 2, z, z + 0.32);
      L9.caja(COL.amarillo, cx - a / 2, cy - b / 2, cx + a / 2, cy - b / 2 + 0.05, z + 0.32, z + 0.36);
    }
    for (const [yy, mira] of [[y0 - 0.08, "-y"], [y1 + 0.08, "+y"]]) cartel(G[9], nom, (x0 + x1) / 2, yy, z + H - 0.6, Math.min(12, x1 - x0 - 2), 0.6, mira, "#ffffff", ET[etapa] || ET.revision);
    nombres9.push({ nom, r, etapa });
  }

  /** Sala (WC, descanso, box, depósito): muros de 3 m, puerta y cartel */
  function sala(r, nom, color, opc) {
    const [x0, y0, x1, y1] = r, z = Z9, H = (opc && opc.h) || 3.0, puerta = (opc && opc.puerta) || "-y";
    for (const [a, b, c, d] of [[x0, y0, x1, y0], [x0, y1, x1, y1], [x0, y0, x0, y1], [x1, y0, x1, y1]]) L9.barra(color || "#e3e8ee", a, b, c, d, 0.15, z, z + H);
    L9.caja("#5b7fb3", x0 - 0.09, y0 - 0.09, x1 + 0.09, y1 + 0.09, z, z + 0.5);   // zócalo azul (como en cota 0)
    L9.caja("#d9dfe6", x0, y0, x1, y1, z + H, z + H + 0.1);
    const xm = (x0 + x1) / 2, ym = (y0 + y1) / 2;
    if (puerta === "-y" || puerta === "+y") { const y = puerta === "-y" ? y0 : y1; L9.caja("#6c7a89", xm - 0.45, y - 0.1, xm + 0.45, y + 0.1, z, z + 2.1); cartel(G[9], nom, xm, y + (puerta === "-y" ? -0.12 : 0.12), z + 2.5, Math.min(4, x1 - x0 - 0.5), 0.45, puerta, "#ffffff", "#1d2f6b"); }
    else { const x = puerta === "-x" ? x0 : x1; L9.caja("#6c7a89", x - 0.1, ym - 0.45, x + 0.1, ym + 0.45, z, z + 2.1); cartel(G[9], nom, x + (puerta === "-x" ? -0.12 : 0.12), ym, z + 2.5, Math.min(4, y1 - y0 - 0.5), 0.45, puerta, "#ffffff", "#1d2f6b"); }
  }

  // ---- Banda de piletas (norte, y 82–104): ingreso, preparación manual, pretratamiento, cataforesis, horno ----
  {
    const z = Z9;
    // PRETRATAMIENTO (x 21,5–204,2; plano B03): túnel cerrado con 9 etapas (árbol de máquinas: SKID 1…9 PRETRATAMIENTO)
    const t0 = 21.5, t1 = 204.2, ya = 94.6, yb = 99.4, H = 4.4;
    const etapa = (t1 - t0) / 9;
    const liq = ["#9ccbe4", "#8cc2df", "#7fb9d9", "#a9cfe0", "#9fb7c7", "#93aec0", "#a9cfe0", "#b5d6e5", "#c3dde9"];
    for (let k = 0; k < 9; k++) {
      const a = t0 + k * etapa + 0.4, b = t0 + (k + 1) * etapa - 0.4;
      L9.caja("#aeb7c0", a, ya + 0.3, b, yb - 0.3, z, z + 1.1);                 // pileta (acero inoxidable)
      L9.caja(liq[k], a + 0.2, ya + 0.5, b - 0.2, yb - 0.5, z + 1.1, z + 1.12, { tr: 0.85 });   // superficie del líquido
      L9.cil("#7d858d", a + 1.0, ya - 0.6, z, 1.6, 0.35);                       // bomba de recirculación
      cartel(G[9], "PRETRATAMIENTO\nETAPA " + (k + 1), (a + b) / 2, ya - 0.08, z + 3.0, 3.2, 0.9, "-y", "#ffffff", ET.pretrat);
    }
    // cerramiento del túnel: paneles con ventanas, techo y extractores
    for (const y of [ya, yb]) {
      L9.barra("#dfe4e8", t0, y, t1, y, 0.1, z, z + 1.4);
      L9.barra(COL.vidrio, t0, y, t1, y, 0.05, z + 1.4, z + 2.6, { tr: 0.32 });
      L9.barra("#dfe4e8", t0, y, t1, y, 0.1, z + 2.6, z + H);
      for (let x = t0; x <= t1; x += 3) L9.bloque("#aab3bc", x, y, 0.12, 0.12, z, z + H);
    }
    L9.caja("#d3d9df", t0, ya, t1, yb, z + H, z + H + 0.15, { tr: 0.28 });
    for (let x = t0 + 6; x < t1; x += 15) { L9.caja("#b9c2ca", x, ya + 1.5, x + 2, yb - 1.5, z + H + 0.15, z + H + 1.2); L9.cil("#b9c2ca", x + 1, (ya + yb) / 2, z + H + 1.2, 17.0 - z - H - 1.2, 0.5); }
    // estructura azul y carro del transportador pendular (CPU2A "péndulo bonder") por arriba
    for (let x = t0; x <= t1; x += 6) L9.caja(COL.acero, x - 0.15, ya - 0.2, x + 0.15, yb + 0.2, z + H - 0.6, z + H - 0.3);
    nombres9.push({ nom: "PRETRATAMIENTO", r: [t0, ya, t1, yb], etapa: "pretrat" });

    // CATAFORESIS: cuba ED (x 21,5–51,5; y 88,1–93,4), ánodos al costado, rectificadores (tableros A–G de cota 0)
    const c0 = 21.5, c1 = 51.5, ca = 88.1, cb = 93.4;
    L9.caja("#8a939d", c0, ca, c1, cb, z, z + 1.4);
    L9.caja("#3e4c5e", c0 + 0.3, ca + 0.3, c1 - 0.3, cb - 0.3, z + 1.4, z + 1.42, { tr: 0.92 });
    for (let x = c0 + 1; x < c1 - 0.5; x += 1.2) for (const y of [ca + 0.45, cb - 0.45]) L9.bloque("#c9d1da", x, y, 0.25, 0.08, z + 0.6, z + 1.6);   // ánodos
    for (const y of [ca, cb]) { L9.barra("#dfe4e8", c0, y, c1, y, 0.1, z + 1.4, z + 4.6); }
    L9.caja("#d3d9df", c0, ca, c1, cb, z + 4.6, z + 4.75, { tr: 0.28 });
    cartel(G[9], "CATAFORESIS · CUBA ED", (c0 + c1) / 2, ca - 0.12, z + 3.4, 6, 0.7, "-y", "#ffffff", ET.cata);
    nombres9.push({ nom: "CATAFORESIS (cuba ED)", r: [c0, ca, c1, cb], etapa: "cata" });
    // LAVADOS después de la cataforesis (LAVAGGI, x 51,6–111,7): túnel de enjuagues
    for (let k = 0; k < 5; k++) { const a = 51.6 + k * 12 + 0.4, b = a + 11.2; L9.caja("#aeb7c0", a, 88.9, b, 92.5, z, z + 1.0); L9.caja("#b8cbd6", a + 0.2, 89.1, b - 0.2, 92.3, z + 1.0, z + 1.02, { tr: 0.85 }); }
    for (const y of [88.7, 92.7]) { L9.barra("#dfe4e8", 51.6, y, 111.7, y, 0.1, z, z + 1.2); L9.barra(COL.vidrio, 51.6, y, 111.7, y, 0.05, z + 1.2, z + 2.4, { tr: 0.32 }); L9.barra("#dfe4e8", 51.6, y, 111.7, y, 0.1, z + 2.4, z + 4.2); }
    L9.caja("#d3d9df", 51.6, 88.7, 111.7, 92.7, z + 4.2, z + 4.35, { tr: 0.28 });
    cartel(G[9], "LAVADOS POST-CATAFORESIS", 81.6, 88.58, z + 3.2, 6.5, 0.6, "-y", "#ffffff", ET.cata);
    nombres9.push({ nom: "LAVADOS (post-cataforesis)", r: [51.6, 88.7, 111.7, 92.7], etapa: "cata" });
    // TÚNEL DE CONEXIÓN (x 116,6–133,6) hacia el horno
    cabina([116.6, 86.2, 133.6, 92.7], "TÚNEL DE CONEXIÓN", "cata", { h: 4.2, plenum: 0.4, vidrio: "#dfe4e8", opacidad: 0.7 });
    // HORNO DE CATAFORESIS (x 133,6–228,2) y ENFRIADOR (x 229,2–239,3) – capa B58
    horno([133.6, 88.0, 228.2, 93.5], "HORNO DE CATAFORESIS", 1, { cada: 16 });
    cabina([229.2, 88.0, 239.3, 93.5], "ENFRIADOR", "horno", { h: 4.2, plenum: 0.8, vidrio: "#dfe4e8", opacidad: 0.75 });
    for (let x = 230.5; x < 238.5; x += 2.6) L9.cil("#9aa4ae", x, 90.75, z + 5.0, 3.0, 0.45);   // extractores del enfriador
    // PREPARACIÓN MANUAL antes de las piletas (B20: x 221,5–243; y 94,2–99,7)
    cabina([221.5, 94.2, 243.0, 99.7], "PREPARACIÓN MANUAL", "chapa", { h: 3.8, plenum: 1.0 });
    // ELEVADOR A COTA 0,00 (montacargas, rótulo del plano)
    sala([209.8, 99.2, 214.6, 103.2], "ELEVADOR COTA 0,00", "#cfd8e2", { puerta: "-y", h: 3.4 });
  }

  // ---- Sala principal de cota 9 ----
  // REVISIÓN DE CATAFORESIS = "REVISIONE FONDO" (B20: x 136,1–243,2; y 65,3–70,7) con sus 2 filas de puestos (módulos 1,9 m)
  {
    const mods = [];
    for (let x = 140.4; x < 222.0; x += 3.05) for (const y of [66.4, 69.6]) mods.push([x, y, 2.4, 1.6]);
    revision([136.1, 65.3, 243.2, 70.7], "REVISIÓN DE CATAFORESIS · LIJADO", "revision", mods);
    // delibera tramo fondo (B58)
    L9.caja("#2b8a3e", 223.23, 65.31, 228.23, 65.4, Z9, Z9 + 2.2);
    cartel(G[9], "DELIBERA TRAMO FONDO", 225.7, 65.2, Z9 + 2.6, 3.4, 0.4, "-y", "#2b8a3e", "#ffffff");
    // cabinas de lijado con extracción (B03 x 177,7–191; 13,3 m) dentro de la revisión
    for (const y of [65.5, 68.6]) L9.caja("#c9d1da", 177.7, y, 191.0, y + 1.93, Z9 + 3.8, Z9 + 4.3);
  }
  // FUERA DE LÍNEA REVISIÓN FONDO + BOX REVISIÓN (B20 x 216,2–227,6; y 70,7–74,6)
  cabina([216.2, 70.7, 227.6, 74.6], "BOX REVISIÓN", "revision", { h: 3.6, plenum: 0.6 });
  // ESTACIÓN I: registro del color antes de pintar (B55 x 15,8–26,3; y 65,3–70,8)
  {
    const [x0, y0, x1, y1] = [15.8, 65.3, 26.3, 70.8];
    L9.pinta("#e0a800", x0, y0, x1, y1, Z9 + 0.004);
    for (let x = x0, k = 0; x < x1; x += 0.5, k++) { L9.pinta(k % 2 ? COL.negro : COL.amarillo, x, y0, Math.min(x + 0.5, x1), y0 + 0.3, Z9 + 0.01); L9.pinta(k % 2 ? COL.negro : COL.amarillo, x, y1 - 0.3, Math.min(x + 0.5, x1), y1, Z9 + 0.01); }
    L9.bloque("#5d6672", 21.0, 64.6, 0.5, 0.5, Z9, Z9 + 0.1); L9.bloque("#7d858d", 21.0, 64.6, 0.12, 0.12, Z9 + 0.1, Z9 + 1.1);
    L9.bloque("#2b2f33", 21.0, 64.6, 0.55, 0.06, Z9 + 1.1, Z9 + 1.5); L9.bloque("#dfe8ef", 21.0, 64.56, 0.48, 0.01, Z9 + 1.14, Z9 + 1.46, { luz: 1 });
    L9.bloque("#e0a800", 21.0, 64.6, 0.7, 0.7, Z9 + 2.3, Z9 + 3.0);
    for (const m of ["+y", "-y", "+x", "-x"]) { const o = 0.36; const [cx, cy] = { "+y": [21.0, 64.6 + o], "-y": [21.0, 64.6 - o], "+x": [21.0 + o, 64.6], "-x": [21.0 - o, 64.6] }[m]; cartel(G[9], "I", cx, cy, Z9 + 2.65, 0.6, 0.6, m, "#e0a800", "#ffffff"); }
    cartel(G[9], "ESTACIÓN I\nREGISTRO DEL COLOR", 21.0, 64.2, Z9 + 1.85, 1.5, 0.45, "-y", "#ffffff", "#1f2a3a");
    nombres9.push({ nom: "ESTACIÓN I", r: [x0, y0, x1, y1], etapa: "revision" });
  }
  // ACUMULO LOTE COLORES: 4 carriles (y 68,0 / 70,5 / 73,0 / 75,5) entre x 29 y 100, con transferidores en los extremos
  {
    cartel(G[9], "ACUMULO LOTE COLORES", 64, 77.2, Z9 + 3.4, 8, 0.8, "-y", "#1d2f6b", "#ffffff", true);
    for (const s of [-1, 1]) L9.caja("#7d858d", 64 + s * 3.2 - 0.01, 77.19, 64 + s * 3.2 + 0.01, 77.21, Z9 + 3.8, 17);
    for (const [y, n] of [[68.01, 1], [70.51, 2], [73.02, 3], [75.52, 4]]) cartel(G[9], "CARRIL " + n, 31.5, y - 0.75, Z9 + 0.9, 1.3, 0.32, "-y", "#ffffff", "#1d2f6b");
    nombres9.push({ nom: "ACUMULO LOTE COLORES", r: [27, 66.5, 100.5, 77], etapa: "revision" });
  }
  // BAJO CARROCERÍA: PREPARACIÓN MANUAL (x 205–243) + CABINA DE FONDO con robots UBS & UBC (x 132,3–195,4)
  cabina([205.2, 54.6, 243.3, 60.6], "PREPARACIÓN MANUAL · BAJO CARROCERÍA", "fondo", { h: 3.8, plenum: 0.8 });
  cabina([132.3, 54.7, 195.4, 60.7], "CABINA DE FONDO · ROBOTS UBS & UBC", "fondo", { h: 4.4, plenum: 1.4 });
  // rieles de los robots (A10: x 165,07–177,59 a los dos lados)
  for (const [a, b] of [[54.27, 55.52], [59.93, 61.18]]) L9.caja("#7d858d", 165.07, a, 177.59, b, Z9, Z9 + 0.5);
  // HORNO DE FONDO (pregelado) x 24–132,1; y 54–61,3 (capa A08)
  horno([24.0, 54.0, 132.1, 61.3], "HORNO DE FONDO · PREGELADO", 1, { cada: 18 });
  // HORNOS DE ESMALTE SX / DX: x 24–96,1; y 42,4–49,7, dos túneles (y 44,24 y 47,74)
  horno([24.0, 42.4, 96.1, 49.7], "HORNOS DE ESMALTE SX / DX", 2, { cada: 15, h: 4.8 });
  // ---- Línea de esmalte (y ≈ 46, sentido −x): BLOWER+EMU → MANUAL BASE → ROBOT BASE → COMPLETACIÓN → FLASH-OFF → CLEAR ----
  cabina([235.2, 43.7, 250.2, 48.3], "BLOWER + EMU", "esmalte", { h: 4.0 });
  cabina([206.2, 43.0, 235.1, 49.0], "CABINA MANUAL BASE", "esmalte", { h: 4.4, plenum: 1.6 });
  cabina([193.2, 43.0, 206.1, 49.0], "CABINA ROBOT BASE", "esmalte", { h: 4.4, plenum: 1.6 });
  cabina([183.6, 43.0, 193.1, 49.0], "CABINA DE COMPLETACIÓN", "esmalte", { h: 4.4, plenum: 1.4 });
  cabina([155.9, 44.2, 183.5, 47.7], "FLASH-OFF", "esmalte", { h: 3.6, plenum: 0.8, vidrio: "#dfe4e8", opacidad: 0.7 });
  cabina([142.5, 43.0, 155.8, 49.0], "CLEAR INTERNO MANUAL", "esmalte", { h: 4.4, plenum: 1.6 });
  cabina([125.4, 43.5, 138.9, 48.5], "CLEAR ROBOT", "esmalte", { h: 4.4, plenum: 1.6 });
  cabina([94.8, 43.0, 116.0, 49.0], "TRANSFERENCIA A HORNOS", "esmalte", { h: 4.0, plenum: 0.6, vidrio: "#dfe4e8", opacidad: 0.7 });
  // tableros del plano y central de pintura de cada cabina (estimado)
  for (const [x, y] of [[192.09, 49.92], [137.82, 54.33]]) { L9.bloque("#d7dce1", x, y, 1.6, 0.5, Z9, Z9 + 2.1); L9.bloque("#2ecc71", x - 0.5, y - 0.26, 0.1, 0.02, Z9 + 1.8, Z9 + 1.9, { luz: 1 }); cartel(G[9], "TABLERO", x, y - 0.26, Z9 + 2.3, 1.2, 0.3, "-y", "#ffffff", "#1f2a3a"); }
  // ingresos a sala limpia con duchas de aire (AIR SHOWER del plano)
  for (const [x, y] of [[251.57, 41.17], [100.77, 41.35], [196.41, 64.45]]) {
    L9.bloque("#cfd8e2", x, y, 1.6, 1.2, Z9, Z9 + 2.4); L9.bloque("#7fb3d5", x, y, 1.62, 1.0, Z9 + 0.3, Z9 + 2.1, { tr: 0.5 });
    cartel(G[9], "AIR SHOWER", x, y - 0.62, Z9 + 2.6, 1.4, 0.3, "-y", "#1f6feb", "#ffffff");
  }
  // REVISIÓN FINAL DE ESMALTE + COLLAUDO DELIBERA (B58: x 28,8–98,6; y 14,6–25,3), 4 filas de puestos
  {
    const mods = [];
    for (let x = 31.0; x < 88.5; x += 3.0) for (const y of [15.4, 19.0, 21.0, 24.4]) mods.push([x, y, 2.3, 1.3]);
    revision([28.8, 14.6, 98.6, 25.3], "REVISIÓN FINAL DE ESMALTE · COLLAUDO DELIBERA", "final", mods);
    L9.caja("#6b2fa0", 89.66, 15.34, 96.66, 15.44, Z9, Z9 + 2.2);
    cartel(G[9], "DELIBERA TRAMO REVISIÓN ESMALTE", 93.2, 15.25, Z9 + 2.6, 4.2, 0.4, "-y", "#6b2fa0", "#ffffff");
  }
  // salas del plano
  sala([104.2, 72.1, 121.6, 76.3], "WC", "#e3e8ee", { puerta: "-y" });
  sala([208.6, 61.4, 214.9, 65.2], "ÁREA DE DESCANSO", "#e8e0d0", { puerta: "-y" });
  sala([216.23, 62.36, 225.54, 65.07], "BOX UTE 2", "#e3e8ee", { puerta: "-y" });
  sala([236.82, 60.71, 242.85, 65.1], "DEPÓSITO", "#e3e8ee", { puerta: "-x" });
  sala([122.78, 20.48, 130.79, 25.48], "ÁREA DE DESCANSO 3", "#e8e0d0", { puerta: "-y" });
  sala([131.6, 20.6, 138.4, 25.4], "BOX UTE 3", "#e3e8ee", { puerta: "-y" });
  sala([240.25, 4.71, 252.27, 12.9], "ÁREA EXHIBIDO WCM", "#dfe9f5", { puerta: "+y" });
  sala([254.05, 2.14, 262.0, 6.64], "EHS DOJO", "#dff0e4", { puerta: "+y" });
  // recinto del elevador de bajada de revisión final (A08: x 120,5–128,4 / 128,4–144,3; y 10–19,2)
  for (const [a, b, c, d] of [[120.5, 10.0, 144.3, 10.0], [120.5, 19.2, 144.3, 19.2], [120.5, 4.9, 120.5, 19.2]]) L9.barra("#cfd8e2", a, b, c, d, 0.15, Z9, Z9 + 3.2);
  // Vallas de seguridad del plano (capa B14) alrededor de los transportadores: malla amarilla de 2 m
  for (const t of D.N9000.trazos) {
    if (t.capa !== "B14") continue;
    for (let i = 0; i < t.p.length - 1; i++) {
      const [x1, y1] = t.p[i], [x2, y2] = t.p[i + 1], l = Math.hypot(x2 - x1, y2 - y1);
      if (l < 0.5) continue;
      L9.barra("#e3a800", x1, y1, x2, y2, 0.04, Z9 + 0.1, Z9 + 2.0, { tr: 0.45 });
      L9.barra("#d49a00", x1, y1, x2, y2, 0.06, Z9 + 1.94, Z9 + 2.0);
      for (let s = 0; s <= l; s += 2) { const f = s / l; L9.bloque("#d49a00", x1 + (x2 - x1) * f, y1 + (y2 - y1) * f, 0.06, 0.06, Z9, Z9 + 2.0); }
    }
  }
  // Puertas del plano (P80S 0,8 m · P70D doble · P-120 1,2 m): marco gris y hoja (blanca en cabinas)
  for (const [nom, x, y, rot] of D.N9000.puertas) {
    if (y > 104) continue;
    const ancho = nom === "P70D" ? 1.4 : nom === "P-120" ? 1.2 : 0.8;
    L9.rot(nom === "P-120" ? "#f4f6f8" : "#8e99a6", x, y, ancho, 0.08, rot, Z9, Z9 + 2.1);
    L9.rot("#3b434c", x, y, ancho + 0.12, 0.1, rot, Z9 + 2.1, Z9 + 2.2);
  }
  // Escaleras del plano (bloque ESCALERA) al techo de los hornos
  for (const [x, y] of D.N9000.escaleras) escalera(L9, x, y, Z9, 4.6);
  function escalera(Lt, x, y, z, h) {
    const n = Math.round(h / 0.2), paso = 0.25;
    for (let k = 0; k < n; k++) Lt.caja("#8a939d", x - 0.45, y + k * paso, x + 0.45, y + k * paso + paso, z + k * 0.2 + 0.15, z + k * 0.2 + 0.2);
    for (const s of [-0.5, 0.5]) { Lt.barra(COL.amarillo, x + s, y, x + s, y + n * paso, 0.05, z + 0.2, z + 0.3); Lt.barra(COL.amarillo, x + s, y, x + s, y + n * paso, 0.05, z + 1.1, z + 1.15); }
    Lt.caja("#8a939d", x - 0.6, y + n * paso, x + 0.6, y + n * paso + 1.2, z + h - 0.1, z + h);
  }

  // ---- Conexión con Chapistería (y 104–145, plano N9000): carril de ingreso a +1,70 m y retorno de skids vacíos a +0,75 m ----
  {
    const z = Z9;
    // galería del puente: piso y estructura (la caja amarilla del entorno se hace traslúcida en app.js)
    L9.caja("#b3bcc5", 46.5, 103.6, 72.5, 146.0, z - 0.3, z);
    for (let y = 106; y < 146; y += 6) for (const x of [46.7, 72.3]) L9.bloque(COL.acero, x, y, 0.3, 0.3, 0, z - 0.3);
    // ELEVADOR SCOCCA BIW (x 62,8, y 141,5): baja la carrocería del puente de Chapa (cota 14) a la carga sobre skid
    for (const [x, y] of [[60.6, 139.0], [65.0, 139.0], [60.6, 144.0], [65.0, 144.0]]) L9.bloque("#aeb6be", x, y, 0.3, 0.3, z, z + 6.0);
    for (const zz of [z + 2.5, z + 5.0, z + 5.9]) { L9.caja(COL.acero, 60.4, 138.85, 65.2, 139.0, zz, zz + 0.2); L9.caja(COL.acero, 60.4, 144.0, 65.2, 144.15, zz, zz + 0.2); }
    cartel(G[9], "ELEVADOR SCOCCA BIW", 62.8, 138.8, z + 6.5, 3.6, 0.5, "-y", "#f2c94c", "#111111", true);
    cartel(G[9], "CARGA S/ SKID PINTURA", 61.2, 128.4, z + 2.9, 3.6, 0.45, "-y", "#ffffff", "#1d2f6b", true);
    cartel(G[9], "VERIFICACIÓN SKID ENGANCHADO", 68.8, 108.3, z + 2.6, 3.8, 0.45, "-y", "#ffffff", "#1d2f6b", true);
    cartel(G[9], "DESCENSOR N+1,70 → N+0,50", 68.8, 119.0, z + 3.0, 3.6, 0.45, "-y", "#ffffff", "#1d2f6b", true);
    for (const [x, y, t] of [[51.3, 112, "RETORNO SKID VACÍOS N+0,75"], [68.8, 125, "INGRESO SCOCCAS N+1,70"]]) cartel(G[9], t, x, y, z + 2.6, 3.4, 0.4, "+x", "#ffffff", ET.skid, true);
  }

  // ================================================================================================
  // 4) COTA +5,40 Y LEVEL +3,20 (plano N5400)
  // ================================================================================================
  // CAMBIO DE SKID (CPU5 "Transporte cambio de skid"), en el MEDIO de la banda de +5,4 – corrección de Julian (10/10),
  // confirmada con el esquema "COTA 5000" del proyecto "Mejora en cambio de skid" (Santopolo, 2026: el elevador de cambio
  // CPU5 05.1 queda al final de los fly rollers que vienen del horno) y con el plano N5400 (símbolo de elevador en x ≈ 133
  // sobre la línea y 90,5; transferidores en x 122 y x 149,6). Orden: elevador de salida del horno (x 251,5) → fly rollers
  // hacia −x → MESA DE DESBLOQUEO (dos mesas antes; las rosetas giran 90°) → ELEVADOR DE CAMBIO (levanta la carrocería, el skid
  // rico baja a +3,2 y queda apoyada en un skid pobre) → transferidores → CPU4 hacia +x hasta el elevador CPU6 GR1.
  const CSK = { x: 133.0, y: 90.51 };
  {
    const z = 5.4, x0 = CSK.x - 3.0, x1 = CSK.x + 3.0, ya = CSK.y - 1.9, yb = CSK.y + 1.9;
    // estructura del elevador de cambio (columnas y vigas amarillas, como en la foto del proyecto)
    for (const [x, y] of [[x0, ya], [x1, ya], [x0, yb], [x1, yb]]) L5.bloque(COL.amarillo, x, y, 0.32, 0.32, z, z + 3.4);
    for (const y of [ya, yb]) L5.caja(COL.amarillo, x0 - 0.2, y - 0.16, x1 + 0.2, y + 0.16, z + 3.1, z + 3.4);
    for (const x of [x0, x1]) L5.caja(COL.amarillo, x - 0.16, ya - 0.2, x + 0.16, yb + 0.2, z + 3.1, z + 3.4);
    // marco de izaje con los apoyos que sostienen la carrocería mientras se cambia el skid de abajo
    L5.caja("#c8462f", CSK.x - 2.4, CSK.y - 1.05, CSK.x + 2.4, CSK.y - 0.85, z + 1.15, z + 1.3);
    L5.caja("#c8462f", CSK.x - 2.4, CSK.y + 0.85, CSK.x + 2.4, CSK.y + 1.05, z + 1.15, z + 1.3);
    for (const dx of [-1.8, -0.6, 0.6, 1.8]) for (const s of [-0.95, 0.95]) L5.bloque("#7d858d", CSK.x + dx, CSK.y + s, 0.12, 0.12, z + 0.3, z + 1.45);
    for (const s of [-1, 1]) L5.bloque("#2e5c9a", CSK.x + s * 2.7, yb + 0.3, 0.6, 0.45, z, z + 0.8);   // motorreductores
    cartel(G[5.4], "ELEVADOR CAMBIO DE SKID\nCPU5 · RICO → POBRE", CSK.x, ya - 0.3, z + 3.9, 3.8, 0.9, "-y", "#1f6feb", "#ffffff", true);
    // mesa de desbloqueo, dos mesas antes del cambio (las rosetas giran 90° y liberan los pinos)
    L5.caja(COL.amarillo, CSK.x + 5.0, CSK.y - 0.75, CSK.x + 10.0, CSK.y + 0.75, z, z + 0.42);
    for (let k = 0; k < 4; k++) L5.caja(COL.negro, CSK.x + 5.3 + k * 1.2, CSK.y - 0.77, CSK.x + 5.8 + k * 1.2, CSK.y + 0.77, z + 0.05, z + 0.38);
    for (const dx of [6.0, 9.0]) for (const s of [-0.62, 0.62]) L5.cil("#c0392b", CSK.x + dx, CSK.y + s, z + 0.42, 0.12, 0.14);   // rosetas
    cartel(G[5.4], "MESA DE DESBLOQUEO", CSK.x + 7.5, CSK.y - 1.0, z + 1.5, 2.6, 0.4, "-y", "#ffffff", "#c0392b", true);
    // baranda del pasillo de mantenimiento junto al cambio
    baranda(L5, [[CSK.x - 6, CSK.y - 2.6], [CSK.x + 11, CSK.y - 2.6]], z, 1.1);
    // ACUMULO DE SKIDS EN 2 PISOS (ACCUMULO SKID N 2 PIANI, x 16–113): skids ricos vacíos a +3,2 y +5,4
    cartel(G[5.4], "ACUMULO SKID 2 PISOS", 48.6, 81.9, z + 2.6, 5, 0.6, "-y", "#ffffff", ET.skid, true);
    cartel(G[5.4], "ÁREA STOCCAGGIO SKID VACÍOS", 78.0, 81.9, z + 2.0, 5, 0.5, "-y", "#ffffff", ET.skid, true);
  }
  // skids vacíos acumulados (ilustrativo: cantidad estimada)
  function skidQuieto(Lt, cx, cy, z, ang) {
    Lt.rot("#c79a1a", cx, cy, 5.0, 0.12, ang, z, z + 0.16); Lt.rot("#c79a1a", cx - Math.sin(rad(ang)) * 0.9, cy + Math.cos(rad(ang)) * 0.9, 5.0, 0.12, ang, z, z + 0.16);
    for (let k = -2; k <= 2; k++) Lt.rot("#a8820f", cx + Math.cos(rad(ang)) * k * 1.1 - Math.sin(rad(ang)) * 0.45, cy + Math.sin(rad(ang)) * k * 1.1 + Math.cos(rad(ang)) * 0.45, 0.12, 1.0, ang, z + 0.16, z + 0.32);
  }
  for (let x = 20; x < 110; x += 6.2) { skidQuieto(L3, x, 84.3, 3.2 + 0.47, 0); if (azar() < 0.8) skidQuieto(L5, x, 84.3, 5.4 + 0.47, 0); }
  // "clear zone": skids pobres vacíos esperando sobre las líneas de la banda de +5,4 (y 93,0 y 101,5) – cantidad ilustrativa
  function skidPobre(Lt, cx, cy, z) {
    for (const s of [-0.45, 0.45]) Lt.caja("#5d6672", cx - 2.5, cy + s - 0.06, cx + 2.5, cy + s + 0.06, z, z + 0.16);
    for (let k = -2; k <= 2; k++) Lt.caja("#4d5560", cx + k * 1.1 - 0.05, cy - 0.5, cx + k * 1.1 + 0.05, cy + 0.5, z + 0.16, z + 0.3);
  }
  for (const y of [101.52]) for (let x = 132; x < 250; x += 5.6) if (azar() < 0.75) skidPobre(L5, x, y, 5.4 + 0.47);   // (por y 93,0 pasan los skids pobres que van al cambio)
  cartel(G[5.4], "CLEAR ZONE · SKIDS POBRES\n(a confirmar)", 190, 103.4, 5.4 + 2.2, 5, 0.9, "-y", "#5d6672", "#ffffff", true);

  // ================================================================================================
  // 5) ELEVADORES QUE UNEN COTAS (torres que se estiran con "Separar pisos")
  // ================================================================================================
  const ELEV = [
    { id: "biw", nom: "ELEVADOR SCOCCA BIW", sub: "baja del puente de Chapa (cota 14) a la carga sobre skid", x: 62.8, y: 141.5, n0: 9, h0: 1.7, n1: 9, h1: 5.0, color: ET.chapa },
    { id: "asc2", nom: "ELEVADOR SALIDA HORNO CATA", sub: "baja de cota 9 a cota 5,4; de ahí los fly rollers CPU5 la llevan al cambio de skid", x: 251.5, y: 90.73, n0: 5.4, h0: 0.45, n1: 9, h1: 0.45, color: ET.cata },
    { id: "gr1", nom: "CPU6 GR1 · ELEVADOR", sub: "baja de cota 5,4 a la cabina de sellado (cota 0)", x: 257.9, y: 76.45, n0: 0, h0: 0.72, n1: 5.4, h1: 0.45, color: ET.sellado },
    { id: "gr11", nom: "ELEVADOR A LÍNEA DE FONDO · CPU6 GR11", sub: "sube de sellado (cota 0) a la línea de fondo (cota 9)", x: 247.4, y: 57.7, n0: 0, h0: 0.8, n1: 9, h1: 0.45, color: ET.fondo },
    { id: "cpu11", nom: "CPU11 GR08 · ELEVADOR", sub: "baja de revisión final (cota 9) a cota 0", x: 128.3, y: 15.5, n0: 0, h0: 0.48, n1: 9, h1: 0.45, color: ET.final },
    { id: "lv32", nom: "SUBE A +3,2 m (CRONOS)", sub: "a la salida de Óleo sube al nivel 3200, sobre el buffer", x: 188.6, y: 8.9, n0: 0, h0: 0.48, n1: 3.2, h1: 0.45, color: ET.elev },
    { id: "mont", nom: "ELEVADOR MONTAJE · CPU12 GR8", sub: "sube el Cronos del nivel 3200 al túnel de cota 9", x: 256.2, y: 8.9, n0: 3.2, h0: 0.45, n1: 9, h1: 0.3, color: ET.elev },
    { id: "rpobre", nom: "RETORNO SKID POBRE (CPU4)", sub: "sube los skids pobres vacíos a +3,2 (zona elevador Montaje) · a confirmar", x: 262.05, y: 4.6, n0: 0, h0: 0.48, n1: 3.2, h1: 0.45, color: ET.skid },
    { id: "gr7", nom: "CPU4 GR7 · ELEVADOR", sub: "skid pobre de +3,2 a +5,4 · ubicación a confirmar", x: 262.05, y: 93.01, n0: 3.2, h0: 0.45, n1: 5.4, h1: 0.45, color: ET.skid },
    { id: "gr5", nom: "CPU5 05.1 · ELEVADOR DE CAMBIO DE SKID", sub: "levanta la carrocería y baja el skid rico vacío a +3,2", x: 133.0, y: 90.51, n0: 3.2, h0: 0.45, n1: 5.4, h1: 0.45, color: ET.skid },
    { id: "doble", nom: "ELEVADOR DOBLE SKID RICO · CPU5 GR8/GR9", sub: "sube el skid rico vacío a cota 9 para volver a Chapa · a confirmar", x: 13.8, y: 84.75, n0: 3.2, h0: 0.45, n1: 9, h1: 0.45, color: ET.skid },
  ];
  const plataformas = {};   // id → { grupo, carga } para animar
  for (const e of ELEV) {
    const L = 1, g = new THREE.Group();
    // 4 parantes + travesaños cada "metro unitario" (se escala en y) y malla traslúcida en dos caras
    const mPar = new THREE.MeshLambertMaterial({ color: "#aeb6be" }), mMalla = new THREE.MeshLambertMaterial({ color: "#e3a800", transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false });
    const ax = 2.6, ay = 1.6;
    for (const [dx, dy] of [[-ax, -ay], [ax, -ay], [-ax, ay], [ax, ay]]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.22, L, 0.22), mPar); p.position.set(dx, L / 2, -dy); g.add(p); }
    for (const dy of [-ay, ay]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(2 * ax, L), mMalla); m.position.set(0, L / 2, -dy); g.add(m); }
    const p = W(e.x, e.y, 0); g.position.set(p.x, 0, p.z);
    vert.add(g);
    verticales.push({ obj: g, n0: e.n0, h0: 0, n1: e.n1, h1: e.h1 + 1.2, L });
    // plataforma móvil
    const plat = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.18, 2.6), new THREE.MeshLambertMaterial({ color: "#c8462f" })); plat.add(base);
    for (const s of [-1, 1]) { const f = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.06, 0.08), new THREE.MeshLambertMaterial({ color: COL.amarillo })); f.position.set(0, 0.12, s * 1.25); plat.add(f); }
    plat.position.set(p.x, alto(e.n0, e.h0) - 0.1, p.z);
    vert.add(plat);
    plataformas[e.id] = { plat, e, t: azar() * 30 };
    const et = etiqueta(vert, e.x, e.y, 0, e.nom, e.sub, e.color, 2);
    e.et = et;
  }
  // las etiquetas de elevadores van a mitad de la torre

  // ================================================================================================
  // 6) ROBOTS (cabinas con robots: posiciones R1–R7 del plano; brazo cubierto con funda, ilustrativo)
  // ================================================================================================
  const robots = [];
  function robot(dest, x, y, z, mira, escala) {
    const s = escala || 1, g = new THREE.Group();
    const mF = new THREE.MeshLambertMaterial({ color: COL.robot }), mJ = new THREE.MeshLambertMaterial({ color: COL.robotJ });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42 * s, 0.5 * s, 0.7 * s, 16), mJ); base.position.y = 0.35 * s; g.add(base);
    const giro = new THREE.Group(); giro.position.y = 0.7 * s; g.add(giro);
    const cuerpo = new THREE.Mesh(new THREE.BoxGeometry(0.7 * s, 0.6 * s, 0.6 * s), mF); cuerpo.position.y = 0.3 * s; giro.add(cuerpo);
    const hombro = new THREE.Group(); hombro.position.y = 0.6 * s; giro.add(hombro);
    const brazo1 = new THREE.Mesh(new THREE.BoxGeometry(0.32 * s, 1.5 * s, 0.32 * s), mF); brazo1.position.y = 0.75 * s; hombro.add(brazo1);
    const codo = new THREE.Group(); codo.position.y = 1.5 * s; hombro.add(codo);
    const brazo2 = new THREE.Mesh(new THREE.BoxGeometry(1.5 * s, 0.26 * s, 0.26 * s), mF); brazo2.position.x = 0.75 * s; codo.add(brazo2);
    const muneca = new THREE.Mesh(new THREE.CylinderGeometry(0.11 * s, 0.16 * s, 0.35 * s, 12), mJ); muneca.rotation.z = Math.PI / 2; muneca.position.x = 1.6 * s; codo.add(muneca);
    const campana = new THREE.Mesh(new THREE.ConeGeometry(0.14 * s, 0.22 * s, 16), new THREE.MeshLambertMaterial({ color: "#c9d1da" })); campana.rotation.z = -Math.PI / 2; campana.position.x = 1.86 * s; codo.add(campana);
    g.position.copy(W(x, y, z)); g.rotation.y = mira;
    dest.add(g);
    robots.push({ giro, hombro, codo, fase: azar() * 6, vel: 0.5 + azar() * 0.4 });
  }
  // CLEAR ROBOT y CABINA ROBOT BASE: robots a los dos lados (filas y 44,6 y 47,6 del plano) mirando al eje de la línea
  for (const [x, y] of [[129.9, 44.6], [133.0, 44.6], [136.3, 44.6], [129.0, 47.7], [132.4, 47.7], [135.5, 47.5], [194.1, 44.6], [197.3, 44.6], [201.6, 44.6], [204.8, 44.6], [194.6, 47.7], [199.4, 47.7], [204.3, 47.7]])
    robot(G[9], x, y < 46 ? 43.85 : 48.15, Z9, y < 46 ? Math.PI / 2 : -Math.PI / 2, 0.9);
  // CABINA DE FONDO (UBS & UBC): robots sobre los rieles del plano, 3 por lado (símbolos del plano; cantidad a confirmar)
  for (const x of [167.5, 171.3, 175.1]) { robot(G[9], x, 54.9, Z9 + 0.5, Math.PI / 2, 0.85); robot(G[9], x, 60.55, Z9 + 0.5, -Math.PI / 2, 0.85); }

  // ================================================================================================
  // 7) ETIQUETAS DE PROCESO (HTML) – mismos nombres que el recorrido
  // ================================================================================================
  const E9 = (x, y, t, s, c, n) => etiqueta(G[9], x, y, 16.5, t, s, c, n);
  E9(68.8, 118, "INGRESO DESDE CHAPISTERÍA", "elevador scocca BIW · carga sobre skid rico · verificación de enganche", ET.chapa);
  E9(232, 97, "PREPARACIÓN MANUAL", "limpieza y revisión a mano antes de las piletas · 7 lugares", ET.chapa, 2);
  E9(112, 97, "PRETRATAMIENTO", "desengrase, lavados y fosfato · Bonder 30 lugares · 9 skids de proceso", ET.pretrat);
  E9(36, 90.7, "CATAFORESIS", "cuba ED con corriente eléctrica · 19 lugares", ET.cata);
  E9(181, 90.7, "HORNO DE CATAFORESIS", "26 lugares · cuello de botella 32 JPH", ET.horno);
  E9(180, 68.0, "REVISIÓN DE CATAFORESIS", "lijado y revisión · 26 lugares · REVISIONE FONDO del plano", ET.revision);
  E9(64, 72, "ACUMULO LOTE COLORES", "4 carriles · 50 lugares · arma los lotes por color", ET.revision, 2);
  E9(21, 68, "ESTACIÓN I", "registro del color antes de la cabina", ET.revision, 2);
  E9(225, 57.6, "PREP. MANUAL BAJO CARROCERÍA", "", ET.fondo, 2);
  E9(164, 57.7, "BAJO CARROCERÍA · UBS & UBC", "robots de sellado y PVC del piso · 21 lugares · cuello de botella 29 JPH", ET.fondo);
  E9(78, 57.6, "HORNO DE FONDO (PREGELADO)", "22 lugares", ET.horno);
  E9(220, 46, "CABINA DE ESMALTE", "BLOWER + EMU → manual base → robot base → completación → flash-off → clear · 30 lugares · 30 JPH", ET.esmalte);
  E9(60, 46, "HORNOS DE ESMALTE SX / DX", "30 lugares", ET.horno);
  E9(63, 20, "REVISIÓN FINAL", "collaudo delibera · 28 lugares", ET.final);
  E9(222, 72.7, "FUERA DE LÍNEA REVISIÓN FONDO", "box revisión", ET.revision, 2);
  etiqueta(G[5.4], CSK.x, CSK.y, 13.5, "COTA 5,4 · CAMBIO DE SKID", "en el medio de la banda: mesa de desbloqueo + elevador de cambio CPU5 · la carrocería deja el skid rico y pasa al skid pobre", ET.skid);
  etiqueta(G[5.4], 60, 84.7, 11.0, "ACUMULO DE SKIDS RICOS (2 PISOS)", "a +3,2 y +5,4 · vuelven a Chapa por el elevador doble", ET.skid, 2);
  etiqueta(G[3.2], 222, 8.9, 8.5, "LEVEL +3,2 · CRONOS SOBRE EL BUFFER", "después de Óleo el Cronos sube y pasa por arriba del buffer KP1", ET.elev);
  etiqueta(G[3.2], 262.05, 50, 8.0, "RETORNO DE SKIDS POBRES (CPU4)", "a +3,2 por la pared, de la zona del elevador Montaje al cambio de skid", ET.skid, 2);
  // carteles de cota (grandes, en el borde de cada piso)
  cartel(G[9], "COTA +9,00", 2.2, 40, Z9 + 2.5, 6, 1.2, "-x", "#1f2a3a", "#ffffff", true);
  cartel(G[5.4], "COTA +5,40", 14.5, 84.8, 5.4 + 2.0, 3.6, 0.9, "-x", "#1f2a3a", "#ffffff", true);
  cartel(G[3.2], "LEVEL +3,20", 186.0, 8.8, 3.2 + 2.0, 3.6, 0.9, "-x", "#1f2a3a", "#ffffff", true);

  // ================================================================================================
  // 7b) DETALLE FINO DE LA COTA 9 (todo ESTIMADO, inspirado en cómo es una nave de pintura; ver supuestos)
  // ================================================================================================
  // operarios con mameluco blanco de sala limpia (capucha), en los puestos manuales y de revisión
  function operario(Lt, x, y, z, herramienta) {
    Lt.bloque("#e9eef3", x, y, 0.3, 0.42, z, z + 0.85);           // piernas (mameluco)
    Lt.bloque("#f4f6f8", x, y, 0.34, 0.5, z + 0.85, z + 1.47);   // torso
    Lt.bloque("#e2b48c", x, y, 0.2, 0.2, z + 1.47, z + 1.66);    // cara
    Lt.bloque("#f4f6f8", x, y, 0.26, 0.26, z + 1.6, z + 1.78);   // capucha
    Lt.bloque("#2b8a3e", x, y, 0.06, 0.52, z + 1.2, z + 1.3);    // franja de identificación
    if (herramienta === "pistola") { Lt.bloque("#7d858d", x + 0.25, y, 0.25, 0.08, z + 1.1, z + 1.2); Lt.cil("#2b2f33", x + 0.1, y, z + 1.1, 3.3, 0.02); }
    if (herramienta === "lija") Lt.bloque("#c9a227", x + 0.24, y, 0.18, 0.14, z + 1.0, z + 1.08);
    if (herramienta === "linterna") Lt.bloque("#fff7c2", x + 0.22, y, 0.1, 0.06, z + 1.25, z + 1.32, { luz: 1 });
  }
  for (let x = 224; x < 242; x += 4.5) { operario(L9, x, 95.1, Z9); operario(L9, x + 1.5, 98.8, Z9); }                  // preparación manual
  for (let x = 208; x < 242; x += 6) { operario(L9, x, 55.4, Z9, "lija"); operario(L9, x + 2.5, 59.8, Z9); }             // prep. bajo carrocería
  for (let x = 140.4, k = 0; x < 222.0; x += 3.05, k++) if (k % 3 === 0) { operario(L9, x, 66.4, Z9 + 0.32, "lija"); operario(L9, x + 1.2, 69.6, Z9 + 0.32, "lija"); }   // revisión de cataforesis
  for (let x = 209; x < 234; x += 6) { operario(L9, x, 43.9, Z9, "pistola"); operario(L9, x + 3, 48.1, Z9, "pistola"); }  // manual base
  for (const x of [185.5, 190.5]) { operario(L9, x, 43.9, Z9, "pistola"); operario(L9, x, 48.1, Z9, "pistola"); }       // completación
  for (const x of [145, 149, 153]) { operario(L9, x, 43.9, Z9, "pistola"); operario(L9, x + 1, 48.1, Z9, "pistola"); }  // clear interno manual
  for (let x = 31.0, k = 0; x < 88.5; x += 3.0, k++) if (k % 4 === 1) for (const y of [15.4, 24.4]) operario(L9, x, y, Z9 + 0.32, "linterna");   // revisión final
  operario(L9, 21.6, 64.1, Z9); operario(L9, 225.7, 64.8, Z9); operario(L9, 221.0, 72.4, Z9, "lija");                   // estación I, delibera, box revisión

  // matafuegos y gabinetes de incendio en las columnas de la nave que atraviesan la cota 9 (uno sí, uno no)
  {
    let k = 0;
    for (const c of api.N.columnas) {
      const [x, y, w, d, z0, z1] = c;
      if (z0 > 0 || z1 < 12 || x < 3 || x > 261 || y < 2 || y > 80) continue;
      if (k++ % 2) continue;
      const yy = y - d / 2 - 0.12;
      L9.bloque("#c0392b", x, yy, 0.22, 0.2, Z9 + 0.9, Z9 + 1.45);       // matafuego
      L9.bloque("#c0392b", x, yy, 0.6, 0.06, Z9 + 2.0, Z9 + 2.3);        // cartel rojo de señalización
      L9.bloque("#ffffff", x, yy - 0.04, 0.4, 0.02, Z9 + 2.08, Z9 + 2.22);
      if (k % 6 === 1) { L9.bloque("#b03026", x, yy, 0.75, 0.25, Z9 + 1.1, Z9 + 1.85); L9.bloque("#e9eef2", x, yy - 0.13, 0.5, 0.02, Z9 + 1.25, Z9 + 1.7); }   // boca de incendio
      L9.bloque(COL.amarillo, x, y, w + 0.12, d + 0.12, Z9, Z9 + 1.0);   // protección amarilla de la columna
      for (let s = 0; s < 4; s++) L9.bloque(COL.negro, x, y, w + 0.14, d + 0.14, Z9 + 0.1 + s * 0.24, Z9 + 0.2 + s * 0.24);
    }
  }
  // luminarias colgadas sobre la cota 9 (filas cada 12 m × 9 m, a +16 m) – un solo InstancedMesh
  {
    const pos = [];
    for (let x = 6; x < 260; x += 12) for (let y = 6; y < 80; y += 9) pos.push([x, y]);
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1.8, 0.18, 0.5), new THREE.MeshLambertMaterial({ color: "#ffffff", emissive: "#fffbe6", emissiveIntensity: 0.9 }), pos.length);
    const m4 = new THREE.Matrix4(), q0 = new THREE.Quaternion(), s1 = new THREE.Vector3(1, 1, 1);
    pos.forEach(([x, y], i) => { m4.compose(W(x, y, 16.0), q0, s1); im.setMatrixAt(i, m4); });
    G[9].add(im);
    for (const [x, y] of pos) L9.cil("#7d858d", x, y, 16.1, 1.0, 0.012);
  }
  // conductos de aire de las cabinas al techo de la nave y bandejas portacables sobre las filas de cabinas
  for (const { r } of nombres9.filter(e => e.etapa === "esmalte" || e.etapa === "fondo")) {
    const [x0, y0, x1, y1] = r;
    for (let x = x0 + 3; x < x1 - 2; x += 10) { L9.cil("#b9c2ca", x, (y0 + y1) / 2 - 1.0, Z9 + 5.8, 17.4 - Z9 - 5.8, 0.42); L9.cil("#aab3bc", x + 1.5, (y0 + y1) / 2 + 1.0, Z9 + 5.8, 17.4 - Z9 - 5.8, 0.32); }
  }
  for (const y of [50.6, 39.2, 62.6]) { L9.caja("#9aa3ab", 24, y - 0.3, 250, y + 0.3, Z9 + 6.6, Z9 + 6.7); L9.caja("#e3a800", 24, y + 0.45, 250, y + 0.6, Z9 + 6.4, Z9 + 6.55); L9.caja("#2e5c9a", 24, y - 0.6, 250, y - 0.45, Z9 + 6.4, Z9 + 6.55); }
  // paneles de la SALA LIMPIA (capa A26: cerramiento de la zona de pintura UTE 3), blancos de 3,5 m
  for (const t of D.N9000.trazos) {
    if (t.capa !== "A26" || t.c || t.p.length < 3) continue;
    if (t.p[0][0] === 250.3) continue;   // línea interior duplicada del panel
    for (let i = 0; i < t.p.length - 1; i++) { const [x1, y1] = t.p[i], [x2, y2] = t.p[i + 1]; L9.barra("#f2f4f6", x1, y1, x2, y2, 0.1, Z9, Z9 + 3.5); L9.barra("#5b7fb3", x1, y1, x2, y2, 0.13, Z9, Z9 + 0.3); }
  }
  // líneas amarillas de seguridad a 1,6 m de cada transportador (piso epoxi de la sala principal)
  for (const [x1, y1, x2, y2] of D.N9000.ejes) {
    if (Math.max(y1, y2) > 81) continue;
    const l = Math.hypot(x2 - x1, y2 - y1); if (l < 3) continue;
    const a = Math.atan2(y2 - y1, x2 - x1), nx = -Math.sin(a), ny = Math.cos(a);
    for (const s of [-1.6, 1.6]) L9.barra(COL.amarillo, x1 + nx * s, y1 + ny * s, x2 + nx * s, y2 + ny * s, 0.1, Z9 + 0.004, Z9 + 0.014, { piso: 1 });
  }
  // señalética de sala limpia y seguridad en los ingresos (duchas de aire) y escaleras
  for (const [x, y] of [[251.57, 41.17], [100.77, 41.35], [196.41, 64.45]]) {
    cartel(G[9], "SALA LIMPIA\nINGRESO CON MAMELUCO,\nCOFIA Y CUBRECALZADO", x + 1.6, y - 0.62, Z9 + 2.0, 1.6, 0.8, "-y", "#ffffff", "#1f6feb");
  }
  for (const [x, y] of D.N9000.escaleras) cartel(G[9], "SALIDA DE\nEMERGENCIA", x, y - 0.3, Z9 + 2.6, 1.2, 0.5, "-y", "#2e9d4f", "#ffffff");
  for (const [x, y] of [[36, 87.9], [60, 88.5]]) cartel(G[9], "⚠ PELIGRO\nTENSIÓN EN LA CUBA", x, y - 0.1, Z9 + 2.0, 1.4, 0.7, "-y", "#f2c94c", "#111111");
  // carteles de zona colgados del techo (UTE de cada línea según el árbol de máquinas de Mantenimiento)
  for (const [txt, x, y, col] of [["UTE 0 · PRETRATAMIENTO", 112, 93.9, ET.pretrat], ["UTE 0 · CATAFORESIS", 60, 87.6, ET.cata], ["UTE 0 · HORNO DE CATAFORESIS", 185, 87.6, ET.horno],
    ["UTE 2 · REVISIÓN DE CATAFORESIS", 190, 64.2, ET.revision], ["UTE 2 · BAJO CARROCERÍA UBS & UBC", 165, 53.3, ET.fondo], ["UTE 2 · HORNO DE FONDO", 80, 53.2, ET.horno],
    ["UTE 3 · LÍNEA DE ESMALTE", 200, 50.4, ET.esmalte], ["UTE 3 · HORNOS DE ESMALTE", 60, 50.8, ET.horno], ["UTE 4 · REVISIÓN FINAL", 63, 26.3, ET.final]]) {
    cartel(G[9], txt, x, y, 15.6, 7.5, 1.0, "-y", col, "#ffffff", true);
    for (const s of [-3.2, 3.2]) L9.caja("#7d858d", x + s - 0.015, y - 0.015, x + s + 0.015, y + 0.015, 16.1, 17.4);
  }
  // semáforos de estado (verde/amarillo/rojo) en la entrada de cada cabina y horno
  for (const { r } of nombres9) {
    const [x0, y0, x1] = r; const x = x1 + 0.35, y = y0 - 0.35;
    L9.bloque("#3b434c", x, y, 0.08, 0.08, Z9, Z9 + 2.6);
    L9.cil("#2ecc71", x, y, Z9 + 2.6, 0.16, 0.09); L9.cil("#6b5a14", x, y, Z9 + 2.76, 0.16, 0.09); L9.cil("#5a1a14", x, y, Z9 + 2.92, 0.16, 0.09);
    L9.bloque("#2ecc71", x, y, 0.2, 0.2, Z9 + 2.62, Z9 + 2.74, { luz: 1 });
  }
  // chapa trapezoidal galvanizada en la cara interior de las fachadas, de +9 hasta el techo (textura de nervios)
  {
    const cv = document.createElement("canvas"); cv.width = 64; cv.height = 8;
    const g = cv.getContext("2d");
    for (let i = 0; i < 64; i++) { const k = (i % 16); g.fillStyle = k < 6 ? "#c9d0d6" : k < 8 ? "#a9b2ba" : k < 14 ? "#dde2e6" : "#b4bcc3"; g.fillRect(i, 0, 1, 8); }
    const tex = new THREE.CanvasTexture(cv); tex.wrapS = THREE.RepeatWrapping;
    const cx = (W(1, 0, 0).x - W(0, 0, 0).x);   void cx;
    for (const s of api.N.muros.envolvente) {
      const [x1, y1, x2, y2] = s, h = s.length > 5 ? s[5] : s[4], z0 = s.length > 5 ? s[4] : 0;
      const L = Math.hypot(x2 - x1, y2 - y1); if (L < 4 || h < 12 || z0 > 9) continue;
      const a = Math.atan2(y2 - y1, x2 - x1), top = Math.min(h, 12.5), alt = top - 9.0;   // hasta la altura del corte de muros
      const t = tex.clone(); t.needsUpdate = true; t.repeat.set(L / 1.0, 1);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(L, alt), new THREE.MeshLambertMaterial({ map: t, side: THREE.DoubleSide }));
      // del lado de adentro de la nave (0,6 m hacia el centro)
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, nx = -Math.sin(a), ny = Math.cos(a);
      const dentro = ((132 - mx) * nx + (52 - my) * ny) > 0 ? 1 : -1;
      m.position.copy(W(mx + nx * 0.6 * dentro, my + ny * 0.6 * dentro, 9.0 + alt / 2)); m.rotation.y = a;
      G[9].add(m);
    }
  }
  // cota 5,4: operarios de mantenimiento y escalera desde cota 0 (frente a la celda verde de acceso)
  operario(L5, 254.2, 79.0, 5.4); operario(L5, 60.0, 82.8, 5.4);
  escalera(L5, 116.0, 87.8, 0, 5.4);

  L9.cerrar(); L5.cerrar(); L3.cerrar();

  // ================================================================================================
  // 8) ANIMACIÓN: robots, mesas giratorias, elevadores y etiquetas
  // ================================================================================================
  let t = 0;
  if (animar) animar.push((dt) => {
    t += dt;
    if (G[9].visible) for (const r of robots) {
      const k = t * r.vel + r.fase;
      r.giro.rotation.y = Math.sin(k) * 0.9; r.hombro.rotation.z = -0.35 + Math.sin(k * 1.3) * 0.25; r.codo.rotation.z = -0.9 + Math.sin(k * 0.9) * 0.35;
    }
    // etiquetas: visibles solo si su cota está visible; las de nivel 2 de cerca. Con el edificio entero y el techo puesto
    // no se muestran (quedan adentro): se ven al elegir una cota, sacar el techo o separar los pisos
    const M = window.__maqueta, cam = M && M.camara, zm = cam ? cam.zoom : 1;
    const tapadas = M && M.estado && M.estado.piso === "todas" && M.estado.sep === 0 && M.capas.techo.visible;
    for (const e of etiquetas) {
      const v = !tapadas && visibleDe(e.o.parent);
      e.o.visible = v && (e.nivel === 1 || zm > (MOVIL ? 4.5 : 2.2));
      if (e.sub) e.sub.style.display = zm > 4 ? "block" : "none";
    }
  });

  function ubicarEtiquetasElev() { for (const e of ELEV) if (e.et) e.et.position.y = (alto(e.n0, e.h0) + alto(e.n1, e.h1)) / 2 + 2; }
  setSep(0);

  return { G, vert, setSep, alto, off: () => SEP, giratorias, plataformas, ELEV, ET, W, etiqueta, nombres9, lote, CSK, cartel };
};
