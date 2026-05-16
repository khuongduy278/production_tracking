import React, { useEffect, useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, ListTodo, FileDown, UserPlus, X, Copy, LogOut } from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';
import { PhongPhuLogo } from './PhongPhuLogo';

export default function Layout() {
  const { userData, logout } = useAuth();
  const location = useLocation();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    
    const appUrl = window.location.origin;
    const subject = encodeURIComponent('Lời mời tham gia hệ thống Phong Phu Home Textile');
    const body = encodeURIComponent(`Xin chào,\n\nBạn đã được mời tham gia hệ thống theo dõi tiến độ của Phong Phu Home Textile.\n\nVui lòng truy cập đường dẫn sau để bắt đầu đăng nhập: ${appUrl}\n\nTrân trọng,\nĐội ngũ quản lý Phong Phu Home Textile.`);
    
    // Mở trình gửi mail mặc định của hệ thống
    window.location.href = `mailto:${inviteEmail}?subject=${subject}&body=${body}`;
    
    toast.success(`Đang mở ứng dụng email để gửi lời mời đến ${inviteEmail}`);
    setShowInviteModal(false);
    setInviteEmail('');
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.origin);
    toast.success('Đã sao chép liên kết vào khay nhớ tạm');
  };

  const navItems = [
    { name: 'Tổng quan', path: '/', icon: LayoutDashboard },
    { name: 'Tiến độ', path: '/orders', icon: ListTodo },
    { name: 'Gia công', path: '/outsourcing', icon: ListTodo },
    { name: 'Lịch sử', path: '/logs', icon: FileDown },
  ];

  // Logic kiểm tra giờ để hiện cảnh báo (MVP simulation)
  useEffect(() => {
    const checkNotificationTime = () => {
      const now = new Date();
      const h = now.getHours();
      const m = now.getMinutes();
      
      const isAlertTime = (h === 8 && m === 0) || (h === 13 && m === 0) || (h === 18 && m === 0);
      if (isAlertTime) {
        toast('Đến giờ kiểm tra tiến độ, xem báo cáo trên Dashboard!', {
          icon: '⏰',
          style: { borderRadius: '10px', background: '#333', color: '#fff' }
        });
      }
    };
    
    // Check local every minute
    const interval = setInterval(checkNotificationTime, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-[#1E293B] flex flex-col md:flex-row overflow-hidden">
      <Toaster position="top-right" />
      {/* Mobile Header */}
      <header className="md:hidden bg-white shadow-sm px-4 py-3 flex justify-between items-center sticky top-0 z-10 border-b border-slate-200">
        <div className="flex">
          <PhongPhuLogo className="h-10 w-auto" />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-600 truncate max-w-[100px]">{userData?.fullName}</span>
          <button 
            onClick={logout}
            className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-md transition-colors"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-[#0F172A] text-white flex-col h-screen sticky top-0">
        <div className="pt-8 pb-10 px-6 shrink-0 flex justify-center bg-white border-b border-slate-200/20">
          <PhongPhuLogo className="h-16 w-auto" />
        </div>
        
        <nav className="flex-1 px-4 pt-6 flex flex-col gap-2 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${
                  isActive 
                  ? 'bg-blue-600 text-white' 
                  : 'hover:bg-slate-800 text-slate-300'
                }`}
              >
                <Icon size={20} className={isActive ? 'text-white' : 'text-slate-400'} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-6 bg-slate-800/50 mt-auto shrink-0 space-y-4">
          <button 
            onClick={() => setShowInviteModal(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm font-medium transition-colors"
          >
            <UserPlus size={16} />
            Mời tham gia
          </button>
          <div className="flex items-center justify-between pt-2 border-t border-slate-700/50">
            <div className="flex items-center gap-3 overflow-hidden pr-2">
              <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center font-bold text-lg shrink-0 shadow-inner">
                {userData?.fullName?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-semibold truncate">{userData?.fullName}</p>
                <p className="text-xs text-slate-400 truncate capitalize">
                  {userData?.role === 'plan' ? 'Điều độ Sản xuất' :
                   userData?.role === 'head_production' ? 'Trưởng ngành SX' :
                   userData?.role === 'tech' ? 'Nhân viên Kỹ thuật' :
                   userData?.role === 'deputy_manager' ? 'Phó Quản đốc' :
                   userData?.role}
                </p>
              </div>
            </div>
            <button 
              onClick={logout}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              title="Đăng xuất"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col max-w-full min-w-0 pb-16 md:pb-0 h-screen overflow-y-auto">
        <div className="p-4 md:p-8 md:max-w-7xl mx-auto w-full">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-between px-2 pb-safe pt-1 z-20">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center w-1/3 py-2 ${
                isActive ? 'text-blue-600' : 'text-gray-500'
              }`}
            >
              <Icon size={24} className="mb-1" strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-semibold text-slate-800">Mời thành viên mới</h3>
              <button 
                onClick={() => setShowInviteModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleInviteSubmit} className="p-6">
              <div className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                    Địa chỉ Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="tengicudo@phongphu.com"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-shadow"
                  />
                </div>
                <p className="text-[13px] text-slate-500 leading-relaxed">
                  Ứng dụng email chuyên dụng trên thiết bị sẽ được mở ra kèm thông tin liên kết truy cập hệ thống dành cho người nhận.
                </p>

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="w-full border-t border-slate-200"></div>
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-slate-50 px-2 text-sm text-slate-500 font-medium font-sans">Hoặc</span>
                  </div>
                </div>

                <div>
                   <label className="block text-sm font-medium text-slate-700 mb-2">
                    Sao chép liên kết trực tiếp
                  </label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      readOnly 
                      value={window.location.origin} 
                      className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-600 outline-none"
                    />
                    <button 
                      type="button" 
                      onClick={handleCopyLink}
                      className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 shadow-sm"
                    >
                      <Copy size={16} className="text-slate-500" />
                      Sao chép
                    </button>
                  </div>
                </div>
              </div>
              <div className="mt-8 flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-sm transition-colors"
                >
                  Gửi lời mời
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
