import crypto from 'node:crypto';

// Kata sandi disimpan dengan scrypt (bawaan Node, tanpa dependensi native)
const scrypt = (pw, salt) => new Promise((ok, fail) =>
  crypto.scrypt(pw, salt, 64, { N: 16384, r: 8, p: 1 }, (e, k) => (e ? fail(e) : ok(k))));

export async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  return `scrypt$${salt.toString('hex')}$${(await scrypt(pw, salt)).toString('hex')}`;
}

export async function verifyPassword(pw, stored) {
  const [alg, salt, hash] = stored.split('$');
  if (alg !== 'scrypt') return false;
  const key = await scrypt(pw, Buffer.from(salt, 'hex'));
  const want = Buffer.from(hash, 'hex');
  return want.length === key.length && crypto.timingSafeEqual(want, key);
}
