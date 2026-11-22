// Easter egg: przy każdym otwarciu strony szansa 2 na 67, że w losowym miejscu wyłoni się Konstantinos Karetsas.
(function (root) {
  const CHANCE = 2 / 67;

  /** Decyzja i miejsce pojawienia się. rand – funkcja zwracająca liczby z [0, 1) (w testach z ustalonym ziarnem). */
  function plan(rand) {
    if (rand() >= CHANCE) return null;
    const sides = ["left", "right", "bottom", "top"];
    const side = sides[Math.floor(rand() * sides.length)];
    return { side, pos: 10 + Math.floor(rand() * 70), tilt: Math.round((rand() - 0.5) * 30), stay: 3500 + Math.floor(rand() * 2000) };
  }

  /** Generator liczb z ziarnem (mulberry32) – do testów. */
  function seeded(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function show(p, doc) {
    doc = doc || document;
    const el = doc.createElement("div");
    el.id = "egg";
    el.innerHTML = '<img src="img/k.jpg" alt="">';
    const off = { left: "translateX(-180%)", right: "translateX(180%)", bottom: "translateY(180%)", top: "translateY(-180%)" }[p.side];
    const s = el.style;
    if (p.side === "left" || p.side === "right") { s[p.side] = "-8px"; s.top = p.pos + "vh"; }
    else { s[p.side] = "-8px"; s.left = p.pos + "vw"; }
    s.transform = off + " rotate(" + p.tilt + "deg)";
    doc.body.appendChild(el);
    const hide = () => { s.transform = off + " rotate(" + p.tilt + "deg)"; setTimeout(() => el.remove(), 800); };
    requestAnimationFrame(() => requestAnimationFrame(() => { s.transform = "translate(0,0) rotate(" + p.tilt + "deg)"; }));
    el.addEventListener("click", hide);
    setTimeout(hide, p.stay);
  }

  root.Easter = { CHANCE, plan, seeded, show };
  if (typeof module !== "undefined") module.exports = root.Easter;
})(typeof window !== "undefined" ? window : globalThis);
