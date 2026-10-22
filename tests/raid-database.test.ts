import { it, expect } from 'vitest';
import { PvpDatabase } from '../src/pvp/server/database';
import type { RaidReceipt } from '../src/raid/model';
import{mkdtempSync,rmSync,rmdirSync}from'node:fs';import{tmpdir}from'node:os';import{join}from'node:path';
it('version-one account data migrates additively; interrupted raids keep the cleared checkpoint as void history',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'mugong-raid-')),path=join(dir,'test.sqlite');let db=new PvpDatabase(path);
 try{
  const a=await db.register('oldaccount','migration-test-password','기존 검증');db.db.exec('DROP TABLE raid_results; PRAGMA user_version=1');db.close();db=new PvpDatabase(path);
  expect(db.account(a.id)).toEqual(a);db.beginRaid('interrupted',[a.id]);db.checkpointRaid('interrupted',3);db.close();db=new PvpDatabase(path);
  expect(db.raidHistory(a.id)[0]).toMatchObject({state:'void',floor:3,receipt:null});expect(db.account(a.id)?.rating).toBe(1000);
 }finally{db.close();for(const suffix of['','-wal','-shm'])rmSync(path+suffix,{force:true});rmdirSync(dir);}
});
it('raid return is account-scoped, atomic and idempotent; ranked points remain untouched', async () => {
  const db = new PvpDatabase(':memory:');
  try {
    const a = await db.register('raidpersist', 'database-test-password', '기록 검증'),
      b = await db.register('raidother', 'database-test-password', '다른 검증');
    db.beginRaid('one', [a.id, b.id]);
    db.checkpointRaid('one', 2);
    db.checkpointRaid('one', 1);
    const receipt: RaidReceipt = {
      id: 'one:0',
      runId: 'one',
      name: a.name,
      outcome: 'returned',
      floor: 2,
      damage: 100,
      taken: 30,
      finishedAt: Date.now(),
    };
    expect(db.settleRaid(a.id, receipt)).toEqual(receipt);
    expect(db.settleRaid(a.id, { ...receipt, floor: 5 })).toEqual(receipt);
    expect(db.raidHistory(a.id)).toHaveLength(1);
    expect(db.raidHistory(b.id)[0].receipt).toBeNull();
    expect(db.raidHistory(b.id)[0].floor).toBe(2);
    expect(db.account(a.id)?.rating).toBe(1000);
    expect(db.account(a.id)?.matches).toBe(0);
    expect(() => db.settleRaid('unknown', receipt)).toThrow();
  } finally {
    db.close();
  }
});
