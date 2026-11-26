const {test}=require('node:test');
const assert=require('node:assert/strict');
const {setup}=require('./prototype-harness.cjs');
test('official storage owns both old regular namespaces but stays separate from sample',()=>{
    const s=setup();
    assert.equal(s.run('PREFIX'),'SekigaeKun_v7_');
    assert.equal(s.context.isSekiGaeOwnedStorageKey('SekigaeKun_v6_data_class_default'),true);
    assert.equal(s.context.isSekiGaeOwnedStorageKey('SekiGaeTrial_v1_data_class_default'),true);
    assert.equal(s.context.isSekiGaeOwnedStorageKey('SekigaeKun_sample_v7_system'),false);
    assert.equal(s.context.isSekiGaeOwnedStorageKey('unrelated_app_key'),false);
    assert.equal(setup('?sample=1').context.isSekiGaeOwnedStorageKey('SekigaeKun_v7_system'),false);
});
test('migration keeps same-ID regular and trial classes without writing into either old namespace',()=>{
    const s=setup();
    const old='SekigaeKun_v6_', trial='SekiGaeTrial_v1_';
    const system = JSON.stringify({classes:[{id:'x',name:'架空クラス'}],currentClassId:'x'});
    const regular = JSON.stringify({students:[{id:'01',name:'旧版'}]});
    const prototype = JSON.stringify({cols:8,rows:8,students:[{id:'01',name:'試作版'}]});
    s.storage.set(old+'system',system);
    s.storage.set(old+'data_x',regular);
    s.storage.set(trial+'restored',JSON.stringify({[trial+'system']:system,[trial+'data_x']:prototype}));
    const prefix=s.run('PREFIX');
    const write=s.context.localStorage.setItem;
    s.context.localStorage.setItem=()=>{throw Error('quota');};
    assert.throws(()=>s.context.migratePreviousClassData(),/quota/);
    assert.equal(s.context.readClassStorage(prefix+'system'),null);
    assert.equal(s.storage.get(old+'data_x'),regular);
    s.context.localStorage.setItem=write;
    s.context.migratePreviousClassData();
    assert.equal(s.context.readClassStorage(prefix+'data_x'),regular);
    assert.equal(s.context.readClassStorage(prefix+'data_x_trial'),prototype);
    assert.equal(JSON.parse(s.context.readClassStorage(prefix+'system')).currentClassId,'x');
    const snapshot=s.storage.get(prefix+'restored');
    s.context.migratePreviousClassData();
    assert.equal(s.storage.get(prefix+'restored'),snapshot);
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
test('sample operations use page memory and leave persistent storage untouched',()=>{
    const s=setup('?sample=1');
    s.storage.set('other-app','preserved');
    s.run("appStorage.setItem(PREFIX+'system','sample'); appStorage.setItem(PREFIX+'data_test','value')");
    assert.equal(s.run("appStorage.getItem(PREFIX+'system')"),'sample');
    assert.equal(s.storage.size,1);
    assert.equal(s.storage.get('other-app'),'preserved');
    assert.equal(setup('?sample=1').run("appStorage.getItem(PREFIX+'system')"),null);
});

test('backup publication is one write and a quota failure preserves both old classes', () => {
    const s = setup();
    const prefix = s.run('PREFIX');
    const first = prefix + 'data_test';
    const second = prefix + 'data_other';
    s.storage.set(first, '{"students":[]}');
    s.storage.set(second, '{"students":[{"id":"02"}]}');
    s.context.backup = { [first]: '{"students":[{"id":"01"}]}', [second]: '{"students":[]}' };
    const write = s.context.localStorage.setItem;
    s.context.localStorage.setItem = () => { throw Error('quota'); };
    assert.throws(() => s.run("mergeImportedBackupIntoLocalStorage(backup, ['test','other'])"), /quota/);
    assert.equal(s.context.readClassStorage(first), '{"students":[]}');
    assert.equal(s.context.readClassStorage(second), '{"students":[{"id":"02"}]}');
    s.context.localStorage.setItem = write;
    s.run("mergeImportedBackupIntoLocalStorage(backup, ['test','other'])");
    assert.equal(s.context.readClassStorage(first), s.context.backup[first]);
    assert.equal(s.context.readClassStorage(second), s.context.backup[second]);
});

test('backup validation checks histories and roster identity without requiring past students in the current roster', () => {
    const { context } = setup();
    assert.match(context.validateTrialClassData({ histories: {} }, true), /履歴/);
    assert.match(context.validateTrialClassData({ students: [{ id: 'A01' }, { id: 'a01' }] }, true), /名簿/);
    const past = Array(42).fill(null);
    past[1] = { id: 'former' };
    assert.equal(context.validateTrialClassData({ students: [{ id: 'current' }], histories: [{ assignment: past }] }, true), null);
});

test('Excel aliases and case-insensitive roster duplicates are rejected', () => {
    const { context } = setup();
    assert.match(context.validateExcelImportStep1([['101', '01']], 1, 2, [{ id: '101' }]).error, /1行2列目/);
    assert.equal(context.validateRosterSaveConstraints([{ id: 'A01' }, { id: 'a01' }], '').ok, false);
    assert.equal(context.validateRosterSaveConstraints([{ id: '', name: '架空' }], '').ok, false);
});

test('past front and back use active seats, while an interior column is not a window or corridor', () => {
    const { context } = setup();
    const past = Array(42).fill(null);
    past[7] = { id: '01' };
    const result = context.buildPastConstraintMaps([{ id: '01' }], [{ assignment: past, inactiveSeats: [1] }]);
    assert.equal(result.pastFront['01'].length, 1);
    assert.equal(result.pastBack['01'].length, 0);
    assert.equal(result.pastWindow['01'].length + result.pastCorridor['01'].length, 0);
});

test('initial search distinguishes an exhausted search from a deadline', async () => {
    const s = setup();
    s.context.performance = { now: () => 10 };
    const context = {
        activeSeats: [0, 1],
        tempStudents: [{ id: '01', allowedSeats: [0] }, { id: '02', allowedSeats: [0] }],
        random: () => 0.5,
        canPlaceAt: () => true,
        safetyContext: { searchEndDeadline: 20, totalEndDeadline: 20 }
    };
    assert.equal((await s.context.buildInitialByBacktracking(0, context)).stopReason, 'impossible');
    context.safetyContext.searchEndDeadline = 10;
    assert.equal((await s.context.buildInitialByBacktracking(0, context)).stopReason, 'time');
});

test('regular recovery adds old classes when v7 already contains an edited class with the same ID', () => {
    const s = setup();
    const prefix = s.run('PREFIX');
    const old = 'SekigaeKun_v6_';
    const oldSystem = JSON.stringify({ classes: [{ id: 'test', name: '改修前' }, { id: 'extra', name: '別クラス' }], currentClassId: 'test' });
    const contemporary = JSON.stringify({ classes: [{ id: 'test', name: '編集済み' }], currentClassId: 'test' });
    const original = JSON.stringify({ students: [{ id: '11', name: '旧名簿' }] });
    const edited = JSON.stringify({ cols: 8, rows: 8, students: [{ id: '21', name: '新名簿' }] });
    s.storage.set(old + 'system', oldSystem);
    s.storage.set(old + 'data_test', original);
    s.storage.set(old + 'data_extra', original);
    s.storage.set(prefix + 'system', contemporary);
    s.storage.set(prefix + 'data_test', edited);
    s.context.migratePreviousClassData();
    assert.equal(s.context.readClassStorage(prefix + 'system'), contemporary);
    assert.deepEqual(s.json('getRegularRecoveryCandidates().map(entry => entry.id)'), ['test', 'extra']);
    assert.equal(s.context.recoverRegularClasses(['test']), 1);
    assert.equal(s.context.readClassStorage(prefix + 'data_test'), edited);
    assert.equal(s.context.readClassStorage(prefix + 'data_test_legacy'), original);
    assert.equal(s.storage.get(old + 'data_test'), original);
    assert.deepEqual(s.json('getRegularRecoveryCandidates().map(entry => entry.id)'), ['extra']);
    assert.equal(s.context.recoverRegularClasses(['test']), 0);
    assert.equal(JSON.parse(s.context.readClassStorage(prefix + 'system')).currentClassId, 'test');
});

test('regular recovery preserves default data without a v7 class list and rolls back on quota errors', () => {
    const s = setup();
    const prefix = s.run('PREFIX');
    s.run("appData={classes:[{id:'class_default',name:'現行'}],currentClassId:'class_default'}");
    const oldKey = 'SekigaeKun_v5_data_class_default';
    const currentKey = prefix + 'data_class_default';
    const old = JSON.stringify({ students: [{ id: '01' }] });
    const current = JSON.stringify({ students: [{ id: '02' }] });
    s.storage.set(oldKey, old);
    s.storage.set(currentKey, current);
    const write = s.context.localStorage.setItem;
    s.context.localStorage.setItem = () => { throw Error('quota'); };
    assert.throws(() => s.context.recoverRegularClasses(['class_default']), /quota/);
    assert.equal(s.context.readClassStorage(currentKey), current);
    assert.equal(s.context.readClassStorage(prefix + 'system'), null);
    assert.equal(s.storage.get(oldKey), old);
    s.context.localStorage.setItem = write;
    assert.equal(s.context.recoverRegularClasses(['class_default']), 1);
    assert.equal(s.context.readClassStorage(currentKey), current);
    assert.equal(s.context.readClassStorage(currentKey + '_legacy'), old);
});

test('regular recovery hides data already migrated by the first launch and stays unavailable in sample mode', () => {
    for (const search of ['', '?sample=1']) {
        const s = setup(search);
        const prefix = s.run('PREFIX');
        const system = JSON.stringify({ classes: [{ id: 'test', name: '記録済み' }], currentClassId: 'test' });
        const data = JSON.stringify({ students: [{ id: '01' }] });
        s.storage.set('SekigaeKun_v6_system', system);
        s.storage.set('SekigaeKun_v6_data_test', data);
        s.storage.set(prefix + 'system', system);
        s.storage.set(prefix + 'data_test', data);
        assert.deepEqual(s.json('getRegularRecoveryCandidates()'), []);
    }
});
