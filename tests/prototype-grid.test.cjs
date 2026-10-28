const {test}=require('node:test');
const assert=require('node:assert/strict');
const {setup}=require('./prototype-harness.cjs');
test('prototype storage and deletion are disjoint from both production and sample',()=>{
    const s=setup(); const p=s.run('PREFIX');
    assert.doesNotMatch(p,/^Sekigae(?:Kun|App)_(?:sample_)?v\d+_/);
    assert.equal(s.context.isSekiGaeOwnedStorageKey('SekigaeKun_v6_system'),false);
    assert.equal(s.context.isSekiGaeOwnedStorageKey('SekiGae_ui_layout'),false);
    assert.equal(s.context.isSekiGaeOwnedStorageKey(p+'system'),true);
    assert.notEqual(p,setup('?sample=1').run('PREFIX'));
});
test('grid expansion preserves coordinates rather than flat indexes',()=>{
    const s=setup(); assert.equal(typeof s.context.planSeatResize,'function');
    const p=s.context.planSeatResize(8,10);
    assert.equal(p.ok,true);assert.equal(p.assignment.length,80);
    assert.equal(p.assignment[8].id,'01');assert.equal(p.assignment[10].id,'02');
    assert.deepEqual(Array.from(p.inactiveSeats),[9,53]);
    assert.equal(p.clearPlacement,false);
});
test('shrink identifies occupied removed seats but preserves roster and history',()=>{
    const s=setup();s.run('seatAssignment[41]=currentStudents[0];seatAssignment[6]=null');
    const p=s.context.planSeatResize(4,4);assert.equal(p.ok,true);assert.equal(p.clearPlacement,true);
    assert.equal(s.run('seatAssignment[41].id'),'01');assert.equal(s.run('currentStudents.length'),2);
});
test('invalid dimensions, capacity and out-of-range fixed rules reject resizing',()=>{
    const s=setup();
    for(const [c,r] of [[3,4],[9,4],[4,11],[4.5,5]]) assert.equal(s.context.planSeatResize(c,r).ok,false);
    s.run("currentStudents=Array.from({length:17},(_,i)=>({id:String(i)}))");
    assert.equal(s.context.planSeatResize(4,4).ok,false);
    s.run("currentStudents=[{id:'01',flags:'@(f7)'}]");
    assert.equal(s.context.planSeatResize(4,4).ok,false);
});
test('odd columns have a single last seat and never pair across row boundaries',()=>{
    const s=setup();s.context.setGridDimensions(5,4);
    assert.equal(s.context.isPair(4,5),false);
    assert.equal(s.context.getPairSeatIndex(4),-1);
    assert.equal(s.context.getPairSeatIndex(5),6);
    const a=Array.from({length:20},(_,i)=>({id:String(i)}));
    assert.equal(s.context.collectMovableCompletePairSeatGroups(a).length,8);
});
test('h10 and row10 are accepted only in the current grid',()=>{
    const s=setup();s.context.setGridDimensions(8,10);
    assert.equal(s.context.getIndexFromLabel('h10'),79);
    assert.deepEqual(s.json("parsePlacementItems('h10')"),{kind:'seat',values:[79]});
    assert.deepEqual(s.json("parsePlacementItems('10')"),{kind:'row',values:[9]});
    s.context.setGridDimensions(4,4);
    assert.equal(s.context.parsePlacementItems('h10'),null);
});
test('different dimensions keep past pairs but exclude same-seat and tracking hits',()=>{
    const s=setup();s.context.setGridDimensions(5,4);
    s.run(`histories=[{assignment:Array(42).fill(null)}];
        histories[0].assignment[6]=currentStudents[0];histories[0].assignment[7]=currentStudents[1];`);
    const maps=s.context.buildPastConstraintMaps(s.run('currentStudents'),s.run('histories'));
    assert.equal(maps.pastPairsMap['01'][0].partnerId,'02');
    assert.equal(maps.pastSeatsMap['01'].length,0);
    assert.equal(s.context.buildSeatTrackHistoryMap('01').size,0);
});
test('old backup keys are accepted only through explicit import and trial exports stay distinct',()=>{
    const s=setup(); assert.equal(s.context.normalizeBackupStorageKey('SekigaeKun_v6_system'),s.run('PREFIX')+'system');
    assert.equal(s.context.normalizeBackupStorageKey('SekiGae_ui_layout'),null);
    assert.equal(s.context.normalizeBackupStorageKey('unrelated-secret'),null);
});
test('malformed explicit dimensions or mismatched arrays are rejected before backup writes',()=>{
    const s=setup();assert.equal(typeof s.context.validateTrialClassData,'function');
    assert.equal(s.context.validateTrialClassData({assignment:Array(42).fill(null)}),null);
    assert.equal(s.context.validateTrialClassData({cols:8,rows:10,assignment:Array(80).fill(null)}),null);
    assert.ok(s.context.validateTrialClassData({cols:8,rows:10,assignment:Array(42).fill(null)}));
    assert.ok(s.context.validateTrialClassData({cols:3,rows:10,assignment:Array(30).fill(null)}));
    assert.ok(s.context.validateTrialClassData({cols:8,rows:10,assignment:Array(80).fill(null),inactiveSeats:[80]}));
    assert.ok(s.context.validateTrialClassData({histories:[{cols:8,rows:10,assignment:Array(42).fill(null)}]}));
});
test('class and confirmed history serialize grid dimensions',()=>{
    const s=setup();s.context.setGridDimensions(8,10);
    s.run('seatAssignment=Array(80).fill(null);inactiveSeats.clear()');
    s.context.saveCurrentClassData();const data=JSON.parse(s.storage.get(s.run('PREFIX')+'data_test'));
    assert.equal(data.cols,8);assert.equal(data.rows,10);assert.equal(data.assignment.length,80);
    s.run('previewAssignment=seatAssignment.slice();getPreviewPointDetails=()=>null');
    s.context.commitSeats();assert.deepEqual(s.json('getHistoryDimensions(histories[0])'),{cols:8,rows:10});
});
test('selected history must match current dimensions, placement and inactive seats',()=>{
    const s=setup();assert.equal(typeof s.context.historyMatchesCurrentBoard,'function');
    s.run('h={assignment:seatAssignment.slice(),inactiveSeats:[7,41]}');
    assert.equal(s.run('historyMatchesCurrentBoard(h)'),true);
    s.context.setGridDimensions(7,6);assert.equal(s.run('historyMatchesCurrentBoard(h)'),false);
    s.context.setGridDimensions(6,7);s.run('inactiveSeats.clear()');
    assert.equal(s.run('historyMatchesCurrentBoard(h)'),false);
});
test('pair tracking retains the latest history when dimensions have changed',()=>{
    const s=setup();assert.equal(typeof s.context.getPairTrackHistoryList,'function');
    s.run('histories=[{assignment:seatAssignment.slice(),inactiveSeats:[7,41]}]');
    assert.equal(s.context.getPairTrackHistoryList().length,0);
    s.context.setGridDimensions(7,6);assert.equal(s.context.getPairTrackHistoryList().length,1);
    s.context.setGridDimensions(6,7);s.run('previewAssignment=seatAssignment.slice()');
    assert.equal(s.context.getPairTrackHistoryList().length,1);
});
test('first visit uses viewport orientation and a saved manual choice takes precedence',()=>{
    const s=setup();let mode;s.context.applyUiLayoutMode=value=>{mode=value};
    s.context.window.innerWidth=820;s.context.window.innerHeight=1180;s.context.loadUiLayoutMode();
    assert.equal(mode,'portrait');
    s.storage.set(s.run('UI_LAYOUT_STORAGE_KEY'),'landscape');s.context.loadUiLayoutMode();assert.equal(mode,'landscape');
});
