import test from 'node:test';
import assert from 'node:assert/strict';
import {nameClean,idClean,envClean,intClean,startClean,enoughGap,csvCell,slotIdsClean,roomClean,subteamListClean,bookingSubteam} from '../lib/validation.js';
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
test('15 minute break between sessions',()=>{
 // 14:00-14:15 then 14:15-14:30: no break
 assert.equal(enoughGap('2026-10-27T14:00:00+07:00','2026-10-27T14:15:00+07:00'),false);
 assert.equal(enoughGap('2026-10-27T14:00:00+07:00','2026-10-27T14:29:00+07:00'),false);
 // 14:00-14:15 then 14:30-14:45: 15 minute break
 assert.equal(enoughGap('2026-10-27T14:00:00+07:00','2026-10-27T14:30:00+07:00'),true);
 // registration order does not matter
 assert.equal(enoughGap('2026-10-27T14:15:00+07:00','2026-10-27T14:00:00+07:00'),false);
 assert.equal(enoughGap('2026-10-27T14:30:00+07:00','2026-10-27T14:00:00+07:00'),true);
 assert.equal(enoughGap('2026-10-27T14:00:00+07:00','2026-10-27T14:00:00+07:00'),false);
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
 assert.throws(()=>slotIdsClean({}),/chọn ít nhất một phiên/);
 assert.throws(()=>slotIdsClean({slot_ids:[]}),/chọn ít nhất một phiên/);
 assert.throws(()=>slotIdsClean({slot_ids:['x']}),/không hợp lệ/);
 assert.deepEqual(slotIdsClean({slot_ids:[3,3,'5']}),[3,5]);
 assert.deepEqual(slotIdsClean({slot_id:7}),[7]);
 assert.throws(()=>slotIdsClean({slot_ids:[1,2,3,4,5,6,7,8,9,10,11]}),/tối đa 10/);
});
test('room and subteam validation',()=>{
 assert.equal(roomClean('  A.203  '),'A.203');
 assert.equal(roomClean(undefined),'');
 assert.throws(()=>roomClean('x'.repeat(51)),/Số phòng/);
 assert.deepEqual(subteamListClean(' Creative Team, Product Team ,,Digital Team, Creative Team'),['Creative Team','Product Team','Digital Team']);
 assert.deepEqual(subteamListClean(''),[]);
 const teams=['Creative Team','Product Team','Digital Team'];
 assert.equal(bookingSubteam([], 'Creative Team'),'');          // committee without subteams ignores the field
 assert.equal(bookingSubteam(teams,'Product Team'),'Product Team');
 assert.throws(()=>bookingSubteam(teams,''),/chọn một nhóm/);
 assert.throws(()=>bookingSubteam(teams,'Design Team'),/Nhóm không hợp lệ/);
 assert.equal(bookingSubteam(teams,'Digital Team','Digital Team'),'Digital Team');
 assert.throws(()=>bookingSubteam(teams,'Creative Team','Digital Team'),/chỉ dành cho Digital Team/);
});
