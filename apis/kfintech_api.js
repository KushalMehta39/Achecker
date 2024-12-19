const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const { spawn } = require('child_process');

async function getAllocation(cid, panNumber) {
    const url = 'https://kprism.kfintech.com/ipostatus/';

    const formData = {
        "__EVENTTARGET": "btn_submit_query",
        "__EVENTARGUMENT": "",
        "__LASTFOCUS": "",
        "__VIEWSTATE": "",
        "__VIEWSTATEGENERATOR": "7CE23556",
        "__VIEWSTATEENCRYPTED": "",
        "__EVENTVALIDATION": "",
        "chkOnOff": "on",
        "ddl_ipo": cid,
        "query": "pan",
        "txt_applno": "",
        "ddl_depository": "N",
        "txt_nsdl_dpid": "",
        "txt_nsdl_clid": "",
        "txt_cdsl_clid": "",
        "txt_pan": panNumber,
        "txt_captcha": "",
        "_h_query": "pan",
        "encrypt_payload": "N",
        "req_src": ""
    };

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        executablePath: '/usr/bin/chromium-browser'
    });
    let page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    const maxRetries = 2;
    let attempts = 0;

    while (attempts < maxRetries) {
        try {
            const captchaSelector = 'img#captchaimg';
            await page.waitForSelector(captchaSelector, { timeout: 5000 });
            const captchaImage = await page.$(captchaSelector);

            if (!captchaImage) throw new Error("Captcha image not found.");

            const imageBuffer = await captchaImage.screenshot();
            const captchaText = await processCaptchaBuffer(imageBuffer);
            console.log(`Captcha for PAN ${panNumber}: ${captchaText}`);

            formData.txt_captcha = captchaText;
            formData.__VIEWSTATE = await page.$eval('input[name="__VIEWSTATE"]', el => el.value);
            formData.__EVENTVALIDATION = await page.$eval('input[name="__EVENTVALIDATION"]', el => el.value);

            const response = await page.evaluate(async (formData) => {
                const resp = await fetch('https://kprism.kfintech.com/ipostatus/', {
                    method: 'POST',
                    body: new URLSearchParams(formData),
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                });
                return await resp.text();
            }, formData);

            const $ = cheerio.load(response);
            const errorScript = $('script[type="text/javascript"]').text();

            if (errorScript.includes("CAPTCHA is invalid or Expired")) {
                console.log("Invalid captcha. Retrying...");
                attempts++;
                await page.reload({ waitUntil: 'domcontentloaded' });
                continue;
            }

            if (errorScript.includes("PAN details  not available.")) {
                console.log("No data available for PAN.");
                await browser.close();
                return {
                    name: '',
                    allottedShares: "Not Applied"
                };
            }

            const name = $('span.qvalue').filter((_, el) => $(el).closest('div').text().includes('Name')).text().trim() || 'Name not found';
            const allottedShares = $('span.qvalue').filter((_, el) => $(el).closest('div').text().includes('Alloted')).text().trim() || '0';

            await browser.close();
            return {
                name,
                allottedShares: allottedShares === '0' ? 'Not allotted' : `${allottedShares} shares allotted`
            };
        } catch (error) {
            console.error(`Attempt ${attempts + 1} failed for PAN ${panNumber}: ${error.message}`);
        }
    }

    await browser.close();

    // Return response after all retries fail
    return {
                status: "error",
                message: "Retry"
        } 
    };

async function processCaptchaBuffer(imageBuffer) {
    return new Promise((resolve, reject) => {
        const pythonProcess = spawn('python3', ['-c', `
import sys
import cv2
import numpy as np
import pytesseract

image_bytes = sys.stdin.buffer.read()
nparr = np.frombuffer(image_bytes, np.uint8)
frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
_, binary = cv2.threshold(gray, 150, 255, cv2.THRESH_BINARY_INV)
kernel = np.ones((2, 2), np.uint8)
cleaned = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)

custom_config = r'--oem 3 --psm 6 outputbase digits'
text = pytesseract.image_to_string(cleaned, config=custom_config)
print(''.join(filter(str.isdigit, text.strip())))
`]);

        pythonProcess.stdin.write(imageBuffer);
        pythonProcess.stdin.end();

        let result = '';
        pythonProcess.stdout.on('data', (chunk) => {
            result += chunk.toString();
        });

        pythonProcess.stderr.on('data', (error) => {
            console.error(`Captcha processing error: ${error}`);
            reject(error);
        });

        pythonProcess.on('close', (code) => {
            if (code !== 0) reject(`Python process exited with code ${code}`);
            else resolve(result.trim());
        });
    });
}

module.exports = { getAllocation };
