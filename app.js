/* Maqueta 3D Paint Shop KP1 – visor (Fase 3: nave).
 * Datos: window.NAVE (data/nave.js, generado por etl/nave3d.py). Unidades: metros.
 * Convención: plano (x, y) + altura z  →  Three.js (x, z, -y), centrado en la nave. */
(function () {
  "use strict";
  const N = window.NAVE;
  if (!N) { document.body.insertAdjacentHTML("beforeend", "<p style='padding:120px 24px'>Falta data/nave.js: correr etl/nave3d.py</p>"); return; }

  // ---------------------------------------------------------------- colores
  const C = {
    piso: 0xe4e9ef, naveLosa: 0xf3f6f9, calle: 0xa9dcb8, ejes: 0xb6c2cf,
    envolvente: 0xffffff, anexos: 0xf4f6f9, internos: 0xeaf1f8, tabiques: 0xd6e3f1,
    columnaNave: 0xc3cedb, columnaPlat: 0xa9b8c9, techo: 0xfbfcfe, borde: 0x9fb0c3,
    patio: 0xc3cbd4, torre: 0xf2c94c, chimenea: 0xb9c4d0, conexion: 0xf6d77a, norte: 0x1f6feb,
    terreno: 0xc9d4bf, calle: 0x9ea9b5, estac: 0xb3bcc6, solar: 0x2f4a78, solarMarco: 0x9aa7b6,
    vecino: 0xeef1f5, verde: 0xb2d1a2, arbol: 0x7fb176, via: 0x6f757d, pista: 0x98a3af,
    // autos estacionados en grises (el azul fuerte queda reservado a las carrocerías en proceso)
    autos: [0xffffff, 0xf4f6f9, 0xdfe4ea, 0xc3cbd4, 0xa3adb9, 0x7d8896, 0x5b6573],
  };

  // ---------------------------------------------------------------- escena
  const cont = document.getElementById("escena");
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  cont.appendChild(renderer.domElement);

  const etiquetas = new THREE.CSS2DRenderer();
  etiquetas.setSize(window.innerWidth, window.innerHeight);
  Object.assign(etiquetas.domElement.style, { position: "absolute", top: "0", pointerEvents: "none" });
  cont.appendChild(etiquetas.domElement);

  const scene = new THREE.Scene();
  const xs = N.nave.map(p => p[0]), ys = N.nave.map(p => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const W = (x, y, z) => new THREE.Vector3(x - cx, z, -(y - cy));

  scene.add(new THREE.HemisphereLight(0xffffff, 0xd5dde6, 0.9));
  const sol = new THREE.DirectionalLight(0xffffff, 0.45);
  sol.position.set(-60, 320, 90);   // sol alto: sombras cortas y suaves
  sol.castShadow = true;
  sol.shadow.mapSize.set(4096, 4096);
  Object.assign(sol.shadow.camera, { left: -480, right: 480, top: 480, bottom: -480, near: 10, far: 900 });
  sol.shadow.bias = -0.0005;
  scene.add(sol);

  // ---------------------------------------------------------------- utilidades de geometría
  const mat = (color, extra) => new THREE.MeshLambertMaterial(Object.assign({ color }, extra || {}));
  const matBorde = new THREE.LineBasicMaterial({ color: C.borde, transparent: true, opacity: 0.55 });

  /** Muros: cada segmento [x1,y1,x2,y2,h] → caja de espesor e. z0 opcional, hmax recorta. */
  function geoMuros(segs, e, opt) {
    const pos = [];
    const hmax = (opt && opt.hmax) || Infinity;
    for (const s of segs) {
      const [x1, y1, x2, y2] = s;
      const z0 = s.length > 5 ? s[4] : 0;
      const z1 = Math.min(s.length > 5 ? s[5] : s[4], z0 + hmax);
      const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy);
      if (L < 1e-3) continue;
      const nx = -dy / L * e / 2, ny = dx / L * e / 2;
      caja(pos, [[x1 + nx, y1 + ny], [x2 + nx, y2 + ny], [x2 - nx, y2 - ny], [x1 - nx, y1 - ny]], z0, z1);
    }
    return armar(pos);
  }

  /** Columnas: [x, y, ancho, prof, z0, z1] → caja alineada a los ejes. */
  function geoColumnas(cols) {
    const pos = [];
    for (const [x, y, w, d, z0, z1] of cols) {
      caja(pos, [[x - w / 2, y - d / 2], [x + w / 2, y - d / 2], [x + w / 2, y + d / 2], [x - w / 2, y + d / 2]], z0, z1);
    }
    return armar(pos);
  }

  /** Prisma de base cuadrilátera (4 puntos en planta) entre z0 y z1, triángulos sueltos (sombreado plano). */
  function caja(pos, q, z0, z1) {
    const a = q.map(([x, y]) => W(x, y, z0)), b = q.map(([x, y]) => W(x, y, z1));
    const tri = (p, r, s) => pos.push(p.x, p.y, p.z, r.x, r.y, r.z, s.x, s.y, s.z);
    const quad = (p, r, s, t) => { tri(p, r, s); tri(p, s, t); };
    quad(b[0], b[1], b[2], b[3]);                 // arriba
    quad(a[0], a[3], a[2], a[1]);                 // abajo
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; quad(a[i], a[j], b[j], b[i]); }
  }

  function armar(pos) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    return g;
  }

  /** Polígono horizontal (losa / techo / calle) a la altura z, con espesor opcional. */
  function losa(poly, z, espesor, material) {
    const shape = new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x - cx, y - cy)));
    const g = espesor > 0
      ? new THREE.ExtrudeGeometry(shape, { depth: espesor, bevelEnabled: false })
      : new THREE.ShapeGeometry(shape);
    g.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(g, material);
    mesh.position.y = z;
    return mesh;
  }

  function malla(geo, material, sombra, bordes) {
    const grupo = new THREE.Group();
    const m = new THREE.Mesh(geo, material);
    m.castShadow = sombra; m.receiveShadow = true;
    grupo.add(m);
    if (bordes) grupo.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), matBorde));
    return grupo;
  }

  // ---------------------------------------------------------------- capas
  const capas = {};
  const capa = (nombre) => (capas[nombre] = capas[nombre] || new THREE.Group(), scene.add(capas[nombre]), capas[nombre]);

  // Piso general y losa de la nave
  const piso = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), mat(C.terreno));
  piso.rotation.x = -Math.PI / 2; piso.position.set(0, -0.05, 0); piso.receiveShadow = true;
  scene.add(piso);
  const naveLosa = losa(N.nave, 0, 0, mat(C.naveLosa));
  naveLosa.position.y = 0.01; naveLosa.receiveShadow = true;
  scene.add(naveLosa);

  // Calles peatonales
  const matCalle = mat(C.calle, { polygonOffset: true, polygonOffsetFactor: -1 });
  for (const c of N.calles) { const m = losa(c, 0.08, 0, matCalle); m.receiveShadow = true; capa("calles").add(m); }

  // Muros (completos y recortados para poder ver adentro)
  const e = N.espesor_muro;
  const tipos = { envolvente: C.envolvente, anexos: C.anexos, internos: C.internos, tabiques: C.tabiques };
  const muroCompleto = {}, muroCortado = {};
  for (const [t, color] of Object.entries(tipos)) {
    const destino = capa(t === "tabiques" ? "internos" : t);
    muroCompleto[t] = malla(geoMuros(N.muros[t], e), mat(color), true, t !== "tabiques");
    muroCortado[t] = malla(geoMuros(N.muros[t], e, { hmax: N.corte_muros }), mat(color), true, t !== "tabiques");
    muroCortado[t].visible = false;
    destino.add(muroCompleto[t], muroCortado[t]);
  }

  // Columnas
  const plat = N.columnas.filter(c => Math.abs(c[5] - 9) < 0.01 && c[4] === 0);
  const nave = N.columnas.filter(c => !plat.includes(c));
  capa("columnas").add(malla(geoColumnas(nave), mat(C.columnaNave), true, true));
  capa("columnas").add(malla(geoColumnas(plat), mat(C.columnaPlat), true, false));

  // Techo: losas + frontones entre zona baja y alta
  const matTecho = mat(C.techo, { transparent: true, opacity: 0.93, side: THREE.DoubleSide });
  for (const t of N.techos) {
    const m = losa(t.poly, t.z, 0.35, matTecho);
    m.castShadow = true;
    capa("techo").add(m);
    const borde = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), matBorde);
    borde.position.copy(m.position);
    capa("techo").add(borde);
  }
  capa("techo").add(malla(geoMuros(N.frontones, e), mat(C.envolvente), true, true));

  // Ejes de la grilla: líneas en el piso + etiquetas
  const lin = [];
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const etiqueta = (texto, p) => {
    const div = document.createElement("div"); div.className = "eje"; div.textContent = texto;
    const o = new THREE.CSS2DObject(div); o.position.copy(p); capa("ejes").add(o);
  };
  for (const [n, x] of N.grilla.x) {
    lin.push(W(x, minY - 6, 0.05), W(x, maxY + 6, 0.05));
    etiqueta(n, W(x, minY - 9, 0.1));
  }
  for (const [n, y] of N.grilla.y) {
    lin.push(W(minX - 6, y, 0.05), W(maxX + 6, y, 0.05));
    etiqueta(n, W(minX - 9, y, 0.1));
  }
  const ejes = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(lin),
    new THREE.LineDashedMaterial({ color: C.ejes, dashSize: 2, gapSize: 1.2 }));
  ejes.computeLineDistances();
  capa("ejes").add(ejes);

  // ---------------------------------------------------------------- exterior (estimado: satélite / foto aérea)
  const X = N.exterior;
  if (X) {
    const ent = capa("entorno");
    const patio = losa(X.patio, 0.005, 0, mat(C.patio));
    patio.receiveShadow = true;
    ent.add(patio);
    const cajaR = ([a, b, c, d], z0, z1) => { const p = []; caja(p, [[a, b], [c, b], [c, d], [a, d]], z0, z1); return p; };
    // Torres de escalera amarillas (fachada oeste)
    const pt = []; for (const [a, b, c, d, z0, z1] of X.torres) pt.push(...cajaR([a, b, c, d], z0, z1));
    ent.add(malla(armar(pt), mat(C.torre), true, true));
    // Conexiones: túnel a Montaje y puente a Chapistería
    for (const k of X.conexiones) {
      ent.add(malla(armar(cajaR(k.rect, k.z0, k.z1)), mat(C.conexion), true, true));
      const [a, b, c, d] = k.rect;
      if (k.z0 > 0) {   // pasarela elevada: pilares cada 12 m a ambos lados, fuera de la nave
        const pp = [], largoX = c - a > d - b, s = 0.6;
        const dentro = (x, y) => x >= Math.min(...xs) && x <= Math.max(...xs) && y >= Math.min(...ys) && y <= Math.max(...ys);
        for (let t = (largoX ? a : b) + 6; t < (largoX ? c : d); t += 12) {
          for (const lado of largoX ? [b + 1, d - 1] : [a + 1, c - 1]) {
            const [px, py] = largoX ? [t, lado] : [lado, t];
            if (!dentro(px, py)) pp.push(...cajaR([px - s, py - s, px + s, py + s], 0, k.z0));
          }
        }
        if (pp.length) ent.add(malla(armar(pp), mat(C.columnaNave), true, false));
      }
      const div = document.createElement("div"); div.className = "eje destino"; div.textContent = k.etiqueta;
      const o = new THREE.CSS2DObject(div);
      o.position.copy(W(k.etiqueta.startsWith("→") ? c : (a + c) / 2, k.etiqueta.startsWith("→") ? (b + d) / 2 : d, k.z1 + 2));
      ent.add(o);
    }
    // Chimeneas sobre el techo alto
    const geoCh = new THREE.CylinderGeometry(1, 1, 1, 12);
    const matCh = mat(C.chimenea);
    const chim = new THREE.InstancedMesh(geoCh, matCh, X.chimeneas.length);
    const mtx = new THREE.Matrix4();
    X.chimeneas.forEach(([x, y, dia, z0, z1], i) => {
      mtx.compose(W(x, y, (z0 + z1) / 2), new THREE.Quaternion(), new THREE.Vector3(dia / 2, z1 - z0, dia / 2));
      chim.setMatrixAt(i, mtx);
    });
    chim.castShadow = true;
    capa("techo").add(chim);
    // Juntas del techo cada eje (como se ve en el satélite)
    const lt = [];
    const techoZ = x => (x >= N.zona_alta_x[0] && x <= N.zona_alta_x[1] ? N.techos.find(t => t.tipo === "nave_alta").z : N.techos.find(t => t.tipo === "nave_baja").z) + 0.4;
    for (const x of X.lineas_techo_x) lt.push(W(x, Math.min(...ys), techoZ(x)), W(x, Math.max(...ys), techoZ(x)));
    capa("techo").add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(lt), matBorde));
    if (X.sitio) construirSitio(X.sitio, ent, cajaR);

    // Flecha de norte en el piso
    const [nx, ny] = X.norte;
    const base = W(Math.min(...xs) - 22, Math.min(...ys) - 22, 0.2);
    const dir = new THREE.Vector3(nx, 0, -ny).normalize();
    const flecha = new THREE.ArrowHelper(dir, base, 16, C.norte, 6, 4);
    ent.add(flecha);
    const nd = document.createElement("div"); nd.className = "eje norte"; nd.textContent = "N";
    const no = new THREE.CSS2DObject(nd); no.position.copy(base.clone().add(dir.clone().multiplyScalar(20))); ent.add(no);
  }

  /** Entorno relevado de Google Maps (metros, coordenadas del plano). Todo estimado. */
  function construirSitio(S, grupo, cajaR) {
    const rectPoly = ([a, b, c, d]) => [[a, b], [c, b], [c, d], [a, d]];
    const plano = (r, z, color) => { const m = losa(rectPoly(r), z, 0, mat(color, { polygonOffset: true, polygonOffsetFactor: -1 })); m.receiveShadow = true; grupo.add(m); };
    const rotulo = (texto, p) => {
      const div = document.createElement("div"); div.className = "eje sitio"; div.textContent = texto;
      const o = new THREE.CSS2DObject(div); o.position.copy(p); grupo.add(o);
    };
    let semilla = 7;
    const azar = () => (semilla = (semilla * 16807) % 2147483647) / 2147483647;
    const m4 = new THREE.Matrix4(), q0 = new THREE.Quaternion(), col = new THREE.Color();

    for (const c of S.calles) plano(c.rect, 0.04, C.calle);

    // Estacionamientos: piso + autos (cajas con forma de auto, instanciadas)
    const autos = [];
    for (const e of S.estacionamientos) {
      plano(e.rect, 0.03, C.estac);
      const [a, b, c, d] = e.rect;
      // filas de autos a lo largo de x, auto con el largo en y; pasillo de 6 m cada dos filas
      for (let y = b + 1, k = 0; y + 4.5 <= d; y += 4.8, k++) {
        if (k % 2 === 0 && k > 0) y += 6;
        if (y + 4.5 > d) break;
        for (let x = a + 1; x + 2 <= c; x += 2.6) if (azar() < e.ocupacion) autos.push([x + 1, y + 2.25]);
      }
      rotulo(e.nombre, W((a + c) / 2, (b + d) / 2, 3));
    }
    const geoAuto = new THREE.BoxGeometry(1.8, 1.4, 4.4);
    const instA = new THREE.InstancedMesh(geoAuto, mat(0xffffff), autos.length);
    autos.forEach(([x, y], i) => {
      m4.compose(W(x, y, 0.75), q0, new THREE.Vector3(1, 1, 1)); instA.setMatrixAt(i, m4);
      instA.setColorAt(i, col.setHex(C.autos[Math.floor(azar() * C.autos.length)]));
    });
    instA.castShadow = true;
    grupo.add(instA);

    // Paneles solares: filas inclinadas, a lo largo de x
    const filas = [];
    for (const p of S.paneles_solares) {
      const [a, b, c, d] = p.rect;
      for (let y = b + 2; y + 3 <= d; y += 6) filas.push([a, c, y]);
      rotulo(p.nombre, W((a + c) / 2, (b + d) / 2, 4));
    }
    const geoPanel = new THREE.BoxGeometry(1, 0.15, 1);
    const instP = new THREE.InstancedMesh(geoPanel, mat(C.solar), filas.length);
    const inclin = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.45);
    filas.forEach(([a, c, y], i) => {
      m4.compose(W((a + c) / 2, y + 1.5, 1.4), inclin, new THREE.Vector3(c - a, 1, 3.2)); instP.setMatrixAt(i, m4);
    });
    instP.castShadow = true;
    grupo.add(instP);

    // Edificios vecinos (bloques blancos; "dientes" = techo con lucernarios en línea)
    for (const b of S.edificios) {
      grupo.add(malla(armar(cajaR(b.rect, 0, b.h)), mat(C.vecino), true, true));
      const [a, bb, c, d] = b.rect;
      if (b.techo === "dientes") {
        const p = [];
        for (let x = a + 6; x < c - 3; x += 12) p.push(...cajaR([x - 1.5, bb + 2, x + 1.5, d - 2], b.h, b.h + 1.8));
        grupo.add(malla(armar(p), mat(0xdfe6ee), false, false));
      }
      rotulo(b.nombre, W((a + c) / 2, (bb + d) / 2, b.h + 3));
    }

    // Verdes con árboles
    const arboles = [];
    for (const v of S.verdes) {
      plano(v.rect, 0.02, C.verde);
      const [a, b, c, d] = v.rect;
      for (let i = 0; i < v.arboles; i++) arboles.push([a + 4 + azar() * (c - a - 8), b + 4 + azar() * (d - b - 8), 4 + azar() * 3]);
    }
    const geoArbol = new THREE.IcosahedronGeometry(1, 0);
    const instT = new THREE.InstancedMesh(geoArbol, mat(C.arbol, { flatShading: true }), arboles.length);
    arboles.forEach(([x, y, r], i) => { m4.compose(W(x, y, r), q0, new THREE.Vector3(r, r, r)); instT.setMatrixAt(i, m4); });
    instT.castShadow = true;
    grupo.add(instT);

    // Vía férrea: balasto + dos rieles
    if (S.via_ferrea) {
      const pts = S.via_ferrea.puntos;
      const pos = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
        const L2 = Math.hypot(x2 - x1, y2 - y1), nx = -(y2 - y1) / L2, ny = (x2 - x1) / L2;
        caja(pos, [[x1 + nx * 2.5, y1 + ny * 2.5], [x2 + nx * 2.5, y2 + ny * 2.5], [x2 - nx * 2.5, y2 - ny * 2.5], [x1 - nx * 2.5, y1 - ny * 2.5]], 0, 0.15);
      }
      grupo.add(malla(armar(pos), mat(0xa9a29a), false, false));
      const rieles = [];
      for (const off of [-0.75, 0.75]) for (let i = 0; i < pts.length - 1; i++) {
        const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
        const L2 = Math.hypot(x2 - x1, y2 - y1), nx = -(y2 - y1) / L2 * off, ny = (x2 - x1) / L2 * off;
        rieles.push(W(x1 + nx, y1 + ny, 0.3), W(x2 + nx, y2 + ny, 0.3));
      }
      grupo.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(rieles), new THREE.LineBasicMaterial({ color: C.via })));
      rotulo("Vía férrea", W(...pts[0], 2));
    }

    // Pista de prueba (elipse con ancho)
    if (S.pista_prueba) {
      const { centro: [px, py], radios: [rx, ry], ancho } = S.pista_prueba;
      const elipse = (kx, ky) => { const s = []; for (let i = 0; i < 64; i++) { const t = i / 64 * Math.PI * 2; s.push(new THREE.Vector2(px - cx + kx * Math.cos(t), py - cy + ky * Math.sin(t))); } return s; };
      const forma = new THREE.Shape(elipse(rx, ry));
      forma.holes.push(new THREE.Path(elipse(rx - ancho, ry - ancho).reverse()));   // agujero en sentido inverso
      const g = new THREE.ShapeGeometry(forma); g.rotateX(-Math.PI / 2);
      const pista = new THREE.Mesh(g, mat(C.pista)); pista.position.y = 0.05; pista.receiveShadow = true;
      pista.name = "pista";
      grupo.add(pista);
      rotulo("Pista de prueba", W(px, py, 2));
    }
  }

  // ---------------------------------------------------------------- cámara y controles
  let aspecto = window.innerWidth / window.innerHeight;
  const ALTO = 190;   // metros visibles en vertical con zoom 1
  const camara = new THREE.OrthographicCamera(-ALTO * aspecto / 2, ALTO * aspecto / 2, ALTO / 2, -ALTO / 2, -1000, 2000);
  const controles = new THREE.OrbitControls(camara, renderer.domElement);
  Object.assign(controles, { enableDamping: true, dampingFactor: 0.08, screenSpacePanning: true,
    maxPolarAngle: Math.PI / 2 - 0.05, minZoom: 0.12, maxZoom: 25 });

  const VISTAS = {
    iso: { dir: new THREE.Vector3(1, 0.82, 1), zoom: 0.78 },
    planta: { dir: new THREE.Vector3(0, 1, 0.0001), zoom: 1.0 },
    sitio: { dir: new THREE.Vector3(1, 1.1, 1), zoom: 0.24, centro: [120, -80] },
  };
  function vista(nombre) {
    const v = VISTAS[nombre];
    const c0 = v.centro ? W(v.centro[0], v.centro[1], 0) : new THREE.Vector3();
    controles.target.copy(c0);
    camara.position.copy(c0);
    camara.position.add(v.dir.clone().normalize().multiplyScalar(400));
    camara.zoom = v.zoom;
    camara.updateProjectionMatrix();
    controles.update();
    // en planta las sombras de columnas altas se ven como rayado: se apagan
    sol.castShadow = nombre !== "planta";
    scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
    document.querySelectorAll("#vistas button[data-vista]").forEach(b => b.classList.toggle("activo", b.dataset.vista === nombre));
  }
  vista("iso");

  // ---------------------------------------------------------------- interfaz
  document.querySelectorAll("#vistas button").forEach(b => b.addEventListener("click", () => {
    vista(b.dataset.vista === "reset" ? "iso" : b.dataset.vista);
  }));
  document.querySelectorAll("#capas input[data-capa]").forEach(chk => chk.addEventListener("change", () => {
    capas[chk.dataset.capa].visible = chk.checked;
  }));
  document.getElementById("cortar").addEventListener("change", (ev) => {
    for (const t of Object.keys(tipos)) { muroCompleto[t].visible = !ev.target.checked; muroCortado[t].visible = ev.target.checked; }
  });
  const dlg = document.getElementById("supuestos");
  document.getElementById("lista-supuestos").innerHTML = N.supuestos.map(s => `<li>${s}</li>`).join("");
  document.getElementById("ver-supuestos").addEventListener("click", () => dlg.showModal());

  window.addEventListener("resize", () => {
    aspecto = window.innerWidth / window.innerHeight;
    Object.assign(camara, { left: -ALTO * aspecto / 2, right: ALTO * aspecto / 2 });
    camara.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    etiquetas.setSize(window.innerWidth, window.innerHeight);
  });

  window.__maqueta = { scene, camara };   // para inspección/depuración desde la consola

  (function animar() {
    requestAnimationFrame(animar);
    controles.update();
    // de lejos se ocultan las etiquetas de ejes; de cerca, las del entorno
    document.body.classList.toggle("lejos", camara.zoom < 0.5);
    document.body.classList.toggle("cerca", camara.zoom > 1.6);
    renderer.render(scene, camara);
    etiquetas.render(scene, camara);
  })();
})();
