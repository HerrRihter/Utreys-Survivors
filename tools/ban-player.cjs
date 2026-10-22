// Bans a player who cheats or abuses the cloud, or lifts the ban. A ban turns the account off
// in Firebase Auth (no new sign-ins, sessions end within the hour), marks banned/{uid} so the
// rules refuse every write at once, and removes the player's leaderboard rows. Their saved
// progress stays. Needs the same service-account key as reset-password.cjs:
//
//   $env:GOOGLE_APPLICATION_CREDENTIALS='C:\keys\utreys-admin.json'
//   npm run admin:ban -- <login> ["reason"]
//   npm run admin:ban -- <login> --unban
const fs = require('node:fs');
const { loginError, loginKey } = require('../src/services/login.js');

async function main(args) {
  const unban = args.includes('--unban');
  const [login, reason = ''] = args.filter((arg) => arg !== '--unban');
  if (!login) {
    console.error('Usage: npm run admin:ban -- <login> ["reason"] | <login> --unban');
    return 2;
  }
  const error = loginError(login);
  if (error) {
    console.error(error);
    return 2;
  }
  const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!keyFile || !fs.existsSync(keyFile)) {
    console.error('Set GOOGLE_APPLICATION_CREDENTIALS to the service-account key file.');
    return 2;
  }
  const { projectId } = JSON.parse(fs.readFileSync(keyFile, 'utf8'));
  const { initializeApp, applicationDefault } = require('firebase-admin/app');
  const { getAuth } = require('firebase-admin/auth');
  const { getFirestore, FieldValue } = require('firebase-admin/firestore');
  initializeApp({ credential: applicationDefault(), projectId });
  const db = getFirestore();
  const owner = await db.doc(`logins/${loginKey(login)}`).get();
  if (!owner.exists) {
    console.error(`No player with login «${login}» in project ${projectId}.`);
    return 1;
  }
  const uid = owner.get('uid');
  const auth = getAuth();
  if (unban) {
    await db.doc(`banned/${uid}`).delete();
    await auth.updateUser(uid, { disabled: false });
    console.log(`Ban lifted for «${login}» (uid ${uid}).`);
    return 0;
  }
  await db.doc(`banned/${uid}`).set({ login, reason, at: FieldValue.serverTimestamp() });
  await db.doc(`stats/${uid}`).delete();
  await auth.updateUser(uid, { disabled: true });
  await auth.revokeRefreshTokens(uid);
  console.log(`Banned «${login}» (uid ${uid}); leaderboard rows removed.`);
  return 0;
}

if (require.main === module)
  main(process.argv.slice(2)).then(
    (code) => (process.exitCode = code),
    (e) => {
      console.error(e?.message || e);
      process.exitCode = 1;
    },
  );

module.exports = { main };
