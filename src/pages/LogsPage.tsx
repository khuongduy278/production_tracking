import React, { useEffect, useState } from 'react';
import { collection, query, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/errorHandling';
import { Log } from '../types';

export default function LogsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'logs'), orderBy('timestamp', 'desc'), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Log));
      setLogs(data);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'logs');
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) return <div className="p-8 flex justify-center"><div className="animate-pulse">Đang tải lịch sử...</div></div>;

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      <h1 className="font-playfair text-3xl md:text-4xl font-medium text-slate-900 tracking-tight">Lịch sử cập nhật</h1>

      <div className="bg-white shadow-sm rounded-lg border border-slate-200 overflow-hidden">
        <div className="divide-y divide-slate-100">
          {logs.length === 0 ? (
            <div className="p-8 text-center text-slate-500">Chưa có lịch sử cập nhật nào.</div>
          ) : (
            logs.map(log => (
              <div key={log.id} className="p-5 hover:bg-slate-50 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-slate-900">{log.userName}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium uppercase tracking-wider">
                      {log.action}
                    </span>
                  </div>
                  <span className="font-mono text-xs text-slate-500">
                    {new Date(log.timestamp).toLocaleString('vi-VN')}
                  </span>
                </div>
                <p className="text-sm text-slate-600 mt-1 leading-relaxed">{log.details}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
