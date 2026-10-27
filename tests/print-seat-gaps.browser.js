// Run through Playwright MCP browser_run_code_unsafe with this filename.
// Requires: python3 -m http.server 8765 --bind 127.0.0.1
// Uses an isolated browser context and only the existing sample fixture.
async page => {
    const context = await page.context().browser().newContext({ acceptDownloads: true });
    const p = await context.newPage();
    const errors = [];
    p.on('pageerror', e => errors.push(e.message));
    const base = 'http://127.0.0.1:8765';
    const assert = (value, message) => { if (!value) throw new Error(message); };
    const settle = async () => p.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))));
    const state = () => p.evaluate(() => JSON.parse(JSON.stringify(printSeatGaps)));
    const clickGap = async (axis, index, expected) => {
        await p.locator(`.print-gap-button[data-axis="${axis}"][data-index="${index}"]`).click();
        await p.waitForFunction(({axis,index,expected}) => {
            const b = document.querySelector(`.print-gap-button[data-axis="${axis}"][data-index="${index}"]`);
            return b?.dataset.multiplier === String(expected) && document.querySelector('.print-gap-controls').style.visibility === 'visible';
        }, {axis,index,expected});
        await settle();
    };
    const measure = () => p.evaluate(() => {
        const g = document.getElementById('print-seat-grid');
        const cs = getComputedStyle(g);
        const columns = cs.gridTemplateColumns.split(' ').map(parseFloat);
        const rows = cs.gridTemplateRows.split(' ').map(parseFloat);
        return {columns,rows,font:parseFloat(getComputedStyle(g.querySelector('[data-row-key="name"] .seat-fixed-text')).fontSize)};
    });
    const report = {};
    try {
        await p.setViewportSize({width:1280,height:900});
        await p.goto(`${base}/index.html`);
        await p.waitForFunction(() => typeof appData !== 'undefined');
        await p.evaluate(async () => {
            const fixture = await (await fetch('meibo_sample.json')).json();
            for (const [key,value] of Object.entries(fixture)) localStorage.setItem(key.replace('SekigaeKun_sample_v6_', PREFIX),value);
            loadAppSystemData(); loadCurrentClassData();
            window.__originalClass = appData.currentClassId;
            window.__originalInactive = [...inactiveSeats];
        });
        assert((await state()).columns.every(x=>x===1), 'legacy fixture must default to 1');
        await p.evaluate(() => {
            const key = `${PREFIX}data_${appData.currentClassId}`;
            const data = JSON.parse(localStorage.getItem(key));
            data.printSeatGaps = {columns:[1.5,2,3,1,1], rows:[1,1.5,2,3,1,1]};
            localStorage.setItem(key, JSON.stringify(data));
            loadCurrentClassData();
        });
        const migrated = await state();
        assert(JSON.stringify(migrated.columns)===JSON.stringify([2,2,3,1,1]) &&
            JSON.stringify(migrated.rows)===JSON.stringify([1,2,2,3,1,1]), 'legacy data migrates 1.5x to 2x and preserves 2x/3x');
        await p.evaluate(() => {
            const key = `${PREFIX}data_${appData.currentClassId}`;
            const data = JSON.parse(localStorage.getItem(key));
            delete data.printSeatGaps;
            localStorage.setItem(key, JSON.stringify(data));
            loadCurrentClassData();
        });
        const before = await p.evaluate(() => ({assignment:JSON.stringify(seatAssignment),history:JSON.stringify(histories),main:getComputedStyle(document.getElementById('seat-grid')).gridTemplateColumns}));
        await p.getByRole('button',{name:'印刷プレビュー',exact:true}).click();
        await settle();
        const shapes = [];
        for (const expected of [2,3,1]) {
            await clickGap('columns',1,expected);
            const m=await measure();
            assert(Math.abs(m.columns[3]-expected*96/25.4)<0.03, `actual column gap ${expected}`);
            assert(Math.abs(m.columns[1]-96/25.4)<0.03,'neighboring column gap unchanged');
            const b = p.locator('.print-gap-button[data-axis="columns"][data-index="1"]');
            const next = expected === 1 ? 2 : expected === 2 ? 3 : 1;
            assert((await b.getAttribute('aria-label')).includes(`${expected}倍。押すと${next}倍`), 'accessible label reports current and next multiplier');
            shapes.push(await b.locator('path').getAttribute('d'));
        }
        assert(new Set(shapes).size===3,'all three states have distinct wedge shapes');
        const key = p.locator('.print-gap-button[data-axis="rows"][data-index="2"]');
        await key.focus(); await key.press('Enter'); await settle();
        assert((await state()).rows[2]===2,'Enter cycles gap');
        assert(await key.evaluate(b=>b===document.activeElement),'focus survives rerender');
        await key.press('Space'); await settle();
        assert((await state()).rows[2]===3,'Space cycles gap');
        await p.evaluate(() => {for(const axis of ['columns','rows']) for(let i=0;i<printSeatGaps[axis].length;i++) while(printSeatGaps[axis][i]!==3) cyclePrintGap(axis,i);});
        await settle();
        assert((await state()).rows.every(x=>x===3),'rapid changes survive pending render generations');
        assert(await p.evaluate(b=>JSON.stringify(seatAssignment)===b.assignment&&JSON.stringify(histories)===b.history,before),'gap edits do not change placements or history');
        report.cycleKeyboardRapidClicks = 'passed';

        await p.evaluate(() => {
            inactiveSeats = new Set(Array.from({length:42},(_,i)=>i).filter(i=>i<6 || i%6===0));
            renderPrintLayout();
        });
        await settle();
        assert(await p.locator('.print-gap-button[data-index="0"]').count()===0,'cropped boundary controls hidden');
        assert((await state()).columns[0]===3,'cropped setting retained');
        await p.evaluate(() => { printInactiveMode='frame'; renderPrintLayout(); }); await settle();
        assert(await p.locator('.print-gap-button').count()===11,'frame restores all 11 controls');
        await p.evaluate(() => { printInactiveMode='hide'; inactiveSeats=new Set(Array.from({length:42},(_,i)=>i));renderPrintLayout(); }); await settle();
        assert(await p.locator('.print-gap-button').count()===0,'no controls for degenerate empty grid');
        await p.evaluate(() => {inactiveSeats=new Set(window.__originalInactive);printInactiveMode='hide';renderPrintLayout();}); await settle();
        report.cropAndEmpty = 'passed';

        await p.getByRole('button',{name:'印刷プレビューを閉じる',exact:true}).click();
        const other = await p.evaluate(()=>appData.classes.find(c=>c.id!==window.__originalClass).id);
        await p.locator('#class-select').selectOption(other);
        assert((await state()).columns.every(x=>x===1),'other legacy class has own default gaps');
        await p.evaluate(()=>createNewClass());
        assert((await state()).rows.every(x=>x===1),'new class defaults to 1');
        const original = await p.evaluate(()=>window.__originalClass);
        await p.locator('#class-select').selectOption(original);
        assert((await state()).columns.every(x=>x===3),'original class retains its gap settings');
        await p.reload(); await p.waitForFunction(()=>currentStudents.length>0);
        assert((await state()).rows.every(x=>x===3),'reload retains saved settings');
        await p.locator('#history-select').selectOption('1');
        assert((await state()).rows.every(x=>x===3),'history restore leaves class gap setting unchanged');
        assert(await p.evaluate(b=>getComputedStyle(document.getElementById('seat-grid')).gridTemplateColumns===b.main,before),'normal grid spacing unchanged');
        await p.evaluate(()=>openExportBackupModal());
        const downloadEvent = p.waitForEvent('download');
        await p.evaluate(()=>confirmExportBackup());
        const download=await downloadEvent;
        const stream=await download.createReadStream(); let backupText='';
        for await(const chunk of stream) backupText+=chunk.toString();
        const backup=JSON.parse(backupText);
        assert(JSON.parse(backup[`SekigaeKun_v6_data_${original}`]).printSeatGaps.columns.every(x=>x===3),'export contains gap settings');
        await p.evaluate(({backup,original})=>{
            localStorage.clear(); mergeImportedBackupIntoLocalStorage(backup,[original]);loadAppSystemData();loadCurrentClassData();
        },{backup,original});
        assert((await state()).rows.every(x=>x===3),'backup import restores gap settings');
        const legacyBackup = JSON.parse(JSON.stringify(backup));
        const legacyKey = `SekigaeKun_v6_data_${original}`;
        const legacyClass = JSON.parse(legacyBackup[legacyKey]);
        legacyClass.printSeatGaps.columns[0] = 1.5;
        legacyClass.printSeatGaps.rows[0] = 2;
        legacyBackup[legacyKey] = JSON.stringify(legacyClass);
        await p.evaluate(({backup,original})=>{mergeImportedBackupIntoLocalStorage(backup,[original]);loadAppSystemData();loadCurrentClassData();},{backup:legacyBackup,original});
        assert((await state()).columns[0]===2 && (await state()).rows[0]===2 && (await state()).columns[1]===3,'legacy backup maps 1.5x to 2x and retains 2x and 3x');
        await p.evaluate(({backup,original})=>{mergeImportedBackupIntoLocalStorage(backup,[original]);loadAppSystemData();loadCurrentClassData();},{backup,original});
        report.classReloadHistoryBackup = 'passed';

        await p.getByRole('button',{name:'印刷プレビュー',exact:true}).click(); await settle();
        report.layouts=[];
        for(const [width,height] of [[1440,1000],[1280,900],[1024,768],[768,1024],[375,812]]) {
            await p.setViewportSize({width,height});
            for(const orientation of ['landscape','portrait']) for(const student of [false,true]) {
                await p.evaluate(({orientation,student})=>{
                    printInactiveMode='frame'; printIsStudentView=student; setPrintOrientation(orientation);renderPrintLayout();
                },{orientation,student}); await settle();
                const geometry=await p.evaluate(()=>{
                    const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
                    const paper=rect(document.querySelector('.print-page'));
                    const shell=rect(document.querySelector('.print-page-shell'));
                    const buttons=[...document.querySelectorAll('.print-gap-button')].map(e=>({...rect(e),axis:e.dataset.axis}));
                    const enclosed=buttons.every(r=>r.left>=shell.left-1&&r.right<=shell.right+1&&r.top>=shell.top-1&&r.bottom<=shell.bottom+1);
                    const overlap=buttons.some((a,i)=>buttons.slice(i+1).some(b=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top));
                    const outside=buttons.every(r=>r.right<=paper.left||r.left>=paper.right||r.bottom<=paper.top||r.top>=paper.bottom);
                    const expectedSides=buttons.every(r=>r.axis==='columns'?(getPrintStudentView()?r.bottom<=paper.top:r.top>=paper.bottom):(getPrintStudentView()?r.left>=paper.right:r.right<=paper.left));
                    const seat=(r,c)=>[...document.querySelectorAll('.print-seat')].find(e=>+e.style.gridRowStart===r*2+1&&+e.style.gridColumnStart===c*2+1).getBoundingClientRect();
                    const aligned=[...document.querySelectorAll('.print-gap-button')].every(b=>{
                        const i=+b.dataset.index, br=b.getBoundingClientRect();
                        if(b.dataset.axis==='columns') {const a=seat(0,i),z=seat(0,i+1);return Math.abs((br.left+br.right)/2-(getPrintStudentView()?(z.right+a.left)/2:(a.right+z.left)/2))<0.3;}
                        const a=seat(i,0),z=seat(i+1,0);return Math.abs((br.top+br.bottom)/2-(getPrintStudentView()?(a.bottom+z.top)/2:(z.bottom+a.top)/2))<0.3;
                    });
                    const clipped=[...document.querySelectorAll('.print-seat-content .seat-fixed-text')].filter(t=>{
                        const range=document.createRange();range.selectNodeContents(t);const a=range.getBoundingClientRect(),b=t.closest('.seat-fixed-row').getBoundingClientRect();
                        return a.left<b.left-1||a.right>b.right+1||a.top<b.top-1||a.bottom>b.bottom+1;
                    }).length;
                    const sample = document.querySelector('.print-gap-button');
                    const dimensions = {padding:getComputedStyle(sample).padding, svgWidth:getComputedStyle(sample.querySelector('svg')).width,
                        shellPadding:getComputedStyle(document.querySelector('.print-page-shell')).padding};
                    return {enclosed,overlap,outside,expectedSides,aligned,dimensions,clipped,minTarget:Math.min(...buttons.map(b=>Math.min(b.width,b.height))),horizontalOverflow:document.documentElement.scrollWidth>innerWidth,paper,grid:rect(document.getElementById('print-seat-grid')),root:rect(document.getElementById('print-root')),scale:printScreenScale,buttons};
                });
                assert(geometry.enclosed&&!geometry.overlap&&geometry.outside&&geometry.expectedSides&&geometry.aligned&&!geometry.horizontalOverflow,`geometry ${width}/${orientation}/${student}: ${JSON.stringify(geometry)}`);
                assert(geometry.clipped===0,`text clipping ${width}/${orientation}/${student}: ${geometry.clipped}`);
                assert(geometry.dimensions.padding==='0px'&&geometry.dimensions.svgWidth==='18px','button padding and wedge dimensions');
                assert(geometry.dimensions.shellPadding===(student?'32px 32px 0px 0px':'0px 0px 32px 32px'),'screen-only control gutter is 32px');
                if(width>=768) assert(geometry.minTarget>=27.9 && geometry.minTarget<=28.1,'tablet/desktop target is 28px');
                report.layouts.push({width,height,orientation,student,...geometry});
                if(width===768&&orientation==='portrait'&&student) await p.screenshot({path:'.playwright-mcp/print-gaps-v2-student-tablet.png',fullPage:true});
            }
        }
        await p.setViewportSize({width:1280,height:900});
        await p.evaluate(()=>{
            printInactiveMode='frame';printIsStudentView=false;printSeatGaps=normalizePrintSeatGaps();setPrintOrientation('portrait');renderPrintLayout();
        }); await settle();
        const baseline=await measure();
        await p.evaluate(()=>{printSeatGaps.rows.fill(3);renderPrintLayout();});await settle();
        const rowOnly=await measure();
        assert(Math.abs(rowOnly.columns[0]-baseline.columns[0])<0.03&&Math.abs(rowOnly.font-baseline.font)<0.03,'spare vertical space must preserve seat/text sizes');
        await p.evaluate(()=>{printSeatGaps.columns.fill(3);renderPrintLayout();});await settle();
        const max=await measure();
        assert(max.font>baseline.font*0.90,'all expanded gaps must not excessively shrink text');
        await p.evaluate(()=>{printSeatGaps=normalizePrintSeatGaps();renderPrintLayout();});await settle();
        const restored=await measure();assert(Math.abs(restored.font-baseline.font)<0.01,'returning to 1 restores original font size');
        report.textSizes={baseline:baseline.font,rowOnly:rowOnly.font,max:max.font,restored:restored.font};
        report.pdf=[];
        for(const orientation of ['landscape','portrait']) {
            await p.evaluate(o=>{
                printSeatGaps=normalizePrintSeatGaps({columns:[1,3,1,3,1],rows:[1,1,3,1,3,1]});
                setPrintOrientation(o);renderPrintLayout();window.print=()=>{window.__printCalled=true};
            },orientation); await settle();
            await p.evaluate(()=>executePrint());
            assert(await p.evaluate(()=>window.__printCalled),'print button executes print path');
            await p.emulateMedia({media:'print'});
            assert(await p.evaluate(()=>[...document.querySelectorAll('.print-gap-button')].every(b=>b.getBoundingClientRect().width===0)),'controls hidden in print');
            const gaps=await measure();
            assert(Math.abs(gaps.columns[3]-3*96/25.4)<0.03,'print path keeps 3mm gap');
            assert(Math.abs(gaps.rows[5]-3*96/25.4)<0.03,'print path keeps 3mm row gap');
            await p.pdf({path:`.playwright-mcp/print-gaps-v2-${orientation}.pdf`,preferCSSPageSize:true,printBackground:true});
            report.pdf.push(orientation);
            await p.emulateMedia({media:'screen'});await p.evaluate(()=>window.dispatchEvent(new Event('afterprint')));await settle();
        }
        await p.goto(`${base}/sample.html`);
        await p.getByRole('button',{name:'サンプルを使い始める'}).click();
        assert((await state()).columns.every(x=>x===1),'sample starts at 1x');
        await p.getByRole('button',{name:'印刷プレビュー',exact:true}).click(); await settle();
        await clickGap('columns',1,2); await clickGap('columns',1,3);
        await p.locator('#btn-print-view-toggle').click();
        await p.locator('input[name="print-orientation"][value="portrait"]').check(); await settle();
        assert((await state()).columns[1]===3,'sample retains 3x across view and orientation');
        await p.reload(); await p.getByRole('button',{name:'サンプルを使い始める'}).click();
        assert((await state()).columns.every(x=>x===1),'sample reload resets changes');
        assert(await p.evaluate(original=>JSON.parse(localStorage.getItem(`SekigaeKun_v6_data_${original}`)).printSeatGaps.columns.every(x=>x===3),original),'sample leaves normal class data intact');
        report.sample='passed';
        assert(errors.length===0,`page errors: ${errors.join(',')}`);
        report.pageErrors=errors;
        return {...report, layouts: {cases:report.layouts.length, clipped:0, overlaps:0,
            tabletDesktopMinTarget:Math.min(...report.layouts.filter(x=>x.width>=768).map(x=>x.minTarget))}};
    } finally { await context.close(); }
}
