const axios = require("axios");
const cheerio = require("cheerio");

async function getAllocation(cid, panNumber) {
  try {
    // Step 1: Get the page HTML to extract the CSRF token
    const pageResponse = await axios.get("https://www.purvashare.com/investor-service/ipo-query");
    const html = pageResponse.data;

    // Step 2: Extract the CSRF token using regex
    const tokenMatch = html.match(/<input type="hidden" name="csrfmiddlewaretoken" value="(.+?)"/);
    const csrfToken = tokenMatch ? tokenMatch[1] : null;

    if (!csrfToken) {
      throw new Error("CSRF token not found!");
    }

    // Step 3: Set up the request payload
    const data = new URLSearchParams();
    data.append("csrfmiddlewaretoken", csrfToken);
    data.append("company_id", cid);
    data.append("applicationNumber", "");
    data.append("panNumber", panNumber);
    data.append("submit", "Search");

    // Step 4: Send the POST request
    const response = await axios.post(
      "https://www.purvashare.com/investor-service/ipo-query",
      data.toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Referer": "https://www.purvashare.com/investor-service/ipo-query",
          "Cookie": `csrftoken=${csrfToken}`, // Send CSRF token in cookies if needed
        },
      }
    );

    // Step 5: Load the response data into Cheerio for parsing
    const $ = cheerio.load(response.data);

    // Step 6: Extract Name and Allotted Shares
    let name = $("table.table-bordered tbody tr td").eq(0).text().trim();
    let allottedShares = $("table.table-bordered tbody tr td").eq(5).text().trim();

    // Handle the case where no data is found or the shares are "0"
    if (allottedShares === "0") {
      allottedShares = "Not allotted";
    } else if (name === "" && allottedShares === "") {
      // Handle case where both name and allotted shares are missing
      name = "";
      allottedShares = "Not applied";
    } else if (allottedShares && allottedShares !== "Not allotted") {
      allottedShares = `${allottedShares} shares allotted`;
    }

    // Return the result in the same format
    return { name, allottedShares };
  } catch (error) {
    console.error("Error fetching IPO data from Purvashare:", error);
    throw new Error("Error fetching IPO data from Purvashare.");
  }
}

// Export the function for use in the main app.js
module.exports = { getAllocation };
