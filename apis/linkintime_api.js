const axios = require('axios');
const xml2js = require('xml2js'); // Make sure to install this package via npm

async function getAllocation(cid, panNumber) {
    const apiUrl = 'https://linkintime.co.in/initial_offer/IPO.aspx/SearchOnPan';
    const requestData = {
        clientid: cid,
        PAN: panNumber,
        IFSC: '',
        CHKVAL: '1',
        token: 'yJIz1+SX026LfHixjJKSLA==' // Ensure this token is valid
    };

    try {
        const response = await axios.post(apiUrl, requestData, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        // Parse XML to JSON
        const parser = new xml2js.Parser();
        const result = await parser.parseStringPromise(response.data.d); // Use parseStringPromise for promise support

        // Log the result to inspect its structure
        // console.log('Link Intime Response:', result); 

        // Check if NewDataSet is empty or not
        if (result && result.NewDataSet && result.NewDataSet.Table && result.NewDataSet.Table.length > 0) {
            const name = result.NewDataSet.Table[0].NAME1 ? result.NewDataSet.Table[0].NAME1[0] : 'Name not found';
            const allot = result.NewDataSet.Table[0].ALLOT ? result.NewDataSet.Table[0].ALLOT[0] : 'Not allotted';

            // Return based on allotted shares
            if (allot === "0") {
                return { name, allottedShares: "Not allotted" };
            } else if (allot === "") {
                return { name: "Not applied", allottedShares: "Not applied" };
            } else {
                return { name, allottedShares: `${allot} shares allotted` };
            }
        } else {
            // If NewDataSet is empty or missing, assume "Not applied"
            return { name: "", allottedShares: "Not applied" };
        }

    } catch (error) {
        console.error('Error making API request to Link Intime:', error.message);
        return { error: {} }; // Return empty error object as per request
    }
}

module.exports = { getAllocation };
