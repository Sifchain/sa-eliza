const fs = require('fs-extra');
const path = require('path');

// Base directory for docs
const DOCS_DIR = path.join(__dirname, 'docs');
const SIDEBAR_PATH = path.join(DOCS_DIR, '_sidebar.md');

// Capitalize folder names
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// Extract H1 from markdown file
function extractTitle(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const match = content.match(/^#\s+(.+)/m);
    return match ? match[1].trim() : path.basename(filePath, '.md');
}

// Recursively build sidebar content
function generateSidebar(dir, prefix = '') {
    const files = fs.readdirSync(dir).sort();
    let content = '';

    files.forEach(file => {
        const fullPath = path.join(dir, file);
        const relativePath = path.relative(DOCS_DIR, fullPath);
        const stat = fs.statSync(fullPath);

        // Exclude files and folders starting with '_'
        if (file.startsWith('_')) {
            return;
        }

        if (file.startsWith() === 'assets') {
            return;
        }

        if (stat.isDirectory()) {
            const sectionName = capitalize(file);
            content += `* [${sectionName}](${prefix}${file}/)\n`;
            content += generateSidebar(fullPath, `${prefix}${file}/`);
        } else if (file.endsWith('.md')) {
            const title = extractTitle(fullPath);
            content += `  * [${title}](${prefix}${file})\n`;
        }
    });

    return content;
}

// Main function to generate sidebar
function buildSidebar() {
    let sidebarContent = '* [Home](/)\n';
    sidebarContent += generateSidebar(DOCS_DIR);
    fs.writeFileSync(SIDEBAR_PATH, sidebarContent);
    console.log('Sidebar generated successfully!');
}

buildSidebar();
