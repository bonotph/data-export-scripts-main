
import {useState} from 'react';
import {debounce} from 'lodash';
import JSZip from 'jszip';
import './MainPage.css';
import {useAuth} from './AuthProvider';
import MenuButton from './MenuButton';
export default function MainPage({history, setHistory}) {

    const [date, setDate] = useState(''); // date
    const [checked, setChecked] = useState(true); // default to today
    const [include, setInclude] = useState(true); // date-inclusive

    const [encrypt, setEncrypt]=useState(true); //encrypt xlsx
    const [isHovering, setIsHovering] = useState(false); //show filetype text
    const [type, setType] = useState(true); // convert filetype

    const [loading, setLoading] = useState(false); // loading
    const [progress, setProgress] = useState(0); // progress bar
    const [confirm, setConfirm] = useState(''); // confirm text
    const [time, setTime] = useState('');//convert time(line doesnt break so i need to set a new state)
    const [wiggle, setWiggle] = useState(false); // wiggle animation for no date
    const [controller, setController] = useState(null); // cancel
    const [isGeneratingAll, setIsGeneratingAll] = useState(false); //generate all

    //today
    const getToday = () => {
      var today = new Date();
      let dd = String(today.getDate()).padStart(2, '0');
      let mm = String(today.getMonth() + 1).padStart(2, '0'); 
      let yyyy = today.getFullYear();
      today = yyyy+"-"+mm+"-"+dd;
      return today;
    }

    const auth = useAuth();

    const handleClick = debounce(async (e) => {
      const filename = e.target.value;
        setWiggle(false);
        if (!filename) {
          setConfirm('Cannot find this file');
          setTime('');
          return;
        }if(!date && !checked){
          setConfirm('Please select a date first.');
          setTimeout(() => setWiggle(true), 5);
          setTime('');
          return;
        }
        setLoading(true);
        setConfirm("");
        setTime('');
        const abortController = new AbortController();
        setController(abortController);    
        try{
          var startTime = performance.now()
          const response = await fetch(process.env.REACT_APP_API_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': auth.token
            },
            body: JSON.stringify({ name:filename, csvdate:date||getToday(), inclusive: include, filetype: type, encryptFile: encrypt}),
                    signal: abortController.signal
          })
          
          if (response.ok && response.status === 200){
              const b = await response.blob();
              var url = window.URL.createObjectURL(b);
              var a = document.querySelector('.download');
              a.href = url;
              !type && filename.split('_')[0]!=='cf'? a.download = `${getToday().replaceAll("-","")}_${filename}${date==="" || date===getToday()?'':`(enddate_${date.replaceAll("-","")})`}.csv`:a.download = `${getToday().replaceAll("-","")}_${filename}${date===""||date===getToday()||filename==='cf_hpo_family'?'':`(enddate_${date.replaceAll("-","")})`}.xlsx`;
            a.click();
            const historyTime = new Date();
            const newEntry = `${a.download} generated at ${historyTime.toLocaleTimeString()}`;
            setHistory(newEntry);
            setLoading(false);
            var endTime = performance.now()
            let convertTime = ((endTime - startTime)/1000).toFixed(2);
            setConfirm(`"${filename}" monthly report is generated successfully.`);
            setTime(`(${convertTime} s)`);
            window.URL.revokeObjectURL(url);
          }else if (response.status === 204){
            setLoading(false);
            setConfirm('204: No content written');
            return;
          }else if(response.status === 500){
            setLoading(false);
            setConfirm('500: Internal server error');
            return;
          }else if(response.status === 511){
            setLoading(false);
            setConfirm('511: Cannot connect to server');
            return;
          }
          else{
            setLoading(false);
            setConfirm('Invalid response:', response.status);
            return;
          }
      } catch (error) {
        setLoading(false);
        if (error.name === 'AbortError') {
          console.log('Fetch aborted');
        } else {
          setConfirm(`Error: ${error.message}`);
        }
        return;
      } finally{
        setLoading(false);
        setController(null);
      }
      
    }, 500);





    const handleCancel = () => {
      if (controller) {
        controller.abort();
      }
      setLoading(false);
      setConfirm('Cancelled');
    };




    const handleType = (e)=> {
      e.stopPropagation();
     setType((state) => !state);
   };

   const handleAll = async() => {
      setProgress(1);
      setWiggle(false);
       const arr = ['consent', 'pedigree', 'referrer', 'research_report', 'cf_clinical_summary', 'cf_hpo_family'];
       setIsGeneratingAll(true);
       const zip = new JSZip();
       var startTime = performance.now()
       for (let i = 0; i < arr.length; i++) {
         await new Promise(resolve => setTimeout(resolve, 1000)); 
         const filename = arr[i];
         if(!date && !checked){
            setTime('');
           setConfirm('Please select a date first.');
           setTimeout(() => setWiggle(true), 5);
           return;
         }
         setLoading(true);
         setConfirm("");
         setTime('');

         try{
          console.log("hello");
           const response = await fetch(process.env.REACT_APP_API_URL, {
             method: 'POST',
             headers: {
               'Content-Type': 'application/json',
               'x-api-key': auth.token
             },
             body: JSON.stringify({ name:filename, csvdate:date||getToday(), inclusive: include, filetype: type, encryptFile: encrypt}),
           })
           
           if (response.ok && response.status === 200){
             const blob = await response.blob();
             zip.file(`${getToday().replaceAll("-","")}_${filename}${date===""||date===getToday()||filename==='cf_hpo_family'?'':`(enddate_${date.replaceAll("-","")})`}.xlsx`, blob);
             setConfirm(`"${filename}" monthly report is generated successfully.`);
           }else if (response.status === 204){
             setLoading(false);
             setConfirm('204: No content written');
             return;
           }else if(response.status === 500){
             setLoading(false);
             setConfirm('500: Internal server error');
             return;
           }else if(response.status === 511){
             setLoading(false);
             setConfirm('511: Cannot connect to server');
             return;
           }
           else{
             setLoading(false);
             setConfirm('Invalid response:', response.status);
             return; 
           }
       } catch (error) {
         setLoading(false);
         if (error.name === 'AbortError') {
           console.log('Fetch aborted');
         } else {
           setConfirm(`Error: ${error.message}`);
         }
         return;
       } finally{
        setProgress(((i + 1) / arr.length) * 100);
       }
     }
       try {
         const content = await zip.generateAsync({type:"blob"});
         const url = window.URL.createObjectURL(content);
         var a = document.querySelector('.download');
         a.href = url;
         a.download = `monthly_reports_${getToday().replaceAll("-","")}${date===""||date===getToday()?'':`(enddate_${date.replaceAll("-","")})`}.zip`;
         a.click();
         const historyTime = new Date();
         const newEntry = `${a.download} generated at ${historyTime.toLocaleTimeString()}`;
         setHistory(newEntry);
         window.URL.revokeObjectURL(url);
         var endTime = performance.now()
         let convertTime = ((endTime - startTime)/1000).toFixed(2);
         setConfirm("All reports are generated and zipped successfully.");
         setTime(`(${convertTime} s)`);
     } catch (error) {
         setConfirm(`Error creating zip: ${error.message}`);
     } finally {
         setLoading(false);
         setIsGeneratingAll(false);
         setProgress(0);
     }
   };

   return(
<div className="container text-center">
   <br/>
   <div class="row justify-content-end">
    <div className='col-1'>
    <MenuButton/>
    </div>
    <div class="col-8">
    <h3 className = "title">Monthly Report Generation Tool</h3>
    </div>
    <div class="col-3">
 
    <button onClick={() => auth.logOut()} className="logout">Logout</button>
    </div>
  </div>


   <div className="row">
     <form method="POST" enctype="multipart/form-data" onSubmit={(e) => e.preventDefault()}>
       <div className="col-sm-6 offset-md-3"> 
        <label for="date">Select end date:</label>
        <input className="form-check-input" type="checkbox" id="today" name="today" value="today" defaultChecked = {checked} onChange = {() => setChecked((state) => !state)}/>
         <label for= 'today' className = "form-check-label today">Today</label> 
         <input className="form-check-input" type="checkbox" id="encrypt" name="encrypt" value="encrypt" defaultChecked = {encrypt}  onChange = {() => setEncrypt((state) => !state)}/>
         <label for= 'encrypt' className="form-check-label encrypt">Encrypt(XLSX)</label> 
         <div className="info-container">
         <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-info-circle info-icon" viewBox="0 0 16 16">
             <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/>
             <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0"/>
         </svg>
       <span className="info" id ="info">
         <ul>
           <li>Click button: generate individual report</li>
           <li>Select end date: set closing date for report data</li>
           <li>Tick 'Today': set default end date to today</li>
           <li>Tick 'Encrypt': set file output to be password protected(only for XLSX)</li>
           <li>Click toggle switch: set end date to be inclusive/exclusive</li>
           <li>Click excel logo: change file type(csv/xlsx)</li>
           <li>Click 'Generate all': generate all reports(stored in zip folder)</li>
           <li>Click 'Cancel': cancel report generation(will not appear when generating all reports)</li>
           <li>Click 'Logout': return to login page</li>
           <li>Cf hpo family will always show the latest data regardless of the end date</li>
         </ul>
       </span>
   </div>
       </div>
       <br/>
       <div className="row justify-content-end no-gutter">
         <div className="col-sm-7 ">
         <input className="form-control" type="date" id="date" min = "2021-10-01" max = {getToday()} onChange={(e) => setDate(e.target.value)}/>
         </div>
         <div className="col-7 col-md-3">
         <div className="onoffswitch">
       <input type="checkbox" name="onoffswitch" className="onoffswitch-checkbox" id="myonoffswitch" tabindex="0" defaultChecked onChange = {() => setInclude((state) => !state)}/>
           <label className="onoffswitch-label" for="myonoffswitch">
           <span className="onoffswitch-inner"></span>
           <span className="onoffswitch-switch"></span>
         </label>
         </div>
         </div>
       </div>

       <br/>
       <div className="row justify-content-center">
       <div className="col-6">
         <div className = "card" id="card1" >
         <div className = "card-body">
         <div className="d-grid gap-4 ">
           
         <button className="btn" type="submit" value="consent" onClick={handleClick} disabled={loading}>consent<div className = "image-container" onMouseEnter={() => setIsHovering(true)} onMouseLeave={() => setIsHovering(false)}>{isHovering && (<div className="description">{type?'xlsx':'csv'}</div>)}<img src="excel_logo.png" alt="Excel Logo" className="excel-logo" onClick= {handleType}/> </div></button>
         <button className="btn" type="submit" value="pedigree" onClick={handleClick} disabled={loading}>pedigree<div className = "image-container" onMouseEnter={() => setIsHovering(true)} onMouseLeave={() => setIsHovering(false)}>{isHovering && (<div className="description">{type?'xlsx':'csv'}</div>)}<img src="excel_logo.png" alt="Excel Logo" className="excel-logo" onClick= {handleType}/> </div></button>
         <button className="btn" type="submit" value="referrer" onClick={handleClick} disabled={loading}>referrer<div className = "image-container" onMouseEnter={() => setIsHovering(true)} onMouseLeave={() => setIsHovering(false)}>{isHovering && (<div className="description">{type?'xlsx':'csv'}<br/></div>)}<img src="excel_logo.png" alt="Excel Logo" className="excel-logo" onClick= {handleType}/> </div></button>
         <button className="btn" type="submit" value="research_report" onClick={handleClick} disabled={loading}>research report<div className = "image-container" onMouseEnter={() => setIsHovering(true)} onMouseLeave={() => setIsHovering(false)}>{isHovering && (<div className="description">{type?'xlsx':'csv'}</div>)}<img src="excel_logo.png" alt="Excel Logo" className="excel-logo" onClick= {handleType}/> </div></button>
         </div>
         </div>
         </div>
         </div>
         <div className="col-6">
         <div className = "card" id="card2">
         <div className = "card-body">
         <div className="d-grid gap-4">
         <button className="btn" type="submit" value="cf_clinical_summary" onClick={handleClick} disabled={loading}>cf clinical summary<img src="excel_logo.png" alt="Excel Logo" className="excel-logo" onClick={(e) => e.stopPropagation()}/></button>
         <button className="btn" type="submit" value="cf_hpo_family" onClick={handleClick} disabled={loading}>cf hpo family (latest)<img src="excel_logo.png" alt="Excel Logo" className="excel-logo" onClick={(e) => e.stopPropagation()}/></button>
         </div>
         </div>
         </div>
         <br/>
         </div>
       </div>
     </form>
     <div className="col-sm-6 offset-sm-3 mt-3">
       <div className="card" id = "responseText">
         <div className="card-body">
           {!loading&&<button className="btn all" type="submit"  onClick={handleAll} value = "all" disabled={loading}>Generate all<img src="excel_logo.png" alt="Excel Logo" className="excel-logo" onClick={(e) => e.stopPropagation()}/></button>}
           {loading && <div className="spinner-border" role="status"></div>}
            {progress>0 && loading && <div className="progress">
              <div
                className="progress-bar"
                role="progressbar"
                style={{ width: `${progress}%` }}
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow={progress}
              >
              </div>
            </div>}
           {loading? <p></p>:<p className = {wiggle? "wiggle":" "}>{confirm}<br/>{time}</p>}
           <button className={loading&&!isGeneratingAll? 'btn btn-primary btn-sm showCancel': 'btn btn-primary btn-sm hideCancel'} onClick = {handleCancel} >Cancel</button>
           <a className="download"></a>
         </div>
       </div>
     </div>
   </div>
 </div>

 )
};

