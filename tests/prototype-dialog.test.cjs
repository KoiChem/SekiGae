const {test}=require('node:test');
const assert=require('node:assert/strict');
const {setup}=require('./prototype-harness.cjs');
function dialogFixture(){
    const s=setup(), handlers={};let focusCount=0;
    const els={};
    for(const id of ['app-dialog','app-dialog-title','app-dialog-message','app-dialog-cancel','app-dialog-ok']) {
        els[id]={textContent:'',hidden:false,focus(){focusCount++},classList:{toggle(){}},
            addEventListener(name,fn){handlers[name]=fn}};
    }
    els['app-dialog'].showModal=function(){this.open=true};
    els['app-dialog'].close=function(){this.open=false};
    const previous=s.context.document.getElementById;
    s.context.document.getElementById=id=>els[id]||previous(id);
    s.context.document.activeElement={isConnected:true,focus(){focusCount++}};
    return {...s,els,handlers,getFocusCount:()=>focusCount};
}
test('confirm cancellation preserves the result and restores focus',async()=>{
    const s=dialogFixture();assert.equal(typeof s.context.appConfirm,'function');
    const result=s.context.appConfirm('削除しますか？','削除する');
    assert.equal(s.els['app-dialog'].open,true);
    assert.equal(s.els['app-dialog-ok'].textContent,'削除する');
    s.els['app-dialog-cancel'].onclick();
    assert.equal(await result,false);assert.equal(s.els['app-dialog'].open,false);
    assert.ok(s.getFocusCount()>=2);
});
test('duplicate confirmation cannot run a second continuation or overwrite the first',async()=>{
    const s=dialogFixture();const a=s.context.appConfirm('一つ目','削除する');
    const b=s.context.appConfirm('二つ目','削除する');
    assert.equal(await b,false);assert.equal(s.els['app-dialog-message'].textContent,'一つ目');
    s.els['app-dialog-ok'].onclick();assert.equal(await a,true);
});
test('notification waits for OK and renders user input as literal text',async()=>{
    const s=dialogFixture();let finished=false;
    const result=s.context.appAlert('<img onerror=bad>\n復元完了').then(()=>{finished=true});
    await Promise.resolve();assert.equal(finished,false);
    assert.equal(s.els['app-dialog-message'].textContent,'<img onerror=bad>\n復元完了');
    assert.equal(s.els['app-dialog-cancel'].hidden,true);
    s.els['app-dialog-ok'].onclick();await result;assert.equal(finished,true);
});
