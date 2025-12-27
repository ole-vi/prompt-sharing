const fs = require('fs');
const path = require('path');

const PROMPTS_DIR = path.join(__dirname, '../prompts');
const REQUIRED_FIELDS = ['name', 'description', 'version'];

function parseFrontmatter(content) {
  // Use a more robust regex that handles both LF and CRLF
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;

  const frontmatter = {};
  // Split by LF, then handle CR if present
  const lines = match[1].split('\n');

  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith('#')) continue;

    // Split by first colon only
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      // Remove quotes if present
      let value = line.substring(colonIndex + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.substring(1, value.length - 1);
      }
      frontmatter[key] = value;
    }
  }
  return frontmatter;
}

function validateFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const frontmatter = parseFrontmatter(content);

  if (!frontmatter) {
    console.error(`❌ [MISSING FRONTMATTER] ${filePath}`);
    return false;
  }

  let valid = true;
  for (const field of REQUIRED_FIELDS) {
    if (!frontmatter[field]) {
      console.error(`❌ [MISSING FIELD: ${field}] ${filePath}`);
      valid = false;
    }
  }

  if (valid) {
    console.log(`✅ ${filePath}`);
  }
  return valid;
}

function traverseDir(dir) {
  let hasErrors = false;
  let files;
  try {
    files = fs.readdirSync(dir);
  } catch (e) {
    console.warn(`Warning: Could not read directory ${dir}`);
    return false;
  }

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      if (traverseDir(fullPath)) hasErrors = true;
    } else if (file.endsWith('.md')) {
      if (!validateFile(fullPath)) hasErrors = true;
    }
  }
  return hasErrors;
}

console.log('🔍 Starting Prompt Validation...');
const errorsFound = traverseDir(PROMPTS_DIR);

if (errorsFound) {
  console.error('\n⚠️  Validation failed. Some prompts are missing required metadata.');
  process.exit(1);
} else {
  console.log('\n✨ All prompts valid!');
  process.exit(0);
}
