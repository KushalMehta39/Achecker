const axios = require('axios');
const cheerio = require('cheerio');

// Function to get IPO allocation details from Skylinerta
async function getAllocation(cid, panNumber) {
    const url = 'https://www.skylinerta.com/display_application.php';

    // Prepare the request payload
    const payload = new URLSearchParams({
        client_id: "",
        application_no: "", // Adjust if needed
        pan: panNumber,
        app: cid,
        action: "search",
        image: "Search"
    });

    try {
        // Send the POST request
        const response = await axios.post(url, payload.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        // Load the response data into Cheerio for scraping
        const $ = cheerio.load(response.data);

        // Extract applicant name
        const name = extractApplicantName($);

        // Extract total shares allotted
        const allottedShares = extractAllottedShares($);

        // Handle different output scenarios
        return handleResponse(name, allottedShares);
    } catch (error) {
        console.error('Error fetching IPO data from Skylinerta:', error.message);
        return { error: { message: 'Error fetching IPO data from Skylinerta.' } };
    }
}

// Helper function to extract applicant name
function extractApplicantName($) {
    const nameText = $('p:contains("Applicant Name")').text();
    return nameText ? nameText.split(':').pop().trim() : "";
}

// Helper function to extract allotted shares
function extractAllottedShares($) {
    return $('td').eq(2).text().trim();
}

// Helper function to handle the different output scenarios
function handleResponse(name, allottedShares) {
    if (!name && !allottedShares) {
        // Case 3: Not applied
        return { name: "", allottedShares: "Not applied" };
    } else if (allottedShares === "0") {
        // Case 2: Not allotted
        return { name, allottedShares: "Not allotted" };
    } else {
        // Case 1: Shares allotted
        return { name, allottedShares: `${allottedShares} shares allotted` };
    }
}

// Export the getSkylinertaAllocation function for use in other parts of the application
module.exports = { getAllocation };
