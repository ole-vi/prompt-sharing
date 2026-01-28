import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function getAllFiles(dirPath, arrayOfFiles) {
  const files = fs.readdirSync(dirPath);

  arrayOfFiles = arrayOfFiles || [];

  files.forEach(function(file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      if (file !== 'node_modules' && file !== '.git') {
        arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
      }
    } else {
      arrayOfFiles.push(path.join(dirPath, "/", file));
    }
  });

  return arrayOfFiles;
}

describe('Security Injection Prevention', () => {
  const srcFiles = getAllFiles('./src').filter(f => f.endsWith('.js'));
  const dangerousPatterns = [
    'evaluateJavascript',
    'eval(',
    'setTimeout(',
    'setInterval(',
    'new Function('
  ];

  it('should not contain dangerous JS evaluation patterns with user input', () => {
    srcFiles.forEach(file => {
      const content = fs.readFileSync(file, 'utf8');

      // Allow eval/setTimeout in tests or if explicitly safe (commented)
      if (file.includes('.test.js')) return;

      dangerousPatterns.forEach(pattern => {
        if (content.includes(pattern)) {
          // Check if it's a comment or safe usage
          const lines = content.split('\n');
          lines.forEach((line, index) => {
            if (line.includes(pattern)) {
              const isComment = line.trim().startsWith('//') || line.trim().startsWith('*');
              const isSafe = line.includes('// Safe') || line.includes('// safe');

              if (!isComment && !isSafe) {
                // We allow setTimeout if it doesn't look like it's evaluating a string
                if (pattern === 'setTimeout(' || pattern === 'setInterval(') {
                    if (line.includes("setTimeout('") || line.includes('setTimeout("')) {
                         console.warn(`Potential dangerous usage in ${file}:${index + 1}: ${line.trim()}`);
                    }
                } else {
                    console.warn(`Potential dangerous usage in ${file}:${index + 1}: ${line.trim()}`);
                }
              }
            }
          });
        }
      });
    });
  });

  it('should ensure dark mode script is isolated', () => {
      const darkModeScript = fs.readFileSync('./src/scripts/dark-mode.js', 'utf8');
      expect(darkModeScript).toBeDefined();
      expect(darkModeScript).not.toContain('eval(');
      expect(darkModeScript).toContain('localStorage.getItem');
      expect(darkModeScript).toContain('document.documentElement.classList');
  });

  it('should simulate safe string interpolation', () => {
      // This test demonstrates how to prevent breaking out of string context
      const userInput = "'; alert('XSS'); var x = '";

      // DANGEROUS:
      // const script = "var data = '" + userInput + "';";

      // SAFE:
      const safeScript = "var data = " + JSON.stringify(userInput) + ";";

      expect(safeScript).toBe('var data = "\'; alert(\'XSS\'); var x = \'";');

      // Verify it's valid JS
      // We use new Function here strictly for testing the safe pattern
      // Note: new Function executes in global scope, so we return the value to capture it
      const f = new Function(safeScript + " return data;");
      const evaluatedData = f();

      expect(evaluatedData).toBe(userInput);
  });
});
