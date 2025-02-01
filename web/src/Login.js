import { useState } from "react";
import { useAuth } from "./AuthProvider";
import './Login.css';

const Login = () => {
  const [input, setInput] = useState({
    username: "",
    password: "",
  });
  const[msg, setMsg] = useState('');
  const [wiggle, setWiggle] = useState(false); 
  const [isLoading, setIsLoading] = useState(false)

  const auth = useAuth();
  const handleSubmitEvent = async (e) => {
    e.preventDefault();
    setMsg('')
    setWiggle(false)
    setIsLoading(true)
    setMsg('');
    if (input.username !== "" && input.password !== "") {
      const response = await auth.loginAction(input);
      if(response?.error){
        setMsg(response?.error);
        setWiggle(true)
      }
    }
    else {
      setMsg('Please provide a valid input');
      setWiggle(true)
    }
    setIsLoading(false)
  };

  const handleInput = (e) => {
    const { name, value } = e.target;
    setInput((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  return (
    <div className = "box">
    <div className="row justify-content-center">
        <img src = "HKGI_Logo.png" alt = "HKGI logo" className = "HKGI"/>
        <div className="toolTitle">Monthly Report Generation Tool</div>
    </div>
    <br/>
    <form onSubmit={handleSubmitEvent}>
      <div className="form_control loginForm">
        <label htmlFor="username" className = "userlabel">Username:</label>
        <input
          type="name"
          id="username"
          name="username"
          className = {wiggle?'wrong':''}
          value={input.username}
          onChange={handleInput}
        />
      </div>
      <div className="form_control">
        <label htmlFor="password" className = "userlabel">Password:</label>
        <input
          type="password"
          id="password"
          name="password"
          className = {wiggle?'wrong':''}
          value={input.password}
          onChange={handleInput}
        />
      </div>        <br/>
      <div className="row justify-content-center">
      <button 
        className={`login ${isLoading ? 'disabled' : ''}`}
        type="submit" 
        disabled={isLoading}
      >
        {isLoading ? 
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid" width="20" height="20" 
            style={{
              shapeRendering: "auto", 
              display: "block",  
            }}
            xmlnsXlink="http://www.w3.org/1999/xlink"
          >
            <g>
              <circle strokeDasharray="164.93361431346415 56.97787143782138" r="35" strokeWidth="10" stroke="#FFFFFF" fill="none" cy="50" cx="50">
                <animateTransform keyTimes="0;1" values="0 50 50;360 50 50" dur="1s" repeatCount="indefinite" type="rotate" attributeName="transform"></animateTransform>
              </circle>
              <g></g>
            </g>
          </svg> : 'Login'
        }
      </button>
      <p className = {wiggle? "wigglemsg": "msg"}>{msg}</p>
      </div>
    </form>
    </div>
  );
};

export default Login;