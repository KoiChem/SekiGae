const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const target = path.join(__dirname, '../prototype/app.js');
const source = fs.readFileSync(fs.existsSync(target) ? target : path.join(__dirname, '../app.js'), 'utf8');
function setup(search = '') {
    const storage = new Map();
    const elements = new Map();
    const context = vm.createContext({console, URLSearchParams, setTimeout, clearTimeout,
        window:{location:{search},addEventListener(){}},
        document:{addEventListener(){},body:{classList:{contains:()=>false}},getElementById(id){
            if(!elements.has(id)) elements.set(id,{value:'',checked:false,dataset:{},classList:{toggle(){}}});
            return elements.get(id);
        }},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
        crypto:require('node:crypto').webcrypto});
    vm.runInContext(source,context);
    const run = code=>vm.runInContext(code,context);
    const json = code=>JSON.parse(JSON.stringify(run(code)));
    run(`renderAssignments=()=>{}; initGrid=()=>{}; updateCounters=()=>{}; updateHistorySelect=()=>{};
        clearManualMoveSelection=()=>{}; clearManualSwapUndoStack=()=>{}; setActionButtons=()=>{};
        showAlert=()=>{}; readSeatAppearanceSettingsFromMainUi=()=>({colors:{}});
        appData={currentClassId:'test',classes:[{id:'test',name:'テスト'}]};
        currentStudents=[{id:'01',name:'架空一'},{id:'02',name:'架空二'}];
        seatAssignment=Array(42).fill(null); seatAssignment[6]=currentStudents[0];seatAssignment[8]=currentStudents[1];
        inactiveSeats=new Set([7,41]);`);
    return {context,run,json,storage,elements};
}
module.exports={setup};
