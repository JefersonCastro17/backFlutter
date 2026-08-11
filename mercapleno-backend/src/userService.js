const fetch = require('node-fetch');

async function  getUser(id) {
    const res = await fetch('API_ENDPOINTS')
    return res.json
}

module.exports = getUser