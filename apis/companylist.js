const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');

// Function to fetch companies from BigShare
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
        console.error('Error fetching companies from BigShare:', error.message);
        return [];
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
        console.error('Error fetching companies from Cameo:', error.message);
        return [];
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
        console.error('Error fetching companies from KFintech:', error.message);
        return [];
    }
}

// Function to fetch companies from LinkInTime using Puppeteer
async function fetchCompaniesFromLinkInTime() {
    const url = 'https://linkintime.co.in/initial_offer/public-issues.html';
    try {
        const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
        await page.waitForSelector('#ddlCompany', { timeout: 10000 });

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
        return companies.map(company => ({ ...company, registrar: 'LinkInTime' }));
    } catch (error) {
        console.error('Error fetching companies from LinkInTime:', error.message);
        return [];
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
        console.error('Error fetching companies from Purva Share:', error.message);
        return [];
    }
}

// Function to fetch companies from Maashitla
async function fetchCompaniesFromMaashitla() {
    const url = 'https://maashitla.com/allotment-status/public-issues';
    try {
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);
        const companies = [];
        $('#txtCompany option').each((_, element) => {
            const value = $(element).val();
            const name = $(element).text().trim();
            if (value && name && name !== 'Select Company') {
                companies.push({ name, value, registrar: 'Maashitla' });
            }
        });
        return companies;
    } catch (error) {
        console.error('Error fetching companies from Maashitla:', error.message);
        return [];
    }
}

// Function to get companies from all registrars
async function getAllCompanies() {
    try {
        const registrars = [
            fetchCompaniesFromBigShare,
            fetchCompaniesFromCameo,
            fetchCompaniesFromKFintech,
            fetchCompaniesFromPurvaShare,
            fetchCompaniesFromLinkInTime,
            fetchCompaniesFromMaashitla,
        ];

        const allCompanies = [];
        for (const registrar of registrars) {
            try {
                const companies = await registrar();
                allCompanies.push(...companies);
            } catch (error) {
                console.error(`Registrar fetch failed: ${error.message}`);
            }
        }

        // Print the combined companies data to the console
        console.log(JSON.stringify(allCompanies, null, 2));

        return allCompanies;
    } catch (error) {
        console.error('Error fetching all companies:', error.message);
        return [];
    }
}

module.exports = {
    getAllCompanies
};
