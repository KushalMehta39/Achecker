const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const { spawn } = require('child_process');

// Function to get IPO allocation from KFintech
async function getAllocation(cid, panNumber) {
    const url = 'https://kosmic.kfintech.com/ipostatus/';

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

    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    let attempt = 0;
    let captchaText;
    let lastCaptchaText = '';  // Track previous captcha text

    // Retry on captcha failures
    while (attempt < 3) {
        try {
            captchaText = await processCaptcha(page);

            if (captchaText === lastCaptchaText) {
                console.log('Captcha text has not changed. Retrying...');
                attempt++;
                continue;  // Retry with the next captcha
            }

            lastCaptchaText = captchaText; // Update last captcha text

            // Set captcha text in form data
            formData.txt_captcha = captchaText;

            // Fetch VIEWSTATE and EVENTVALIDATION
            formData.__VIEWSTATE = await page.$eval('input[name="__VIEWSTATE"]', el => el.value);
            formData.__EVENTVALIDATION = await page.$eval('input[name="__EVENTVALIDATION"]', el => el.value);

            // Submit the form and get response
            const response = await submitForm(page, formData);

            // Process the response
            const { name, allottedShares } = processResponse(response);

            // Return appropriate result
            if (name === 'Name not found' && allottedShares === 'Allotted shares not found') {
                await page.close();
                await browser.close();
                return { name, allottedShares };
            }

            if (allottedShares === '0') {
                await page.close();
                await browser.close();
                return { name, allottedShares: 'Not allotted' };
            }

            await page.close();
            await browser.close();
            return { name, allottedShares: `${allottedShares} shares allotted` };

        } catch (error) {
            console.error(`Error processing attempt ${attempt + 1}: ${error.message}`);
            attempt++;
        }
    }

    await page.close();
    await browser.close();
    throw new Error('Max captcha attempts reached. Please try again later.');
}

// Function to process the captcha image buffer
async function processCaptcha(page) {
    const captchaSelector = 'img#captchaimg';
    await page.waitForSelector(captchaSelector, { timeout: 5000 });  // Wait for captcha image to load
    const captchaImage = await page.$(captchaSelector);
    const imageBuffer = await captchaImage.screenshot();
    console.log('Executing Python script with image buffer');

    return new Promise((resolve, reject) => {
        const pythonProcess = spawn('python', ['-c', `
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
            reject(`Python script error: ${error}`);
        });

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                reject(`Python script exited with code ${code}`);
            } else {
                resolve(data.trim());
            }
        });
    });
}

// Function to submit the form and get the response
async function submitForm(page, formData) {
    return await page.evaluate(async (formData) => {
        const response = await fetch('https://kosmic.kfintech.com/ipostatus/', {
            method: 'POST',
            body: new URLSearchParams(formData),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
        return await response.text();
    }, formData);
}

// Function to process the form submission response
function processResponse(response) {
    const $ = cheerio.load(response);
    const name = $('span.qvalue').filter((i, el) => $(el).closest('div').text().includes('Name')).text().trim() || 'Name not found';
    const allottedShares = $('span.qvalue').filter((i, el) => $(el).closest('div').text().includes('Alloted')).text().trim() || 'Allotted shares not found';
    return { name, allottedShares };
}

// Export the function for use in the main application
module.exports = { getAllocation };
