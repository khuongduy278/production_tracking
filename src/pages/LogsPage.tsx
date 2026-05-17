import React, { useEffect, useState } from 'react';
import { collection, query, onSnapshot, orderBy, limit, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/errorHandling';
import { Log } from '../types';
import toast from 'react-hot-toast';
import { Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LogsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const { userData } = useAuth();
  const canDelete = ['admin', 'plan', 'head_production', 'tech', 'manager'].includes(userData?.role || '');

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

  const handleDeleteAll = () => {
    toast((t) => (
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-slate-900">
          Chắc chắn xóa TẤT CẢ lịch sử cập nhật?
        </p>
        <p className="text-xs text-slate-500">
          Hành động này không thể hoàn tác.
        </p>
        <div className="flex gap-2 justify-end mt-2">
          <button 
            onClick={() => toast.dismiss(t.id)}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
          >
            Hủy
          </button>
          <button 
            onClick={async () => {
              toast.dismiss(t.id);
              setIsDeleting(true);
              try {
                const logsRef = collection(db, 'logs');
                const snapshot = await getDocs(logsRef);
                
                const chunks = [];
                let currentBatch = writeBatch(db);
                let currentBatchCount = 0;

                snapshot.docs.forEach((doc) => {
                  currentBatch.delete(doc.ref);
                  currentBatchCount++;
                  if (currentBatchCount === 499) {
                    chunks.push(currentBatch);
                    currentBatch = writeBatch(db);
                    currentBatchCount = 0;
                  }
                });
                
                if (currentBatchCount > 0) {
                  chunks.push(currentBatch);
                }

                for (const batchChunk of chunks) {
                  await batchChunk.commit();
                }

                toast.success(`Đã xóa ${snapshot.size} lịch sử.`);
              } catch (err) {
                toast.error('Có lỗi xảy ra khi xóa lịch sử');
                handleFirestoreError(err, OperationType.DELETE, 'logs');
              } finally {
                setIsDeleting(false);
              }
            }}
            className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
          >
            Xác nhận xóa
          </button>
        </div>
      </div>
    ), { duration: Infinity, id: 'delete-all-logs-toast' });
  };

  if (loading) return <div className="p-8 flex justify-center"><div className="animate-pulse">Đang tải lịch sử...</div></div>;

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="font-playfair text-3xl md:text-4xl font-medium text-slate-900 tracking-tight">Lịch sử cập nhật</h1>
        {canDelete && logs.length > 0 && (
          <button
            onClick={handleDeleteAll}
            disabled={isDeleting}
            className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded-md text-sm font-medium shadow-sm transition-colors flex items-center justify-center gap-2"
          >
            <Trash2 size={16} />
            {isDeleting ? 'Đang xóa...' : 'Xóa tất cả lịch sử'}
          </button>
        )}
      </div>

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
