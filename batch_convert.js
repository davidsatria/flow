const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Batch convert FreeShow (.show) files to FLOW (.json) format.
 * Target folder: DATA/songs
 */

const srcDir = 'c:/Users/david/OneDrive/Documents/FreeShow/Shows';
const destDir = 'c:/Users/david/OneDrive/Documents/FLOW/FLOW 0.5.41/DATA/songs';
const scriptPath = 'c:/Users/david/OneDrive/Documents/FLOW/FLOW 0.5.41/convert_show.js';

if (!fs.existsSync(destDir)) {
    console.log(`Creating directory: ${destDir}`);
    fs.mkdirSync(destDir, { recursive: true });
}

console.log(`Searching for .show files in: ${srcDir}...`);
const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.show'));
console.log(`Found ${files.length} files. Starting batch conversion.`);

let successCount = 0;
let errorCount = 0;

files.forEach((f, i) => {
    try {
        const input = path.join(srcDir, f);
        const output = path.join(destDir, f.replace('.show', '.json'));
        
        // Use child_process to run the existing conversion script
        execSync(`node "${scriptPath}" "${input}" "${output}"`, { stdio: 'ignore' });
        
        successCount++;
        if (successCount % 50 === 0 || successCount === files.length) {
            process.stdout.write(`Progress: ${successCount}/${files.length} converted.\r`);
        }
    } catch (e) {
        console.error(`\nError converting [${f}]:`, e.message);
        errorCount++;
    }
});

console.log(`\n\nConversion complete!`);
console.log(`Total: ${files.length}`);
console.log(`Success: ${successCount}`);
console.log(`Errors: ${errorCount}`);
console.log(`Check results in: ${destDir}`);
