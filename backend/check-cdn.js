const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const axios = require('axios');

const cdnHost = 'd2ghstwmcd6f2g.cloudfront.net';
const sampleAsset = 'https://d2ghstwmcd6f2g.cloudfront.net/media/6a7afa2265545de3eb2e8c65/1788446754948-g6olsa-thumb.jpg';

dns.resolve4(cdnHost, async (err, addresses) => {
  if (err) {
    console.log(`⏳ DNS not propagated yet (${err.code}). AWS is still deploying edge IP addresses.`);
  } else {
    console.log(`✅ DNS IS LIVE! IP addresses:`, addresses);
    try {
      const res = await axios.get(sampleAsset, { timeout: 5000 });
      console.log(`🎉 CloudFront asset returned status: ${res.status} OK!`);
    } catch (e) {
      console.log(`⚠️ Asset fetch returned:`, e.response?.status || e.message);
    }
  }
});
