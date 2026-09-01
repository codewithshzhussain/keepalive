const puppeteer = require('puppeteer');
const fs = require('fs');

const DASHBOARD_URL = 'https://captainfbatools.com/amember/member';
const LOGIN_URL = 'https://captainfbatools.com/amember/login';
const COOKIES_FILE = './cookies.json';

async function checkLoggedIn(page) {
    if (page.url().includes('/login')) return false;
    const hasLoginForm = await page.$('input[name="amember_pass"]');
    if (hasLoginForm) return false;
    return page.evaluate(() =>
        /membership information|active subscriptions|logout|dashboard/i.test(document.body.innerText)
    );
}

async function login(page) {
    const user = process.env.TOOLSWALA_USERNAME;
    const pass = process.env.TOOLSWALA_PASSWORD;
    if (!user || !pass) throw new Error('Credentials missing — GitHub Secrets check karein.');
    console.log('DEBUG: username length =', user.length, '| password length =', pass.length);

    const client = await page.target().createCDPSession();
    await client.send('Network.clearBrowserCookies');

    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const userField = await page.$('input[name="amember_login"]')
        || await page.$('.am-row-login-login input');
    const passField = await page.$('input[name="amember_pass"]')
        || await page.$('.am-row-login-pass input[type="password"]');
    if (!userField || !passField) throw new Error('Login fields nahi mile.');

    await userField.click({ clickCount: 3 });
    await userField.type(user, { delay: 30 });
    await passField.click({ clickCount: 3 });
    await passField.type(pass, { delay: 30 });

    const submitBtn = await page.$('.am-row-buttons input[type="submit"]')
        || await page.$('input[type="submit"]')
        || await page.$('button[type="submit"]');
    if (!submitBtn) throw new Error('Login button nahi mila.');

    await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
        submitBtn.click(),
    ]);

    await new Promise(r => setTimeout(r, 4000));

    console.log('DEBUG URL:', page.url());
    const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 400));
    console.log('DEBUG PAGE TEXT:', bodyText);
    console.log('DEBUG COOKIES:', (await page.cookies()).map(c => c.name).join(', '));

    if (!(await checkLoggedIn(page))) {
        throw new Error('Login fail hua — dashboard par nahi pahunche.');
    }
    console.log('Login successful.');
}

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

    if (fs.existsSync(COOKIES_FILE)) {
        try {
            const saved = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'));
            if (Array.isArray(saved) && saved.length) await page.setCookie(...saved);
        } catch (e) {
            console.log('cookies.json corrupt tha — ignore kar diya.');
        }
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
