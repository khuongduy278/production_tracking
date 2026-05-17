import * as xlsx from 'xlsx';
import { Order } from '../types';
import { getOrderStatus } from './orderUtils';

export function downloadExcelTemplate(type: 'regular' | 'outsourcing' = 'regular') {
  let data;
  
  if (type === 'outsourcing') {
    data = [{
      'Mã hợp đồng': 'HD123456',
      'Mã số vật tư': 'VT001',
      'Ngày giao': '2024-05-20',
      'Ngày giao gia công': '2024-05-18',
      'Ngày nhận gia công': '2024-05-19',
      'Kế hoạch': 1000,
      'Thực hiện': 0,
      'Đạt cho cắt': 0,
      'Cắt dọc': 0,
      'May biên': 0,
      'May ngang': 0,
      'Kiểm': 0,
      'Đóng gói': 0,
      'Lý do trễ': ''
    }];
  } else {
    data = [{
      'Mã hợp đồng': 'HD123456',
      'Mã số vật tư': 'VT001',
      'Ngày giao': '2024-05-20',
      'Kế hoạch': 1000,
      'Thực hiện': 0,
      'Đạt cho cắt': 0,
      'Cắt dọc': 0,
      'May biên': 0,
      'May ngang': 0,
      'Kiểm': 0,
      'Đóng gói': 0,
      'Lý do trễ': ''
    }];
  }

  const worksheet = xlsx.utils.json_to_sheet(data);
  const workbook = xlsx.utils.book_new();
  const sheetName = type === 'outsourcing' ? 'MauNhapGiaCong' : 'MauNhapTienDo';
  const fileName = type === 'outsourcing' ? 'Mau_Nhap_Gia_Cong.xlsx' : 'Mau_Nhap_Tien_Do.xlsx';
  
  xlsx.utils.book_append_sheet(workbook, worksheet, sheetName);
  
  xlsx.writeFile(workbook, fileName);
}

export function exportOrdersToExcel(orders: Order[], filename: string = 'export.xlsx') {
  const data = orders.map((o, idx) => ({
    'STT': idx + 1,
    'Mã hợp đồng': o.contractCode,
    'Ngày giao hàng': o.deliveryDate ? new Date(o.deliveryDate).toLocaleDateString('vi-VN') : '',
    'Mã số vật tư': o.materialCode,
    'Số lượng KH': o.plannedQuantity,
    'Số lượng thực hiện': o.actualQuantity || 0,
    'Đạt cho cắt': o.cutAllowed,
    'Cắt dọc': o.cutVertical,
    'May biên': o.sewBorder,
    'May ngang': o.sewHorizontal,
    'Kiểm': o.inspect,
    'Đóng gói': o.pack,
    'Trạng thái': getOrderStatus(o),
    'Lý do trễ': o.delayReason || '',
    'Người cập nhật': o.updatedBy || '',
    'Thời gian cập nhật': o.updatedAt ? new Date(o.updatedAt).toLocaleString('vi-VN') : '',
  }));

  const worksheet = xlsx.utils.json_to_sheet(data);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, 'TienDo');
  
  xlsx.writeFile(workbook, filename);
}
