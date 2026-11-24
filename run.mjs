import http from 'node:http';
import { once } from 'node:events';
import { writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { evaluate, policy } from './gate.mjs';

async function serve(servers, handler) {
  const server = http.createServer(handler);
  servers.push(server);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return 'http://127.0.0.1:' + server.address().port;
}

async function trial(name, faults) {
  const servers = [];
  try {
    let candidateHits = 0;
    const stable = await serve(servers, (_, res) => res.writeHead(200).end('stable'));
    const candidate = await serve(servers, (_, res) => {
      candidateHits++;
      res.writeHead(faults.includes(candidateHits) ? 503 : 200).end('candidate');
    });
    let state = 'hold', incoming = 0, samples = 0, failures = 0;
    // This lab driver issues one request at a time. Every fifth goes to the canary.
    const router = await serve(servers, async (_, res) => {
      incoming++;
      const target = state === 'promote' || (state === 'hold' && incoming % 5 === 0)
        ? candidate : stable;
      try {
        const reply = await fetch(target);
        const version = await reply.text();
        if (target === candidate && state === 'hold') {
          samples++;
          if (reply.status >= 500) failures++;
          state = evaluate(samples, failures);
        }
        res.writeHead(reply.status, {'content-type':'application/json'}).end(
          JSON.stringify({version, state, samples, failures})
        );
      } catch {
        res.writeHead(502).end('Local upstream could not be reached');
      }
    });
    const events = [];
    for (let seq = 1; seq <= 105; seq++) {
      const response = await fetch(router);
      events.push({seq, status:response.status, ...await response.json()});
    }
    const checkpoints = [15,100,101,105].map(seq => events[seq-1]);
    const expected = faults.length ? 'abort' : 'promote';
    assert.equal(checkpoints[0].state, 'hold');
    assert.equal(checkpoints[0].samples, 3);
    assert.equal(checkpoints[1].state, expected);
    assert.equal(checkpoints[1].failures, faults.length);
    assert.equal(checkpoints[1].samples, 20);
    const finalVersion = expected === 'abort' ? 'stable' : 'candidate';
    assert.ok(events.slice(100).every(e => e.version === finalVersion && e.status === 200));
    return {name, injectedFaultOrdinals:faults, checkpoints, events};
  } finally {
    await Promise.all(servers.map(server => new Promise(resolve => server.close(resolve))));
  }
}

assert.equal(evaluate(19,2),'hold');
assert.equal(evaluate(20,2),'abort');
assert.equal(evaluate(20,1),'promote');
const trials = [await trial('faulty',[3,11,17]), await trial('healthy',[])];
const run = {recorded:new Date().toISOString(), policy, candidateShare:0.2, trials};
const dir = new URL('./evidence/', import.meta.url);
await mkdir(dir, {recursive:true});
await writeFile(new URL('run.json',dir),JSON.stringify(run,null,2)+'\n');
for (const {name,checkpoints} of trials) {
  console.log(name);
  console.table(checkpoints);
}
