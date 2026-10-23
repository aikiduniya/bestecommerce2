import crypto from "node:crypto";
const secret = process.env.JWT_SECRET; if (!secret || secret.length < 32) { console.error("Set JWT_SECRET (>=32 chars): openssl rand -hex 32"); process.exit(1); }
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const sign = (p) => { const h = b64({ alg: "HS256", typ: "JWT" }), b = b64(p); return `${h}.${b}.${crypto.createHmac("sha256", secret).update(`${h}.${b}`).digest("base64url")}`; };
const exp = Math.floor(Date.now()/1000) + 10*365*86400;
console.log(`JWT_SECRET=${secret}\nANON_KEY=${sign({ role: "anon", iss: "supabase", exp })}\nSERVICE_KEY=${sign({ role: "service_role", iss: "supabase", exp })}`);
