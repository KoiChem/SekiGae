async page => {
    const url=new URL(page.url()),root=url.origin+url.pathname.split('/prototype/')[0];
    const context=await page.context().browser().newContext();const p=await context.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
    const report=[];const assert=(v,m)=>{if(!v)throw new Error(m)};
    try {
        await p.goto(root+'/prototype/index.html');await p.waitForFunction(()=>typeof currentStudents!=='undefined');
        for(const [cols,rows,checkerboard,historyCount] of [[8,10,false,20],[5,7,true,5]]){
            await p.evaluate(({cols,rows,historyCount})=>{
                setGridDimensions(cols,rows);
                currentStudents=Array.from({length:TOTAL_SEATS},(_,i)=>({id:String(i+1).padStart(2,'0'),name:`架空${i+1}`,kana:`かくう${i+1}`,gender:i%2?'女':'男',attr1:'',attr2:'',flags:''}));
                currentStudents[0].flags='@(a1) NG(02)';currentStudents[2].flags=`@(${'abcdefgh'[cols-1]}${rows})`;
                histories=Array.from({length:historyCount},(_,h)=>({cols,rows,date:`検証${h}`,assignment:Array.from({length:TOTAL_SEATS},(_,i)=>({...currentStudents[(i+h*3)%TOTAL_SEATS]})),inactiveSeats:[]}));
                inactiveSeats=new Set();seatAssignment=Array(TOTAL_SEATS).fill(null);previewAssignment=null;previewInactiveSeatsBackup=null;shuffleCandidates=[];clearPendingHistoryShuffleMeta();
                document.getElementById('overall-rules').value='';initGrid();setActionButtons(false,false);checkerboardOffset=0;saveCurrentClassData();loadCurrentClassData();
                window.__shuffleStarted=performance.now();
            },{cols,rows,historyCount});
            await p.evaluate(checkerboard=>{void prepareShuffle(checkerboard,{skipEdgeGuard:true});},checkerboard);
            await p.waitForFunction(()=>!isCalculating&&!!previewAssignment,{},{timeout:45000});
            const result=await p.evaluate(()=>{
                const ids=previewAssignment.filter(Boolean).map(s=>s.id),a=previewAssignment.findIndex(s=>s?.id==='01'),b=previewAssignment.findIndex(s=>s?.id==='02');
                return {cols:NUM_COLS,rows:NUM_ROWS,count:ids.length,unique:new Set(ids).size,first:previewAssignment[0]?.id,last:previewAssignment[TOTAL_SEATS-1]?.id,ngOk:!isAdjacentIncludingDiagonal(a,b),candidate:shuffleCandidates.length,candidateCols:shuffleCandidates[0]?.cols,seconds:(performance.now()-window.__shuffleStarted)/1000,algorithmSeconds:lastShuffleLog?.totalTime,checkerboardOk:previewAssignment.every((s,i)=>s.gender===(getDefaultSeatGender(i)))};
            });
            assert(result.count===cols*rows&&result.unique===cols*rows,'shuffle lost or duplicated a student');
            assert(result.first==='01'&&result.last==='03'&&result.ngOk,'fixed-seat or NG constraint failed');
            assert(result.candidate===1&&result.candidateCols===cols,'candidate grid was not recorded');
            if(checkerboard)assert(result.checkerboardOk,'checkerboard violated gender pattern');
            await p.evaluate(async()=>{cancelPreview();await restoreShuffleCandidate(0);});
            assert(await p.evaluate(()=>previewAssignment.length===TOTAL_SEATS),'candidate restore dimensions differ');
            report.push({...result,checkerboard,historyCount});
        }
        assert(errors.length===0,errors.join('\n'));return {report,errors};
    }finally{await context.close();}
}
