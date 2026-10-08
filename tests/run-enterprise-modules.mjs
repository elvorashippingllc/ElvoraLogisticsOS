import {spawn} from 'node:child_process'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
const run=(file,env)=>new Promise((resolve,reject)=>{const child=spawn(process.execPath,['--import','tsx',file],{env:{...process.env,...env},stdio:'inherit'});child.on('error',reject);child.on('exit',c=>c?reject(Error(`${file} failed (${c})`)):resolve())})
for(const file of ['tests/enterprise-modules.ts','tests/cargo-docs.ts','tests/deposits.ts','tests/ocr.ts']){
 const dir=await mkdtemp(path.join(tmpdir(),'elvora-domain-'));try{await run(file,{DATA_DIR:dir})}finally{await rm(dir,{recursive:true,force:true})}
}
for(const file of ['tests/smoke.ts','tests/enterprise-controls.ts','tests/workflow-api.ts','tests/work-api.ts','tests/enterprise-module-api.ts']){
 const dir=await mkdtemp(path.join(tmpdir(),'elvora-api-')),server=spawn(process.execPath,['dist/server/index.mjs'],{env:{...process.env,HOST:'127.0.0.1',PORT:'8098',DATA_DIR:dir},stdio:['ignore','pipe','pipe']})
 const stopped=new Promise(resolve=>server.once('exit',resolve))
 try{await new Promise((resolve,reject)=>{let out='';const timeout=setTimeout(()=>reject(Error('Server did not start: '+out)),20000);const ready=d=>{out+=d;if(out.includes('listening')){clearTimeout(timeout);resolve()}};server.stdout.on('data',ready);server.stderr.on('data',d=>out+=d);server.once('error',e=>{clearTimeout(timeout);reject(e)});server.once('exit',()=>{clearTimeout(timeout);reject(Error(out))})});await run(file,{BASE_URL:'http://127.0.0.1:8098'})}finally{server.kill();await stopped;await rm(dir,{recursive:true,force:true})}
}
console.log('Enterprise module domain and API suite passed.')
