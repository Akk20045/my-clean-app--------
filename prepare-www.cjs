
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('=== Step: Preparing Web App Directory (www) Fast ===');

if (!fs.existsSync('www')) {
  fs.mkdirSync('www', { recursive: true });
}

// 1. Unzip if app-source.zip exists
if (fs.existsSync('app-source.zip')) {
  console.log('Found app-source.zip, unpacking...');
  if (!fs.existsSync('extracted_source')) {
    fs.mkdirSync('extracted_source', { recursive: true });
  }
  try {
    if (process.platform === 'win32') {
      execSync('tar -xf app-source.zip -C extracted_source', { stdio: 'inherit' });
    } else {
      execSync('unzip -q -o app-source.zip -d extracted_source', { stdio: 'inherit' });
    }
  } catch (err) {
    console.warn('Unpack notice:', err.message);
  }

  // Determine root directory inside extracted_source
  let baseContentDir = 'extracted_source';
  const rootItems = fs.readdirSync('extracted_source').filter(n => n !== '__MACOSX' && n !== '.DS_Store');
  if (rootItems.length === 1 && fs.statSync(path.join('extracted_source', rootItems[0])).isDirectory()) {
    baseContentDir = path.join('extracted_source', rootItems[0]);
  }

  // First check if dist or build directory ALREADY exists inside zip to skip npm build completely (saving 5+ mins!)
  let prebuiltDirFound = false;
  const candidateBuildDirs = [
    path.join(baseContentDir, 'dist'),
    path.join(baseContentDir, 'build'),
    path.join(baseContentDir, 'out'),
    path.join('extracted_source', 'dist'),
    path.join('extracted_source', 'build')
  ];

  for (const bDir of candidateBuildDirs) {
    if (fs.existsSync(bDir) && fs.existsSync(path.join(bDir, 'index.html'))) {
      console.log('⚡ Found pre-built directory, copying directly:', bDir);
      fs.cpSync(bDir, 'www', { recursive: true });
      prebuiltDirFound = true;
      break;
    }
  }

  // If no pre-built directory, check if package.json exists to run npm build
  if (!prebuiltDirFound) {
    const pkgPath = path.join(baseContentDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      console.log('Found package.json in:', baseContentDir);
      try {
        process.chdir(baseContentDir);
        console.log('Running npm install...');
        execSync('npm install --legacy-peer-deps --no-audit --prefer-offline', { stdio: 'inherit' });
        console.log('Running build command...');
        execSync('npm run build || npx vite build || npm run generate', { stdio: 'inherit' });
        process.chdir(path.resolve(__dirname));

        for (const bDir of candidateBuildDirs) {
          if (fs.existsSync(bDir) && fs.existsSync(path.join(bDir, 'index.html'))) {
            console.log('Copying built files from:', bDir);
            fs.cpSync(bDir, 'www', { recursive: true });
            prebuiltDirFound = true;
            break;
          }
        }
      } catch (buildErr) {
        console.warn('Build command notice:', buildErr.message);
        process.chdir(path.resolve(__dirname));
      }
    }
  }

  // Fallback: Copy all files from baseContentDir
  if (!prebuiltDirFound) {
    console.log('Copying all source files and folders to www...');
    fs.cpSync(baseContentDir, 'www', { recursive: true });
  }
}

// 2. Ensure index.html exists
const indexPath = path.join('www', 'index.html');
if (!fs.existsSync(indexPath)) {
  console.log('Generating fallback index.html...');
  const fallbackHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <title>تحصيل</title>
  <style>
    body { margin:0; padding:0; background:#4f46e5; font-family:-apple-system,BlinkMacSystemFont,sans-serif; display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; color:#fff; text-align:center; }
    .spinner { width:32px; height:32px; border:3px solid rgba(255,255,255,0.25); border-top-color:#fff; border-radius:50%; animation:spin 0.8s linear infinite; margin-top:16px; }
    @keyframes spin { to { transform:rotate(360deg); } }
  </style>
</head>
<body>
  <h2>تحصيل</h2>
  <div class="spinner"></div>
  
</body>
</html>`;
  fs.writeFileSync(indexPath, fallbackHtml, 'utf8');
} else {
  try {
    let html = fs.readFileSync(indexPath, 'utf8');
    html = html.replace(/<base[^>]+href=["']\/[^"']*["'][^>]*>/gi, '<base href="./">');
    if (!html.includes('viewport')) {
      html = html.replace('<head>', '<head><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">');
    }
    fs.writeFileSync(indexPath, html, 'utf8');
  } catch (e) {}
}

// 3. Create PWA manifest
const manifestPath = path.join('www', 'manifest.json');
const manifestContent = {
  name: "تحصيل",
  short_name: "تحصيل",
  start_url: "./",
  display: "standalone",
  background_color: "#4f46e5",
  theme_color: "#4f46e5",
  icons: [
    {
      src: "icon.png",
      sizes: "512x512",
      type: "image/png"
    }
  ]
};
fs.writeFileSync(manifestPath, JSON.stringify(manifestContent, null, 2), 'utf8');

if (fs.existsSync('assets/icon.png')) {
  try {
    fs.copyFileSync('assets/icon.png', path.join('www', 'icon.png'));
    fs.copyFileSync('assets/icon.png', path.join('www', 'apple-touch-icon.png'));
  } catch (e) {}
}

console.log('=== Web App Directory Ready (www) ===');
