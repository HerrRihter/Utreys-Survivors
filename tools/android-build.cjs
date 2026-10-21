// Builds the Android app: the web game (vite build), copied into android/ (cap sync), then an
// APK by Gradle. docs/ANDROID.md.
//
//   npm run android:apk              debug APK, installs over itself on one computer
//   npm run android:apk -- release   signed APK to hand out (needs android/keystore.properties)
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const android = path.join(root, 'android');
const windows = process.platform === 'win32';

function run(command, args, options = {}) {
  const line = [command, ...args].join(' ');
  console.log('> ' + line);
  // npm, npx and gradlew.bat are scripts that Windows runs only through the shell. The
  // arguments are this file's own, so one command line is safe.
  const result = windows
    ? spawnSync(line, { stdio: 'inherit', shell: true, ...options })
    : spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.status !== 0) throw new Error(`${command} failed`);
}

// Gradle needs a JDK and the Android SDK; Android Studio brings both.
function toolchain() {
  const env = { ...process.env };
  const studio = 'C:\\Program Files\\Android\\Android Studio\\jbr';
  if (!env.JAVA_HOME && windows && fs.existsSync(studio)) env.JAVA_HOME = studio;
  // Java on Windows opens its internal pipes as sockets in %TEMP%; where it may not, Gradle
  // stops with «Unable to establish loopback connection». A folder of our own avoids that.
  if (windows && !/unixdomain\.tmpdir/.test(env.JAVA_TOOL_OPTIONS || '')) {
    const tmp = path.join(android, '.gradle', 'java-tmp');
    fs.mkdirSync(tmp, { recursive: true });
    env.JAVA_TOOL_OPTIONS =
      `${env.JAVA_TOOL_OPTIONS || ''} -Djdk.net.unixdomain.tmpdir=${tmp}`.trim();
  }
  const local = path.join(android, 'local.properties');
  if (!env.ANDROID_HOME && !fs.existsSync(local)) {
    const sdk = windows
      ? path.join(env.LOCALAPPDATA || '', 'Android', 'Sdk')
      : path.join(env.HOME || '', 'Android', 'Sdk');
    if (!fs.existsSync(sdk))
      throw new Error(
        'Android SDK not found: open Android Studio once to install it, or set ANDROID_HOME.',
      );
    env.ANDROID_HOME = sdk;
  }
  return env;
}

async function main([kind = 'debug']) {
  if (kind !== 'debug' && kind !== 'release') {
    console.error('Usage: npm run android:apk -- [debug|release]');
    return 2;
  }
  // The APK takes the same Firebase project as the site (.env.local), never the emulators.
  const { loadEnv } = await import('vite');
  const env = loadEnv('production', root, 'VITE_');
  if (env.VITE_FIREBASE_EMULATOR) {
    console.error('VITE_FIREBASE_EMULATOR is set: the APK would look for Firebase on this PC.');
    return 2;
  }
  if (!env.VITE_FIREBASE_API_KEY)
    console.warn('No VITE_FIREBASE_* in .env.local: the APK will play without cloud saves.');
  if (kind === 'release' && !fs.existsSync(path.join(android, 'keystore.properties'))) {
    console.error('android/keystore.properties is missing: see docs/ANDROID.md, «Подпись».');
    return 2;
  }
  const gradleEnv = toolchain();
  run('npm', ['run', 'build'], { cwd: root });
  run('npx', ['cap', 'sync', 'android'], { cwd: root });
  const task = kind === 'release' ? 'assembleRelease' : 'assembleDebug';
  run(path.join(android, windows ? 'gradlew.bat' : 'gradlew'), [task], {
    cwd: android,
    env: gradleEnv,
  });
  const apk = path.join(android, 'app', 'build', 'outputs', 'apk', kind);
  const files = fs.existsSync(apk) ? fs.readdirSync(apk).filter((f) => f.endsWith('.apk')) : [];
  for (const file of files) console.log('APK: ' + path.join(apk, file));
  return files.length ? 0 : 1;
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
