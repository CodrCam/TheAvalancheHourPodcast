// scripts/dns-check.js
const dns = require('dns').promises;

(async () => {
  const host = 'db.mvvhieajcrkvbtgnidgf.supabase.co'; // paste EXACTLY from Supabase > Settings > Database > Host
  try {
    const res = await dns.lookup(host);
    console.log('✅ DNS OK:', host, '->', res.address);
  } catch (e) {
    console.error('❌ DNS ERROR for', host, '->', e.message);
  }
})();
