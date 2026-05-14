export type Role = 'admin' | 'plan' | 'manager' | 'foreman' | 'tech' | 'head_production';

export interface User {
  id: string; // from auth
  fullName: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
}

export interface Order {
  id: string; // generated
  contractCode: string;
  materialCode: string;
  deliveryDate: string; // YYYY-MM-DD
  plannedQuantity: number;
  actualQuantity: number; // For tracking real numbers
  cutAllowed: number;
  cutVertical: number;
  sewBorder: number;
  sewHorizontal: number;
  inspect: number;
  pack: number;
  delayReason?: string;
  notes?: string;
  updatedBy: string;
  updatedAt: string;
  createdAt: string;
}

export interface Log {
  id: string;
  orderId: string;
  action: string;
  details: string;
  userId: string;
  userName: string;
  timestamp: string;
}
