// Sets a new password for a player who forgot theirs. Accounts have no mailbox, so this is
// the only way. Needs a service-account key kept outside the repository:
//
//   $env:GOOGLE_APPLICATION_CREDENTIALS='C:\keys\utreys-admin.json'
//   npm run admin:reset-password -- <login> <new-password>
const fs = require('node:fs');
const { loginEmail, loginError, passwordError } = require('../src/services/login.js');

async function main([login, password]) {
  if (!login || !password) {
    console.error('Usage: npm run admin:reset-password -- <login> <new-password>');
    return 2;
  }
  const error = loginError(login) || passwordError(password);
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
  initializeApp({ credential: applicationDefault(), projectId });
  const auth = getAuth();
  let user;
  try {
    user = await auth.getUserByEmail(loginEmail(login, `${projectId}.firebaseapp.com`));
  } catch (e) {
    if (e?.code === 'auth/user-not-found') {
      console.error(`No player with login «${login}» in project ${projectId}.`);
      return 1;
    }
    throw e;
  }
  await auth.updateUser(user.uid, { password });
  // Signs the player out everywhere: old sessions stop working with the old password.
  await auth.revokeRefreshTokens(user.uid);
  console.log(`Password changed for «${login}» (uid ${user.uid}).`);
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
