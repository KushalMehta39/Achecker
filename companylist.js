const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');


const app = express();
const PORT = 8080;
// C:\Users\intel\Desktop\Acheckerrr\companies.json
// Path to companies.json file
const filePath = path.join('C:', 'Users', 'intel', 'Desktop', 'Acheckerrr', 'companies.json');


// Function to fetch companies from Bigshare
async function fetchCompaniesFromBigShare() {
    const url = 'https://ipo.bigshareonline.com/IPO_Status.html';

    try {
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);
        const companies = [];

        $('#ddlCompany option').each((_, element) => {
            const value = $(element).attr('value');
            const name = $(element).text().trim();
            if (value && name && name !== '--Select Company--') {
                companies.push({ name, value, registrar: 'Bigshare' });
            }
        });

        return companies;
    } catch (error) {
        console.error('Error fetching companies from BigShare:', error);
        throw new Error('Failed to fetch companies from BigShare');
    }
}

// Function to fetch companies from Cameo
async function fetchCompaniesFromCameo() {
    const url = 'https://ipostatus1.cameoindia.com/';

    try {
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);
        const companies = [];

        $('#drpCompany option').each((_, element) => {
            const value = $(element).attr('value');
            const name = $(element).text().trim();
            if (value && name && name !== '-------  Select Company     -------') {
                companies.push({ name, value, registrar: 'Cameo' });
            }
        });

        return companies;
    } catch (error) {
        console.error('Error fetching companies from Cameo:', error);
        throw new Error('Failed to fetch companies from Cameo');
    }
}

// Function to fetch companies from KFintech
async function fetchCompaniesFromKFintech() {
    const url = 'https://ipostatus.kfintech.com/';

    try {
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);
        const companies = [];

        $('#ddl_ipo option').each((_, element) => {
            const value = $(element).attr('value');
            const name = $(element).text().trim();
            if (value && name && name !== '--Select--') {
                companies.push({ name, value, registrar: 'Kfintech' });
            }
        });

        return companies;
    } catch (error) {
        console.error('Error fetching companies from KFintech:', error);
        throw new Error('Failed to fetch companies from KFintech');
    }
}

// Function to fetch companies from Purva Share
async function fetchCompaniesFromPurvaShare() {
    const url = 'https://www.purvashare.com/investor-service/ipo-query';

    try {
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);
        const companies = [];

        $('#company_id option').each((_, element) => {
            const value = $(element).attr('value');
            const name = $(element).text().trim();

            if (value && name && name !== 'Select Company') {
                companies.push({ name, value, registrar: 'Purva' });
            }
        });

        return companies;
    } catch (error) {
        console.error('Error fetching companies from Purva Share:', error);
        throw new Error('Failed to fetch companies from Purva Share');
    }
}

// Function to fetch companies from KFintech (Alternative URL)
async function fetchCompaniesFromKosmicKFintech() {
    const url = 'https://kosmic.kfintech.com/ipostatus/';

    try {
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);
        const companies = [];

        $('#ddl_ipo option').each((_, element) => {
            const value = $(element).attr('value');
            const name = $(element).text().trim();
            if (value && name && name !== '--Select--') {
                companies.push({ name, value, registrar: 'Kfin2' });
            }
        });

        return companies;
    } catch (error) {
        console.error('Error fetching companies from Kosmic KFintech:', error);
        throw new Error('Failed to fetch companies from Kosmic KFintech');
    }
}

// Function to fetch companies from LinkInTime
async function fetchCompaniesFromLinkInTime() {
    const url = 'https://linkintime.co.in/initial_offer/public-issues.html';

    try {
        const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();

        await page.setRequestInterception(true);
        page.on('request', (request) => {
            if (request.resourceType() === 'image' || request.resourceType() === 'stylesheet') {
                request.abort();
            } else {
                request.continue();
            }
        });

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 5000 });
        await page.waitForSelector('#ddlCompany', { timeout: 3000 });

        const companies = await page.evaluate(() => {
            const options = Array.from(document.querySelectorAll('#ddlCompany option'));
            return options
                .filter(option => option.value !== '0')
                .map(option => ({
                    name: option.textContent.trim(),
                    value: option.value
                }));
        });

        await browser.close();
        
        return companies.map(company => ({ ...company, registrar: 'Linkintime' }));
    } catch (error) {
        console.error('Error fetching companies from LinkInTime:', error);
        throw new Error('Failed to fetch companies from LinkInTime');
    }
}

// Function to fetch companies from Skylinerta
async function fetchCompaniesFromSkylinerta() {
    const url = 'https://www.skylinerta.com/ipo.php';

    try {
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);
        const companies = [];

        $('#company option').each((_, element) => {
            const value = $(element).attr('value');
            const name = $(element).text().trim();

            if (value && name && name !== 'Select Company') {
                companies.push({ name, value, registrar: 'Skylinerta' });
            }
        });

        return companies;
    } catch (error) {
        console.error('Error fetching companies from Skylinerta:', error);
        throw new Error('Failed to fetch companies from Skylinerta');
    }
}

// Function to fetch companies from Maashitla
async function fetchCompaniesFromMaashitla() {
    const url = 'https://maashitla.com/allotment-status/public-issues';

    try {
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);
        const companies = [];

        $('#txtCompany option').each((index, element) => {
            const value = $(element).val();
            const name = $(element).text().trim();

            if (value) {
                companies.push({ name, value, registrar: 'Maashitla' });
            }
        });

        return companies;
    } catch (error) {
        console.error('Error fetching companies from Maashitla:', error);
        throw new Error('Failed to fetch companies from Maashitla');
    }
}

// Combined route to get companies from all sources
app.get('/get-all-companies', async (req, res) => {
    try {
        const [
            bigShareCompanies,
            cameoCompanies,
            kfintechCompanies,
            kosmicKfintechCompanies,
            linkInTimeCompanies,
            purvaShareCompanies,
            skylinertaCompanies,
            maashitlaCompanies
        ] = await Promise.all([
            fetchCompaniesFromBigShare(),
            fetchCompaniesFromCameo(),
            fetchCompaniesFromKFintech(),
            fetchCompaniesFromPurvaShare(),
            fetchCompaniesFromKosmicKFintech(),
            fetchCompaniesFromLinkInTime(),
            fetchCompaniesFromSkylinerta(),
            fetchCompaniesFromMaashitla()
        ]);

        const allCompanies = [
            ...bigShareCompanies,
            ...cameoCompanies,
            ...kfintechCompanies,
            ...kosmicKfintechCompanies,
            ...purvaShareCompanies,
            ...linkInTimeCompanies,
            ...maashitlaCompanies,
            ...skylinertaCompanies
        ];

        // Write data to file (empty and overwrite)
        fs.writeFile(filePath, JSON.stringify(allCompanies, null, 2), (err) => {
            if (err) {
                console.error('Error writing to file:', err);
                return res.status(500).json({ error: 'Failed to save companies data to file' });
            }
            console.log('Companies data successfully saved to companies.json');
            res.status(200).json({ message: 'Data fetched and saved successfully', companies: allCompanies });
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}...`);
});
