const puppeteer = require('puppeteer');
const fs = require('fs');

const DASHBOARD_URL = 'https://captainfbatools.com/amember/member';
const COOKIES_FILE = './cookies.json';

async function run() {
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

    const saved = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'));
    if (!Array.isArray(saved) || !saved.length) {
        throw new Error('cookies.json khali hai — browser se cookies daalein.');
    }
    await page.setCookie(...saved);

    await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

    console.log('URL:', page.url());
    const text = await page.evaluate(() => document.body.innerText.slice(0, 300));
    console.log('PAGE TEXT:', text);

    const loggedIn = !page.url().includes('/login')
        && !(await page.$('input[name="amember_pass"]'));

    if (loggedIn) {
        console.log('SUCCESS — session zinda hai, refresh ho gaya.');
        const cookies = await page.cookies();
        fs.writeFileSync(COOKIES_FILE, JSON.stringify(cookies, null, 2));
    } else {
        console.log('SESSION DEAD — cookies kaam nahi kar rahi (IP binding ho sakti hai).');
    }

    await browser.close();
    if (!loggedIn) process.exit(1);
}

run().catch(err => {
    console.error('FAILED:', err.message);
    process.exit(1);
});
