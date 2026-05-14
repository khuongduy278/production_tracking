import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Role } from '../types';
import { PhongPhuLogo } from '../components/PhongPhuLogo';

export default function WelcomePage() {
  const { setUserData } = useAuth();
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<Role>('plan');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError('Vui lòng nhập họ tên');
      return;
    }
    setError('');

    const now = new Date().toISOString();
    // Unique mock ID for logs tracking
    const mockId = 'user-' + Math.random().toString(36).substr(2, 9);
    
    setUserData({
      id: mockId,
      fullName: fullName.trim(),
      role,
      createdAt: now,
      updatedAt: now
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md flex flex-col items-center">
        <div className="mt-6 w-72 bg-white rounded-lg p-4 shadow-sm border border-slate-100">
          <PhongPhuLogo className="w-full h-auto" />
        </div>
        <p className="mt-5 text-center text-sm font-medium text-slate-500 tracking-tight">
          Khai báo thông tin để bắt đầu hệ thống
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-sm border border-slate-200 sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <Input
              label="Họ và tên"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nhập tên của bạn"
            />

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1 tracking-tight">Chức vụ</label>
              <select 
                className="w-full flex h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-800 shadow-sm"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
              >
                <option value="admin">Admin (Quản trị viên)</option>
                <option value="plan">Điều độ Sản xuất</option>
                <option value="manager">Quản đốc</option>
                <option value="head_production">Trưởng ngành Sản xuất</option>
                <option value="tech">Nhân viên Kỹ thuật</option>
                <option value="foreman">Tổ trưởng</option>
              </select>
            </div>

            {error && <div className="text-red-500 text-sm bg-red-50 p-3 rounded-md border border-red-200">{error}</div>}

            <Button type="submit" className="w-full">
              Vào hệ thống
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
