const express = require("express");
const fs = require("fs").promises;
const path = require("path");
const { validatePanNumber } = require("./utils/validation");  // Add validation utility

const app = express();
app.use(express.json());

// Whitelist of allowed registrars
const allowedRegistrars = [
  "bigshare",
  "cameo",
  "kfintech",
  "purva",
  "kfin2",
  "skylinerta",
  "linkintime",
  "maashitla"
];

// Centralized error handler
function handleError(res, message, statusCode = 500) {
  console.error(message);
  res.status(statusCode).json({ error: message });
}

// POST request handler: Get allocation details
app.post("/get-allocation", async (req, res) => {
  try {
    const { panNumber, companyName } = req.body;

    if (!panNumber || !companyName) {
      return handleError(res, "PAN number and company name are required.", 400);
    }

    // Validate PAN number format (you could use a regex or a library)
    if (!validatePanNumber(panNumber)) {
      return handleError(res, "Invalid PAN number format.", 400);
    }

    const companiesPath = path.join(__dirname, "apis", "companies.json"); // Updated path
    let companies = [];

    try {
      const companiesData = await fs.readFile(companiesPath, "utf-8");
      companies = JSON.parse(companiesData);
    } catch (err) {
      return handleError(res, "Error reading companies data.", 500);
    }

    const company = companies.find(
      (c) => c.name.toLowerCase() === companyName.toLowerCase()
    );

    if (!company) {
      return handleError(res, "Company not found.", 404);
    }

    const { value: cid, registrar } = company;
    console.log(`Found registrar for ${companyName}: ${registrar}`);

    if (!allowedRegistrars.includes(registrar.toLowerCase())) {
      return handleError(res, "Invalid registrar specified.", 400);
    }

    const apiPath = path.join(__dirname, "apis", `${registrar.toLowerCase()}_api.js`);
    try {
      delete require.cache[require.resolve(apiPath)];
      const registrarApi = require(apiPath);
      const result = await registrarApi.getAllocation(cid, panNumber);
      res.json({ status: "success", data: result });
    } catch (err) {
      return handleError(res, `Failed to load or execute registrar API: ${err.message}`, 500);
    }
  } catch (error) {
    return handleError(res, `Server Error: ${error.message}`);
  }
});

// GET request handler: Get all companies
app.get("/get-all-companies", async (req, res) => {
  try {
    const companyListPath = path.join(__dirname, "apis", "companylist.js");

    // Clear cache for live updates
    delete require.cache[require.resolve(companyListPath)];

    // Dynamically load companylist.js
    const companyList = require(companyListPath);

    // Call the function to get company data
    const companies = await companyList.getAllCompanies();

    // Send the fetched companies data in the response
    res.json({
      message: "Data fetched and saved successfully",
      data: companies
    });
  } catch (error) {
    return handleError(res, 'Failed to fetch company list.', 500);
  }
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
