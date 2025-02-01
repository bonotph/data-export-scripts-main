import Sidebar from './Sidebar';
import { useAuth } from './AuthProvider';
import MenuButton from './MenuButton';

export default function Options() {
    const auth = useAuth();

    const renderConsentSection = () => (
        <div className="accordion-body">
            Content for consent section 
        </div>
    );

    const renderPedigreeSection = () => (
        <div className="accordion-body">
            Content for pedigree section
        </div>
    );

    const renderReferrerSection = () => (
        <div className="accordion-body">
            Content for referrer section
        </div>
    );

    const renderResearchReportSection = () => (
        <div className="accordion-body">
            Content for research report section
        </div>
    );

    const renderCfClinicalSummarySection = () => (
        <div className="accordion-body">
            Content for CF clinical summary section
        </div>
    );

    const renderCfHpoFamilySection = () => (
        <div className="accordion-body">
            Content for CF HPO family section
        </div>
    );

    const sections = [
        { title: 'consent', render: renderConsentSection },
        { title: 'pedigree', render: renderPedigreeSection },
        { title: 'referrer', render: renderReferrerSection },
        { title: 'research report', render: renderResearchReportSection },
        { title: 'cf clinical summary', render: renderCfClinicalSummarySection },
        { title: 'cf hpo family', render: renderCfHpoFamilySection },
    ];

    return (
        <>
            <Sidebar />
            <div className="container text-center">
            <br/>
            <div class="row justify-content-end">
          <div className='col-1'>
          <MenuButton/>
          </div>
          <div class="col-8">
          <h3 className = "title">Options</h3>
          </div>
          <div class="col-3">
      
          <button onClick={() => auth.logOut()} className="logout">Logout</button>
          </div>
        </div>
                <div className="row justify-content-center mt-3">
                    <div className="card other">
                        <div className="card-body">
                            <h4 className="card-title text-center mb-4">Tables</h4>
                            <div className="accordion" id="optionsAccordion">
                                {sections.map((section, index) => (
                                    <div className="accordion-item" key={index}>
                                        <h2 className="accordion-header" id={`heading${index}`}>
                                            <button 
                                                className="accordion-button collapsed" 
                                                type="button" 
                                                data-bs-toggle="collapse" 
                                                data-bs-target={`#collapse${index}`} 
                                                aria-expanded="false" 
                                                aria-controls={`collapse${index}`}
                                            >
                                                {section.title}
                                            </button>
                                        </h2>
                                        <div 
                                            id={`collapse${index}`} 
                                            className="accordion-collapse collapse" 
                                            aria-labelledby={`heading${index}`} 
/*                                             data-bs-parent="#optionsAccordion" */
                                        >
                                            {section.render()}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}