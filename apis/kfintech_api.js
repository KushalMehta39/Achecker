const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const { spawn } = require('child_process');

// Function to get IPO allocation from KFintech
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
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      executablePath: '/usr/bin/chromium-browser'  // Specify the path to Chromium
  });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  const maxRetries = 3;
  let attempt = 0;
  let captchaText;
  let lastCaptchaText = '';  // Track previous captcha text

  while (attempt < maxRetries) {
      try {
          // Capture and process captcha
          const captchaSelector = 'img#captchaimg';
          await page.waitForSelector(captchaSelector, { timeout: 10000 }); // Increase timeout to 10 seconds
          const captchaImage = await page.$(captchaSelector);

          if (!captchaImage) {
              console.log("Captcha image not found.");
              throw new Error("Captcha image not found.");
          }

          const imageBuffer = await captchaImage.screenshot();
          captchaText = await processCaptchaBuffer(imageBuffer);
          console.log(`Captured Captcha Text for PAN ${panNumber}: ${captchaText}`);

          // Avoid retrying with the same captcha text
          if (captchaText === lastCaptchaText) {
              console.log('Captcha text has not changed. Retrying...');
              attempt++;
              continue;  // Skip this loop and retry captcha
          }

          lastCaptchaText = captchaText; // Update last captcha text

          // Set captcha text in form data
          formData.txt_captcha = captchaText;

          // Get VIEWSTATE and EVENTVALIDATION values
          formData.__VIEWSTATE = await page.$eval('input[name="__VIEWSTATE"]', el => el.value);
          formData.__EVENTVALIDATION = await page.$eval('input[name="__EVENTVALIDATION"]', el => el.value);

          // Submit the form
          const response = await page.evaluate(async (formData) => {
              const response = await fetch('https://kprism.kfintech.com/ipostatus/', {
                  method: 'POST',
                  body: new URLSearchParams(formData),
                  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              });
              return await response.text();
          }, formData);

          // Handle captcha error or incorrect text
          if (!response.includes("invalid captcha")) {
              const $ = cheerio.load(response);
              const name = $('span.qvalue').filter((i, el) => $(el).closest('div').text().includes('Name')).text().trim() || 'Name not found';
              let allottedShares = $('span.qvalue').filter((i, el) => $(el).closest('div').text().includes('Alloted')).text().trim() || 'Allotted shares not found';

              // Handle cases where no data is found
              if (name === 'Name not found' && allottedShares === 'Allotted shares not found') {
                  await page.close();
                  await browser.close();
                  return { name: '', allottedShares: 'Not Applied' };
              }

              // Handle case where allotted shares are 0
              if (allottedShares === '0') {
                  await page.close();
                  await browser.close();
                  return { name, allottedShares: 'Not allotted' };
              }

              // Handle case where shares are allotted
              if (allottedShares) {
                  await page.close();
                  await browser.close();
                  return { name, allottedShares: `${allottedShares} shares allotted` };
              }
          } else {
              console.log(`Captcha attempt ${attempt + 1} failed. Retrying...`);
              attempt++;
          }
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
async function processCaptchaBuffer(imageBuffer) {
    return new Promise((resolve, reject) => {
        console.log('Executing Python script with image buffer');

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

// Export the function for use in the main application
module.exports = { getAllocation };
