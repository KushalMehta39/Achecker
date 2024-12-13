const express = require("express");
const fs = require("fs").promises;
const path = require("path");


const app = express();
app.use(express.json());

// Whitelist of allowed registrars
const allowedRegistrars = ["bigshare", "cameo", "kfintech", "purva", "kfin2", "skylinerta", "linkintime", "maashitla"];

app.post("/get-allocation", async (req, res) => {
  try {
    const { panNumber, companyName } = req.body;

    if (!panNumber || !companyName) {
      return res.status(400).json({ error: "PAN number and company name are required." });
    }

    // Step 1: Load companies.json
    const companies = JSON.parse(await fs.readFile("companies.json", "utf-8"));

    // Step 2: Find the company details
    const company = companies.find(
      (c) => c.name.toLowerCase() === companyName.toLowerCase()
    );

    if (!company) {
      return res.status(404).json({ error: "Company not found." });
    }

    const { value: cid, registrar } = company;

    // Step 3: Validate registrar
    if (!allowedRegistrars.includes(registrar.toLowerCase())) {
      return res.status(400).json({ error: "Invalid registrar specified." });
    }

    // Step 4: Dynamically load the registrar API with cache clearing
    const apiPath = path.join(__dirname, "apis", `${registrar.toLowerCase()}_api.js`);

    try {
      // Clear module cache for live reloading
      delete require.cache[require.resolve(apiPath)];

      // Load the latest version of the API module
      const registrarApi = require(apiPath);

      // Step 5: Call the API with CID and PAN number
      const result = await registrarApi.getAllocation(cid, panNumber);  // Same call for every registrar

      // Step 6: Send the response
      res.json({ status: "success", data: result });
    } catch (err) {
      console.error(`Error loading registrar API: ${err.message}`);
      res.status(500).json({ error: `Failed to load registrar API: ${registrar}` });
    }
  } catch (error) {
    console.error(`Server Error: ${error.message}`);
    res.status(500).json({ error: "Internal server error." });
  }
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
