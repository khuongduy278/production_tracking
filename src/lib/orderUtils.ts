import { differenceInDays, startOfDay, parseISO, isAfter } from 'date-fns';
import { Order } from '../types';

export type OrderStatus = 'Hoàn thành' | 'Trễ tiến độ' | 'Khẩn cấp' | 'Sắp đến hạn' | 'Bình thường' | 'Chưa bắt đầu';

export function getOrderStatus(order: Order): OrderStatus {
  if (!order) return 'Chưa bắt đầu';
  
  // if packing reached plan, it's done
  if (order.pack >= order.plannedQuantity && order.plannedQuantity > 0) {
    return 'Hoàn thành';
  }

  // Check if they haven't started at all
  if (order.actualQuantity === 0 && order.cutAllowed === 0 && order.sewBorder === 0 && order.sewHorizontal === 0 && order.inspect === 0 && order.pack === 0) {
    if (!order.deliveryDate) return 'Chưa bắt đầu';
  }
  
  if (!order.deliveryDate) return 'Bình thường'; // fallback

  const today = startOfDay(new Date());
  const delivery = startOfDay(parseISO(order.deliveryDate));

  // Trễ tiến độ check
  if (isAfter(today, delivery)) {
    return 'Trễ tiến độ';
  }

  const daysLeft = differenceInDays(delivery, today);
  
  if (daysLeft <= 2) {
    return 'Khẩn cấp';
  } else if (daysLeft >= 3 && daysLeft <= 5) {
    return 'Sắp đến hạn';
  } else {
    return 'Bình thường';
  }
}

export function getStatusColor(status: OrderStatus) {
  switch (status) {
    case 'Hoàn thành': return 'done';
    case 'Trễ tiến độ': return 'late';
    case 'Khẩn cấp': return 'urgent';
    case 'Sắp đến hạn': return 'soon';
    case 'Bình thường': return 'normal';
    case 'Chưa bắt đầu': return 'default';
    default: return 'default';
  }
}
