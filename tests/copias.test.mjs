import assert from "node:assert";
// Uso: node tests/copias.test.mjs  (API real con un almacén en memoria en vez de Netlify Blobs)
import { readFileSync, writeFileSync } from "node:fs";
const src = new URL("../netlify/functions/api.mjs", import.meta.url), tmp = new URL("./.api-memoria.mjs", import.meta.url);
writeFileSync(tmp, readFileSync(src, "utf8").replace('"@netlify/blobs"', '"./blobs-memoria.mjs"'));
const { default: h } = await import(tmp.href); const { mem } = await import("./blobs-memoria.mjs");
process.env.TEACHER_PASSWORD = "pw"; process.env.CLASS_CODE = "K";
const call = async (path, method = "GET", body, tok) => { const r = await h(new Request("http://x/api" + path, { method, headers: tok ? { authorization: "Bearer " + tok } : {}, body: body ? JSON.stringify(body) : undefined }), { ip: "1.1.1.1" }); return { s: r.status, j: await r.json() }; };
const reg = await call("/register", "POST", { name: "Ana López", password: "🐶🐱🐭", gender: "girl", faction: "Rayo", classCode: "K" });
assert.equal(reg.s, 201, JSON.stringify(reg.j));
const t = (await call("/teacher/login", "POST", { password: "pw" })).j.token;
let l = await call("/teacher/backups", "GET", null, t); assert.equal(l.j.backups.length, 1);
const snap = (await call("/teacher/backup", "GET", null, t)).j;
assert.ok(Object.keys(snap.data).some((k) => k.startsWith("students/")));
assert.ok(!Object.keys(snap.data).some((k) => k.startsWith("meta/secret") || k.startsWith("rl/")));
const reg2 = await call("/register", "POST", { name: "Bea Ruiz", password: "🐶🐱🐭", gender: "girl", faction: "Roca", classCode: "K" });
assert.equal((await call("/teacher/students", "GET", null, t)).j.students.length, 2);
let r = await call("/teacher/restore", "POST", { name: l.j.backups[0] }, t); assert.equal(r.s, 200, JSON.stringify(r.j));
assert.equal(r.j.backups.length, 2);
const t2 = t; const st = (await call("/teacher/students", "GET", null, t2)).j.students; assert.deepEqual(st.map((s) => s.name), ["Ana López"]);
// Bea's name reservation is gone, so she can register again
assert.equal((await call("/register", "POST", { name: "Bea Ruiz", password: "🐶🐱🐭", gender: "girl", faction: "Roca", classCode: "K" })).s, 201);
assert.equal((await call("/teacher/restore", "POST", { snapshot: { app: "x" } }, t2)).s, 400);
assert.equal((await call("/teacher/restore", "POST", { snapshot: { app: "liga-kanto", data: { "students/a": { id: "b" } } } }, t2)).s, 400);
assert.equal((await call("/teacher/restore", "POST", { snapshot: { ...snap, data: { ...snap.data, "meta/secret": "x", "rl/z": {} } } }, t2)).s, 200);
assert.ok(mem.has("meta/secret") && !mem.has("rl/z"));
console.log("ok");
