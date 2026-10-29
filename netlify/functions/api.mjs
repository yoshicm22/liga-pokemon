// API de la Liga del Movimiento - Kanto (Netlify Functions v2 + Netlify Blobs)
// Variables de entorno en Netlify:
//   TEACHER_PASSWORD  (obligatoria)  contraseña del panel del profesor
//   CLASS_CODE        (opcional)     código que deben escribir los alumnos al registrarse
//   SESSION_SECRET    (opcional)     si no existe, se genera y se guarda sola

import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

// getStore se crea al usarlo (dentro de una petición), como pide Netlify
const store = new Proxy({}, { get: (_, p) => { const s = getStore({ name: "liga-kanto", consistency: "strong" }); const v = s[p]; return typeof v === "function" ? v.bind(s) : v; } });

const FACTIONS = ["Rayo", "Cascada", "Roca"];
const STUDENT_TTL = 3 * 60 * 60 * 1000;
const TEACHER_TTL = 8 * 60 * 60 * 1000;
const MAX_BODY = 200_000;
// Debe coincidir con rewardsCatalog de public/index.html
const REWARD_COST = {
  "Encargado de Material": 1, "Líder de la Fila": 1, "DJ del Calentamiento": 2, "Árbitro Asistente": 2,
  "Elegir Compañero/a": 2, "Cronometrador Oficial": 2, "Capitán de Equipo": 3, "Elegir Juego del Viernes": 3,
  "Corona de Entrenador": 3, "Inmunidad de Recogida": 4,
};
const POKE_COST = {"Bulbasaur": 2, "Ivysaur": 3, "Venusaur": 4, "Charmander": 2, "Charmeleon": 3, "Charizard": 4, "Squirtle": 2, "Wartortle": 3, "Blastoise": 4, "Caterpie": 1, "Metapod": 1, "Butterfree": 2, "Weedle": 1, "Kakuna": 1, "Beedrill": 3, "Pidgey": 1, "Pidgeotto": 2, "Pidgeot": 3, "Rattata": 1, "Raticate": 2, "Spearow": 1, "Fearow": 3, "Ekans": 1, "Arbok": 3, "Pikachu": 2, "Raichu": 3, "Sandshrew": 2, "Sandslash": 3, "Nidoran♀": 2, "Nidorina": 3, "Nidoqueen": 4, "Nidoran♂": 2, "Nidorino": 3, "Nidoking": 4, "Clefairy": 2, "Clefable": 3, "Vulpix": 2, "Ninetales": 4, "Jigglypuff": 2, "Wigglytuff": 3, "Zubat": 1, "Golbat": 3, "Oddish": 1, "Gloom": 2, "Vileplume": 4, "Paras": 1, "Parasect": 3, "Venonat": 1, "Venomoth": 3, "Diglett": 1, "Dugtrio": 3, "Meowth": 2, "Persian": 3, "Psyduck": 2, "Golduck": 3, "Mankey": 2, "Primeape": 3, "Growlithe": 2, "Arcanine": 4, "Poliwag": 1, "Poliwhirl": 2, "Poliwrath": 4, "Abra": 2, "Kadabra": 3, "Alakazam": 4, "Machop": 2, "Machoke": 3, "Machamp": 4, "Bellsprout": 1, "Weepinbell": 2, "Victreebel": 3, "Tentacool": 1, "Tentacruel": 3, "Geodude": 1, "Graveler": 2, "Golem": 4, "Ponyta": 2, "Rapidash": 3, "Slowpoke": 1, "Slowbro": 3, "Magnemite": 1, "Magneton": 3, "Doduo": 1, "Dodrio": 3, "Seel": 1, "Dewgong": 3, "Grimer": 1, "Muk": 3, "Shellder": 1, "Cloyster": 3, "Gastly": 1, "Haunter": 2, "Gengar": 4, "Onix": 3, "Drowzee": 1, "Hypno": 3, "Krabby": 1, "Kingler": 3, "Voltorb": 1, "Electrode": 2, "Exeggcute": 1, "Exeggutor": 3, "Cubone": 2, "Marowak": 3, "Hitmonlee": 3, "Hitmonchan": 3, "Lickitung": 2, "Koffing": 1, "Weezing": 3, "Rhyhorn": 2, "Rhydon": 4, "Chansey": 3, "Tangela": 2, "Kangaskhan": 4, "Horsea": 1, "Seadra": 2, "Goldeen": 1, "Seaking": 3, "Staryu": 2, "Starmie": 3, "Mr. Mime": 3, "Scyther": 3, "Jynx": 3, "Electabuzz": 3, "Magmar": 3, "Pinsir": 3, "Tauros": 3, "Magikarp": 1, "Gyarados": 4, "Lapras": 4, "Ditto": 3, "Eevee": 2, "Vaporeon": 4, "Jolteon": 4, "Flareon": 4, "Porygon": 3, "Omanyte": 2, "Omastar": 3, "Kabuto": 2, "Kabutops": 3, "Aerodactyl": 4, "Snorlax": 4, "Articuno": 5, "Zapdos": 5, "Moltres": 5, "Dratini": 2, "Dragonair": 3, "Dragonite": 5, "Mewtwo": 6, "Mew": 6, "Farfetch'd": 2};
// objetos de un solo uso (no son premios-privilegio): se compran con fichas y se gastan al usarlos. Debe coincidir con itemsCatalog de public/index.html
const ITEM_COST = { pocion: 2, superball: 3 };
const ITEM_MAX = 3; // por tipo en la mochila
const isPoke = (n) => Object.prototype.hasOwnProperty.call(POKE_COST, n);
const isReward = (t) => Object.prototype.hasOwnProperty.call(REWARD_COST, t);

/* ---------- utilidades ---------- */
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
const fail = (status, error) => json({ error }, status);
const sha = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");
const clean = (s, max) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
const smallJson = (v, max = 20000) => { try { return JSON.stringify(v).length <= max; } catch { return false; } };

function safeEqual(a, b) {
  const x = Buffer.from(sha(a)), y = Buffer.from(sha(b));
  return crypto.timingSafeEqual(x, y);
}

async function readBody(req) {
  const text = await req.text();
  if (text.length > MAX_BODY) throw Object.assign(new Error("big"), { status: 413 });
  if (!text) return {};
  try { const v = JSON.parse(text); return isObj(v) ? v : {}; }
  catch { throw Object.assign(new Error("bad"), { status: 400 }); }
}

/* ---------- secreto y tokens ---------- */
let secretCache;
async function getSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (secretCache) return secretCache;
  let s = await store.get("meta/secret");
  if (!s) {
    const fresh = crypto.randomBytes(32).toString("hex");
    await store.set("meta/secret", fresh, { onlyIfNew: true });
    s = await store.get("meta/secret");
  }
  secretCache = s;
  return s;
}
async function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", await getSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}
async function verify(token) {
  if (!token) return null;
  const [body, sig] = String(token).split(".");
  if (!body || !sig) return null;
  const exp = crypto.createHmac("sha256", await getSecret()).update(body).digest("base64url");
  const a = Buffer.from(sig), b = Buffer.from(exp);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString());
    return p.exp > Date.now() ? p : null;
  } catch { return null; }
}
const getEpoch = async () => (await store.get("meta/epoch", { type: "json" })) || 0;
async function auth(req) {
  const h = req.headers.get("authorization") || "";
  const p = await verify(h.startsWith("Bearer ") ? h.slice(7) : "");
  if (p && p.role === "student" && p.ep !== (await getEpoch())) return null;
  return p;
}

/* ---------- contraseñas (scrypt con sal) ---------- */
function hashPw(pw) {
  const salt = crypto.randomBytes(16);
  const h = crypto.scryptSync(String(pw), salt, 32);
  return `s1$${salt.toString("base64")}$${h.toString("base64")}`;
}
function checkPw(pw, stored) {
  try {
    const [v, s, h] = String(stored || "").split("$");
    if (v !== "s1") return false;
    const got = crypto.scryptSync(String(pw), Buffer.from(s, "base64"), 32);
    return crypto.timingSafeEqual(got, Buffer.from(h, "base64"));
  } catch { return false; }
}

/* ---------- escritura atómica: lee, cambia y guarda solo si nadie escribió entre medias ---------- */
async function update(key, fn, tries = 8) {
  for (let i = 0; i < tries; i++) {
    const cur = await store.getWithMetadata(key, { type: "json" });
    const next = await fn(cur ? cur.data : null);
    if (next === undefined) return null; // fn decide no escribir
    const r = await store.setJSON(key, next, cur ? { onlyIfMatch: cur.etag } : { onlyIfNew: true });
    if (r?.modified !== false) return next;
    await new Promise((ok) => setTimeout(ok, 15 + Math.random() * 40 * (i + 1)));
  }
  throw new Error("conflicto de escritura en " + key);
}

/* ---------- límite de intentos (atómico: cuenta ANTES de comprobar) ---------- */
const rlKey = (k) => "rl/" + sha(k).slice(0, 32);
async function attempt(key, max, windowMs, lockMs) {
  const now = Date.now();
  let r;
  // 25 tablets a la vez pelean por este contador: más reintentos y, si aun así no se puede contar, se deja pasar (nunca dejar fuera a un niño)
  try {
    r = await update(rlKey(key), (cur) => {
      if (cur?.until && cur.until > now) return undefined;
      const x = cur && now - cur.first < windowMs && !cur.until ? cur : { count: 0, first: now };
      x.count++;
      if (x.count > max) x.until = now + lockMs;
      return x;
    }, 30);
  } catch { return { ok: true }; }
  if (r === null || (r.until && r.until > now)) {
    const cur = await store.get(rlKey(key), { type: "json" });
    return { ok: false, mins: Math.max(1, Math.ceil(((cur?.until || now) - now) / 60000)) };
  }
  return { ok: true };
}
const bump = async (key, max, windowMs) => (await attempt(key, max, windowMs, windowMs)).ok;
const clearAttempts = (key) => store.delete(rlKey(key));

/* ---------- datos ---------- */
const teacherView = (p) => { const { passHash, ...rest } = p; return rest; };
// racha: listas pasadas seguidas, de la más reciente hacia atrás, sin falta (el retraso cuenta como venir). Al alumno solo le llega el número, nunca las fechas
const streakOf = (p, closed) => {
  const from = madridDay(Number.isFinite(p.createdAt) ? p.createdAt : 0), today = madridDay(Date.now());
  const att = isObj(p.att) ? p.att : {};
  // cuentan las listas pasadas; una falta ya puesta corta aunque la lista no llegara a cerrarse (pero no una de un día futuro)
  const ds = [...new Set([...closed, ...Object.keys(att).filter((d) => att[d] === "F" && d <= today)])].filter((d) => d >= from).sort().reverse();
  let n = 0;
  for (const d of ds) { if (att[d] === "F") break; n++; }
  return n;
};
const studentView = (p, closed = []) => { const { passHash, weight, height, wingspan, hrRest, note, att, ...rest } = p; return { ...rest, streak: streakOf(p, closed) }; };
// si falla la lectura, la racha sale a 0 en vez de tumbar el login
const getAttClosed = async () => { try { const v = await store.get("meta/att-closed", { type: "json" }); return Array.isArray(v) ? v : []; } catch { return []; } };
const viewOf = async (p) => studentView(p, await getAttClosed());
const dateOk = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d)) && (() => { const x = new Date(d + "T00:00:00Z"); return !Number.isNaN(x.getTime()) && x.toISOString().startsWith(d); })();
const shortName = (n) => {
  const parts = String(n).trim().split(" ").filter(Boolean);
  return parts.length > 1 ? `${parts[0]} ${[...parts[1]][0].toUpperCase()}.` : (parts[0] || "");
};
const nameKeyOf = (name) => "names/" + sha(name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim()).slice(0, 32);
const getStudent = (id) => store.get("students/" + id, { type: "json" });
const putStudent = (p) => store.setJSON("students/" + p.id, p);
// cambia un alumno de forma atómica; fn recibe el alumno y puede devolver un Response de error
async function mutate(id, fn) {
  let res;
  const out = await update("students/" + id, async (s) => {
    if (!s) { res = fail(404, "Alumno no encontrado."); return undefined; }
    const r = await fn(s);
    if (r instanceof Response) { res = r; return undefined; }
    return s;
  });
  return res ?? out;
}
async function allStudents() {
  const { blobs } = await store.list({ prefix: "students/" });
  const list = await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })));
  return list.filter(Boolean).sort((a, b) => String(a.name).localeCompare(String(b.name), "es"));
}
const getConfig = async () => normCfg(await store.get("config/main", { type: "json" }));
function normCfg(c0) {
  const c = c0 || {};
  return {
    currentWeek: Number.isInteger(c.currentWeek) && c.currentWeek >= 1 && c.currentWeek <= 33 ? c.currentWeek : 1,
  };
}
function factionTotals(students) {
  const t = Object.fromEntries(FACTIONS.map((f) => [f, 0]));
  for (const s of students) {
    const f = FACTIONS.includes(s.faction) ? s.faction : "Rayo";
    for (const g of s.gymSessionsData || []) if (Array.isArray(g)) t[f] += g.filter(Boolean).length;
  }
  return t;
}

/* ---------- unidades, cofres y consolación ---------- */
const LEGENDS = ["Articuno", "Zapdos", "Moltres", "Dragonite", "Mewtwo", "Mew"];
const CONSOLATION = Object.keys(POKE_COST).filter((n) => POKE_COST[n] >= 2 && POKE_COST[n] <= 3);
const pick = (a) => a[crypto.randomInt(a.length)];
const getUnits = async () => (await store.get("meta/units", { type: "json" })) || { list: [] };
const mastered = (s, g) => (Array.isArray(s.gymSessionsData?.[g]) ? s.gymSessionsData[g].filter(Boolean).length : 0);
function giveMon(s, name, shiny) {
  s.ownedPokemon = Array.isArray(s.ownedPokemon) ? s.ownedPokemon : ["Pikachu"];
  const isNew = !s.ownedPokemon.includes(name);
  if (isNew) {
    s.ownedPokemon.push(name);
    const team = Array.isArray(s.activeTeam) ? s.activeTeam : [null, null, null, null, null, null];
    const i = team.indexOf(null);
    if (i >= 0) team[i] = name;
    s.activeTeam = team;
  }
  if (shiny) {
    s.shinyUnlocked = [...new Set([...(s.shinyUnlocked ?? s.shinyPokemon ?? []), name])];
    s.shinyPokemon = [...new Set([...(s.shinyPokemon || []), name])];
  }
  return isNew;
}
// compañero: el alumno elige una línea de 3 fases (nunca legendaria) y evoluciona con su esfuerzo; cada forma nueva entra en su Pokédex
const COMPANIONS = [["Bulbasaur", "Ivysaur", "Venusaur"], ["Charmander", "Charmeleon", "Charizard"], ["Squirtle", "Wartortle", "Blastoise"], ["Pidgey", "Pidgeotto", "Pidgeot"], ["Abra", "Kadabra", "Alakazam"], ["Machop", "Machoke", "Machamp"], ["Geodude", "Graveler", "Golem"], ["Gastly", "Haunter", "Gengar"], ["Poliwag", "Poliwhirl", "Poliwrath"], ["Oddish", "Gloom", "Vileplume"]];
const EVOLVE_AT = [15, 40]; // energía para la 2ª y la 3ª fase
// energía = casas superadas + racha actual: baja si falta, pero lo ya evolucionado no se pierde
const companionEnergy = (s, streak) => (s.gymSessionsData || []).reduce((a, g) => a + (Array.isArray(g) ? g.filter(Boolean).length : 0), 0) + streak;
const addTrophy = (s, g, kind) => { s.trophies = [...(s.trophies || []), { g, kind }].slice(-40); };
// el cofre lo abre el alumno en su perfil: aquí solo se guarda lo que le ha tocado
const setChest = (s, rec, prize) => { s.pendingChests = [...(s.pendingChests || []), { g: rec.g, city: rec.city || "", at: Date.now(), ...prize }].slice(-8); };
// aplica el premio de la unidad g a un alumno (una sola vez por unidad)
function applyUnitPrize(s, rec, prize) {
  if (s.unitsDone?.[rec.g]) return;
  s.unitsDone = { ...(s.unitsDone || {}), [rec.g]: 1 };
  const city = rec.city || "la unidad";
  if (!prize) { // consolación: un Pokémon de coste 2-3 al azar; si ya lo tiene, su valor en fichas
    const n = pick(CONSOLATION);
    addTrophy(s, rec.g, "sello");
    const repeated = (s.ownedPokemon || []).includes(n);
    if (!repeated) {
      giveMon(s, n, false);
      pushNotice(s, { title: "¡Gran unidad en " + city + "!", desc: "Tu escuadrón ha dado todo. Tienes un cofre por abrir en tu perfil.", icon: "🎁" });
    } else {
      s.tokens = (s.tokens || 0) + POKE_COST[n];
      pushNotice(s, { title: "¡Gran unidad en " + city + "!", desc: "Tu escuadrón ha dado todo. Tienes un cofre por abrir en tu perfil.", icon: "🎁" });
    }
    setChest(s, rec, { kind: "consolation", name: n, tokens: repeated ? POKE_COST[n] : 0 });
    return;
  }
  addTrophy(s, rec.g, "campeon");
  if (prize.kind === "legend") {
    giveMon(s, prize.name, true);
    setChest(s, rec, { kind: "legend", name: prize.name });
    pushNotice(s, { title: "¡COFRE DEL ESCUADRÓN!", desc: "Tu escuadrón ha ganado " + city + ". Tienes un cofre por abrir en tu perfil.", icon: "🏆" });
  } else if (prize.kind === "choose") {
    s.pendingChoice = [...(s.pendingChoice || []), { g: rec.g, maxCost: 4 }].slice(-10);
    setChest(s, rec, { kind: "choose" });
    pushNotice(s, { title: "¡COFRE DEL ESCUADRÓN!", desc: "Tu escuadrón ha ganado " + city + ". Tienes un cofre por abrir en tu perfil.", icon: "🏆" });
  } else {
    setChest(s, rec, { kind: "day" });
    pushNotice(s, { title: "¡COFRE DEL ESCUADRÓN!", desc: "Tu escuadrón ha ganado " + city + ". Tienes un cofre por abrir en tu perfil.", icon: "🏆" });
  }
}

/* ---------- pizarra del aula ---------- */
const DEFAULT_TIMER = { mode: "countdown", status: "idle", durationSec: 300, startedAt: 0, pausedElapsedMs: 0, work: 30, rest: 15, rounds: 6 };
const DEFAULT_BOARD = { noise: "green", behavior: 0, effort: 0, phase: 0, absent: [], drawn: [], draw: null, cup: null, timer: DEFAULT_TIMER };
const withBoard = (b) => ({ ...DEFAULT_BOARD, ...(b || {}), timer: { ...DEFAULT_TIMER, ...(b?.timer || {}) } });
const getBoard = async () => withBoard(await store.get("board/main", { type: "json" }));
const getPlans = async () => (await store.get("board/plans", { type: "json" })) || {};
const intIn = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
function applyBoard(bd, b) {
  if (b.chest === null) delete bd.chest;
  if (b.reset) { Object.assign(bd, { noise: "green", behavior: 0, effort: 0, phase: 0, draw: null, drawn: [], timer: { ...DEFAULT_TIMER } }); delete bd.chest; }
  if (["green", "yellow", "red"].includes(b.noise)) bd.noise = b.noise;
  if (intIn(b.behavior, 0, 10)) bd.behavior = b.behavior;
  if (intIn(b.effort, 0, 10)) bd.effort = b.effort;
  if (intIn(b.phase, 0, 2)) bd.phase = b.phase;
  for (const k of ["absent", "drawn"]) {
    if (Array.isArray(b[k]) && b[k].length <= 80 && b[k].every((x) => typeof x === "string")) bd[k] = b[k].map((x) => clean(x, 60));
  }
  if ("draw" in b) {
    const d = b.draw;
    if (d === null) bd.draw = null;
    else if (isObj(d) && ["pick", "pairs", "teams"].includes(d.kind) && Array.isArray(d.items) && d.items.length <= 16) {
      const items = d.kind === "pick"
        ? d.items.slice(0, 1).map((x) => clean(x, 40))
        : d.items.map((g) => (Array.isArray(g) ? g.slice(0, 16).map((x) => clean(x, 40)) : []));
      bd.draw = { kind: d.kind, items, at: Date.now() };
    }
  }
  // torneo: t = equipos en orden de cuadro (2-8), w = ganador de cada partido (índice en t o null), ronda a ronda
  if ("cup" in b) {
    const c = b.cup;
    if (c === null) bd.cup = null;
    else if (isObj(c) && Array.isArray(c.t) && c.t.length >= 2 && c.t.length <= 8 && Array.isArray(c.w) && c.w.length <= 7) {
      const t = c.t.map((x) => clean(x, 40)), size = 2 ** Math.ceil(Math.log2(t.length));
      if (t.every(Boolean) && new Set(t).size === t.length) bd.cup = { t, w: c.w.slice(0, size - 1).map((x) => (intIn(x, 0, t.length - 1) ? x : null)) };
    }
  }
  if (isObj(b.timer)) {
    const t = b.timer, o = bd.timer;
    if (["countdown", "stopwatch", "intervals"].includes(t.mode)) o.mode = t.mode;
    if (["idle", "running", "paused"].includes(t.status)) o.status = t.status;
    if (intIn(t.durationSec, 1, 7200)) o.durationSec = t.durationSec;
    if (intIn(t.work, 5, 600)) o.work = t.work;
    if (intIn(t.rest, 0, 600)) o.rest = t.rest;
    if (intIn(t.rounds, 1, 30)) o.rounds = t.rounds;
    if (Number.isFinite(t.startedAt) && t.startedAt >= 0) o.startedAt = Math.floor(t.startedAt);
    if (Number.isFinite(t.pausedElapsedMs) && t.pausedElapsedMs >= 0 && t.pausedElapsedMs <= 86400000) o.pausedElapsedMs = Math.floor(t.pausedElapsedMs);
  }
}

/* ---------- validación de campos ---------- */

function applyCommon(target, body) {
  if ("theme" in body) target.theme = clean(body.theme, 20) || "emerald";
  for (const k of ["ownedPokemon", "activeTeam", "redeemedRewards", "shinyPokemon"]) {
    if (Array.isArray(body[k]) && body[k].length <= 400 && body[k].every((x) => x === null || typeof x === "string")) {
      target[k] = body[k].map((x) => (x === null ? null : clean(x, 60)));
    }
  }
  for (const k of ["dailyQuestStatus", "achievements"]) {
    if (isObj(body[k]) && smallJson(body[k])) target[k] = body[k];
  }
}

function multisetDiff(oldArr, newArr) {
  const c = {};
  for (const t of oldArr) c[t] = (c[t] || 0) + 1;
  const added = [];
  for (const t of newArr) { if (c[t] > 0) c[t]--; else added.push(t); }
  return { added, removed: Object.values(c).some((v) => v > 0) };
}
const pushNotice = (s, n) => { s.pendingNotifications = [...(s.pendingNotifications || []), n].slice(-50); };

/* ---------- buzón: preguntas del alumno al profe (solo las lee el profe) ---------- */
const MAIL_MAX = 300, MAIL_PER_DAY = 5, MAIL_KEEP = 30;
const madridDay = (t) => new Date(t).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
const getMail = async (sid) => { const v = await store.get("mail/" + sid, { type: "json" }); return Array.isArray(v) ? v : []; };
// el punto rojo del alumno = respuestas que aún no ha visto (se recalcula, así nunca se queda colgado)
const syncMailNew = (sid, list, notify) => mutate(sid, (s) => {
  s.mailNew = list.filter((x) => x.reply && !x.seen).length;
  if (notify) pushNotice(s, { title: "¡El profe te ha respondido!", desc: "Mira tu respuesta en la pestaña Buzón.", icon: "✉️" });
});
// guarda las últimas MAIL_KEEP, pero nunca tira una pregunta sin responder; null si están todas sin responder
const trimMail = (l) => { const out = [...l]; while (out.length > MAIL_KEEP) { const i = out.findIndex((x) => x.reply); if (i < 0) return null; out.splice(i, 1); } return out; };

/* ---------- autoevaluación: el alumno se puntúa esfuerzo y juego limpio (1-3) una vez al día ---------- */
const EVAL_KEEP = 60;
const face = (v) => Number.isInteger(v) && v >= 1 && v <= 3;

/* ---------- manejador ---------- */
export default async (req, context) => {
  try {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/api/, "").replace(/\/+$/, "") || "/";
    const method = req.method;
    const ip = context?.ip || req.headers.get("x-nf-client-connection-ip") || "0.0.0.0";

    /* --- públicos --- */
    if (method === "GET" && path === "/public") {
      const students = await allStudents();
      return json({
        students: students.map((s) => ({ id: s.id, name: shortName(s.name), school: s.school, gender: s.gender, faction: s.faction, badges: s.badges || [] })),
        config: await getConfig(),
        factionTotals: factionTotals(students),
        requiresCode: true,
      });
    }

    if (method === "POST" && path === "/register") {
      const b = await readBody(req);
      if (!process.env.CLASS_CODE) return fail(503, "Falta configurar CLASS_CODE en Netlify (código de clase para registrarse).");
      if (!(await bump("reg:" + ip, 60, 60 * 60 * 1000))) return fail(429, "Demasiados registros desde esta red. Inténtalo más tarde.");
      if (!safeEqual(b.classCode ?? "", process.env.CLASS_CODE)) return fail(403, "Código de clase incorrecto.");
      const name = clean(b.name, 30);
      const password = String(b.password ?? "");
      if (name.length < 2) return fail(400, "Escribe tu nombre (mínimo 2 letras).");
      const pwLen = [...password].length;
      if (pwLen < 3 || pwLen > 64) return fail(400, "El código debe tener entre 3 y 64 símbolos.");
      const nameKey = nameKeyOf(name);
      const dupMsg = "Ya existe un alumno con ese nombre. Añade tu inicial o apellido.";
      const existing = await allStudents();
      if (existing.some((s) => s.name.toLowerCase() === name.toLowerCase())) return fail(409, dupMsg);
      // la reserva del nombre es atómica: dos registros a la vez no pasan los dos
      const res = await store.setJSON(nameKey, { t: Date.now() }, { onlyIfNew: true });
      if (res?.modified === false) return fail(409, dupMsg);
      const profile = {
        id: "student_" + crypto.randomBytes(8).toString("hex"),
        name,
        school: clean(b.school, 40) || "Colegio Kanto",
        gender: b.gender === "girl" ? "girl" : "boy",
        faction: FACTIONS.includes(b.faction) ? b.faction : "Rayo",
        passHash: hashPw(password),
        tokens: 0, weight: "", height: "", wingspan: "", hrRest: "", theme: "emerald",
        gymSessionsData: [], badges: [false, false, false, false, false, false, false, false],
        ownedPokemon: ["Pikachu"], activeTeam: ["Pikachu", null, null, null, null, null],
        redeemedRewards: [], dailyQuestStatus: {}, achievements: {}, shinyPokemon: [], pendingNotifications: [],
        createdAt: Date.now(), nameKey,
      };
      await putStudent(profile);
      const token = await sign({ role: "student", sid: profile.id, ep: await getEpoch(), exp: Date.now() + STUDENT_TTL });
      return json({ token, profile: await viewOf(profile) }, 201);
    }

    if (method === "POST" && path === "/login") {
      const b = await readBody(req);
      const id = clean(b.id, 60);
      // se cuenta el intento ANTES de comprobar: en paralelo solo pasan unos pocos. Límite por alumno (da igual la IP: el colegio comparte red) y por IP
      const a2 = await attempt(`loginip:${ip}`, 150, 5 * 60 * 1000, 5 * 60 * 1000);
      if (!a2.ok) return fail(429, `Demasiados intentos desde esta red. Espera ${a2.mins} min.`);
      const s = id ? await getStudent(id) : null;
      if (!s) return fail(401, "Código incorrecto. ¡Inténtalo otra vez!"); // sin crear registros para ids inventados
      // 10 fallos cada 5 min y bloqueo corto: frena la fuerza bruta sin dejar a un niño fuera mucho rato si un compañero le fastidia
      const a1 = await attempt(`login:${id}`, 10, 5 * 60 * 1000, 3 * 60 * 1000);
      if (!a1.ok) return fail(429, `Demasiados intentos con este perfil. Espera ${a1.mins} min.`);
      if (!checkPw(b.password ?? "", s.passHash)) return fail(401, "Código incorrecto. ¡Inténtalo otra vez!");
      await clearAttempts(`login:${id}`);
      const token = await sign({ role: "student", sid: s.id, ep: await getEpoch(), exp: Date.now() + STUDENT_TTL });
      return json({ token, profile: await viewOf(s) });
    }

    if (method === "POST" && path === "/teacher/login") {
      const b = await readBody(req);
      if (!process.env.TEACHER_PASSWORD) return fail(503, "Falta configurar TEACHER_PASSWORD en Netlify.");
      // por IP y sin tope global (un tope global dejaba fuera al profesor con unos pocos intentos anónimos)
      const a1 = await attempt(`teacher:${ip}`, 10, 5 * 60 * 1000, 2 * 60 * 1000);
      if (!a1.ok) return fail(429, `Demasiados intentos. Espera ${a1.mins} min.`);
      if (!safeEqual(b.password ?? "", process.env.TEACHER_PASSWORD)) return fail(401, "Contraseña incorrecta.");
      await clearAttempts(`teacher:${ip}`);
      return json({ token: await sign({ role: "teacher", exp: Date.now() + TEACHER_TTL }) });
    }

    /* --- a partir de aquí hace falta sesión --- */
    const session = await auth(req);
    if (!session) return fail(401, "Sesión caducada. Vuelve a entrar.");

    /* --- alumno --- */
    if (session.role === "student") {
      if (path === "/me" && method === "GET") {
        const s = await getStudent(session.sid);
        return s ? json({ profile: await viewOf(s) }) : fail(404, "Perfil no encontrado.");
      }
      if (path === "/me" && method === "PUT") {
        const b = await readBody(req);
        const out = await mutate(session.sid, (s) => {
          const { redeemedRewards, ownedPokemon, activeTeam, shinyPokemon, ...rest } = b;
          applyCommon(s, rest);
          // las fichas las calcula el servidor: el cliente nunca dice cuántas tiene
          let tokens = s.tokens || 0;
          const strs = (a) => Array.isArray(a) && a.length <= 400 && a.every((x) => typeof x === "string");
          if (strs(redeemedRewards)) {
            // solo se suma lo nuevo: si al cliente le falta algo ganado en otro dispositivo, se conserva en vez de perder la compra
            const { added } = multisetDiff(s.redeemedRewards || [], redeemedRewards);
            const cost = added.reduce((a, x) => a + (isReward(x) ? REWARD_COST[x] : 1e9), 0);
            if (cost <= tokens) { s.redeemedRewards = [...(s.redeemedRewards || []), ...added]; tokens -= cost; }
          }
          if (strs(ownedPokemon)) {
            const cur = s.ownedPokemon || ["Pikachu"];
            const added = [...new Set(ownedPokemon)].filter((x) => !cur.includes(x));
            // los legendarios solo salen de un cofre: no se pueden comprar
            const cost = added.reduce((a, x) => a + (isPoke(x) && !LEGENDS.includes(x) ? POKE_COST[x] : 1e9), 0);
            if (cost <= tokens) { s.ownedPokemon = [...cur, ...added]; tokens -= cost; }
          }
          s.tokens = tokens;
          const own = s.ownedPokemon || [];
          const teamNames = Array.isArray(activeTeam) ? activeTeam.filter((x) => x !== null) : [];
          // el equipo titular no admite repetidos
          if (Array.isArray(activeTeam) && activeTeam.length === 6 && activeTeam.every((x) => x === null || own.includes(x)) && new Set(teamNames).size === teamNames.length) s.activeTeam = activeTeam;
          // el brillo shiny solo lo da un cofre; los que ya lo tenían activado se respetan
          if (s.shinyUnlocked === undefined) s.shinyUnlocked = [...(s.shinyPokemon || [])];
          if (Array.isArray(shinyPokemon)) s.shinyPokemon = shinyPokemon.filter((x) => own.includes(x) && s.shinyUnlocked.includes(x)).slice(0, 200);
          // el alumno solo quita los avisos que ha visto: uno que llegue mientras tanto se queda
          if (Array.isArray(b.seenNotices)) {
            const q = [...(s.pendingNotifications || [])];
            for (const n of b.seenNotices.slice(0, 50)) { const i = q.findIndex((x) => x.title === n?.title && x.desc === n?.desc); if (i >= 0) q.splice(i, 1); }
            s.pendingNotifications = q;
          } else if (Array.isArray(b.pendingNotifications) && b.pendingNotifications.length === 0) s.pendingNotifications = []; // clientes antiguos en caché
        });
        return out instanceof Response ? out : json({ ok: true, tokens: out.tokens, profile: await viewOf(out) });
      }
      if (path === "/me/chest-seen" && method === "POST") {
        const b = await readBody(req);
        const out = await mutate(session.sid, (s) => {
          const q = s.pendingChests || [];
          // con dos dispositivos abiertos, cada uno cierra su propio cofre y no el del otro
          s.pendingChests = q.length && (b.g === undefined || q[0].g === b.g) ? q.slice(1) : q;
        });
        return out instanceof Response ? out : json({ ok: true, profile: await viewOf(out) });
      }
      if (path === "/me/choose" && method === "POST") {
        const b = await readBody(req);
        const name = clean(b.name, 60);
        if (!isPoke(name)) return fail(400, "Pokémon no válido.");
        const out = await mutate(session.sid, (s) => {
          const pc = Array.isArray(s.pendingChoice) ? s.pendingChoice : [];
          if (!pc.length) return fail(409, "No tienes ninguna elección pendiente.");
          if (POKE_COST[name] > (pc[0].maxCost || 4)) return fail(400, "Ese Pokémon es demasiado fuerte para esta elección.");
          giveMon(s, name, true);
          s.pendingChoice = pc.slice(1);
          pushNotice(s, { title: "¡Pokémon shiny conseguido!", desc: name + " brillante ya es tuyo.", icon: "✨" });
        });
        return out instanceof Response ? out : json({ ok: true, profile: await viewOf(out) });
      }
      if (path === "/me/self-eval" && method === "POST") {
        const b = await readBody(req);
        if (!face(b.effort) || !face(b.fair)) return fail(400, "Elige una carita en cada pregunta.");
        const out = await mutate(session.sid, (s) => {
          // se puede cambiar durante el día; se guardan los últimos EVAL_KEEP días
          const ev = { ...(isObj(s.selfEval) ? s.selfEval : {}), [madridDay(Date.now())]: [b.effort, b.fair] };
          s.selfEval = Object.fromEntries(Object.entries(ev).sort(([x], [y]) => x.localeCompare(y)).slice(-EVAL_KEEP));
        });
        return out instanceof Response ? out : json({ ok: true, profile: await viewOf(out) });
      }
      if (path === "/me/items" && method === "POST") {
        const b = await readBody(req);
        const id = b.id;
        if (!Object.hasOwn(ITEM_COST, id) || !["buy", "use"].includes(b.action)) return fail(400, "Objeto no válido.");
        const today = madridDay(Date.now());
        const out = await mutate(session.sid, (s) => {
          const items = { pocion: 0, superball: 0, ...(isObj(s.items) ? s.items : {}) };
          if (b.action === "buy") {
            if (items[id] >= ITEM_MAX) return fail(409, `Ya llevas ${ITEM_MAX} en la mochila. Usa uno antes de comprar otro.`);
            if ((s.tokens || 0) < ITEM_COST[id]) return fail(409, "No tienes fichas suficientes.");
            s.tokens -= ITEM_COST[id];
            items[id]++;
          } else {
            if (items[id] < 1) return fail(409, "No te queda ninguno en la mochila.");
            if (id === "pocion") {
              if (s.potionDay === today) return fail(409, "Hoy ya has usado una Poción.");
              s.potionDay = today;
            } else {
              if (s.superball) return fail(409, "Ya tienes una Superball preparada.");
              s.superball = true;
            }
            items[id]--;
          }
          s.items = items;
        });
        return out instanceof Response ? out : json({ ok: true, profile: await viewOf(out) });
      }
      if (path === "/me/companion" && method === "POST") {
        const b = await readBody(req);
        const line = COMPANIONS.find((l) => l[0] === b.name);
        if (!line) return fail(400, "Ese Pokémon no puede ser tu compañero.");
        const out = await mutate(session.sid, (s) => {
          if (s.companion) return fail(409, "Ya tienes compañero.");
          s.companion = { line: line[0], stage: 0 };
          giveMon(s, line[0], false);
        });
        return out instanceof Response ? out : json({ ok: true, profile: await viewOf(out) });
      }
      if (path === "/me/companion/evolve" && method === "POST") {
        const closed = await getAttClosed();
        const out = await mutate(session.sid, (s) => {
          const c = s.companion, line = c && COMPANIONS.find((l) => l[0] === c.line);
          if (!line) return fail(409, "Todavía no tienes compañero.");
          if (c.stage >= 2) return fail(409, "Tu compañero ya está en su forma final.");
          if (companionEnergy(s, streakOf(s, closed)) < EVOLVE_AT[c.stage]) return fail(409, "A tu compañero aún le falta energía.");
          s.companion = { line: c.line, stage: c.stage + 1 };
          giveMon(s, line[c.stage + 1], false);
        });
        return out instanceof Response ? out : json({ ok: true, profile: studentView(out, closed) });
      }
      if (path === "/me/messages" && method === "GET") return json({ messages: await getMail(session.sid) });
      if (path === "/me/messages" && method === "POST") {
        const b = await readBody(req);
        const text = clean(b.text, MAIL_MAX + 1);
        if (text.length < 2) return fail(400, "Escribe tu pregunta.");
        if (text.length > MAIL_MAX) return fail(400, `Máximo ${MAIL_MAX} letras.`);
        let err = null;
        const list = await update("mail/" + session.sid, (cur) => {
          const l = Array.isArray(cur) ? cur : [];
          const today = madridDay(Date.now());
          if (l.filter((x) => madridDay(x.at) === today).length >= MAIL_PER_DAY) { err = fail(429, `Ya has mandado ${MAIL_PER_DAY} preguntas hoy. ¡Mañana puedes mandar más!`); return undefined; }
          const next = trimMail([...l, { id: crypto.randomBytes(6).toString("hex"), text, at: Date.now(), read: false }]);
          if (!next) { err = fail(429, "Tu buzón está lleno. Espera a que el profe responda."); return undefined; }
          return next;
        });
        if (err) return err;
        return json({ messages: list }, 201);
      }
      if (path === "/me/messages/seen" && method === "POST") {
        // solo las que el alumno ha visto en pantalla: una respuesta que llega entre medias sigue marcada
        const b = await readBody(req);
        const ids = Array.isArray(b.ids) ? b.ids.slice(0, MAIL_KEEP).map(String) : [];
        const list = (await update("mail/" + session.sid, (cur) => (Array.isArray(cur) ? cur.map((x) => (x.reply && ids.includes(x.id) ? { ...x, seen: true } : x)) : undefined))) || [];
        const out = await syncMailNew(session.sid, list);
        return out instanceof Response ? out : json({ ok: true, profile: await viewOf(out) });
      }
      return fail(403, "No permitido.");
    }

    /* --- profesor --- */
    if (session.role === "teacher") {
      if (path === "/teacher/students" && method === "GET") {
        return json({ students: (await allStudents()).map(teacherView), config: await getConfig(), attClosed: await getAttClosed(), units: (await getUnits()).list });
      }
      const m = path.match(/^\/teacher\/students\/([\w-]{1,60})$/);
      if (m && method === "PUT") {
        const b = await readBody(req);
        if (typeof b.newPassword === "string" && b.newPassword.length) {
          const npLen = [...b.newPassword].length;
          if (npLen < 3 || npLen > 64) return fail(400, "El código debe tener entre 3 y 64 símbolos.");
        }
        // renombrar mueve la reserva del nombre: si no, el nombre viejo queda bloqueado y el nuevo libre
        let newKey = null, oldKey = null;
        if ("name" in b && clean(b.name, 30).length >= 2) {
          const cur = await getStudent(m[1]);
          const k = nameKeyOf(clean(b.name, 30));
          if (cur && k !== cur.nameKey) {
            const res = await store.setJSON(k, { t: Date.now() }, { onlyIfNew: true });
            if (res?.modified === false) return fail(409, "Ya existe un alumno con ese nombre. Añade una inicial o apellido.");
            newKey = k; oldKey = cur.nameKey;
          }
        }
        const out = await mutate(m[1], (s) => {
        if (newKey) s.nameKey = newKey;
        // el profesor no toca lo que es del alumno (Pokémon, canjes, medidas...): evita pisar compras recientes
        if ("name" in b) { const n = clean(b.name, 30); if (n.length >= 2) s.name = n; }
        if ("school" in b) s.school = clean(b.school, 40) || s.school;
        if (b.gender === "boy" || b.gender === "girl") s.gender = b.gender;
        if (FACTIONS.includes(b.faction)) s.faction = b.faction;
        for (const k of ["weight", "height", "wingspan", "hrRest"]) if (k in b) s[k] = clean(b[k], 8);
        if ("note" in b) s.note = clean(b.note, 500);
        if (Number.isFinite(b.tokens) && b.tokens >= 0 && b.tokens <= 9999) s.tokens = Math.floor(b.tokens);
        if (Array.isArray(b.badges) && b.badges.length <= 20) s.badges = b.badges.map(Boolean);
        if (Array.isArray(b.gymSessionsData) && b.gymSessionsData.length <= 20 && b.gymSessionsData.every(Array.isArray)) {
          s.gymSessionsData = b.gymSessionsData.map((g) => g.slice(0, 20).map(Boolean));
        }
        if (Array.isArray(b.pendingNotifications) && b.pendingNotifications.length <= 50) {
          s.pendingNotifications = b.pendingNotifications.map((n) => ({ title: clean(n?.title, 80), desc: clean(n?.desc, 300), icon: clean(n?.icon, 8) }));
        }
        if (typeof b.newPassword === "string" && b.newPassword.length) s.passHash = hashPw(b.newPassword);
        });
        if (newKey) { if (out instanceof Response) await store.delete(newKey); else if (oldKey) await store.delete(oldKey); }
        return out instanceof Response ? out : json({ profile: teacherView(out) });
      }
      const q = path.match(/^\/teacher\/students\/([\w-]{1,60})\/(session|reward|bonus)$/);
      if (q && method === "POST") {
        const b = await readBody(req);
        const done_ = (out) => (out instanceof Response ? out : json({ profile: teacherView(out) }));
        if (q[2] === "session") {
          const g = b.gIndex, i = b.sIndex, total = b.gymTotal, count = b.gymCount;
          if (!intIn(g, 0, 19) || !intIn(count, 1, 20) || g >= count || !intIn(total, 1, 20) || !intIn(i, 0, 19) || i >= total) return fail(400, "Sesión no válida.");
          return done_(await mutate(q[1], (s) => {
          const grid = Array.isArray(s.gymSessionsData) ? s.gymSessionsData : [];
          while (grid.length < count) grid.push([]);
          const row = Array.isArray(grid[g]) ? grid[g] : [];
          while (row.length < total) row.push(false);
          grid[g] = row;
          s.gymSessionsData = grid;
          const done = !!b.done;
          if (!!row[i] !== done) {
            row[i] = done;
            // Superball preparada: esta misión da +2. Si el profe la desmarca, la Superball vuelve (a la mochila si ya hay otra preparada); ya estaba pagada, así que puede pasar de ITEM_MAX (el tope es solo para comprar)
            const cell = g + "-" + i;
            let gain = 1;
            if (done && s.superball) { gain = 2; s.superball = false; s.superballCell = cell; }
            else if (!done && s.superballCell === cell) {
              gain = 2;
              delete s.superballCell;
              if (s.superball) s.items = { ...(isObj(s.items) ? s.items : {}), superball: (s.items?.superball || 0) + 1 };
              else s.superball = true;
            }
            s.tokens = Math.max(0, (s.tokens || 0) + (done ? gain : -gain));
            if (done) pushNotice(s, gain === 2
              ? { title: "¡Superball! Misión doble", desc: "El profesor ha marcado tu sesión y tu Superball la ha duplicado. ¡Has ganado +2 fichas!", icon: "🔵" }
              : { title: "¡Sesión Validada en Pista!", desc: "El profesor ha marcado una nueva sesión completada. ¡Has ganado +1 ficha!", icon: "⚡" });
            s.badges = Array.isArray(s.badges) ? s.badges : [];
            while (s.badges.length < count) s.badges.push(false);
            const completed = row.slice(0, total).filter(Boolean).length;
            if (completed === total && !s.badges[g]) {
              s.badges[g] = true;
              pushNotice(s, { title: "¡Medalla Conquistada!", desc: "¡Has completado el 100% de " + clean(b.gymCity, 40) + "!", icon: "🏅" });
            } else if (completed < total && s.badges[g]) s.badges[g] = false;
          }
          }));
        }
        if (q[2] === "bonus") {
          const d = b.delta === -1 ? -1 : 1;
          return done_(await mutate(q[1], (s) => {
            s.tokens = Math.max(0, (s.tokens || 0) + d);
            if (d === 1) pushNotice(s, { title: "¡Fair play!", desc: "El profesor te da +1 ficha por tu buen comportamiento. ¡Sigue así!", icon: "🤝" });
          }));
        }
        const title = clean(b.title, 60);
        if (!isReward(title)) return fail(400, "Premio no válido.");
        return done_(await mutate(q[1], (s) => {
          const used = Array.isArray(s.usedRewards) ? s.usedRewards : [];
          if (b.used === false) {
            const idx = used.indexOf(title);
            if (idx >= 0) used.splice(idx, 1);
          } else if (used.filter((x) => x === title).length < (s.redeemedRewards || []).filter((x) => x === title).length) {
            used.push(title);
          }
          s.usedRewards = used;
        }));
      }
      if (m && method === "DELETE") {
        const old = await getStudent(m[1]);
        if (old?.nameKey) await store.delete(old.nameKey);
        await store.delete("students/" + m[1]);
        await store.delete("mail/" + m[1]);
        return json({ ok: true });
      }
      if (path === "/teacher/board" && method === "GET") {
        return json({ board: await getBoard(), plans: await getPlans(), config: await getConfig(), now: Date.now() });
      }
      if (path === "/teacher/board" && method === "PUT") {
        const b = await readBody(req);
        const bd = await update("board/main", (cur) => {
          const x = withBoard(cur);
          applyBoard(x, b);
          return x;
        });
        return json({ board: bd, now: Date.now() });
      }
      if (path === "/teacher/plan" && method === "PUT") {
        const b = await readBody(req);
        if (!/^\d{1,2}-\d{1,2}$/.test(String(b.key))) return fail(400, "Sesión no válida.");
        const pl = isObj(b.plan) ? b.plan : {};
        let full = false;
        const plans = await update("board/plans", (cur) => {
          const p = cur || {};
          if (!p[b.key] && Object.keys(p).length >= 300) { full = true; return undefined; }
          p[b.key] = { warmup: clean(pl.warmup, 300), main: clean(pl.main, 300), cooldown: clean(pl.cooldown, 300), material: clean(pl.material, 200) };
          return p;
        });
        return full ? fail(400, "Demasiados planes guardados.") : json({ plans });
      }
      if (path === "/teacher/attendance" && method === "PUT") {
        const b = await readBody(req);
        if (!dateOk(b.date)) return fail(400, "Fecha no válida.");
        if (typeof b.closed === "boolean") {
          const out = await update("meta/att-closed", (cur) => {
            const ds = (cur || []).filter((x) => x !== b.date);
            if (b.closed) ds.push(b.date);
            return ds.sort().slice(-400);
          });
          return json({ attClosed: out });
        }
        if (b.all === "P") {
          for (const s of await allStudents()) {
            if (s.att && s.att[b.date]) await mutate(s.id, (x) => { if (x.att) delete x.att[b.date]; });
          }
          return json({ ok: true });
        }
        if (!["P", "F", "R"].includes(b.mark)) return fail(400, "Marca no válida.");
        if (!/^[\w-]{1,60}$/.test(String(b.id))) return fail(400, "Alumno no válido.");
        const out = await mutate(b.id, (s) => {
          s.att = isObj(s.att) ? s.att : {};
          if (b.mark === "P") delete s.att[b.date]; else s.att[b.date] = b.mark;
        });
        return out instanceof Response ? out : json({ profile: teacherView(out) });
      }
      if (path === "/teacher/unit-close" && method === "POST") {
        const b = await readBody(req);
        if (!intIn(b.g, 0, 19)) return fail(400, "Unidad no válida.");
        const g = b.g, city = clean(b.city, 40);
        const students = await allStudents();
        const squads = FACTIONS.map((f) => {
          const ms = students.filter((s) => (FACTIONS.includes(s.faction) ? s.faction : "Rayo") === f);
          return { f, n: ms.length, avg: ms.length ? ms.reduce((a, s) => a + mastered(s, g), 0) / ms.length : 0 };
        }).filter((q) => q.n > 0);
        const top = Math.max(0, ...squads.map((q) => q.avg));
        if (top <= 0) return fail(400, "Nadie ha completado sesiones en esta unidad todavía.");
        let rec, exists = false;
        await update("meta/units", (u) => {
          const list = u?.list || [];
          const old = list.find((x) => x.g === g);
          if (old) { rec = old; exists = true; return undefined; }
          const winners = squads.filter((q) => q.avg === top).map((q) => q.f);
          const prizes = {};
          // un legendario solo se entrega una vez en toda la liga
          const used = list.flatMap((x) => Object.values(x.prizes || {}).filter((p) => p?.kind === "legend").map((p) => p.name));
          const left = LEGENDS.filter((n) => !used.includes(n));
          // si no hay legendarios para todos los ganadores, todos reciben el mismo premio extraordinario
          if (left.length >= winners.length) for (const f of winners) { const n = pick(left); left.splice(left.indexOf(n), 1); prizes[f] = { kind: "legend", name: n }; }
          else { const extra = { kind: pick(["choose", "day"]) }; for (const f of winners) prizes[f] = { ...extra }; }
          rec = { g, city, at: Date.now(), scores: Object.fromEntries(squads.map((q) => [q.f, Math.round(q.avg * 100) / 100])), winners, prizes, done: false };
          return { list: [...list, rec].slice(-40) };
        });
        if (exists && rec.done) return fail(409, "Esta unidad ya está cerrada.");
        // reparte los premios; si se cortó a medias, se reanuda sin repetir a nadie
        await Promise.all(students.map((s) => mutate(s.id, (x) => {
          const f = FACTIONS.includes(x.faction) ? x.faction : "Rayo";
          applyUnitPrize(x, rec, rec.winners.includes(f) ? rec.prizes[f] : null);
        })));
        await update("meta/units", (u) => ({ list: (u?.list || []).map((x) => (x.g === g ? { ...x, done: true } : x)) }));
        const chest = { g, city: rec.city, winners: rec.winners, prizes: rec.prizes, at: Date.now() };
        await update("board/main", (cur) => ({ ...withBoard(cur), chest }));
        return json({ record: { ...rec, done: true } });
      }
      if (path === "/teacher/messages" && method === "GET") {
        const students = await allStudents();
        const lists = await Promise.all(students.map(async (st) => (await getMail(st.id)).map((x) => ({ ...x, sid: st.id, name: st.name, faction: st.faction }))));
        return json({ messages: lists.flat().sort((a, b) => b.at - a.at) });
      }
      const mm = path.match(/^\/teacher\/messages\/([\w-]{1,60})\/([a-f0-9]{12})$/);
      if (mm && (method === "PUT" || method === "DELETE")) {
        const b = method === "PUT" ? await readBody(req) : {};
        const reply = "reply" in b ? clean(b.reply, 500) : null;
        if (reply !== null && reply.length < 1) return fail(400, "Escribe la respuesta.");
        let found = false, changed = false;
        const list = await update("mail/" + mm[1], (cur) => {
          const l = Array.isArray(cur) ? cur : [];
          const i = l.findIndex((x) => x.id === mm[2]);
          if (i < 0) return undefined;
          found = true;
          if (method === "DELETE") return l.filter((_, j) => j !== i);
          // repetir la misma respuesta no vuelve a avisar al alumno
          if (reply !== null && reply !== l[i].reply) { changed = true; Object.assign(l[i], { reply, replyAt: Date.now(), read: true, seen: false }); }
          if (typeof b.read === "boolean") l[i].read = b.read;
          return l;
        });
        if (!found) return fail(404, "Mensaje no encontrado.");
        if (changed || method === "DELETE") await syncMailNew(mm[1], list, changed);
        return json({ ok: true });
      }
      if (path === "/teacher/units" && method === "GET") return json(await getUnits());
      if (path === "/teacher/end-class" && method === "POST") {
        await update("meta/epoch", (e) => (e || 0) + 1);
        return json({ ok: true });
      }
      if (path === "/teacher/config" && method === "PUT") {
        const b = await readBody(req);
        const cfg = await update("config/main", (c) => {
          const x = { ...(normCfg(c)) };
            if (Number.isInteger(b.currentWeek) && b.currentWeek >= 1 && b.currentWeek <= 33) x.currentWeek = b.currentWeek;
          return x;
        });
        return json({ config: cfg });
      }
    }

    return fail(404, "No encontrado.");
  } catch (e) {
    if (e?.status === 413) return fail(413, "Petición demasiado grande.");
    if (e?.status === 400) return fail(400, "Petición no válida.");
    console.error(e);
    if (String(e?.message).startsWith("conflicto")) return fail(503, "Hay mucha actividad, inténtalo otra vez.");
    return fail(500, "Error del servidor.");
  }
};

export const config = { path: "/api/*" };
