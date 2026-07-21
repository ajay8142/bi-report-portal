import { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/axiosInstance';

// Shared across every admin tab so switching BIP Enterprise / BIP Free in the
// AdminLayout top-bar dropdown is reflected everywhere at once — each tab
// reads `engine` from here and refetches when it changes, instead of only
// picking up the new edition on next navigation/mount.
const ReportEngineContext = createContext(null);

export function ReportEngineProvider({ children }) {
  const [engine, setEngineState] = useState(null);

  useEffect(() => {
    api.get('/admin/report-engine')
      .then(res => setEngineState(res.data.data.engine))
      .catch(() => setEngineState('bip'));
  }, []);

  const setEngine = async (value) => {
    const previous = engine;
    setEngineState(value); // optimistic — immediately triggers every subscribed tab to refetch
    try {
      await api.put('/admin/report-engine', { engine: value });
    } catch (err) {
      setEngineState(previous); // revert if the server rejected/failed the switch
      throw err;
    }
  };

  return (
    <ReportEngineContext.Provider value={{ engine, setEngine }}>
      {children}
    </ReportEngineContext.Provider>
  );
}

export const useReportEngine = () => useContext(ReportEngineContext);
