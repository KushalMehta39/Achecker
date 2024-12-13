const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const { spawn } = require('child_process');
const { exec } = require('child_process');

/**
 * Function to get IPO allocation from KFintech.
 * @param {string} cid - Company ID.
 * @param {string} panNumber - PAN number.
 * @returns {Promise<Object>} - IPO allocation details.
 */
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
        "txt_conf_pan": "",
        "_h_query": "pan",
        "encrypt_payload": "N",
        "req_src": ""
    };

    const browser = await puppeteer.launch({
        headless: true, // Ensure it's in headless mode
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--remote-debugging-port=9222']
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    const maxRetries = 3;
    let attempt = 0;
    let captchaText;
    let lastCaptchaText = '';

    while (attempt < maxRetries) {
        try {
            const captchaSelector = 'img#captchaimg';
            await page.waitForSelector(captchaSelector, { timeout: 10000 });

            const captchaImage = await page.$(captchaSelector);
            if (!captchaImage) {
                throw new Error('Captcha image not found.');
            }

            const imageBuffer = await captchaImage.screenshot();
            captchaText = await processCaptchaBuffer(imageBuffer);

            // Retry logic if captcha text is the same as last time
            if (captchaText === lastCaptchaText) {
                console.log('Captcha text has not changed. Retrying...');
                await page.waitForTimeout(2000); // Small delay before retrying
                attempt++;
                continue;
            }

            lastCaptchaText = captchaText;
            formData.txt_captcha = captchaText;
            formData.__VIEWSTATE = await page.$eval('input[name="__VIEWSTATE"]', el => el.value);
            formData.__EVENTVALIDATION = await page.$eval('input[name="__EVENTVALIDATION"]', el => el.value);

            // Sending the form data after captcha solving
            const response = await page.evaluate(async (formData) => {
                const res = await fetch('https://kprism.kfintech.com/ipostatus/', {
                    method: 'POST',
                    body: new URLSearchParams(formData),
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                });
                return await res.text();
            }, formData);

            // If captcha is successful, parse the result
            if (!response.includes('invalid captcha')) {
                const $ = cheerio.load(response);
                const name = $('span.qvalue').filter((i, el) => $(el).closest('div').text().includes('Name')).text().trim() || 'Name not found';
                const allottedShares = $('span.qvalue').filter((i, el) => $(el).closest('div').text().includes('Alloted')).text().trim() || 'Allotted shares not found';

                await browser.close();
                if (name === 'Name not found' && allottedShares === 'Allotted shares not found') {
                    return { name: '', allottedShares: 'Not Applied' };
                }

                return {
                    name,
                    allottedShares: allottedShares === '0' ? 'Not allotted' : `${allottedShares} shares allotted`,
                };
            } else {
                console.log(`Captcha attempt ${attempt + 1} failed. Retrying...`);
                await page.waitForTimeout(2000); // Delay before retrying
                attempt++;
            }
        } catch (error) {
            console.error(`Error in attempt ${attempt + 1}: ${error.message}`);
            await page.waitForTimeout(2000); // Delay before retrying
            attempt++;
        }
    }

    await browser.close();
    throw new Error('Max captcha attempts reached. Please try again later.');
}

/**
 * Function to process captcha image buffer.
 * @param {Buffer} imageBuffer - Captcha image buffer.
 * @returns {Promise<string>} - Captcha text.
 */
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

        let data = '';
        pythonProcess.stdout.on('data', (chunk) => {
            data += chunk.toString();
        });

        pythonProcess.stderr.on('data', (error) => {
            console.error(`Python script error: ${error}`);
            reject(error);
        });

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`Python script exited with code ${code}`));
            } else {
                resolve(data.trim());
            }
        });
    });
}

// Launch with xvfb
exec('xvfb-run node your-script.js', (error, stdout, stderr) => {
    if (error) {
        console.error(`exec error: ${error}`);
        return;
    }
    console.log(`stdout: ${stdout}`);
    console.error(`stderr: ${stderr}`);
});

module.exports = { getAllocation };
