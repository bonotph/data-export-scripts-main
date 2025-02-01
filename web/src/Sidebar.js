import { Link } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import './Sidebar.css';

export default function Sidebar({ history}) {
  const auth = useAuth();


  return (
    <>
      <div className="offcanvas offcanvas-start" tabIndex="-1" id="offcanvas" data-bs-keyboard="true" data-bs-backdrop="false">
        <div className="offcanvas-header">
          <h5 className="offcanvas-title" id="offcanvas">Menu</h5>
          <button type="button" className="btn-close text-reset" data-bs-dismiss="offcanvas" aria-label="Close"></button>
        </div>
        <div className="offcanvas-body">
          <ul className="nav flex-column">
            <li className="nav-item">
              <Link to="/dashboard" className="nav-link">
                <i className="bi bi-speedometer2"></i> Dashboard
              </Link>
            </li>
            <li className="nav-item">
              <Link to="/info" className="nav-link">
                <i className="bi bi-info-circle"></i> Info
              </Link>
            </li>
            <li className="nav-item">
              <Link to="/options" className="nav-link">
                <i className="bi bi-gear"></i> Options
              </Link>
            </li>
            <li className="nav-item">
              <Link to="/" className="nav-link" onClick={() => auth.logOut()}>
                <i className="bi bi-box-arrow-right"></i> Sign out
              </Link>
            </li>
          </ul>
        </div>
        <div className="offcanvas-header">
          <h6 className="offcanvas-title">History</h6>
        </div>
        <div className="offcanvas-body history">
          <ul className="history-log flex-column">
            {history? history.map((item, index) => (
              <li key={index}>
                <span>{item}</span>
              </li>
            )) : ''}
          </ul> 
        </div>
      </div>      
    </>
  );
}