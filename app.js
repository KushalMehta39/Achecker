const express = require("express");
const fs = require("fs").promises;
const path = require("path");

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

// POST request handler: Get allocation details
app.post("/get-allocation", async (req, res) => {
  try {
    const { panNumber, companyName } = req.body;

    if (!panNumber || !companyName) {
      return res.status(400).json({
        error: "PAN number and company name are required."
      });
    }

    const companiesPath = path.join(__dirname, "apis", "companies.json"); // Updated path
    const companiesData = await fs.readFile(companiesPath, "utf-8");
    const companies = JSON.parse(companiesData);

    const company = companies.find(
      (c) => c.name.toLowerCase() === companyName.toLowerCase()
    );

    if (!company) {
      return res.status(404).json({ error: "Company not found." });
    }

    const { value: cid, registrar } = company;
    console.log(`Found registrar for ${companyName}: ${registrar}`);

    if (!allowedRegistrars.includes(registrar.toLowerCase())) {
      return res.status(400).json({ error: "Invalid registrar specified." });
    }

    const apiPath = path.join(__dirname, "apis", `${registrar.toLowerCase()}_api.js`);
    try {
      delete require.cache[require.resolve(apiPath)];
      const registrarApi = require(apiPath);
      const result = await registrarApi.getAllocation(cid, panNumber);

      // Send a response with the message and company data
      res.json({
        message: "Data fetched and saved successfully",
        companies: companies.map(c => ({
          name: c.name,
          value: c.value,
          registrar: c.registrar
        }))
      });
    } catch (err) {
      console.error(`Error loading registrar API: ${err.message}`);
      res.status(500).json({
        error: `Failed to load or execute registrar API for registrar: ${registrar}`
      });
    }
  } catch (error) {
    console.error(`Server Error: ${error.message}`);
    res.status(500).json({ error: "Internal server error." });
  }
});

// GET request handler: Get all companies
app.get("/get-all-companies", async (req, res) => {
  try {
    const companyListPath = path.join(__dirname, "apis", "companylist.js"); // Updated path

    // Clear cache for live updates
    delete require.cache[require.resolve(companyListPath)];

    // Dynamically load companylist.js
    const companyList = require(companyListPath);

    // Check if the function exists
    if (!companyList.getAllCompanies) {
      throw new Error("getAllCompanies is not a function");
    }

    // Call the function to get company data
    const companies = await companyList.getAllCompanies();

    // Return the data in the desired format
    res.json({
      message: "Data fetched and saved successfully",
      companies: companies
    });
  } catch (error) {
    console.error(`Error fetching companies: ${error.message}`);
    res.status(500).json({ error: "Failed to fetch company list." });
  }
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
