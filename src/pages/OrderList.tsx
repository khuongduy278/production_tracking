import React, { useEffect, useState, useRef } from 'react';
import { collection, query, onSnapshot, orderBy, doc, writeBatch, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/errorHandling';
import { Order } from '../types';
import { getOrderStatus, getStatusColor } from '../lib/orderUtils';
import { exportOrdersToExcel, downloadExcelTemplate } from '../lib/exportUtils';
import { parseExcel } from '../lib/excelImport';
import { Badge } from '../components/ui/Badge';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Plus, FileDown, FilterX, Edit, Upload, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { differenceInDays, startOfDay, parseISO, isSameDay, addDays } from 'date-fns';
import { toast } from 'react-hot-toast';

export default function OrderList({ listType = 'regular' }: { listType?: 'regular' | 'outsourcing' }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Filters
  const [search, setSearch] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [warningGroup, setWarningGroup] = useState('all');
  const [stageFilter, setStageFilter] = useState('all');
  const [quickFilter, setQuickFilter] = useState('all');

  const navigate = useNavigate();
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

  const resetFilters = () => {
    setSearch('');
    setFilterDate('');
    setStatusFilter('all');
    setWarningGroup('all');
    setStageFilter('all');
    setQuickFilter('all');
  };

  const filteredOrders = orders.filter(o => {
    // Basic type check (default type is 'regular' or undefined for older records)
    const orderType = o.type === 'outsourcing' ? 'outsourcing' : 'regular';
    if (orderType !== listType) return false;

    // Search by contractCode or materialCode
    const matchesSearch = o.contractCode.toLowerCase().includes(search.toLowerCase()) || 
                          o.materialCode.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    
    // Filter by date
    if (filterDate && o.deliveryDate !== filterDate) return false;

    const status = getOrderStatus(o);
    
    // Filter by status
    if (statusFilter !== 'all' && status !== statusFilter) return false;

    // Filter by warning group
    if (warningGroup === 'red' && status !== 'Khẩn cấp' && status !== 'Trễ tiến độ') return false;
    if (warningGroup === 'yellow' && status !== 'Sắp đến hạn') return false;
    if (warningGroup === 'green' && status !== 'Bình thường' && status !== 'Hoàn thành' && status !== 'Chưa bắt đầu') return false;

    // Filter by stage (Basic heuristic: which stage is currently active)
    if (stageFilter !== 'all') {
      const isDone = status === 'Hoàn thành';
      if (isDone) return false; // if it's done, it's not "at" a production stage
      
      const activeStage = 
        o.pack < o.inspect ? 'pack' :
        o.inspect < Math.max(o.sewBorder, o.sewHorizontal) ? 'inspect' : 
        (o.sewHorizontal < o.sewBorder) ? 'sewHorizontal' :
        (o.sewBorder < o.cutVertical) ? 'sewBorder' :
        o.cutVertical < o.cutAllowed ? 'cut' : 'cut'; 
      
      if (stageFilter === 'cut' && activeStage !== 'cut') return false;
      if (stageFilter === 'sewBorder' && activeStage !== 'sewBorder') return false;
      if (stageFilter === 'sewHorizontal' && activeStage !== 'sewHorizontal') return false;
      if (stageFilter === 'inspect' && activeStage !== 'inspect') return false;
      if (stageFilter === 'pack' && activeStage !== 'pack') return false;
    }

    // Quick filter
    if (quickFilter !== 'all') {
      if (quickFilter === 'late' && status !== 'Trễ tiến độ') return false;
      if (quickFilter === 'done' && status !== 'Hoàn thành') return false;
      
      const today = startOfDay(new Date());
      const delivery = startOfDay(parseISO(o.deliveryDate));
      
      if (quickFilter === 'today' && !isSameDay(delivery, today)) return false;
      if (quickFilter === 'next2days') {
        const daysLeft = differenceInDays(delivery, today);
        if (daysLeft < 0 || daysLeft > 2) return false;
      }
    }

    return true;
  });

  const sortedAndFilteredOrders = [...filteredOrders].sort((a, b) => {
    const dA = a.deliveryDate ? new Date(a.deliveryDate).getTime() : Infinity;
    const dB = b.deliveryDate ? new Date(b.deliveryDate).getTime() : Infinity;
    return dA - dB;
  });

  const canCreate = ['admin', 'plan', 'head_production', 'tech'].includes(userData?.role || '');

  const handleDelete = (id: string, contractCode: string) => {
    if (!canCreate) return;
    
    toast((t) => (
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-slate-900">
          Xóa đơn hàng {contractCode}?
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
              try {
                await deleteDoc(doc(db, 'orders', id));
                toast.success(`Đã xóa đơn hàng ${contractCode}`);
              } catch (err) {
                toast.error('Có lỗi xảy ra khi xóa đơn hàng');
                handleFirestoreError(err, OperationType.DELETE, 'orders');
              }
            }}
            className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
          >
            Xóa
          </button>
        </div>
      </div>
    ), { duration: Infinity });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const loadingToast = toast.loading('Đang xử lý file Excel...');

    try {
      const data = await parseExcel(file);
      
      if (!data || data.length === 0) {
        throw new Error("File Excel trống hoặc không đúng định dạng.");
      }

      const batch = writeBatch(db);
      let count = 0;
      let skippedCount = 0;

      for (const row of data as any[]) {
        // Map excel data. Note: this needs headers to exactly match or use loose translation.
        const normalizedRow: any = {};
        Object.keys(row).forEach(key => {
          normalizedRow[key.toString().trim().toLowerCase()] = row[key];
        });

        const contractCode = normalizedRow['mã hợp đồng'] || normalizedRow['contract code'] || normalizedRow['ma hop dong'] || normalizedRow['mã hđ'] || normalizedRow['po'];
        const materialCode = normalizedRow['mã số vật tư'] || normalizedRow['mã vật tư'] || normalizedRow['material code'] || normalizedRow['ma vat tu'] || normalizedRow['mã vt'] || normalizedRow['mã hàng'] || normalizedRow['item'];
        let deliveryDate = normalizedRow['ngày giao'] || normalizedRow['ngày giao hàng'] || normalizedRow['delivery date'] || normalizedRow['ngay giao'] || normalizedRow['delivery'];
        
        const getVal = (keys: string[]) => {
          for (const key of keys) {
            if (normalizedRow[key] !== undefined && normalizedRow[key] !== null && normalizedRow[key] !== '') {
               return normalizedRow[key];
            }
          }
          return '0';
        };

        const plannedQuantityStr = getVal(['kế hoạch', 'kế hoạch giao', 'số lượng', 'planned quantity', 'ke hoach', 'sl', 'qty']);
        const plannedQuantity = parseInt(String(plannedQuantityStr).replace(/,/g, ''), 10);
        
        if (!contractCode || !materialCode) {
          skippedCount++;
          continue; // Skip invalid rows
        }

        const existingOrder = orders.find(o => 
          String(o.contractCode).toLowerCase().trim() === String(contractCode).toLowerCase().trim() && 
          String(o.materialCode).toLowerCase().trim() === String(materialCode).toLowerCase().trim()
        );

        let outsourcingDeliveryDate = getVal(['ngày giao gc', 'ngay giao gc', 'ngày giao gia công', 'ngay giao gia cong']);
        let outsourcingReceiveDate = getVal(['ngày nhận gc', 'ngay nhan gc', 'ngày nhận gia công', 'ngay nhan gia cong']);
        
        const formatDate = (val: any) => {
          if (!val) return '';
          if (typeof val === 'number') {
            return new Date((val - (25567 + 2)) * 86400 * 1000).toISOString().split('T')[0];
          } else if (typeof val === 'string' && val.includes('/')) {
             const parts = val.split('/');
             if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          } else if (typeof val === 'string' && val.includes('-')) {
             const parts = val.split('-');
             if (parts.length === 3 && parts[0].length === 2) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
          return typeof val === 'string' ? val : '';
        };

        if (outsourcingDeliveryDate) outsourcingDeliveryDate = formatDate(outsourcingDeliveryDate);
        if (outsourcingReceiveDate) outsourcingReceiveDate = formatDate(outsourcingReceiveDate);

        // Convert Excel date serial number to string if necessary
        if (typeof deliveryDate === 'number') {
          const date = new Date((deliveryDate - (25567 + 2)) * 86400 * 1000); // Excel date to JS date
          deliveryDate = date.toISOString().split('T')[0];
        } else if (typeof deliveryDate === 'string' && deliveryDate.includes('/')) {
           // Handle DD/MM/YYYY or similar
           const parts = deliveryDate.split('/');
           if (parts.length === 3) {
             deliveryDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
           }
        } else if (typeof deliveryDate === 'string' && deliveryDate.includes('-')) {
            const parts = deliveryDate.split('-');
            if (parts.length === 3 && parts[0].length === 2) {
               deliveryDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
        }

        const newOrderRef = existingOrder ? doc(db, 'orders', existingOrder.id) : doc(collection(db, 'orders'));
        const orderData = {
          contractCode: String(contractCode).trim(),
          materialCode: String(materialCode).trim(),
          deliveryDate: deliveryDate || (existingOrder?.deliveryDate || ''),
          type: listType,
          outsourcingDeliveryDate: outsourcingDeliveryDate || existingOrder?.outsourcingDeliveryDate || '',
          outsourcingReceiveDate: outsourcingReceiveDate || existingOrder?.outsourcingReceiveDate || '',
          plannedQuantity: isNaN(plannedQuantity) ? 0 : plannedQuantity,
          actualQuantity: parseInt(String(getVal(['thực hiện', 'thực tế', 'actual quantity', 'thuc hien'])).replace(/,/g, ''), 10) || 0,
          cutAllowed: parseInt(String(getVal(['đạt cho cắt', 'cắt', 'cut allowed', 'dat cho cat'])).replace(/,/g, ''), 10) || 0,
          cutVertical: parseInt(String(getVal(['cắt dọc', 'cat doc'])).replace(/,/g, ''), 10) || 0,
          sewBorder: parseInt(String(getVal(['may biên', 'may bien'])).replace(/,/g, ''), 10) || 0,
          sewHorizontal: parseInt(String(getVal(['may ngang'])), 10) || 0,
          inspect: parseInt(String(getVal(['kiểm', 'kiểm tra', 'kiem', 'inspect'])).replace(/,/g, ''), 10) || 0,
          pack: parseInt(String(getVal(['đóng gói', 'đóng', 'pack', 'dong goi'])).replace(/,/g, ''), 10) || 0,
          delayReason: getVal(['lý do trễ', 'lý do', 'delay reason', 'ly do tre']) === '0' ? '' : String(getVal(['lý do trễ', 'lý do', 'delay reason', 'ly do tre'])),
          notes: existingOrder ? existingOrder.notes : '',
          updatedBy: userData?.fullName || 'Import Excel',
          updatedAt: new Date().toISOString(),
          ...(existingOrder ? {} : { createdAt: new Date().toISOString() })
        };

        batch.set(newOrderRef, orderData, { merge: true });
        count++;

        // Firestore batch max limits is 500, we could make logic to execute if count == 500
        if (count % 450 === 0) {
          await batch.commit();
        }
      }

      if (count > 0 && count % 450 !== 0) {
        await batch.commit();
      }

      if (count === 0) {
        toast.error(`Không tìm thấy dòng dữ liệu nào hợp lệ. Vui lòng kiểm tra lại tiêu đề cột (cần có 'Mã hợp đồng' và 'Mã số vật tư'). (Bỏ qua ${skippedCount} dòng)`, { id: loadingToast, duration: 6000 });
      } else {
        toast.success(`Đã thông nhập thành công ${count} đơn hàng!`, { id: loadingToast });
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Có lỗi xảy ra khi nhập file.', { id: loadingToast });
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  if (loading) return <div className="p-8 flex justify-center"><div className="animate-pulse">Đang tải dữ liệu...</div></div>;

  return (
    <div className="space-y-6 flex-1 flex flex-col h-full overflow-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 shrink-0">
        <div>
          <h2 className="text-3xl font-playfair font-medium text-slate-900 tracking-tight">
            {listType === 'outsourcing' ? 'Tiến độ Gia công' : 'Tiến độ sản xuất'}
          </h2>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-white border border-slate-200 rounded-md text-sm font-medium shadow-sm hover:bg-slate-50 relative group transition-colors text-slate-700 flex items-center justify-center gap-2" onClick={() => exportOrdersToExcel(filteredOrders, `tien-do-${new Date().getTime()}.xlsx`)}>
            <FileDown size={16} /> Xuất Excel
          </button>
          
          {canCreate && (
             <>
               <input
                 type="file"
                 accept=".xlsx, .xls"
                 className="hidden"
                 ref={fileInputRef}
                 onChange={handleFileUpload}
               />
               <button 
                 onClick={() => downloadExcelTemplate(listType)}
                 className="px-4 py-2 bg-white border border-slate-200 rounded-md text-sm font-medium shadow-sm hover:bg-slate-50 relative group transition-colors text-slate-700 flex items-center justify-center gap-2"
               >
                 <FileDown size={16} /> Tải mẫu Excel
               </button>
               <button 
                 disabled={importing}
                 onClick={() => fileInputRef.current?.click()}
                 className="px-4 py-2 bg-white border border-slate-200 rounded-md text-sm font-medium shadow-sm hover:bg-slate-50 relative group transition-colors text-slate-700 flex items-center justify-center gap-2"
               >
                 <Upload size={16} /> {importing ? 'Đang tải...' : 'Nhập Excel'}
               </button>
             </>
          )}

          {canCreate && (
            <button className="px-4 py-2 bg-slate-900 text-white rounded-md text-sm font-medium shadow-sm flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors" onClick={() => navigate(listType === 'outsourcing' ? '/outsourcing/new' : '/orders/new')}>
              <Plus size={16} /> Thêm mới
            </button>
          )}
        </div>
      </div>

      {/* Filters Section */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 shrink-0 space-y-4">
        {/* Row 1: Search & Quick Filters */}
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={16} className="text-slate-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-9 pr-3 py-2 border border-slate-300 rounded-md bg-white placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-800 focus:border-slate-800 text-sm shadow-sm"
              placeholder="Tìm mã hợp đồng, mã vật tư..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <button onClick={() => setQuickFilter('all')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${quickFilter === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Tất cả</button>
            <button onClick={() => setQuickFilter('today')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${quickFilter === 'today' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Giao hôm nay</button>
            <button onClick={() => setQuickFilter('next2days')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${quickFilter === 'next2days' ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Giao 2 ngày tới</button>
            <button onClick={() => setQuickFilter('late')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${quickFilter === 'late' ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Trễ</button>
            <button onClick={() => setQuickFilter('done')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${quickFilter === 'done' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Hoàn thành</button>
          </div>
        </div>

        {/* Row 2: Advanced filters */}
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs font-medium text-slate-500 mb-1">Ngày giao hàng</label>
            <input type="date" className="block w-full px-3 py-1.5 border border-slate-300 rounded-md bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-800 focus:border-slate-800 text-sm shadow-sm" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
          </div>
          
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs font-medium text-slate-500 mb-1">Trạng thái</label>
            <select className="block w-full px-3 py-1.5 border border-slate-300 rounded-md bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-800 focus:border-slate-800 text-sm shadow-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Tất cả</option>
              <option value="Hoàn thành">Hoàn thành</option>
              <option value="Trễ tiến độ">Trễ tiến độ</option>
              <option value="Khẩn cấp">Khẩn cấp</option>
              <option value="Sắp đến hạn">Sắp đến hạn</option>
              <option value="Bình thường">Bình thường</option>
              <option value="Chưa bắt đầu">Chưa bắt đầu</option>
            </select>
          </div>

          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs font-medium text-slate-500 mb-1">Cảnh báo</label>
            <select className="block w-full px-3 py-1.5 border border-slate-300 rounded-md bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-800 focus:border-slate-800 text-sm shadow-sm" value={warningGroup} onChange={(e) => setWarningGroup(e.target.value)}>
              <option value="all">Tất cả</option>
              <option value="red">Đỏ (Trễ/Khẩn cấp)</option>
              <option value="yellow">Vàng (Sắp đến hạn)</option>
              <option value="green">Xanh (Bình thường/Xong)</option>
            </select>
          </div>

          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs font-medium text-slate-500 mb-1">Công đoạn (Đang dừng ở)</label>
            <select className="block w-full px-3 py-1.5 border border-slate-300 rounded-md bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-800 focus:border-slate-800 text-sm shadow-sm" value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
              <option value="all">Tất cả</option>
              <option value="cut">Cắt dọc</option>
              <option value="sewBorder">May biên</option>
              <option value="sewHorizontal">May ngang</option>
              <option value="inspect">Kiểm</option>
              <option value="pack">Đóng gói</option>
            </select>
          </div>

          <button onClick={resetFilters} className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-900 flex items-center justify-center gap-1 transition-colors" title="Xóa bộ lọc">
            <FilterX size={16} /> Bỏ lọc
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 flex-1 flex flex-col min-h-0">
        <div className="overflow-auto flex-1">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead className="sticky top-0 bg-slate-50 z-10 shadow-sm">
              <tr>
                <th className="py-3 px-4 text-xs font-medium text-slate-500 border-b border-slate-200">STT</th>
                <th className="py-3 px-4 text-xs font-medium text-slate-500 border-b border-slate-200">Thao tác</th>
                <th className="py-3 px-4 text-xs font-medium text-slate-500 border-b border-slate-200">Mã hợp đồng</th>
                <th className="py-3 px-4 text-xs font-medium text-slate-500 border-b border-slate-200">Mã số vật tư</th>
                <th className="py-3 px-4 text-xs font-medium text-slate-500 border-b border-slate-200">Ngày giao</th>
                {listType === 'outsourcing' && (
                  <>
                    <th className="py-3 px-4 text-xs font-medium text-slate-500 border-b border-slate-200">Ngày giao Gia công</th>
                    <th className="py-3 px-4 text-xs font-medium text-slate-500 border-b border-slate-200">Ngày nhận Gia công</th>
                  </>
                )}
                <th className="py-3 px-4 text-xs font-medium text-slate-500 border-b border-slate-200">Trạng thái</th>
                <th className="py-3 px-4 text-xs font-medium text-slate-500 border-b border-slate-200 text-right">Kế hoạch</th>
                <th className="py-3 px-4 text-xs font-medium text-slate-500 border-b border-slate-200 text-right">Thực hiện</th>
                <th className="py-3 px-4 text-xs font-medium text-slate-500 border-b border-slate-200 text-right">Đạt cho cắt</th>
                <th className="py-3 px-4 text-xs font-medium text-slate-500 border-b border-slate-200 text-right">Cắt dọc</th>
                <th className="py-3 px-4 text-xs font-medium text-slate-500 border-b border-slate-200 text-right">May biên</th>
                <th className="py-3 px-4 text-xs font-medium text-slate-500 border-b border-slate-200 text-right">May ngang</th>
                <th className="py-3 px-4 text-xs font-medium text-slate-500 border-b border-slate-200 text-right">Kiểm</th>
                <th className="py-3 px-4 text-xs font-medium text-slate-500 border-b border-slate-200 text-right">Đóng gói</th>
                <th className="py-3 px-4 text-xs font-medium text-slate-500 border-b border-slate-200">Lý do trễ</th>
                <th className="py-3 px-4 text-xs font-medium text-slate-500 border-b border-slate-200">Người cập nhật</th>
                <th className="py-3 px-4 text-xs font-medium text-slate-500 border-b border-slate-200">Thời gian CN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedAndFilteredOrders.length === 0 && (
                <tr>
                  <td colSpan={16} className="py-12 px-6 text-center text-slate-500">
                    Không tìm thấy dữ liệu.
                  </td>
                </tr>
              )}
              {sortedAndFilteredOrders.map((order, idx) => {
                const status = getOrderStatus(order);
                const isDone = status === 'Hoàn thành';
                const dateColorClass = 
                  status === 'Khẩn cấp' || status === 'Trễ tiến độ' ? 'text-red-600 font-medium' :
                  status === 'Sắp đến hạn' ? 'text-amber-600 font-medium' :
                  isDone ? 'text-slate-400' : 'text-slate-700';

                return (
                  <tr key={order.id} className={`hover:bg-slate-50 transition-colors ${isDone ? 'opacity-75' : ''}`}>
                    <td className="py-3 px-4 text-sm text-slate-500">{idx + 1}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <Link to={listType === 'outsourcing' ? `/outsourcing/${order.id}` : `/orders/${order.id}`} className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-slate-200 text-slate-500 transition-colors" title="Sửa">
                          <Edit size={16} />
                        </Link>
                        {canCreate && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(order.id, order.contractCode);
                            }}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-red-100 text-red-500 transition-colors"
                            title="Xóa"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-900 font-medium">{order.contractCode}</td>
                    <td className="py-3 px-4 text-sm text-slate-600">
                      <strong>{order.materialCode.substring(0, 4)}</strong>
                    </td>
                    <td className={`py-3 px-4 text-sm ${dateColorClass}`}>
                      {order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString('vi-VN') : '-'}
                    </td>
                    {listType === 'outsourcing' && (
                      <>
                        <td className="py-3 px-4 text-sm text-slate-700">
                          {order.outsourcingDeliveryDate ? new Date(order.outsourcingDeliveryDate).toLocaleDateString('vi-VN') : '-'}
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-700">
                          {order.outsourcingReceiveDate ? new Date(order.outsourcingReceiveDate).toLocaleDateString('vi-VN') : '-'}
                        </td>
                      </>
                    )}
                    <td className="py-3 px-4">
                      <Badge variant={getStatusColor(status)}>{status}</Badge>
                    </td>
                    <td className="py-3 px-4 text-sm text-right font-mono text-slate-600">{order.plannedQuantity}</td>
                    <td className="py-3 px-4 text-sm text-right font-mono text-slate-600">{order.actualQuantity || 0}</td>
                    <td className="py-3 px-4 text-sm text-right font-mono text-slate-600">{order.cutAllowed}</td>
                    <td className="py-3 px-4 text-sm text-right font-mono text-slate-600">{order.cutVertical}</td>
                    <td className="py-3 px-4 text-sm text-right font-mono text-slate-600">{order.sewBorder}</td>
                    <td className="py-3 px-4 text-sm text-right font-mono text-slate-600">{order.sewHorizontal}</td>
                    <td className="py-3 px-4 text-sm text-right font-mono text-slate-600">{order.inspect}</td>
                    <td className="py-3 px-4 text-sm text-right font-mono font-medium text-slate-900">{order.pack}</td>
                    <td className="py-3 px-4 text-sm text-slate-500 max-w-[200px] truncate" title={order.delayReason}>{order.delayReason || '-'}</td>
                    <td className="py-3 px-4 text-sm text-slate-500">{order.updatedBy || '-'}</td>
                    <td className="py-3 px-4 text-sm text-slate-500">
                      {order.updatedAt ? new Date(order.updatedAt).toLocaleString('vi-VN') : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

