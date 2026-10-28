// Run with Playwright MCP browser_run_code_unsafe. The current tab selects local/public base.
async page => {
    const origin = new URL(page.url());
    const root = origin.origin + origin.pathname.split('/prototype/')[0];
    const base = root + '/prototype/';
    const context = await page.context().browser().newContext({acceptDownloads:true});
    const p = await context.newPage(), errors=[], nativeDialogs=[];
    p.on('pageerror',e=>errors.push(e.message));
    p.on('dialog',async d=>{nativeDialogs.push(d.message());await d.dismiss();});
    const assert=(v,m)=>{if(!v)throw new Error(m);};
    const settle=()=>p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(r)))));
    const report={base,checks:[]};
    const check=(v,m)=>{assert(v,m);report.checks.push(m);};
    const resize=async(c,r)=>{
        await p.locator('#btn-seat-size').click();
        await p.locator('#seat-size-cols').selectOption(String(c));await p.locator('#seat-size-rows').selectOption(String(r));
        await p.locator('#seat-size-apply').click();
    };
    const injectFixture=async(count,cols=8,rows=10)=>{
        await p.evaluate(({count,cols,rows})=>{
            currentStudents=Array.from({length:count},(_,i)=>({id:String(i+1).padStart(2,'0'),name:`架空生徒${i+1}`,kana:`かくう せいと${i+1}`,gender:i%2?'女':'男',attr1:'検証用',attr2:'架空のデータ',flags:''}));
            setGridDimensions(cols,rows);seatAssignment=Array(cols*rows).fill(null);inactiveSeats=new Set();histories=[];shuffleCandidates=[];previewAssignment=null;previewInactiveSeatsBackup=null;clearPendingHistoryShuffleMeta();
            document.getElementById('overall-rules').value='';initGrid();setActionButtons(false,false);saveCurrentClassData();loadCurrentClassData();
        },{count,cols,rows});await settle();
    };
    try {
        await p.setViewportSize({width:1366,height:1024});await p.goto(base+'index.html');await p.waitForFunction(()=>typeof currentStudents!=='undefined');
        await p.evaluate(()=>{localStorage.setItem('SekigaeKun_v5_data_class_default',JSON.stringify({students:[{id:'prod',name:'既存版のみ'}]}));localStorage.setItem('SekiGae_ui_layout','portrait');localStorage.setItem('SekigaeKun_v6_sentinel','preserve');});
        await p.reload();await p.waitForFunction(()=>typeof currentStudents!=='undefined');
        check(await p.evaluate(()=>currentStudents.length===0&&document.body.classList.contains('ui-layout-landscape')),'production fallback and layout setting are isolated');
        const fixture=await p.evaluate(async()=>JSON.stringify(await(await fetch('../meibo_sample.json')).json()));
        await p.locator('#import-file').setInputFiles({name:'legacy.json',mimeType:'application/json',buffer:Buffer.from(fixture)});
        await p.locator('#import-backup-modal').waitFor({state:'visible'});
        await p.locator('#import-backup-modal button[onclick="confirmImportBackup()"]').click();
        await p.locator('#app-dialog').waitFor({state:'visible'});
        check(await p.evaluate(()=>currentStudents.length===0&&!!localStorage.getItem(PREFIX+'system')),'backup commit waits for completion notification before reload');
        await p.locator('#app-dialog-ok').click();await p.waitForFunction(()=>currentStudents.length>=35);await settle();
        check(await p.evaluate(()=>NUM_COLS===6&&NUM_ROWS===7&&currentStudents.length>=35),'legacy backup imports as 6x7');
        await resize(8,10);await p.waitForFunction(()=>NUM_COLS===8&&NUM_ROWS===10);await settle();
        check(await p.evaluate(()=>document.querySelectorAll('#seat-grid .seat').length===80&&document.getElementById('history-select').value===''),'80-seat expansion preserves board and selects current placement');
        await p.reload();await p.waitForFunction(()=>NUM_COLS===8);await settle();
        check(await p.evaluate(()=>NUM_ROWS===10&&seatAssignment.length===80&&document.getElementById('history-select').value===''),'normal prototype persists dimensions without selecting an unrelated history');
        await p.locator('#history-select').selectOption('0');await p.waitForFunction(()=>NUM_COLS===6&&NUM_ROWS===7);await settle();
        check(await p.evaluate(()=>seatAssignment.filter(Boolean).length>=35),'history restores its original dimensions and assignment');
        // Pick a shrink that removes occupied columns while retaining enough active seats.
        const before=await p.evaluate(()=>JSON.stringify({seatAssignment,inactive:[...inactiveSeats],histories,currentStudents}));
        await resize(5,10);await p.locator('#app-dialog').waitFor({state:'visible'});
        await p.keyboard.press('Escape');
        check(await p.evaluate(()=>document.getElementById('seat-size-dialog').open),'Escape cancels child confirmation and retains size dialog');
        check(await p.evaluate(b=>JSON.stringify({seatAssignment,inactive:[...inactiveSeats],histories,currentStudents})===b,before),'shrink cancellation changes no placement, roster or histories');
        await p.locator('#seat-size-apply').click();await p.locator('#app-dialog-ok').click();await p.waitForFunction(()=>NUM_COLS===5);await settle();
        check(await p.evaluate(()=>seatAssignment.every(x=>x===null)&&histories.length>0&&currentStudents.length>=35),'confirmed occupied shrink clears placement and retains roster and histories');
        await p.locator('button[onclick="openSortModal()"]').click();await p.locator('button[onclick="executeSort()"]').click();await p.waitForFunction(()=>!!previewAssignment);
        const oldSelection=await p.locator('#history-select').inputValue();
        await p.locator('#history-select').selectOption('0');await p.locator('#app-dialog').waitFor({state:'visible'});await p.locator('#app-dialog-cancel').click();
        check(await p.evaluate(()=>NUM_COLS===5&&!!previewAssignment),'history restore cancellation preserves pending preview');
        check(await p.locator('#history-select').inputValue()===oldSelection,'history cancellation restores selected value');
        await p.locator('#btn-cancel-preview').click();
        // Parent backup selections survive its child notice and focus stays trapped.
        await p.locator('button[onclick="openExportBackupModal()"]').click();await p.locator('#export-backup-modal button[onclick="toggleExportClasses(false)"]').click();
        await p.locator('#export-backup-modal button[onclick="confirmExportBackup()"]').click();await p.locator('#app-dialog').waitFor({state:'visible'});
        for(let i=0;i<4;i++)await p.keyboard.press('Tab');
        check(await p.evaluate(()=>document.getElementById('app-dialog').contains(document.activeElement)),'message dialog traps keyboard focus');
        await p.keyboard.press('Escape');
        check(await p.locator('#export-backup-modal').isVisible()&&await p.locator('.export-class-cb:checked').count()===0,'closing child notice retains parent backup choices');
        await p.locator('#export-backup-modal button[onclick="toggleExportClasses(true)"]').click();
        const downloadEvent=p.waitForEvent('download');await p.locator('#export-backup-modal button[onclick="confirmExportBackup()"]').click();const dl=await downloadEvent;
        const stream=await dl.createReadStream();let backup='';for await(const chunk of stream)backup+=chunk.toString();
        const exported=JSON.parse(backup);
        check(dl.suggestedFilename().includes('試作版')&&Object.keys(exported).every(k=>k.startsWith('SekiGaeTrial_')),'trial export has distinct filename and storage identity');
        await p.locator('#import-file').setInputFiles({name:'trial.json',mimeType:'application/json',buffer:Buffer.from(backup)});
        await p.locator('#import-backup-modal').waitFor({state:'visible'});await p.locator('#import-backup-modal button[onclick="confirmImportBackup()"]').click();await p.locator('#app-dialog').waitFor({state:'visible'});await p.locator('#app-dialog-ok').click();await p.waitForFunction(()=>NUM_COLS===5&&NUM_ROWS===10);
        check(await p.evaluate(()=>histories.length>0&&seatAssignment.every(x=>x===null)),'trial backup roundtrip preserves resized empty board and old history');
        // Deterministic fictional roster for geometry, all 80 students and both print orientations.
        await injectFixture(80);
        await p.locator('button[onclick="openSortModal()"]').click();await p.locator('button[onclick="executeSort()"]').click();await p.waitForFunction(()=>!!previewAssignment);await p.locator('#btn-commit').click();await settle();
        check(await p.evaluate(()=>seatAssignment.filter(Boolean).length===80&&histories[0].cols===8&&histories[0].rows===10),'all 80 fictional students can be sorted and confirmed');
        report.layouts=[];
        for(const [width,height,mode] of [[1366,1024,'landscape'],[1180,820,'landscape'],[768,1024,'portrait'],[820,1180,'portrait']]){
            await p.setViewportSize({width,height});await p.evaluate(m=>applyUiLayoutMode(m,false),mode);await settle();
            const metrics=await p.evaluate(()=>{
                const main=document.getElementById('tab-main'),c=document.getElementById('classroom');
                const texts=[...document.querySelectorAll('#seat-grid .seat-fixed-text')];
                return {cols:NUM_COLS,rows:NUM_ROWS,overflow:main.scrollWidth>main.clientWidth+1,nameMin:Math.min(...texts.filter(e=>e.closest('[data-row-key=name]')).map(e=>parseFloat(getComputedStyle(e).fontSize))),clipDetails:texts.filter(e=>e.scrollWidth>e.clientWidth+1||e.getBoundingClientRect().height>e.parentElement.clientHeight+1).slice(0,4).map(e=>({text:e.textContent,w:e.clientWidth,sw:e.scrollWidth,h:e.getBoundingClientRect().height,rh:e.parentElement.clientHeight,font:getComputedStyle(e).fontSize})),clipped:texts.filter(e=>e.scrollWidth>e.clientWidth+1||e.getBoundingClientRect().height>e.parentElement.clientHeight+1).length,scrollHeight:c.scrollHeight,clientHeight:c.clientHeight};
            });
            check(!metrics.overflow&&metrics.nameMin>=16&&metrics.clipped===0,`${width}x${height} ${mode}: readable 80-seat layout without clipping or horizontal overflow ${JSON.stringify(metrics)}`);
            report.layouts.push({width,height,mode,...metrics});
        }
        await p.setViewportSize({width:1180,height:820});await p.evaluate(()=>applyUiLayoutMode('landscape',false));
        await p.getByRole('button',{name:'印刷プレビュー',exact:true}).click();await p.waitForSelector('.print-seat-content.is-fitted');await settle();
        report.print=[];
        for(const orientation of ['landscape','portrait']){
            await p.evaluate(o=>setPrintOrientation(o),orientation);await settle();
            const metrics=await p.evaluate(()=>{const a=document.querySelector('.print-page').getBoundingClientRect(),g=document.getElementById('print-seat-grid').getBoundingClientRect();return {count:document.querySelectorAll('.print-seat').length,within:g.left>=a.left-1&&g.right<=a.right+1&&g.top>=a.top-1&&g.bottom<=a.bottom+1};});
            check(metrics.count===80&&metrics.within,`A4 ${orientation}: all 80 seats fit on the page`);report.print.push({orientation,...metrics});
        }
        await p.getByRole('button',{name:'印刷プレビューを閉じる',exact:true}).click();
        // Smallest and odd dimensions.
        await injectFixture(16,4,4);check(await p.evaluate(()=>document.querySelectorAll('#seat-grid .seat').length===16),'minimum 4x4 grid loads');
        await injectFixture(35,5,7);check(await p.evaluate(()=>collectMovableCompletePairSeatGroups(currentStudents).every(([a,b])=>Math.floor(a/5)===Math.floor(b/5))),'5-column pairing stays within each row');
        await injectFixture(49,7,7);check(await p.evaluate(()=>NUM_COLS===7&&NUM_ROWS===7),'7x7 grid loads');
        // Delete isolation in both directions with actual ownership functions.
        await p.evaluate(()=>{localStorage.setItem('SekiGaeTrial_sample_v1_marker','keep');deleteAllSekiGaeStoredData();});
        check(await p.evaluate(()=>localStorage.getItem('SekigaeKun_v6_sentinel')==='preserve'&&localStorage.getItem('SekiGaeTrial_sample_v1_marker')==='keep'),'trial deletion preserves production and trial sample data');
        await p.goto(root+'/index.html');await p.waitForFunction(()=>typeof isSekiGaeOwnedStorageKey==='function');
        check(await p.evaluate(()=>!isSekiGaeOwnedStorageKey('SekiGaeTrial_v1_system')&&!isSekiGaeOwnedStorageKey('SekiGaeTrial_sample_v1_system')),'production deletion does not own either trial namespace');
        check(await p.evaluate(()=>getClassesFromBackupFile({SekiGaeTrial_v1_system:JSON.stringify({classes:[{id:'x',name:'trial'}]})}).length===0),'production rejects trial-only backup identity');
        await p.goto(base+'sample.html');await p.getByRole('button',{name:'サンプルを使い始める'}).click();await settle();
        const sampleBefore=await p.evaluate(()=>JSON.stringify({currentStudents,seatAssignment,histories}));await resize(8,10);await p.waitForFunction(()=>NUM_COLS===8);
        await p.reload();await p.getByRole('button',{name:'サンプルを使い始める'}).click();await settle();
        check(await p.evaluate(b=>NUM_COLS===6&&NUM_ROWS===7&&JSON.stringify({currentStudents,seatAssignment,histories})===b,sampleBefore),'sample resets dimensions and content on reload');
        check(errors.length===0,'no JavaScript page errors');check(nativeDialogs.length===0,'no browser alert or confirm dialogs');
        report.errors=errors;report.nativeDialogs=nativeDialogs;return report;
    } finally {await context.close();}
}
