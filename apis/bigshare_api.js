const axios = require('axios');

// Function to fetch IPO details from BigShare
module.exports.getAllocation = async (cid, panNumber) => {
    // Validate input
    if (!panNumber || !cid) {
        throw new Error('PAN number and Company ID (CID) are required.');
    }

    // Request payload
    const postData = {
        Applicationno: '',
        Company: cid,
        SelectionType: 'PN',
        PanNo: panNumber,
        txtcsdl: '',
        txtDPID: '',
        txtClId: '',
        ddlType: ''
    };

    try {
        // Send request to BigShare's endpoint
        const response = await axios.post(
            'https://ipo1.bigshareonline.com/Data.aspx/FetchIpodetails',
            postData,
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        // Check for response and extract data
        if (response.data && response.data.d) {
            const { Name, ALLOTED } = response.data.d;

            // Handle output based on "Name" and "ALLOTED" values
            if (Name && ALLOTED && ALLOTED !== 'NON-ALLOTTE') {
                // Case: Shares allotted
                return { name: Name, allottedShares: `${ALLOTED} shares allotted` };
            } else if (Name && ALLOTED === 'NON-ALLOTTE') {
                // Case: Not allotted
                return { name: Name, allottedShares: 'Not allotted' };
            } else if (!Name && !ALLOTED) {
                // Case: Not applied
                return { name: '', allottedShares: 'Not applied' };
            } else {
                // Fallback case
                return { name: 'Unknown', allottedShares: 'Data not recognized' };
            }
        } else {
            throw new Error('No allocation data found.');
        }
    } catch (error) {
        console.error('Error fetching IPO data from BigShare:', error.message);
        throw new Error('Error fetching IPO data from BigShare.');
    }
};
