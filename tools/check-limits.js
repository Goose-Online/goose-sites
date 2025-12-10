#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('📏 Checking storage limits...');

const SITES_DIR = path.join(__dirname, '../sites');
const MAX_SIZE_MB = 50; // Максимальный размер сайта в МБ
const MAX_TOTAL_MB = 1000; // Максимальный общий размер

// Функция для получения размера папки
function getFolderSize(folderPath) {
    let totalSize = 0;
    
    function scan(currentPath) {
        const items = fs.readdirSync(currentPath, { withFileTypes: true });
        
        for (const item of items) {
            const fullPath = path.join(currentPath, item.name);
            
            if (item.isFile()) {
                const stats = fs.statSync(fullPath);
                totalSize += stats.size;
            } else if (item.isDirectory()) {
                scan(fullPath);
            }
        }
    }
    
    if (fs.existsSync(folderPath)) {
        scan(folderPath);
    }
    
    return totalSize / 1024 / 1024; // Конвертируем в МБ
}

// Основная функция проверки
async function checkLimits() {
    console.log('🔍 Checking site sizes...');
    
    const users = fs.readdirSync(SITES_DIR, { withFileTypes: true })
        .filter(item => item.isDirectory())
        .map(dir => dir.name);
    
    const violations = [];
    let totalUsed = 0;
    
    for (const user of users) {
        const userPath = path.join(SITES_DIR, user);
        const userSites = fs.readdirSync(userPath, { withFileTypes: true })
            .filter(item => item.isDirectory())
            .map(dir => dir.name);
        
        for (const site of userSites) {
            const sitePath = path.join(userPath, site);
            const sizeMB = getFolderSize(sitePath);
            totalUsed += sizeMB;
            
            if (sizeMB > MAX_SIZE_MB) {
                violations.push({
                    user,
                    site,
                    size: sizeMB.toFixed(2),
                    limit: MAX_SIZE_MB,
                    path: `sites/${user}/${site}`
                });
            }
            
            console.log(`  ${user}/${site}: ${sizeMB.toFixed(2)} MB`);
        }
    }
    
    // Проверка общего размера
    if (totalUsed > MAX_TOTAL_MB) {
        violations.push({
            type: 'total_limit',
            total: totalUsed.toFixed(2),
            limit: MAX_TOTAL_MB
        });
    }
    
    // Вывод результатов
    console.log(`\n📊 Summary:`);
    console.log(`  Total users: ${users.length}`);
    console.log(`  Total storage used: ${totalUsed.toFixed(2)} MB`);
    console.log(`  Storage limit: ${MAX_TOTAL_MB} MB`);
    
    if (violations.length > 0) {
        console.log('\n⚠️  Violations found:');
        violations.forEach(v => {
            if (v.type === 'total_limit') {
                console.log(`  ❌ Total storage exceeded: ${v.total} MB > ${v.limit} MB`);
            } else {
                console.log(`  ❌ ${v.path}: ${v.size} MB > ${v.limit} MB`);
            }
        });
        
        // Записываем в файл для GitHub Actions
        fs.writeFileSync(
            path.join(__dirname, '../violations.json'),
            JSON.stringify(violations, null, 2)
        );
        
        process.exit(1); // Фейлим сборку при нарушениях
    } else {
        console.log('✅ All limits are satisfied');
        process.exit(0);
    }
}

// Запускаем проверку
checkLimits().catch(error => {
    console.error('❌ Error checking limits:', error);
    process.exit(1);
});
