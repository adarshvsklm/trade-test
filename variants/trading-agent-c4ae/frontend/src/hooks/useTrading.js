import { useState, useEffect, useCallback, useRef } from "react";
import { api, createWebSocket } from "../utils/api";

export function useTrading() {
  const [strategies, setStrategies] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const wsRef = useRef(null);

  useEffect(() => {
    api.getStrategies().then(setStrategies).catch(console.error);
    refreshSessions();

    wsRef.current = createWebSocket((data) => {
      if (data.type === "tick") {
        setSessions((prev) =>
          prev.map((s) =>
            s.session_id === data.session_id
              ? { ...s, portfolio: data.portfolio, running: true }
              : s
          )
        );
      }
    });

    return () => wsRef.current?.close();
  }, []);

  const refreshSessions = useCallback(async () => {
    try {
      const data = await api.getSessions();
      setSessions(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const startTrading = useCallback(async (params) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.startTrading(params);
      await refreshSessions();
      return result;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [refreshSessions]);

  const stopTrading = useCallback(async (sessionId) => {
    try {
      await api.stopTrading(sessionId);
      await refreshSessions();
    } catch (e) {
      setError(e.message);
    }
  }, [refreshSessions]);

  return {
    strategies,
    sessions,
    loading,
    error,
    startTrading,
    stopTrading,
    refreshSessions,
  };
}
