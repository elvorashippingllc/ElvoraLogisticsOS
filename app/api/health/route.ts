import {db,bucket} from '@/lib/os-db';
export const dynamic='force-dynamic';
export async function GET(){try{await db().prepare('SELECT COUNT(*) AS count FROM records').first();const b=bucket();if(!b)throw new Error('No document binding');return Response.json({status:'ok',application:'DigitalBurj ElvoraOS',database:'ready',documents:'bound',integrations:'not configured'},{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({status:'unavailable',application:'DigitalBurj ElvoraOS'},{status:503,headers:{'Cache-Control':'no-store'}});}}
