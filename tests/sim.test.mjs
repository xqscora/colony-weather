import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const sim=require('../app.js');

const settings={glucose:3,oxygen:70,temp:30,seeds:34};
test('same seed and intervention produce reproducible starting states',()=>{
  const a=sim.createChamber(settings,19),b=sim.createChamber(settings,19);
  assert.deepEqual([...a.glucose],[...b.glucose]);
  assert.deepEqual(a.cells,b.cells);
});
test('paired chambers begin with identical cells and independent conditions',()=>{
  const p=sim.createPair(settings,{...settings,oxygen:20},41);
  assert.deepEqual(p.a.cells,p.b.cells);
  assert.ok(Math.abs(p.a.oxygen[0]-0.7)<1e-6);
  assert.ok(Math.abs(p.b.oxygen[0]-0.2)<1e-6);
  sim.tick(p.a);
  assert.equal(p.b.time,0);
});
test('simulation advances, records measurements, and keeps resources nonnegative',()=>{
  const s=sim.createChamber(settings,41);
  for(let i=0;i<12;i++)sim.tick(s);
  assert.equal(s.step,12);
  assert.equal(s.time,3);
  assert.equal(s.history.length,6);
  assert.ok(s.glucose.every(x=>x>=0));
  assert.ok(s.oxygen.every(x=>x>=0));
});
test('glucose pulse affects only its selected chamber',()=>{
  const p=sim.createPair(settings,settings,41),before=sim.metrics(p.b).glucose;
  sim.pulse(p.a,1);
  assert.equal(sim.metrics(p.a).glucose,4);
  assert.equal(sim.metrics(p.b).glucose,before);
  assert.equal(p.a.events[0].amount,1);
});
test('a low-oxygen branch produces a measurable output divergence',()=>{
  const p=sim.createPair(settings,{...settings,oxygen:10},41);
  for(let i=0;i<120;i++){sim.tick(p.a);sim.tick(p.b);}
  const a=sim.metrics(p.a),b=sim.metrics(p.b);
  assert.ok(Math.abs(a.ethanol-b.ethanol)>0.01);
  assert.ok(Math.abs(a.biomass-b.biomass)>0.5);
});
test('cell population is capped and run duration is bounded',()=>{
  const s=sim.createChamber({...settings,glucose:8,seeds:72},2);
  for(let i=0;i<220;i++)sim.tick(s);
  assert.ok(s.cells.length<=sim.MAX_CELLS);
  assert.ok(s.time<=48);
});
