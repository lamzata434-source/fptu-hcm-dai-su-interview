import test from 'node:test';
import assert from 'node:assert/strict';
import {nameClean,idClean,envClean,intClean,startClean,enoughGap,csvCell} from '../lib/validation.js';
test('student validation',()=>{
 assert.equal(nameClean(' Hồ   Văn A '),'Hồ Văn A');
 assert.equal(idClean(' se123456 '),'SE123456');
 assert.throws(()=>idClean(' 1'),/MSSV/);
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
