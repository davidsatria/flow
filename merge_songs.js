const fs = require('fs');
const path = require('path');

const songsDir = 'c:/Users/david/OneDrive/Documents/FLOW/FLOW 0.5.41/DATA/songs';
const outputFile = 'c:/Users/david/OneDrive/Documents/FLOW/FLOW 0.5.41/DATA/songs.json';

if (!fs.existsSync(songsDir)) {
    console.error("Songs directory not found!");
    process.exit(1);
}

const files = fs.readdirSync(songsDir).filter(f => f.endsWith('.json'));
console.log(`Merging ${files.length} song files...`);

const allSongs = [];

files.forEach(f => {
    try {
        const content = fs.readFileSync(path.join(songsDir, f), 'utf-8');
        const songObj = JSON.parse(content);
        if (songObj.title && songObj.lyrics) {
            allSongs.push(songObj);
        }
    } catch (e) {
        console.error(`Error reading ${f}:`, e.message);
    }
});

fs.writeFileSync(outputFile, JSON.stringify(allSongs, null, 2), 'utf-8');
console.log(`Success! Merged ${allSongs.length} songs into ${outputFile}`);
