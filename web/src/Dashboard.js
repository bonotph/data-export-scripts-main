import { useState } from 'react';
import MainPage from './MainPage';
import Sidebar from './Sidebar';

export default function Dashboard() {
  const [history, setHistory] = useState([]);

  const addToHistory = (newEntry) => {
    setHistory((prevHistory) => {
      const updatedHistory = [newEntry, ...prevHistory];
      return updatedHistory.length > 4 ? updatedHistory.slice(0, 4) : updatedHistory;
    });
  };

  return (
    <div className="dashboard">
      <Sidebar history={history} />
      <MainPage setHistory={addToHistory} history={history} />
    </div>
  );
}