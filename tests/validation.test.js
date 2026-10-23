import test from 'node:test';
import assert from 'node:assert/strict';
import {nameClean,idClean,envClean,intClean,startClean,enoughGap,csvCell,slotIdsClean} from '../lib/validation.js';
test('student validation',()=>{
 assert.equal(nameClean(' Hồ   Văn A '),'Hồ Văn A');
 assert.equal(idClean(' se123456 '),'SE123456');
 assert.throws(()=>idClean(' 1'),/MSSV/);
 assert.throws(()=>idClean('SE17001'),/MSSV/);
 assert.throws(()=>idClean('SE1700012'),/MSSV/);
 assert.throws(()=>idClean('S1170001'),/MSSV/);
 assert.throws(()=>idClean('SE-17000'),/MSSV/);
 assert.throws(()=>envClean('production'));
 assert.equal(intClean('6',1,6),6);
});
test('slot 15 minute separation',()=>{
 assert.equal(enoughGap('2026-10-27T08:00:00+07:00','2026-10-27T08:14:00+07:00'),false);
 assert.equal(enoughGap('2026-10-27T08:00:00+07:00','2026-10-27T08:15:00+07:00'),true);
});
test('timezone and CSV output',()=>{
 assert.equal(startClean('2026-10-27T08:00:00+07:00'),'2026-10-27T01:00:00.000Z');
 assert.equal(csvCell('=HYPERLINK(1)'),`"'=HYPERLINK(1)"`);
 assert.equal(csvCell('Trần "A"'),`"Trần ""A"""`);
});
test('registration window',async()=>{
 const {registrationWindow}=await import('../lib/registration.js');
 const now=Date.parse('2026-10-27T08:00:00+07:00');
 assert.deepEqual(registrationWindow({registration_open:false},now),{open:false,reason:'closed'});
 assert.equal(registrationWindow({registration_open:true},now).open,true);
 assert.equal(registrationWindow({registration_open:true,registration_opens_at:'2026-10-27T09:00:00+07:00'},now).reason,'not_yet');
 assert.equal(registrationWindow({registration_open:true,registration_closes_at:'2026-10-27T08:00:00+07:00'},now).reason,'ended');
 assert.equal(registrationWindow({registration_open:true,registration_opens_at:'2026-10-27T07:00:00+07:00',registration_closes_at:'2026-10-27T09:00:00+07:00'},now).open,true);
});
test('submission must include a slot',()=>{
 assert.throws(()=>slotIdsClean({}),/chọn ít nhất một ca/);
 assert.throws(()=>slotIdsClean({slot_ids:[]}),/chọn ít nhất một ca/);
 assert.throws(()=>slotIdsClean({slot_ids:['x']}),/không hợp lệ/);
 assert.deepEqual(slotIdsClean({slot_ids:[3,3,'5']}),[3,5]);
 assert.deepEqual(slotIdsClean({slot_id:7}),[7]);
 assert.throws(()=>slotIdsClean({slot_ids:[1,2,3,4,5,6,7,8,9,10,11]}),/tối đa 10/);
});
