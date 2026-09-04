const puppeteer = require('puppeteer');
const fs = require('fs');

const DASHBOARD_URL = 'https://captainfbatools.com/amember/member';
const COOKIES_FILE = './cookies.json';
const NEEDED = ['PHPSESSID', 'amember_nr'];

function loadCookies() {
    const raw = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'));
    if (!Array.isArray(raw)) throw new Error('cookies.json ek array hona chahiye.');

    const cleaned = raw
        .filter(c => NEEDED.includes(c.name))
        .map(c => {
            const out = {
                name: c.name,
                value: c.value,
                domain: c.domain || '.captainfbatools.com',
                path: c.path || '/',
                httpOnly: c.httpOnly !== false,
                secure: c.secure !== false,
            };
            if (c.expirationDate) out.expires = Math.floor(c.expirationDate);
            return out;
        });

    const found = cleaned.map(c => c.name);
    for (const n of NEEDED) {
        if (!found.includes(n)) throw new Error(`Cookie "${n}" nahi mili — dobara export karein.`);
    }
    console.log('Cookies loaded:', found.join(', '));
    return cleaned;
}

async function run() {
    const cookies = loadCookies();

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    await page.setRequestInterception(true);
    page.on('request', req => {
        if (req.url().includes('disable-devtool')) req.abort();
        else req.continue();
    });

    await page.setCookie(...cookies);
    await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

    console.log('URL:', page.url());

    const loggedIn = !page.url().includes('/login')
        && !(await page.$('input[name="amember_pass"]'));

    if (loggedIn) {
        console.log('SUCCESS — session zinda hai, refresh ho gaya.');
        const fresh = (await page.cookies()).filter(c => NEEDED.includes(c.name));
        fs.writeFileSync(COOKIES_FILE, JSON.stringify(fresh, null, 2));
    } else {
        console.log('SESSION DEAD — browser se nayi cookies export kar ke daalein.');
    }

    await browser.close();
    if (!loggedIn) process.exit(1);
}

run().catch(err => {
    console.error('FAILED:', err.message);
    process.exit(1);
});
