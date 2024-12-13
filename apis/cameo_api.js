const axios = require('axios');
const https = require('https');

async function getAllocation(cid, panNumber) {
    const postData = {
        code: cid,
        type: 'pan',
        value: panNumber
    };

    const agent = new https.Agent({
        rejectUnauthorized: false // Disable SSL certificate verification
    });

    try {
        const response = await axios.post('https://ipostatus1.cameoindia.com/', postData, {
            headers: {
                'Content-Type': 'application/json'
            },
            httpsAgent: agent
        });

        console.log('Cameo response:', response.data);

        if (response.data && Array.isArray(response.data) && response.data.length > 0) {
            const { holder: name, allotedShares } = response.data[0];
            return { name, allottedShares: allotedShares };
        } else {
            console.error('Response data format is not as expected:', response.data);
            return { name: "Not found", allottedShares: "Not found" };
        }
    } catch (error) {
        console.error('Error fetching IPO data from Cameo:', error);
        throw new Error('Error fetching IPO data from Cameo.');
    }
}

module.exports = {
    getAllocation
};
