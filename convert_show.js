const fs = require('fs');
const path = require('path');

/**
 * Converter from FreeShow (.show) to FLOW (.json)
 * Usage: node convert_show.js <input_file.show> [output_file.json]
 */

const inputFile = process.argv[2];
const outputFile = process.argv[3] || inputFile.replace('.show', '.json');

if (!inputFile) {
    console.error("Usage: node convert_show.js <input_file.show> [output_file.json]");
    process.exit(1);
}

try {
    const rawData = fs.readFileSync(inputFile, 'utf-8');
    const data = JSON.parse(rawData);

    // FreeShow format: [id, songData]
    const songData = data[1];
    if (!songData) throw new Error("Invalid .show file format");

    const title = songData.name || path.basename(inputFile, '.show');
    const slidesMap = songData.slides || {};
    
    // Get layout to determine order
    const activeLayoutId = songData.settings?.activeLayout;
    const layout = songData.layouts && activeLayoutId ? songData.layouts[activeLayoutId] : null;
    
    if (!layout || !layout.slides) {
        throw new Error("No active layout found in .show file");
    }

    const lyrics = [];

    function getGroupCode(groupName) {
        if (!groupName) return 'v';
        const lower = groupName.toLowerCase();
        if (lower.includes('verse')) return 'v';
        if (lower.includes('chorus')) return 'c';
        if (lower.includes('ref')) return 'c';
        if (lower.includes('bridge')) return 'b';
        if (lower.includes('intro')) return 'i';
        if (lower.includes('intra')) return 'i';
        if (lower.includes('ending')) return 'e';
        if (lower.includes('outro')) return 'e';
        if (lower.includes('wait')) return 'w';
        if (lower.includes('break')) return 'w';
        return 'v';
    }

    function extractText(slide) {
        if (!slide.items || !Array.isArray(slide.items)) return "";
        // Find item that has 'lines' (usually the first one if type is missing)
        const textItem = slide.items.find(it => it.lines) || slide.items[0];
        if (!textItem || !textItem.lines) return "";
        
        return textItem.lines.map(line => {
            if (!line.text) return "";
            if (typeof line.text === 'string') return line.text;
            // Each line.text is an array of segments (with different styles)
            return line.text.map(segment => segment.value || "").join("");
        }).join("\n").trim();
    }

    let lastType = null;

    function processSlide(id, isRoot = false, parentType = null) {
        const slide = slidesMap[id];
        if (!slide) return;

        // Determine type
        let type = parentType;
        if (slide.globalGroup && slide.globalGroup !== 'null') {
            type = getGroupCode(slide.globalGroup);
        } else if (slide.group && slide.group !== 'null') {
            type = getGroupCode(slide.group);
        }
        if (!type) type = 'v'; // Default

        const text = extractText(slide);
        
        // Only push if there is text (skip empty/wait slides)
        if (text && type !== 'w') {
            // newGroup is true if it's a root slide and either:
            // 1. Type changed from previous root slide
            // 2. It has children (definite start of a section)
            // 3. It's the first slide ever
            let newGroup = false;
            if (isRoot) {
                if (type !== lastType || (slide.children && slide.children.length > 0) || lyrics.length === 0) {
                    newGroup = true;
                }
                lastType = type;
            }

            lyrics.push({
                type: type,
                text: text,
                newGroup: newGroup
            });
        }

        // Process children
        if (slide.children && Array.isArray(slide.children)) {
            slide.children.forEach(childId => {
                processSlide(childId, false, type);
            });
        }
    }

    // Process layout slides in order
    layout.slides.forEach(item => {
        processSlide(item.id, true);
    });

    const output = {
        title: title,
        lyrics: lyrics
    };

    fs.writeFileSync(outputFile, JSON.stringify(output, null, 2), 'utf-8');
    console.log(`Successfully converted ${inputFile} -> ${outputFile}`);
    console.log(`Songs extracted: ${lyrics.length} slides.`);

} catch (err) {
    console.error("Error during conversion:", err.message);
}
