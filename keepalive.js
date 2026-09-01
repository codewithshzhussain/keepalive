const puppeteer = require('puppeteer');
const fs = require('fs');

const DASHBOARD_URL = 'https://members.toolswala.net/member';
const LOGIN_URL = 'https://members.toolswala.net/login';
const COOKIES_FILE = './cookies.json';

async function checkLoggedIn(page) {
    if (page.url().includes('/login')) return false;
    const hasLoginForm = await page.$('input[type="submit"][value="Login"]');
    if (hasLoginForm) return false;
    return page.evaluate(() =>
        /dashboard|subscriptions|tool library|logout/i.test(document.body.innerText)
    );
}

async function login(page) {
    const user = process.env.TOOLSWALA_USERNAME;
    const pass = process.env.TOOLSWALA_PASSWORD;
    if (!user || !pass) throw new Error('Credentials missing — GitHub Secrets check karein.');
    console.log('DEBUG: username length =', user.length, '| password length =', pass.length);

    // Purani/dead cookies clear karein taake session mismatch na ho
    const client = await page.target().createCDPSession();
    await client.send('Network.clearBrowserCookies');

    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const captchaVisible = await page.evaluate(() => {
        const el = document.querySelector('#login-recaptcha-row');
        return el && window.getComputedStyle(el).display !== 'none';
    });
    if (captchaVisible) {
        throw new Error('reCAPTCHA active ho gaya — manually login kar ke reset karein.');
    }

    const userField = await page.$('.am-row-login-login input');
    const passField = await page.$('.am-row-login-pass input[type="password"]');
    if (!userField || !passField) throw new Error('Login fields nahi mile — page structure badal gaya.');

    await userField.click({
