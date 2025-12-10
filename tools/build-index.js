#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🦢 Building Goose Sites index...');

// Конфигурация
const SITES_DIR = path.join(__dirname, '../sites');
const OUTPUT_FILE = path.join(__dirname, '../index.json');
const README_FILE = path.join(__dirname, '../README.md');

// Проверяем существует ли папка sites
if (!fs.existsSync(SITES_DIR)) {
    console.log('📁 Creating sites directory...');
    fs.mkdirSync(SITES_DIR, { recursive: true });
}

// Функция для получения информации о сайте
function getSiteInfo(sitePath) {
    try {
        const configPath = path.join(sitePath, 'goose.json');
        const indexPath = path.join(sitePath, 'index.html');
        
        let config = {};
        let hasIndex = false;
        
        // Читаем конфиг
        if (fs.existsSync(configPath)) {
            config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }
        
        // Проверяем наличие index.html
        if (fs.existsSync(indexPath)) {
            hasIndex = true;
            
            // Парсим HTML для получения title и description
            const html = fs.readFileSync(indexPath, 'utf8');
            const titleMatch = html.match(/<title>(.*?)<\/title>/i);
            const descriptionMatch = html.match(/<meta.*?description.*?content="(.*?)"/i);
            
            if (titleMatch && !config.title) {
                config.title = titleMatch[1].replace('| Гусиный Интернет', '').trim();
            }
            
            if (descriptionMatch && !config.description) {
                config.description = descriptionMatch[1];
            }
            
            // Получаем размер файла
            const stats = fs.statSync(indexPath);
            config.size = stats.size;
            config.lastModified = stats.mtime.toISOString();
        }
        
        // Получаем информацию о папке
        const dirName = path.basename(sitePath);
        const [username, siteName] = dirName.split('/').filter(Boolean);
        
        return {
            username: username || 'unknown',
            siteName: siteName || dirName,
            path: dirName,
            url: `https://Goose-Online.github.io/goose-sites/sites/${dirName}/`,
            hasIndex: hasIndex,
            config: config,
            isValid: hasIndex && config.title
        };
    } catch (error) {
        console.error(`Error processing ${sitePath}:`, error.message);
        return null;
    }
}

// Основная функция сборки индекса
async function buildIndex() {
    console.log('🔍 Scanning sites directory...');
    
    const sites = [];
    const users = new Set();
    let totalSites = 0;
    let validSites = 0;
    
    // Рекурсивно сканируем папку sites
    function scanDirectory(dir, depth = 0) {
        const items = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const item of items) {
            const fullPath = path.join(dir, item.name);
            
            if (item.isDirectory()) {
                if (depth === 0) {
                    // Это папка пользователя
                    users.add(item.name);
                    scanDirectory(fullPath, depth + 1);
                } else if (depth === 1) {
                    // Это сайт пользователя
                    totalSites++;
                    const siteInfo = getSiteInfo(fullPath);
                    if (siteInfo) {
                        sites.push(siteInfo);
                        if (siteInfo.isValid) {
                            validSites++;
                        }
                    }
                }
            }
        }
    }
    
    // Запускаем сканирование
    scanDirectory(SITES_DIR);
    
    // Сортируем сайты
    sites.sort((a, b) => {
        if (a.config.created && b.config.created) {
            return new Date(b.config.created) - new Date(a.config.created);
        }
        return a.path.localeCompare(b.path);
    });
    
    // Создаём структуру индекса
    const index = {
        metadata: {
            generatedAt: new Date().toISOString(),
            totalUsers: users.size,
            totalSites: totalSites,
            validSites: validSites,
            version: '1.0.0'
        },
        sites: sites.filter(site => site.isValid)
    };
    
    // Записываем JSON файл
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(index, null, 2));
    console.log(`✅ Index built: ${validSites} valid sites, ${users.size} users`);
    
    // Обновляем README
    updateReadme(index);
    
    return index;
}

// Функция обновления README
function updateReadme(index) {
    let readme = `# 🦢 Goose Sites - Self-Hosted Websites Directory

## 📊 Statistics
- **Total users:** ${index.metadata.totalUsers}
- **Total sites:** ${index.metadata.totalSites}
- **Valid sites:** ${index.metadata.validSites}
- **Last updated:** ${new Date(index.metadata.generatedAt).toLocaleString()}

## 🏆 Recent Sites

| Site | Owner | Description | Created |
|------|-------|-------------|---------|
`;
    
    // Добавляем последние 10 сайтов
    const recentSites = index.sites.slice(0, 10);
    recentSites.forEach(site => {
        const owner = site.username;
        const name = site.config.title || site.siteName;
        const desc = site.config.description ? 
            site.config.description.substring(0, 60) + (site.config.description.length > 60 ? '...' : '') : 
            'No description';
        const created = site.config.created || 'Unknown';
        const url = `[${name}](${site.url})`;
        
        readme += `| ${url} | ${owner} | ${desc} | ${created} |\n`;
    });
    
    readme += `
## 🔗 All Sites

\`\`\`json
${JSON.stringify(index.sites.map(s => ({
    title: s.config.title,
    owner: s.username,
    url: s.url,
    biom: s.config.biom || 'unknown'
})), null, 2)}
\`\`\`

---

*This index is automatically generated by GitHub Actions.*
`;
    
    fs.writeFileSync(README_FILE, readme);
    console.log('📝 README updated');
}

// Запускаем сборку
buildIndex().catch(error => {
    console.error('❌ Error building index:', error);
    process.exit(1);
});
