import test from 'node:test';
import assert from 'node:assert/strict';
import {dateKey,addDays,parseDate,hidingSpot} from './dates.js';
test('date navigation crosses months, leap days and years',()=>{assert.equal(dateKey(addDays(parseDate('2026-12-31'),1)),'2027-01-01');assert.equal(dateKey(addDays(parseDate('2024-02-28'),1)),'2024-02-29');assert.equal(dateKey(addDays(parseDate('2026-03-01'),-1)),'2026-02-28');});
test('invalid dates cannot roll silently into another month',()=>{assert.equal(parseDate('2026-02-30'),null);assert.equal(parseDate('bad'),null);});
test('each day gets a stable, bounded, different hiding spot',()=>{const start=parseDate('2026-09-27');const spots=Array.from({length:7},(_,i)=>hidingSpot(addDays(start,i)));assert.equal(new Set(spots).size,7);assert.ok(spots.every(x=>x>=235&&x<390));assert.equal(hidingSpot(start),hidingSpot(parseDate('2026-09-27')));});
