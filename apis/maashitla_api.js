const fetch = require('node-fetch'); // Make sure you have 'node-fetch' installed

async function getAllocation(cid, panNumber) {
    const baseUrl = 'https://maashitla.com/';

    try {
        // Step 1: Fetch public issues
        const publicIssuesResponse = await fetch(`${baseUrl}allotment-status/public-issues`);
        if (!publicIssuesResponse.ok) {
            throw new Error(`Failed to fetch public issues: ${publicIssuesResponse.statusText}`);
        }

        // Step 2: Fetch search results for company ID (CID) and PAN number
        const searchUrl = `${baseUrl}PublicIssues/Search?company=${cid}&search=${panNumber}`;
        const searchResponse = await fetch(searchUrl);
        if (!searchResponse.ok) {
            throw new Error(`Failed to fetch search results: ${searchResponse.statusText}`);
        }

        // Step 3: Parse the response JSON
        const searchData = await searchResponse.json();

        // Step 4: Extract and handle response data
        const name = searchData.name || ""; // Default to empty string if 'name' is missing
        const sharesAllotted = searchData.share_Alloted || "0"; // Default to '0' if 'share_Alloted' is missing

        if (name === "" && sharesAllotted === "0") {
            // Scenario 3: Not applied
            return { name: "", allottedShares: "Not applied" };
        } else if (sharesAllotted === "0") {
            // Scenario 2: Not allotted
            return { name, allottedShares: "Not allotted" };
        } else {
            // Scenario 1: Shares allotted
            return { name, allottedShares: `${sharesAllotted} shares allotted` };
        }

    } catch (error) {
        console.error('Error fetching allotment status:', error.message);
        return { error: { message: error.message } }; // Return error object
    }
}

module.exports = { getAllocation };
