import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Order } from '../types';
import { getOrderStatus } from '../lib/orderUtils';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, ComposedChart, Line
} from 'recharts';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Target, Layers, LayoutTemplate, CheckCircle2, TrendingUp, AlertCircle, Clock, CalendarIcon } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../lib/errorHandling';

export default function Analytics() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    const qOrders = query(collection(db, 'orders'));
    const unsubOrders = onSnapshot(qOrders, (snapshot) => {
      const ordersData: Order[] = [];
      snapshot.forEach((doc) => ordersData.push({ id: doc.id, ...doc.data() } as Order));
      setOrders(ordersData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'orders'));

    const qLogs = query(collection(db, 'logs'));
    const unsubLogs = onSnapshot(qLogs, (snapshot) => {
      const logsData: any[] = [];
      snapshot.forEach((doc) => logsData.push({ id: doc.id, ...doc.data() }));
      setLogs(logsData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'logs');
      setLoading(false);
    });

    return () => {
      unsubOrders();
      unsubLogs();
    };
  }, []);

  const {
    filteredOrders,
    stats,
    overallPieData,
    delayedOrders,
    delayReasonsList,
    dailyStageData
  } = useMemo(() => {
    // 1. Filter orders by selected month
    const currentDate = parseISO(`${selectedMonth}-01`);
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);

    const filtered = orders.filter(o => {
      const targetDate = o.deliveryDate || o.outsourcingDeliveryDate;
      if (!targetDate) return false;
      try {
        const orderDate = parseISO(targetDate);
        if (Number.isNaN(orderDate.getTime())) return false;
        return isWithinInterval(orderDate, { start: monthStart, end: monthEnd });
      } catch (e) {
        return false;
      }
    });

    // 2. Summary stats (Count based)
    const totalOrders = filtered.length;
    let notStartedCount = 0;
    let doneCount = 0;
    let inProgressCount = 0;

    filtered.forEach(o => {
      const status = getOrderStatus(o);
      const cutVertical = o.cutVertical || 0;
      
      if (cutVertical === 0) {
        notStartedCount++;
      } else if (status === 'Hoàn thành') {
        doneCount++;
      } else {
        inProgressCount++;
      }
    });

    const notStartedPct = totalOrders > 0 ? (notStartedCount / totalOrders) * 100 : 0;
    const inProgressPct = totalOrders > 0 ? (inProgressCount / totalOrders) * 100 : 0;
    const donePct = totalOrders > 0 ? (doneCount / totalOrders) * 100 : 0;

    const stats = {
      totalOrders,
      notStartedCount,
      inProgressCount,
      doneCount,
      notStartedPct: notStartedPct.toFixed(1),
      inProgressPct: inProgressPct.toFixed(1),
      donePct: donePct.toFixed(1)
    };

    // 3. Status breakdown for Pie Chart
    const overallPieData = [
      { name: 'Chưa thực hiện', value: notStartedCount, color: '#cbd5e1' },
      { name: 'Đang thực hiện', value: inProgressCount, color: '#60a5fa' },
      { name: 'Đã hoàn thành', value: doneCount, color: '#10b981' }
    ].filter(item => item.value > 0);

    // 4. Daily Stage Data
    let cutVerticalSum = 0;
    let sewBorderSum = 0;
    let sewHorizontalSum = 0;
    let cutAllowedSum = 0;
    let inspectSum = 0;
    let packSum = 0;

    const sortedLogs = [...logs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const orderStageState: Record<string, any> = {};

    sortedLogs.forEach(log => {
      const dateStr = log.timestamp ? log.timestamp.split('T')[0] : '';
      const isSelectedDate = dateStr === selectedDate;
      const details = log.details || '';
      
      if (!orderStageState[log.orderId]) {
         orderStageState[log.orderId] = { cutAllowed: 0, cutVertical: 0, sewBorder: 0, sewHorizontal: 0, inspect: 0, pack: 0 };
      }
      const st = orderStageState[log.orderId];

      const parseValue = (key: string, current: number) => {
        const regex = new RegExp(`${key}\\((\\d+)\\)`);
        const match = details.match(regex);
        return match ? parseInt(match[1], 10) : current;
      };

      if (details.includes('Cập nhật tiến độ') || details.includes('Đạt cho cắt') || details.includes('Cắt dọc') || details.includes('May biên') || details.includes('May ngang') || details.includes('Kiểm') || details.includes('Đóng gói')) {
        const nextCutAllowed = parseValue('Đạt cho cắt', st.cutAllowed);
        const nextCutVertical = parseValue('Cắt dọc', st.cutVertical);
        const nextSewBorder = parseValue('May biên', st.sewBorder);
        const nextSewHorizontal = parseValue('May ngang', st.sewHorizontal);
        const nextInspect = parseValue('Kiểm', st.inspect);
        const nextPack = parseValue('Đóng gói', st.pack);

        if (isSelectedDate) {
           cutAllowedSum += Math.max(0, nextCutAllowed - st.cutAllowed);
           cutVerticalSum += Math.max(0, nextCutVertical - st.cutVertical);
           sewBorderSum += Math.max(0, nextSewBorder - st.sewBorder);
           sewHorizontalSum += Math.max(0, nextSewHorizontal - st.sewHorizontal);
           inspectSum += Math.max(0, nextInspect - st.inspect);
           packSum += Math.max(0, nextPack - st.pack);
        }

        st.cutAllowed = nextCutAllowed;
        st.cutVertical = nextCutVertical;
        st.sewBorder = nextSewBorder;
        st.sewHorizontal = nextSewHorizontal;
        st.inspect = nextInspect;
        st.pack = nextPack;
      }
    });

    orders.forEach(o => {
       const createDate = o.createdAt ? o.createdAt.split('T')[0] : '';
       if (createDate === selectedDate && !orderStageState[o.id]) {
          cutAllowedSum += (o.cutAllowed || 0);
          cutVerticalSum += (o.cutVertical || 0);
          sewBorderSum += (o.sewBorder || 0);
          sewHorizontalSum += (o.sewHorizontal || 0);
          inspectSum += (o.inspect || 0);
          packSum += (o.pack || 0);
       }
    });

    const dailyStageData = [
      { name: 'Đạt cho cắt', value: cutAllowedSum, fill: '#94a3b8' },
      { name: 'Cắt dọc', value: cutVerticalSum, fill: '#3b82f6' },
      { name: 'May biên', value: sewBorderSum, fill: '#8b5cf6' },
      { name: 'May ngang', value: sewHorizontalSum, fill: '#10b981' },
      { name: 'Kiểm tra', value: inspectSum, fill: '#f59e0b' },
      { name: 'Đóng gói', value: packSum, fill: '#ec4899' },
    ];

    // 5. Delayed Orders & Reasons
    const today = new Date();
    today.setHours(0,0,0,0);
    
    // Top trễ lâu nhất (Top 5)
    const delayedOrders = filtered
      .filter(o => getOrderStatus(o) === 'Trễ tiến độ')
      .map(o => {
        const oDate = parseISO(o.deliveryDate);
        const delayDays = Math.floor((today.getTime() - oDate.getTime()) / (1000 * 3600 * 24));
        return {
          ...o,
          delayDays: delayDays > 0 ? delayDays : 0
        };
      })
      .sort((a, b) => b.delayDays - a.delayDays)
      .slice(0, 5);

    // Lý do trễ
    const delayReasonsList = filtered
      .filter(o => (getOrderStatus(o) === 'Trễ tiến độ' || (o.delayReason && o.delayReason.trim() !== '')))
      .map(o => ({
        materialCode: o.materialCode,
        contractCode: o.contractCode,
        reason: (o.delayReason && o.delayReason.trim() !== '') ? o.delayReason : 'Chưa cập nhật lý do'
      }));

    return {
      filteredOrders: filtered,
      stats,
      overallPieData,
      delayedOrders,
      delayReasonsList,
      dailyStageData
    };

  }, [orders, logs, selectedMonth, selectedDate]);

  if (loading) {
    return <div className="p-8 flex justify-center"><div className="animate-pulse">Đang tải dữ liệu...</div></div>;
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50/50 p-4 md:p-8 overflow-y-auto">
      <div className="max-w-7xl mx-auto w-full space-y-6">
        
        {/* Header & Filter */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-playfair font-medium text-slate-900 tracking-tight">Báo cáo Phân tích</h1>
            <p className="text-slate-500 text-sm mt-1">Góc nhìn tổng quan về tình hình sản xuất và gia công</p>
          </div>
          <div className="flex items-center gap-3 bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
            <span className="text-sm font-medium text-slate-600 pl-2">Tháng / Năm:</span>
            <input 
              type="month" 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="border-none bg-slate-50 text-slate-800 text-sm font-medium focus:ring-0 rounded p-1 cursor-pointer"
            />
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm relative overflow-hidden group hover:border-blue-200 transition-colors">
            <div className="absolute -right-6 -top-6 text-slate-50 opacity-50 group-hover:scale-110 transition-transform"><Target size={120} /></div>
            <div className="relative z-10">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Kế hoạch SX</h3>
              <div className="text-3xl font-bold text-slate-900 tracking-tight flex items-baseline gap-2">
                {stats.totalOrders} <span className="text-sm font-medium text-slate-500">đơn hàng</span>
              </div>
              <p className="text-xs text-slate-400 mt-2">Tổng số đơn trong tháng</p>
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm relative overflow-hidden group hover:border-slate-300 transition-colors">
            <div className="absolute -right-6 -top-6 text-slate-50 opacity-50 group-hover:scale-110 transition-transform"><Clock size={120} /></div>
            <div className="relative z-10">
              <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Chưa thực hiện</h3>
              <div className="text-3xl font-bold text-slate-700 tracking-tight flex items-baseline gap-1">
                {stats.notStartedPct}<span className="text-lg text-slate-500">%</span>
              </div>
              <p className="text-xs text-slate-500 mt-2 font-medium">{stats.notStartedCount} đơn hàng</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm relative overflow-hidden group hover:border-blue-300 transition-colors">
             <div className="absolute -right-6 -top-6 text-blue-50 opacity-50 group-hover:scale-110 transition-transform"><TrendingUp size={120} /></div>
             <div className="relative z-10">
              <h3 className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-2">Đang thực hiện</h3>
              <div className="text-3xl font-bold text-blue-700 tracking-tight flex items-baseline gap-1">
                {stats.inProgressPct}<span className="text-lg text-blue-500">%</span>
              </div>
              <p className="text-xs text-blue-600/70 mt-2 font-medium">{stats.inProgressCount} đơn hàng</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm relative overflow-hidden group hover:border-emerald-300 transition-colors">
             <div className="absolute -right-6 -top-6 text-emerald-50 opacity-50 group-hover:scale-110 transition-transform"><CheckCircle2 size={120} /></div>
             <div className="relative z-10">
              <h3 className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-2">Đã hoàn thành</h3>
              <div className="text-3xl font-bold text-emerald-700 tracking-tight flex items-baseline gap-1">
                {stats.donePct}<span className="text-lg text-emerald-500">%</span>
              </div>
              <p className="text-xs text-emerald-600/70 mt-2 font-medium">{stats.doneCount} đơn hàng</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Chart - Volume over time */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm lg:col-span-2 flex flex-col h-[400px]">
             <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-slate-900 font-semibold">Sản lượng các công đoạn</h3>
                <p className="text-xs text-slate-500">Tổng sản lượng theo từng công đoạn sản xuất (Cắt dọc, May biên,...)</p>
              </div>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded p-1">
                <CalendarIcon className="w-4 h-4 text-slate-400 ml-1" />
                <input 
                  type="date" 
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="border-none bg-transparent text-slate-700 text-xs font-medium focus:ring-0 p-1 cursor-pointer"
                />
              </div>
             </div>
             <div className="flex-1 w-full min-h-0">
               {dailyStageData.some(d => d.value > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyStageData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(val) => new Intl.NumberFormat('vi-VN', { notation: 'compact' }).format(val)} />
                    <RechartsTooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: number) => new Intl.NumberFormat('vi-VN').format(value)}
                      cursor={{fill: '#f8fafc'}}
                    />
                    <Bar dataKey="value" name="Số lượng" radius={[4, 4, 0, 0]} maxBarSize={50}>
                      {
                        dailyStageData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))
                      }
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
               ) : (
                 <div className="flex items-center justify-center h-full text-sm text-slate-400">Không có dữ liệu công đoạn trong ngày {format(parseISO(selectedDate), 'dd/MM/yyyy')}</div>
               )}
             </div>
          </div>

          {/* Pie Chart - Tỷ lệ */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col h-[400px]">
             <div className="mb-4">
              <h3 className="text-slate-900 font-semibold">Tiến độ kế hoạch tháng</h3>
              <p className="text-xs text-slate-500">Phân bổ trạng thái của tháng</p>
             </div>
             <div className="flex-1 w-full min-h-0 relative">
               {overallPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={overallPieData}
                      cx="50%"
                      cy="45%"
                      innerRadius={70}
                      outerRadius={110}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                        if (percent < 0.05) return null;
                        const RADIAN = Math.PI / 180;
                        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                        const x = cx + radius * Math.cos(-midAngle * RADIAN);
                        const y = cy + radius * Math.sin(-midAngle * RADIAN);
                        return (
                          <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="bold">
                            {`${(percent * 100).toFixed(0)}%`}
                          </text>
                        );
                      }}
                      labelLine={false}
                    >
                      {overallPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      formatter={(value: number) => [value + ' đơn hàng', 'Số lượng']}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', bottom: 0 }} />
                  </PieChart>
                </ResponsiveContainer>
               ) : (
                 <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">
                   Không có dữ liệu
                 </div>
               )}
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6 mb-6">
          {/* List - Top 5 Trễ lâu nhất */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-[400px]">
             <div className="p-5 border-b border-slate-100 mb-2">
               <div className="flex items-center gap-2">
                 <AlertCircle className="w-5 h-5 text-rose-500" />
                 <h3 className="text-slate-900 font-semibold tracking-tight">Top 5 đơn trễ lâu nhất</h3>
               </div>
               <p className="text-xs text-slate-500 mt-1">Các đơn hàng chưa hoàn thành có số ngày trễ nhiều nhất</p>
             </div>
             <div className="flex-1 overflow-y-auto p-5 pt-0">
                {delayedOrders.length > 0 ? (
                  <div className="space-y-4">
                    {delayedOrders.map((order, idx) => (
                      <div key={order.id} className="flex items-start justify-between border-l-2 border-rose-400 pl-3 py-1">
                        <div>
                          <div className="font-semibold text-sm text-slate-800">{order.materialCode}</div>
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5">{order.contractCode}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-rose-600 font-bold text-sm">-{order.delayDays} ngày</div>
                          <div className="text-[10px] text-slate-400">Hạn: {new Date(order.deliveryDate || order.outsourcingDeliveryDate || '').toLocaleDateString('vi-VN')}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-sm tracking-tight text-slate-400">
                     Chưa ghi nhận đơn trễ tiến độ.
                  </div>
                )}
             </div>
          </div>

          {/* List - Lý do trễ */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-[400px]">
            <div className="p-5 border-b border-slate-100 flex-shrink-0">
              <h3 className="text-slate-900 font-semibold">Các lý do trễ đơn hàng</h3>
              <p className="text-xs text-slate-500 mt-1">Danh sách mặt hàng báo trễ và lý do cụ thể (nếu có)</p>
            </div>
            <div className="flex-1 w-full min-h-0 overflow-auto">
              {delayReasonsList.length > 0 ? (
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-slate-50/90 backdrop-blur border-b border-slate-200 z-10">
                    <tr>
                      <th className="py-3 px-6 text-[11px] font-black text-slate-400 uppercase tracking-wider">Hợp đồng</th>
                      <th className="py-3 px-6 text-[11px] font-black text-slate-400 uppercase tracking-wider">Mặt hàng</th>
                      <th className="py-3 px-6 text-[11px] font-black text-slate-400 uppercase tracking-wider">Lý do trễ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {delayReasonsList.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="py-3 px-6 text-sm font-mono text-slate-600 whitespace-nowrap">{item.contractCode}</td>
                        <td className="py-3 px-6 text-sm font-medium text-slate-800">{item.materialCode}</td>
                        <td className="py-3 px-6 text-sm text-slate-600 bg-rose-50/30 group-hover:bg-rose-50/50 transition-colors">{item.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="h-full flex items-center justify-center text-sm tracking-tight text-slate-400">
                   Không có đơn hàng trễ tiến độ trong kỳ.
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
