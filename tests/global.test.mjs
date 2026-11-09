// Uso: node tests/global.test.mjs  (API real con un almacén en memoria en vez de la base de datos)
import assert from "node:assert";
import { readFileSync, writeFileSync } from "node:fs";
const src = new URL("../netlify/functions/api.mjs", import.meta.url), tmp = new URL("./.api-memoria.mjs", import.meta.url);
writeFileSync(tmp, readFileSync(src, "utf8").replace('"@netlify/blobs"', '"./blobs-memoria.mjs"'));
const { default: h } = await import(tmp.href); const { mem } = await import("./blobs-memoria.mjs");

const PASS = {}; // código de clase → su contraseña (se añade sola a las rutas ?clase=)
const call = async (path, method = "GET", body, tok, cls, ip = "1.1.1.1", pass) => {
  const headers = {}; if (tok) headers.authorization = "Bearer " + tok; if (cls) headers["x-class"] = cls;
  const code = (path.match(/[?&]clase=([^&]*)/)?.[1] || "").toUpperCase(); pass ??= PASS[code]; if (pass) headers["x-clase-pass"] = pass;
  const r = await h(new Request("http://x/api" + path, { method, headers, body: body ? JSON.stringify(body) : undefined }), { ip });
  return { s: r.status, j: await r.json() };
};
// dos profes; cada uno solo ve lo suyo
const a = await call("/teacher/register", "POST", { name: "Ana", email: "Ana@cole.es", password: "contraseña1" });
assert.equal(a.s, 201, JSON.stringify(a.j)); assert.match(a.j.recovery, /^\w{4}-\w{4}-\w{4}$/);
const dup = await call("/teacher/register", "POST", { name: "Otra", email: "ana@cole.es", password: "contraseña1" });
assert.equal(dup.s, 400); assert.doesNotMatch(dup.j.error || JSON.stringify(dup.j), /Ya hay/);
const b = await call("/teacher/register", "POST", { name: "Benito", email: "beni@cole.es", password: "contraseña2" });
const A = a.j.token, B = b.j.token;
assert.equal((await call("/teacher/classes", "POST", { grade: 7, group: "A", school: "Cole" }, A)).s, 400);
const c4 = (await call("/teacher/classes", "POST", { grade: 4, group: "a", school: "CEIP Kanto" }, A)).j.class;
const c5 = (await call("/teacher/classes", "POST", { grade: 5, group: "B", school: "CEIP Kanto" }, A)).j.class;
const c1 = (await call("/teacher/classes", "POST", { grade: 1, group: "A", school: "Otro cole" }, B)).j.class;
assert.equal(c4.group, "A"); assert.match(c4.code, /^[A-Z0-9]{6}$/); assert.match(c4.pass, /^[A-Z0-9]{5}$/);
for (const c of [c4, c5, c1]) PASS[c.code] = c.pass;
// sin la contraseña de la clase no se ve nada; mayúsculas o minúsculas da igual
assert.equal((await call("/public?clase=" + c4.code, "GET", undefined, null, null, "1.1.1.1", "")).s, 403);
assert.equal((await call("/public?clase=" + c4.code, "GET", undefined, null, null, "1.1.1.1", "MAL00")).s, 403);
assert.equal((await call("/public?clase=" + c4.code, "GET", undefined, null, null, "1.1.1.1", c4.pass.toLowerCase())).s, 200);
assert.equal((await call("/register?clase=" + c4.code, "POST", { name: "Intruso", password: "🐶🐱🐭", gender: "girl", faction: "Rayo" }, null, null, "1.1.1.1", "MAL00")).s, 403);
// tras 60 fallos desde una red, ni la buena entra (así el 429 no delata cuál es la buena); otra red sí
for (let i = 0; i < 61; i++) await call("/public?clase=" + c1.code, "GET", undefined, null, null, "6.6.6.6", "X" + i);
assert.equal((await call("/public?clase=" + c1.code, "GET", undefined, null, null, "6.6.6.6")).s, 429);
assert.equal((await call("/public?clase=" + c1.code, "GET", undefined, null, null, "7.7.7.7")).s, 200);
// el profe cambia la contraseña: la vieja deja de valer
assert.equal((await call("/teacher/classes/" + c5.id, "PUT", { pass: "ab" }, A)).s, 400);
const c5p = (await call("/teacher/classes/" + c5.id, "PUT", { pass: "pika 55" }, A)).j.class; assert.equal(c5p.pass, "PIKA55");
assert.equal((await call("/public?clase=" + c5.code)).s, 403); PASS[c5.code] = "PIKA55";
assert.equal((await call("/public?clase=" + c5.code)).s, 200);
// los alumnos entran con el código de su clase
const reg = (code, name) => call("/register?clase=" + code, "POST", { name, password: "🐶🐱🐭", gender: "girl", faction: "Rayo" });
assert.equal((await reg("NOEXISTE", "Ana")).s, 404);
const s1 = (await reg(c4.code, "Lucía Martín")).j; assert.equal(s1.profile.school, "CEIP Kanto");
await reg(c4.code, "Pablo Ruiz"); await reg(c1.code, "Lucía Martín"); // el mismo nombre en otra clase vale
assert.equal((await call("/public?clase=" + c4.code.toLowerCase())).j.students.length, 2);
assert.equal((await call("/public?clase=" + c1.code)).j.students.length, 1);
// el profe trabaja dentro de la clase elegida y no puede tocar la de otro
assert.equal((await call("/teacher/students", "GET", null, A)).s, 400);
assert.equal((await call("/teacher/students", "GET", null, A, c4.id)).j.students.length, 2);
assert.equal((await call("/teacher/students", "GET", null, B, c4.id)).s, 400);
assert.equal((await call("/teacher/classes/" + c4.id, "DELETE", null, B)).s, 404);
assert.equal((await call("/teacher/move", "POST", { from: c4.id, to: c1.id, id: s1.profile.id }, A)).s, 400);
// el token del alumno solo vale para su clase
assert.equal((await call("/me", "GET", null, s1.token)).s, 200);
assert.equal((await call("/teacher/messages", "GET", null, A, c4.id)).s, 200);
// pasar a Lucía de 4ºA a 5ºB con todo su progreso
await call("/teacher/students/" + s1.profile.id + "/bonus", "POST", { delta: 1 }, A, c4.id);
assert.equal((await call("/teacher/move", "POST", { from: c4.id, to: c5.id, id: s1.profile.id }, A)).s, 200);
const in5 = (await call("/teacher/students", "GET", null, A, c5.id)).j.students;
assert.deepEqual(in5.map((s) => [s.name, s.tokens]), [["Lucía Martín", 1]]);
assert.equal((await call("/teacher/students", "GET", null, A, c4.id)).j.students.length, 1);
assert.equal((await reg(c4.code, "Lucía Martín")).s, 201); // su nombre queda libre en 4ºA
assert.equal((await call("/teacher/move", "POST", { from: c4.id, to: c5.id, id: s1.profile.id }, A)).s, 404);
// el alumno vuelve a entrar con el código de su nueva clase
assert.equal((await call("/login?clase=" + c5.code, "POST", { id: s1.profile.id, password: "🐶🐱🐭" })).s, 200);
assert.equal((await call("/login?clase=" + c4.code, "POST", { id: s1.profile.id, password: "🐶🐱🐭" })).s, 401);
// código nuevo: el viejo deja de valer
const old = c4.code; const c4b = (await call("/teacher/classes/" + c4.id + "/code", "POST", null, A)).j.class;
assert.notEqual(c4b.code, old); assert.equal((await call("/public?clase=" + old)).s, 404);
// copias por clase, y la copia de la versión de una sola clase se puede cargar en una clase nueva
const snap = (await call("/teacher/backup", "GET", null, A, c4.id)).j;
assert.ok(Object.keys(snap.data).every((k) => !k.startsWith("c/")));
assert.equal((await call("/teacher/backups", "GET", null, A, c4.id)).j.backups.length, 1);
const c6 = (await call("/teacher/classes", "POST", { grade: 6, group: "A", school: "CEIP Kanto" }, A)).j.class;
assert.equal((await call("/teacher/restore", "POST", { snapshot: snap }, A, c6.id)).s, 200);
// una copia trucada no puede apuntar a claves globales (p. ej. el secreto de sesión)
const evil = { app: "liga-kanto", v: 1, data: { "students/x": { id: "x", name: "X", nameKey: "meta/secret" } } };
assert.equal((await call("/teacher/restore", "POST", { snapshot: evil }, A, c6.id)).s, 400);
assert.equal((await call("/teacher/students", "GET", null, A, c6.id)).j.students.length, 2);
assert.equal((await call("/teacher/students", "GET", null, A, c4.id)).j.students.length, 2);
// recuperar la contraseña cierra las sesiones abiertas
assert.equal((await call("/teacher/recover", "POST", { email: "ana@cole.es", recovery: "AAAA-BBBB-CCCC", password: "nueva12345" })).s, 401);
const rec = await call("/teacher/recover", "POST", { email: "ana@cole.es", recovery: a.j.recovery.toLowerCase(), password: "nueva12345" });
assert.equal(rec.s, 200); assert.notEqual(rec.j.recovery, a.j.recovery);
assert.equal((await call("/teacher/me", "GET", null, A)).s, 401);
assert.equal((await call("/teacher/login", "POST", { email: "ana@cole.es", password: "contraseña1" })).s, 401);
const A2 = (await call("/teacher/login", "POST", { email: "ANA@cole.es", password: "nueva12345" })).j.token;
assert.equal((await call("/teacher/me", "GET", null, A2)).j.classes.length, 3);
// borrar una clase borra sus datos y su código
assert.equal((await call("/teacher/classes/" + c6.id, "DELETE", null, A2)).s, 200);
assert.ok(![...mem.keys()].some((k) => k.startsWith(`c/${c6.id}/`)));
assert.equal((await call("/public?clase=" + c6.code)).s, 404);
assert.equal((await call("/teacher/me", "GET", null, A2)).j.classes.length, 2);
// cambiar el código del alumno cierra sus sesiones abiertas
const pab = (await call("/login?clase=" + c5.code, "POST", { id: s1.profile.id, password: "🐶🐱🐭" })).j.token;
assert.equal((await call("/teacher/students/" + s1.profile.id, "PUT", { newPassword: "🐸🐵🐔" }, A2, c5.id)).s, 200);
assert.equal((await call("/me", "GET", null, pab)).s, 401);
assert.equal((await call("/me/self-eval", "POST", { effort: 1, fair: 1 }, pab)).s, 401);
const pab2 = (await call("/login?clase=" + c5.code, "POST", { id: s1.profile.id, password: "🐸🐵🐔" })).j.token;
assert.equal((await call("/me", "GET", null, pab2)).s, 200);
// el bloqueo del alumno crece: 3 min, luego 6
const wrong = () => call("/login?clase=" + c5.code, "POST", { id: s1.profile.id, password: "❌❌❌" });
for (let i = 0; i < 10; i++) assert.equal((await wrong()).s, 401);
let lk = await wrong(); assert.equal(lk.s, 429); assert.match(JSON.stringify(lk.j), /3 min/);
const rlk = [...mem.keys()].findLast((k) => k.startsWith("rl/") && JSON.parse(mem.get(k).d).lv === 1);
mem.set(rlk, { d: JSON.stringify({ ...JSON.parse(mem.get(rlk).d), until: Date.now() - 1 }), e: "x" });
for (let i = 0; i < 10; i++) await wrong();
lk = await wrong(); assert.equal(lk.s, 429); assert.match(JSON.stringify(lk.j), /6 min/);
// los fallos de otro (otra IP) no dejan fuera al profe
for (let i = 0; i < 12; i++) await call("/teacher/login", "POST", { email: "ana@cole.es", password: "mala" }, null, null, "9.9.9.9");
assert.equal((await call("/teacher/login", "POST", { email: "ana@cole.es", password: "mala" }, null, null, "9.9.9.9")).s, 429);
assert.equal((await call("/teacher/login", "POST", { email: "ana@cole.es", password: "nueva12345" })).s, 200);
// curso editable por clase: sin guardar, la plantilla son los 8 gimnasios del cliente
const { KANTO_UNITS } = await import(tmp.href);
const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
assert.deepEqual(JSON.parse(html.match(/const KANTO_UNITS = (\[.*\]);/)[1]), KANTO_UNITS);
const co0 = (await call("/teacher/course", "GET", null, A2, c5.id)).j.course;
assert.deepEqual(co0.units.map((u) => u.id), ["u1", "u2", "u3", "u4", "u5", "u6", "u7", "u8"]);
assert.deepEqual(co0.units.map((u) => u.sessions.length), [9, 12, 16, 12, 12, 12, 12, 12]);
assert.equal((await call("/public?clase=" + c5.code)).j.course.units.length, 8);
const base = { units: co0.units, days: [2, 3, 5], start: "2026-09-08", off: [], autoSession: false };
const U = (id, n, extra) => ({ id, name: "Unidad " + id, icon: "futbol", sessions: Array.from({ length: n }, (_, i) => "S" + (i + 1)), ...extra });
const bad = async (patch) => (await call("/teacher/course", "PUT", { ...base, ...patch }, A2, c5.id)).s;
for (const patch of [{ units: [] }, { units: Array.from({ length: 13 }, (_, i) => U("x" + i, 1)) }, { units: [U("a", 31)] }, { units: [U("a", 0)] },
  { units: [U("a", 1), U("a", 2)] }, { units: [U("a", 1, { name: " " })] }, { units: [U("a b", 1)] }, { units: [U("a", 1, { icon: "img:" })] },
  { units: [U("a", 1, { icon: "img:", img: "data:image/gif;base64,AAAA" })] }, { units: [U("a", 1, { icon: "img:", img: "data:image/png;base64," + "A".repeat(90000) })] },
  { units: [U("a", 1, { sessions: [3] })] }, { days: [1, 2, 3, 4, 5, 6] }, { days: [0] }, { days: [2, 2] }, { start: "2026-02-30" }, { end: "2026-01-01" },
  { off: ["mañana"] }, { off: Array(201).fill("2026-10-12") }, { autoSession: "si" }, { name: 7 }]) assert.equal(await bad(patch), 400, JSON.stringify(patch).slice(0, 120));
assert.equal((await call("/teacher/course", "PUT", base, B, c5.id)).s, 400); // otro profe no toca esta clase
assert.equal((await call("/teacher/course", "PUT", { ...base, units: [U("a", 1, { icon: "img:", img: "data:image/png;base64,iVBORw0KGgo=" })] }, A2, c4.id)).s, 200); // imagen pequeña: vale
// progreso de Lucía en 5ºB: unidad 1 entera (medalla), una de la 2, la última de la 3 y su plan; la unidad 1 se cierra
let REV = "0"; // la versión del curso que el cliente tiene en pantalla
const ses = (g, i, total, count = 8, rev = REV, done = true) => call(`/teacher/students/${s1.profile.id}/session`, "POST", { gIndex: g, sIndex: i, done, gymTotal: total, gymCount: count, gymCity: "x", rev }, A2, c5.id);
for (let i = 0; i < 9; i++) assert.equal((await ses(0, i, 9)).s, 200);
await ses(1, 0, 12); await ses(2, 15, 16); await ses(2, 3, 16);
await call("/teacher/plan", "PUT", { key: "2-15", plan: { warmup: "se recorta" } }, A2, c5.id);
await call("/teacher/plan", "PUT", { key: "2-3", plan: { warmup: "pasa a 0-3" } }, A2, c5.id);
await call("/teacher/plan", "PUT", { key: "1-0", plan: { warmup: "se borra" } }, A2, c5.id);
assert.equal((await call("/teacher/unit-close", "POST", { g: 0, city: "Plateada" }, A2, c5.id)).s, 200);
// curso nuevo: la unidad 3 recortada a 10 sesiones va primera, luego la 1, y una nueva de 20 sesiones; las demás se quitan
const nu = { ...base, name: "Los Pikachus", days: [1, 4], autoSession: true, units: [{ ...co0.units[2], sessions: co0.units[2].sessions.slice(0, 10) }, co0.units[0], U("n1", 20, { name: "Atletismo", icon: "atletismo" })] };
const put = await call("/teacher/course", "PUT", nu, A2, c5.id);
assert.equal(put.s, 200, JSON.stringify(put.j)); assert.match(put.j.course.rev, /^\w{8,40}$/); REV = put.j.course.rev; assert.equal(put.j.course.name, "Los Pikachus");
const luc = async () => (await call("/teacher/students", "GET", null, A2, c5.id)).j.students.find((x) => x.id === s1.profile.id);
let lu = await luc();
assert.deepEqual(lu.gymSessionsData.map((r) => r.length), [10, 9, 20]);
assert.deepEqual(lu.gymSessionsData[0].map((x, i) => x && i), [false, false, false, 3, false, false, false, false, false, false]);
assert.ok(lu.gymSessionsData[1].every(Boolean)); assert.ok(!lu.gymSessionsData[2].some(Boolean));
assert.deepEqual(lu.badges, [false, true, false]); assert.deepEqual(Object.keys(lu.unitsDone), ["1"]); assert.equal(lu.cv, REV);
let pl = (await call("/teacher/board", "GET", null, A2, c5.id)).j.plans;
assert.equal(pl["0-3"].warmup, "pasa a 0-3"); assert.ok(!pl["2-15"] && !pl["1-0"] && !pl["0-15"]);
assert.deepEqual((await call("/teacher/units", "GET", null, A2, c5.id)).j.list.map((x) => x.g), [1]);
assert.equal((await call("/public?clase=" + c5.code)).j.class.name, "Los Pikachus");
assert.equal((await call("/teacher/me", "GET", null, A2)).j.classes.find((c) => c.id === c5.id).name, "Los Pikachus");
// límites nuevos: hasta 30 sesiones; con el curso viejo en pantalla se pide recargar
assert.equal((await ses(2, 19, 20, 3, "0")).s, 409); // marcar con la versión vieja del curso
assert.equal((await ses(2, 19, 20, 3)).s, 200); assert.equal((await ses(2, 20, 20, 3)).s, 400); assert.equal((await ses(1, 0, 9, 8)).s, 409);
assert.equal((await call("/teacher/plan", "PUT", { key: "2-19", plan: {} }, A2, c5.id)).s, 200);
assert.equal((await call("/teacher/plan", "PUT", { key: "3-0", plan: {} }, A2, c5.id)).s, 400);
assert.equal((await call("/teacher/unit-close", "POST", { g: 3 }, A2, c5.id)).s, 400);
assert.equal((await call("/teacher/config", "PUT", { currentWeek: 60 }, A2, c5.id)).j.config.currentWeek, 60);
// guardar otra vez lo mismo no recoloca nada
lu = await luc();
const rev2 = (await call("/teacher/course", "PUT", nu, A2, c5.id)).j.course.rev; assert.ok(rev2 !== REV); REV = rev2;
assert.deepEqual((await luc()).gymSessionsData, lu.gymSessionsData);
// las copias llevan el curso; restaurar lo devuelve con su progreso, y un curso dañado no entra
const snapC = (await call("/teacher/backup", "GET", null, A2, c5.id)).j;
assert.equal(snapC.data["config/course"].name, "Los Pikachus");
assert.equal((await call("/teacher/course", "PUT", { ...nu, name: "", units: [nu.units[2]] }, A2, c5.id)).s, 200);
assert.equal((await luc()).gymSessionsData.length, 1);
const badSnap = structuredClone(snapC); badSnap.data["config/course"].units = [];
assert.equal((await call("/teacher/restore", "POST", { snapshot: badSnap }, A2, c5.id)).s, 400);
assert.equal((await call("/teacher/restore", "POST", { snapshot: snapC }, A2, c5.id)).s, 200);
assert.equal((await call("/teacher/course", "GET", null, A2, c5.id)).j.course.units.length, 3);
assert.deepEqual((await luc()).gymSessionsData.map((r) => r.length), [10, 9, 20]);
assert.equal((await call("/public?clase=" + c5.code)).j.class.name, "Los Pikachus"); // el nombre vuelve con la copia
REV = (await call("/teacher/course", "GET", null, A2, c5.id)).j.course.rev; assert.equal(REV, snapC.data["config/course"].rev);
// dos guardados del curso a la vez: entra uno, el otro recibe 409, y el progreso queda en el orden del que entró
const nuB = { ...nu, units: [nu.units[1], nu.units[0], nu.units[2]] };
const both = await Promise.all([call("/teacher/course", "PUT", nu, A2, c5.id), call("/teacher/course", "PUT", nuB, A2, c5.id)]);
assert.deepEqual(both.map((r) => r.s).sort(), [200, 409]);
let cc = (await call("/teacher/course", "GET", null, A2, c5.id)).j.course; REV = cc.rev;
assert.equal(REV, both.find((r) => r.s === 200).j.course.rev);
lu = await luc(); assert.equal(lu.cv, REV); assert.deepEqual(lu.gymSessionsData.map((r) => r.length), cc.units.map((u) => u.sessions.length));
assert.deepEqual(lu.badges, cc.units.map((u) => u.id === "u1"));
// un guardado que se corta antes de recolocar a un alumno: se recoloca solo al leerlo
const kL = `c/${c5.id}/students/${s1.profile.id}`, viejo = mem.get(kL);
const put3 = await call("/teacher/course", "PUT", nu, A2, c5.id); assert.equal(put3.s, 200); REV = put3.j.course.rev;
mem.set(kL, viejo); // como si la recolocación no hubiera llegado a este alumno
lu = await luc(); assert.equal(lu.cv, REV); assert.deepEqual(lu.gymSessionsData.map((r) => r.length), [10, 9, 20]); assert.deepEqual(lu.badges, [false, true, false]);
assert.equal(JSON.parse(mem.get(kL).d).cv, cc.rev); // leer no escribe
assert.equal((await ses(0, 0, 10, 3)).s, 200); assert.equal(JSON.parse(mem.get(kL).d).cv, REV); // al cambiarlo se guarda ya recolocado
// añadir sesiones a una unidad ya completada no quita la medalla, ni al marcar una de las nuevas
const nuC = { ...nu, units: [nu.units[0], { ...nu.units[1], sessions: [...nu.units[1].sessions, "Extra 1", "Extra 2"] }, nu.units[2]] };
REV = (await call("/teacher/course", "PUT", nuC, A2, c5.id)).j.course.rev;
lu = await luc(); assert.deepEqual(lu.badges, [false, true, false]); assert.equal(lu.gymSessionsData[1].filter(Boolean).length, 9);
assert.equal((await ses(1, 9, 11, 3)).s, 200); assert.deepEqual((await luc()).badges, [false, true, false]);
// el profe edita medallas y sesiones: con la versión y la forma del curso actual
const putS = (b) => call("/teacher/students/" + s1.profile.id, "PUT", b, A2, c5.id);
assert.equal((await putS({ badges: [false, true, true] })).s, 409);
assert.equal((await putS({ badges: [false, true, true], rev: "0" })).s, 409);
assert.equal((await putS({ badges: [false, true], rev: REV })).s, 400);
assert.equal((await putS({ badges: [false, true, "si"], rev: REV })).s, 400);
assert.equal((await putS({ gymSessionsData: [[true]], rev: REV })).s, 400);
assert.equal((await putS({ note: "sin tocar medallas" })).s, 200); // lo demás no pide versión
assert.equal((await putS({ badges: [false, true, true], rev: REV })).s, 200); // medalla de Atletismo a mano
// la medalla dada a mano sigue a su unidad al cambiar el curso y al pasar a otra clase
REV = (await call("/teacher/course", "PUT", { ...nu, units: [nu.units[2], nu.units[0]] }, A2, c5.id)).j.course.rev;
assert.deepEqual((await luc()).badges, [true, false]);
const cX = (await call("/teacher/classes", "POST", { grade: 6, group: "C", school: "CEIP Kanto" }, A2)).j.class;
assert.equal((await call("/teacher/course", "PUT", { ...base, units: [U("z", 2), nu.units[2]] }, A2, cX.id)).s, 200);
assert.equal((await call("/teacher/move", "POST", { from: c5.id, to: cX.id, id: s1.profile.id }, A2)).s, 200);
const enCM = (await call("/teacher/students", "GET", null, A2, cX.id)).j.students.find((x) => x.id === s1.profile.id);
assert.deepEqual(enCM.badges, [false, true]); assert.equal(enCM.cv, (await call("/teacher/course", "GET", null, A2, cX.id)).j.course.rev);
assert.equal((await call("/teacher/move", "POST", { from: cX.id, to: c5.id, id: s1.profile.id }, A2)).s, 200);
assert.deepEqual((await luc()).badges, [true, false]); // y vuelve con ella
assert.equal((await call("/teacher/classes/" + cX.id, "DELETE", null, A2)).s, 200);
// máximo de 30 clases, sin dejar clases ni códigos sueltos
for (let i = 0; i < 27; i++) assert.equal((await call("/teacher/classes", "POST", { grade: 1, group: "Z", school: "Cole" }, A2)).s, 201);
const two = await Promise.all([1, 2, 3].map(() => call("/teacher/classes", "POST", { grade: 1, group: "Z", school: "Cole" }, A2)));
assert.deepEqual(two.map((x) => x.s).sort(), [201, 400, 400]); // a la vez: solo cabe una más
assert.equal((await call("/teacher/me", "GET", null, A2)).j.classes.length, 30);
const nc = [...mem.keys()].filter((k) => k.startsWith("classes/")).length;
assert.equal((await call("/teacher/classes", "POST", { grade: 1, group: "Z", school: "Cole" }, A2)).s, 400);
assert.equal([...mem.keys()].filter((k) => k.startsWith("classes/")).length, nc);
console.log("ok");
