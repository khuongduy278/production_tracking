import React, { useEffect, useState } from 'react';
import { collection, query, onSnapshot, orderBy, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/errorHandling';
import { Order } from '../types';
import { getOrderStatus } from '../lib/orderUtils';
import { Package, AlertCircle, Clock, CheckCircle2, TrendingUp, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';

export default function Dashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const { userData } = useAuth();

  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setOrders(data);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'orders');
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const seedData = async () => {
    if (!userData) return;
    setSeeding(true);
    const now = new Date();
    
    const sampleOrders = [
      {
        contractCode: 'HD-TEST-01', materialCode: 'VT-001', deliveryDate: new Date(now.getTime() - 86400000).toISOString(),
        plannedQuantity: 1000, actualQuantity: 800, cutAllowed: 1000, cutVertical: 900, sewBorder: 850, sewHorizontal: 800, inspect: 500, pack: 200,
        delayReason: 'Khách đổi mẫu thêu', notes: 'Cần đốc thúc đóng gói', updatedBy: userData.id, updatedAt: now.toISOString(), createdAt: now.toISOString()
      },
      {
        contractCode: 'HD-TEST-02', materialCode: 'VT-002', deliveryDate: new Date(now.getTime() + 86400000*2).toISOString(),
        plannedQuantity: 5000, actualQuantity: 2000, cutAllowed: 5000, cutVertical: 4500, sewBorder: 3000, sewHorizontal: 2500, inspect: 2000, pack: 1000,
        delayReason: '', notes: 'Giao gấp đợt 1', updatedBy: userData.id, updatedAt: now.toISOString(), createdAt: now.toISOString()
      },
      {
        contractCode: 'HD-TEST-03', materialCode: 'VT-003', deliveryDate: new Date(now.getTime() + 86400000*6).toISOString(),
        plannedQuantity: 2000, actualQuantity: 2000, cutAllowed: 2000, cutVertical: 2000, sewBorder: 2000, sewHorizontal: 2000, inspect: 2000, pack: 2000,
        delayReason: '', notes: '', updatedBy: userData.id, updatedAt: now.toISOString(), createdAt: now.toISOString()
      }
    ];

    try {
      for (const o of sampleOrders) {
        await addDoc(collection(db, 'orders'), o);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSeeding(false);
    }
  };

  if (loading) return <div className="p-8 flex justify-center"><div className="animate-pulse flex p-4 justify-center">Đang tải biểu đồ...</div></div>;

  const stats = {
    total: orders.length,
    today: orders.filter(o => getOrderStatus(o) === 'Khẩn cấp').length, // Khẩn cấp covers <=2 days
    urgent: orders.filter(o => getOrderStatus(o) === 'Khẩn cấp').length,
    soon: orders.filter(o => getOrderStatus(o) === 'Sắp đến hạn').length,
    late: orders.filter(o => getOrderStatus(o) === 'Trễ tiến độ').length,
    done: orders.filter(o => getOrderStatus(o) === 'Hoàn thành').length,
  };

  const statusPriority: Record<string, number> = {
    'Trễ tiến độ': 1,
    'Khẩn cấp': 2,
    'Sắp đến hạn': 3,
    'Hoàn thành': 4,
    'Bình thường': 5,
    'Chưa bắt đầu': 6
  };

  const topUrgentOrders = [...orders]
    .sort((a, b) => {
      const pA = statusPriority[getOrderStatus(a)] || 99;
      const pB = statusPriority[getOrderStatus(b)] || 99;
      if (pA !== pB) return pA - pB;
      const dA = a.deliveryDate ? new Date(a.deliveryDate).getTime() : Infinity;
      const dB = b.deliveryDate ? new Date(b.deliveryDate).getTime() : Infinity;
      return dA - dB;
    })
    .slice(0, 10);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-3xl font-serif italic text-slate-900">Dashboard theo dõi đơn hàng Phân xưởng May TPHCM</h2>
          <p className="text-slate-500 font-medium mt-1">Hôm nay, {new Date().toLocaleDateString('vi-VN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <div className="flex gap-4">
          {orders.length === 0 && userData?.role === 'admin' && (
            <button className="px-6 py-2 bg-white border border-slate-200 rounded-full text-sm font-bold shadow-sm hover:bg-slate-50 transition-colors" onClick={seedData} disabled={seeding}>
              TẠO DỮ LIỆU
            </button>
          )}
          <Link to="/orders" className="px-6 py-2 bg-slate-900 text-white rounded-full text-sm font-bold shadow-lg hover:bg-slate-800 transition-colors text-center inline-block">
            XEM TẤT CẢ
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
          <p className="text-[11px] uppercase tracking-widest text-slate-400 font-bold mb-2">Tổng đơn hàng</p>
          <p className="text-3xl font-black text-slate-900">{stats.total}</p>
        </div>
        
        <div className="bg-rose-50 p-6 rounded-2xl shadow-sm border border-rose-100 flex flex-col justify-between">
          <p className="text-[11px] uppercase tracking-widest text-rose-600 font-bold mb-2">Trễ tiến độ</p>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-black text-rose-700">{stats.late}</p>
            <span className="text-[10px] text-rose-500 font-bold border-l border-rose-200 pl-2 uppercase tracking-wider">Đã lố ngày</span>
          </div>
        </div>

        <div className="bg-orange-50 p-6 rounded-2xl shadow-sm border border-orange-100 flex flex-col justify-between">
          <p className="text-[11px] uppercase tracking-widest text-orange-600 font-bold mb-2">Khẩn cấp</p>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-black text-orange-700">{stats.urgent}</p>
            <span className="text-[10px] text-orange-500 font-bold border-l border-orange-200 pl-2 uppercase tracking-wider">Giao &lt;= 2 ngày</span>
          </div>
        </div>

        <div className="bg-amber-50 p-6 rounded-2xl shadow-sm border border-amber-100 flex flex-col justify-between">
          <p className="text-[11px] uppercase tracking-widest text-amber-600 font-bold mb-2">Sắp đến hạn</p>
          <p className="text-3xl font-black text-amber-700">{stats.soon}</p>
        </div>

        <div className="bg-emerald-50 p-6 rounded-2xl shadow-sm border border-emerald-100 flex flex-col justify-between md:col-span-2 xl:col-span-1">
          <p className="text-[11px] uppercase tracking-widest text-emerald-600 font-bold mb-2">Hoàn thành</p>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-black text-emerald-700">{stats.done}</p>
            <span className="text-[10px] text-emerald-500 font-bold border-l border-emerald-200 pl-2 uppercase tracking-wider text-nowrap">
              {stats.total > 0 ? Math.round((stats.done / stats.total) * 100) + '%' : '0%'}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden flex flex-col">
        <div className="px-8 py-6 border-b border-slate-100 flex flex-wrap justify-between items-center gap-4">
          <h3 className="text-xl font-bold tracking-tight uppercase text-slate-900">Danh sách Theo dõi Tiến độ</h3>
          <div className="flex gap-2">
             <span className="px-3 py-1 bg-red-100 text-red-700 text-[10px] font-black rounded-full">TRỄ HẠN</span>
             <span className="px-3 py-1 bg-amber-100 text-amber-700 text-[10px] font-black rounded-full">CẦN LƯU Ý</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="py-4 px-8 text-[11px] font-black text-slate-400 uppercase tracking-wider">Mã Hợp Đồng</th>
                <th className="py-4 px-6 text-[11px] font-black text-slate-400 uppercase tracking-wider">Mặt hàng</th>
                <th className="py-4 px-6 text-[11px] font-black text-slate-400 uppercase tracking-wider text-right">Tiến Độ Cuối</th>
                <th className="py-4 px-6 text-[11px] font-black text-slate-400 uppercase tracking-wider text-right">Ngày Giao Hàng</th>
                <th className="py-4 px-8 relative w-20"><span className="sr-only">Thao tác</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {topUrgentOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 px-8 text-center text-slate-500 font-medium">Không có đơn hàng gấp hoặc trễ.</td>
                </tr>
              ) : (
                topUrgentOrders.map(order => {
                  let lastStage = 'Chưa bắt đầu';
                  let lastStageValue = 0;
                  if (order.pack > 0) { lastStage = 'Đóng gói'; lastStageValue = order.pack; }
                  else if (order.inspect > 0) { lastStage = 'Kiểm'; lastStageValue = order.inspect; }
                  else if (order.sewHorizontal > 0) { lastStage = 'May ngang'; lastStageValue = order.sewHorizontal; }
                  else if (order.sewBorder > 0) { lastStage = 'May biên'; lastStageValue = order.sewBorder; }
                  else if (order.cutVertical > 0) { lastStage = 'Cắt dọc'; lastStageValue = order.cutVertical; }
                  else if (order.cutAllowed > 0) { lastStage = 'Đạt cho cắt'; lastStageValue = order.cutAllowed; }

                  const matCodePrefix = order.materialCode.substring(0, 4);

                  return (
                    <tr key={order.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="py-4 px-8">
                        <span className="font-bold text-slate-900 underline decoration-slate-200 underline-offset-4">{order.contractCode}</span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-sm text-slate-700 tracking-wider">
                          <strong>{matCodePrefix}</strong>
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <span className="text-sm font-medium text-slate-600">{lastStage}: {lastStageValue > 0 ? <span className="font-mono text-slate-900">{lastStageValue}</span> : '0'}</span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <span className="text-sm font-medium text-slate-600">{new Date(order.deliveryDate).toLocaleDateString('vi-VN')}</span>
                      </td>
                      <td className="py-4 px-8 text-right">
                        <Link to={`/orders/${order.id}`} className="inline-block px-4 py-2 text-[10px] font-bold bg-white border border-slate-200 text-slate-700 rounded-lg shadow-sm hover:bg-slate-50 transition-colors uppercase tracking-widest text-center">
                          Cập nhật
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color, bg }: any) {
  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col items-start">
      <div className={`p-2 rounded-lg ${bg} ${color} mb-3`}>
        <Icon size={24} />
      </div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      <p className="text-sm font-medium text-gray-500 mt-1">{title}</p>
    </div>
  );
}
