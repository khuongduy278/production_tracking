import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, updateDoc, collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/errorHandling';
import { Order } from '../types';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { ArrowLeft, Save } from 'lucide-react';
import { getOrderStatus, getStatusColor } from '../lib/orderUtils';
import { Badge } from '../components/ui/Badge';

const INIT_ORDER: Omit<Order, 'id'> = {
  contractCode: '',
  materialCode: '',
  deliveryDate: '',
  outsourcingDeliveryDate: '',
  outsourcingReceiveDate: '',
  type: 'regular',
  plannedQuantity: 0,
  actualQuantity: 0,
  cutAllowed: 0,
  cutVertical: 0,
  sewBorder: 0,
  sewHorizontal: 0,
  inspect: 0,
  pack: 0,
  delayReason: '',
  notes: '',
  updatedBy: '',
  updatedAt: '',
  createdAt: '',
};

export default function OrderDetail({ detailType = 'regular' }: { detailType?: 'regular' | 'outsourcing' }) {
  const { id } = useParams();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const { userData } = useAuth();
  
  const [order, setOrder] = useState<Omit<Order, 'id'>>({ ...INIT_ORDER, type: detailType });
  const [originalOrder, setOriginalOrder] = useState<Omit<Order, 'id'> | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isNew) return;
    const fetchDoc = async () => {
      try {
        const docRef = doc(db, 'orders', id!);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as Omit<Order, 'id'>;
          setOrder(data);
          setOriginalOrder(data);
        } else {
          setError('Không tìm thấy đơn hàng');
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `orders/${id}`);
      } finally {
        setLoading(false);
      }
    };
    fetchDoc();
  }, [id, isNew]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setOrder(prev => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value
    }));
  };

  const handleSave = async () => {
    if (!order.contractCode || !order.materialCode || !order.deliveryDate || order.plannedQuantity <= 0) {
      setError('Vui lòng điền các trường bắt buộc (Mã hợp đồng, Vật tư, Ngày giao, Số lượng kế hoạch > 0)');
      return;
    }
    setSaving(true);
    setError('');

    try {
      const now = new Date().toISOString();
      const updatedData = {
        ...order,
        updatedBy: userData?.id || '',
        updatedAt: now,
      };

      if (isNew) {
        updatedData.createdAt = now;
        const colRef = collection(db, 'orders');
        const newDoc = await addDoc(colRef, updatedData);
        // add log
        await addDoc(collection(db, 'logs'), {
          orderId: newDoc.id,
          action: 'CREATE',
          details: `Tạo mới đơn hàng ${order.contractCode} (Vật tư: ${order.materialCode})`,
          userId: userData?.id,
          userName: userData?.fullName,
          timestamp: now
        });
        navigate(detailType === 'outsourcing' ? '/outsourcing' : '/orders');
      } else {
        const docRef = doc(db, 'orders', id!);
        // We only allow updating fields, creation fields stay same. Rules prevent updating createdAt.
        // Let's filter out createdAt from update explicitly to prevent rule failure if it slightly drifted
        const { createdAt, contractCode, ...updatePayload } = updatedData as any;
        await updateDoc(docRef, updatePayload);
        
        const contextInfo = `HĐ: ${originalOrder?.contractCode || order.contractCode} | VT: ${originalOrder?.materialCode || order.materialCode}`;
        let detailsText = `Cập nhật đơn hàng - ${contextInfo}`;
        
        if (originalOrder) {
          const diffs = [];
          if (order.cutAllowed !== originalOrder.cutAllowed) diffs.push(`Đạt cho cắt(${order.cutAllowed})`);
          if (order.cutVertical !== originalOrder.cutVertical) diffs.push(`Cắt dọc(${order.cutVertical})`);
          if (order.sewBorder !== originalOrder.sewBorder) diffs.push(`May biên(${order.sewBorder})`);
          if (order.sewHorizontal !== originalOrder.sewHorizontal) diffs.push(`May ngang(${order.sewHorizontal})`);
          if (order.inspect !== originalOrder.inspect) diffs.push(`Kiểm(${order.inspect})`);
          if (order.pack !== originalOrder.pack) diffs.push(`Đóng gói(${order.pack})`);
          if (order.actualQuantity !== originalOrder.actualQuantity) diffs.push(`Hoàn thành(${order.actualQuantity})`);
          
          if (diffs.length > 0) {
            detailsText = `Cập nhật tiến độ [${contextInfo}]: ${diffs.join(', ')}`;
          } else {
            // If details didn't change but maybe something else like delay reason did
            const infoDiffs = [];
            if (order.delayReason !== originalOrder.delayReason) infoDiffs.push(`Lý do trễ`);
            if (order.notes !== originalOrder.notes) infoDiffs.push(`Ghi chú`);
            if (order.materialCode !== originalOrder.materialCode) infoDiffs.push(`Vật tư`);
            if (order.deliveryDate !== originalOrder.deliveryDate) infoDiffs.push(`Ngày giao`);
            if (order.outsourcingDeliveryDate !== originalOrder.outsourcingDeliveryDate) infoDiffs.push(`Ngày giao Gia công`);
            if (order.outsourcingReceiveDate !== originalOrder.outsourcingReceiveDate) infoDiffs.push(`Ngày nhận Gia công`);
            if (order.plannedQuantity !== originalOrder.plannedQuantity) infoDiffs.push(`Kế hoạch`);
            if (infoDiffs.length > 0) {
               detailsText = `Cập nhật thông tin [${contextInfo}]: ${infoDiffs.join(', ')}`;
            }
          }
        }

        await addDoc(collection(db, 'logs'), {
          orderId: id,
          action: 'UPDATE',
          details: detailsText,
          userId: userData?.id,
          userName: userData?.fullName,
          timestamp: now
        });
        navigate(detailType === 'outsourcing' ? '/outsourcing' : '/orders');
      }
    } catch (err: any) {
      if (err.message) {
         try {
           const parsed = JSON.parse(err.message);
           setError(`Lỗi lưu dữ liệu: ${parsed.error}`);
         } catch {
           setError(`Lỗi: ${err.message}`);
         }
      }
    } finally {
      setSaving(false);
    }
  };

  const canEditCore = isNew || ['admin', 'plan', 'head_production', 'tech'].includes(userData?.role || '');

  if (loading) return <div className="p-8">Đang tải...</div>;
  if (error && !isNew && !order.contractCode) return <div className="p-8 text-red-500">{error}</div>;

  const status = isNew ? 'Chưa bắt đầu' : getOrderStatus(order as Order);

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      <div className="flex items-start gap-4">
        <button onClick={() => navigate(-1)} className="mt-1 p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="font-playfair text-3xl md:text-4xl font-medium text-slate-900 tracking-tight">
            {isNew ? (detailType === 'outsourcing' ? 'Thêm gia công mới' : 'Thêm tiến độ mới') : `Chi tiết ${detailType === 'outsourcing' ? 'gia công' : 'tiến độ'}: ${order.contractCode}`}
          </h1>
          {!isNew && (
            <div className="mt-3">
              <Badge variant={getStatusColor(status)}>{status}</Badge>
            </div>
          )}
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-800 p-4 rounded-md text-sm border border-red-200 font-medium tracking-tight">{error}</div>}

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-6 md:p-8 space-y-10">
          
          {/* Section: Thông tin chung */}
          <section>
            <h2 className="font-playfair text-xl font-medium text-slate-900 border-b border-slate-200 pb-3 mb-6">Thông tin chung</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              <Input
                label="Mã hợp đồng"
                name="contractCode"
                value={order.contractCode}
                onChange={handleChange}
                disabled={!canEditCore || !isNew} // Immutable after creation
                placeholder="VD: HD-001"
              />
              <Input
                label="Mã vật tư"
                name="materialCode"
                value={order.materialCode}
                onChange={handleChange}
                disabled={!canEditCore}
                placeholder="VD: VT-A23"
              />
              <Input
                label="Ngày giao hàng"
                type="date"
                name="deliveryDate"
                value={order.deliveryDate}
                onChange={handleChange}
                disabled={!canEditCore}
              />
              {detailType === 'outsourcing' && (
                <>
                  <Input
                    label="Ngày giao Gia công"
                    type="date"
                    name="outsourcingDeliveryDate"
                    value={order.outsourcingDeliveryDate || ''}
                    onChange={handleChange}
                    disabled={!canEditCore}
                  />
                  <Input
                    label="Ngày nhận Gia công"
                    type="date"
                    name="outsourcingReceiveDate"
                    value={order.outsourcingReceiveDate || ''}
                    onChange={handleChange}
                    disabled={!canEditCore}
                  />
                </>
              )}
              <Input
                label="Số lượng kế hoạch"
                type="number"
                name="plannedQuantity"
                value={order.plannedQuantity}
                onChange={handleChange}
                disabled={!canEditCore}
              />
            </div>
          </section>

          {/* Section: Cập nhật tiến độ */}
          {!isNew && (
            <section>
              <h2 className="font-playfair text-xl font-medium text-slate-900 border-b border-slate-200 pb-3 mb-6">Cập nhật tiến độ SX</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-6">
                <Input type="number" label="Đạt cho cắt" name="cutAllowed" value={order.cutAllowed} onChange={handleChange} min={0} />
                <Input type="number" label="Cắt dọc" name="cutVertical" value={order.cutVertical} onChange={handleChange} min={0} />
                <Input type="number" label="May biên" name="sewBorder" value={order.sewBorder} onChange={handleChange} min={0} />
                <Input type="number" label="May ngang" name="sewHorizontal" value={order.sewHorizontal} onChange={handleChange} min={0} />
                <Input type="number" label="Kiểm" name="inspect" value={order.inspect} onChange={handleChange} min={0} />
                <Input type="number" label="Đóng gói (Hoàn thành)" name="pack" value={order.pack} onChange={handleChange} min={0} />
                <Input className="col-span-full md:col-span-1" type="number" label="Số lượng thực hiện (tổng)" name="actualQuantity" value={order.actualQuantity} onChange={handleChange} min={0} />
              </div>
            </section>
          )}

          {/* Section: Vấn đề & Ghi chú */}
          <section>
            <h2 className="font-playfair text-xl font-medium text-slate-900 border-b border-slate-200 pb-3 mb-6">Ghi chú & Vấn đề</h2>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 tracking-tight">Lý do trễ tiến độ</label>
                <textarea
                  name="delayReason"
                  value={order.delayReason || ''}
                  onChange={handleChange}
                  className="w-full flex min-h-24 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-800 transition-colors shadow-sm"
                  placeholder="Nhập lý do nếu đơn hàng bị chậm trễ..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 tracking-tight">Ghi chú sản xuất</label>
                <textarea
                  name="notes"
                  value={order.notes || ''}
                  onChange={handleChange}
                  className="w-full flex min-h-24 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-800 transition-colors shadow-sm"
                  placeholder="Ghi chú thêm..."
                />
              </div>
            </div>
          </section>

        </div>
        <div className="px-6 md:px-8 py-5 border-t border-slate-200 bg-slate-50 flex justify-end">
          <Button onClick={handleSave} isLoading={saving}>
            <Save size={18} className="mr-2" />
            Lưu thay đổi
          </Button>
        </div>
      </div>
    </div>
  );
}
