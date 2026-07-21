const nano = require('nano');
const COUCH_URL = process.env.COUCHDB_URL || 'http://admin:password@127.0.0.1:5984';
console.log('Connecting to:', COUCH_URL);
const server = nano(COUCH_URL);

async function test() {
  try {
    const info = await server.db.get('apiforge');
    console.log('SUCCESS:', info.db_name);
  } catch(e: any) {
    console.error('FAIL -', 'message:', e.message, 'statusCode:', e.statusCode, 'code:', e.code);
    console.error('Constructor:', e.constructor?.name);
  }
}

test().then(() => { console.log('Done'); process.exit(0); }).catch(e => { console.error('Unhandled:', e); process.exit(1); });
