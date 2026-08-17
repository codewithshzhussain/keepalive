const puppeteer = require('puppeteer');
const fs = require('fs');

const DASHBOARD_URL = 'https://members.toolswala.net/member';
const LOGIN_URL = 'https://members.toolswala.net/login';
const COOKIES_FILE = './cookies.json';

async function checkLoggedIn(page) {
    const url = page.url();
    if (url.includes('/login')) return false;

    return page.evaluate(() => {
        return document.body.innerText.includes('subscriptions') ||
               document.body.innerText.includes('Dashboard');
    });
}

async function login(page) {
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('input[type="text"], input[type="email"]', { timeout: 15000 });

    const userField = await page.$('input[type="text"], input[type="email"]');
    await userField.click({ clickCount: 3 });
    await userField.type(process.env.TOOLSWALA_USERNAME, { delay: 30 });

    const passField = await page.$('input[type="password"]');
    await passField.click({ clickCount: 3 });
    await passField.type(process.env.TOOLSWALA_PASSWORD, { delay: 30 });

    await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }),
        page.click('button[type="submit"], input[type="submit"], button'),
    ]);

    const ok = await checkLoggedIn(page);
    if (!ok) throw new Error('Login lagta hai fail hua — dashboard par nahi pahunche.');
    console.log('Login successful.');
}

async function run() {
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    if (fs.existsSync(COOKIES_FILE)) {
        const saved = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'));
        if (Array.isArray(saved) && saved.length) await page.setCookie(...saved);
    }

    await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

    if (await checkLoggedIn(page)) {
        console.log('Still logged in — session refreshed.');
    } else {
        console.log('Not logged in — logging in fresh...');
        await login(page);
    }

    const cookies = await page.cookies();
    fs.writeFileSync(COOKIES_FILE, JSON.stringify(cookies, null, 2));

    await browser.close();
}

run().catch(err => {
    console.error('FAILED:', err.message);
    process.exit(1);
});
