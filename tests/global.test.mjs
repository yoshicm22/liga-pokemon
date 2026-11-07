// Uso: node tests/global.test.mjs  (API real con un almacén en memoria en vez de la base de datos)
import assert from "node:assert";
import { readFileSync, writeFileSync } from "node:fs";
const src = new URL("../netlify/functions/api.mjs", import.meta.url), tmp = new URL("./.api-memoria.mjs", import.meta.url);
writeFileSync(tmp, readFileSync(src, "utf8").replace('"@netlify/blobs"', '"./blobs-memoria.mjs"'));
const { default: h } = await import(tmp.href); const { mem } = await import("./blobs-memoria.mjs");

const call = async (path, method = "GET", body, tok, cls) => {
  const headers = {}; if (tok) headers.authorization = "Bearer " + tok; if (cls) headers["x-class"] = cls;
  const r = await h(new Request("http://x/api" + path, { method, headers, body: body ? JSON.stringify(body) : undefined }), { ip: "1.1.1.1" });
  return { s: r.status, j: await r.json() };
};
// dos profes; cada uno solo ve lo suyo
const a = await call("/teacher/register", "POST", { name: "Ana", email: "Ana@cole.es", password: "contraseña1" });
assert.equal(a.s, 201, JSON.stringify(a.j)); assert.match(a.j.recovery, /^\w{4}-\w{4}-\w{4}$/);
assert.equal((await call("/teacher/register", "POST", { name: "Otra", email: "ana@cole.es", password: "contraseña1" })).s, 409);
const b = await call("/teacher/register", "POST", { name: "Benito", email: "beni@cole.es", password: "contraseña2" });
const A = a.j.token, B = b.j.token;
assert.equal((await call("/teacher/classes", "POST", { grade: 7, group: "A", school: "Cole" }, A)).s, 400);
const c4 = (await call("/teacher/classes", "POST", { grade: 4, group: "a", school: "CEIP Kanto" }, A)).j.class;
const c5 = (await call("/teacher/classes", "POST", { grade: 5, group: "B", school: "CEIP Kanto" }, A)).j.class;
const c1 = (await call("/teacher/classes", "POST", { grade: 1, group: "A", school: "Otro cole" }, B)).j.class;
assert.equal(c4.group, "A"); assert.match(c4.code, /^[A-Z0-9]{6}$/);
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
console.log("ok");
