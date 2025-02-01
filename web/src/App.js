import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Login from "./Login";
import AuthProvider from "./AuthProvider";
import PrivateRoute from "./route";
import Dashboard from "./Dashboard.js";
import Info from "./Info.js";
import Options from "./Options.js";
import PageNotFound from "./PageNotFound.js";

function App(){
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="" element={<Login />} />
          <Route element={<PrivateRoute />}>
            <Route path="/dashboard" element={<Dashboard/>}/>
            <Route path="/info" element={<Info/>}/>
            <Route path="/options" element={<Options/>}/>
           <Route path="*" element={<PageNotFound />}/>
          </Route>
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;