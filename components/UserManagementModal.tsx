import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { Button, Input, Select } from './UI';
import { MockDB } from '../services/mockDatabase';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  onUsersUpdated: () => void;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({ 
  isOpen, onClose, users, onUsersUpdated 
}) => {
  const [view, setView] = useState<'LIST' | 'FORM'>('LIST');
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Form State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.OFFICER);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setView('LIST');
      resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
    setUsername('');
    setPassword('');
    setFullName('');
    setRole(UserRole.OFFICER);
    setEditingUser(null);
  };

  const handleEditClick = (user: User) => {
    setEditingUser(user);
    setUsername(user.username);
    setFullName(user.fullName);
    setRole(user.role);
    setPassword(''); 
    setView('FORM');
  };

  const handleAddClick = () => {
    resetForm();
    setView('FORM');
  };

  const handleDeleteClick = async (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa cán bộ này khỏi hệ thống?')) {
      await MockDB.deleteUser(id);
      onUsersUpdated();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (editingUser) {
        const updatedUser: User = {
          ...editingUser,
          username,
          fullName,
          role,
          password: password ? password : editingUser.password,
          avatarUrl: editingUser.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random&color=fff`
        };
        await MockDB.updateUser(updatedUser);
      } else {
        if (users.some(u => u.username === username)) {
          alert('Tên đăng nhập đã tồn tại!');
          setIsSubmitting(false);
          return;
        }

        const newUser: User = {
          id: `u${Date.now()}`,
          username,
          password: password || '123123',
          isFirstLogin: true,
          fullName,
          role,
          avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random&color=fff`
        };
        await MockDB.addUser(newUser);
      }
      onUsersUpdated();
      setView('LIST');
    } catch (error) {
      console.error(error);
      alert('Có lỗi xảy ra.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-stone-900/60 backdrop-blur-sm p-0 md:p-4 transition-all">
      <div className="bg-white w-full h-full md:h-auto md:max-h-[90vh] md:rounded-3xl rounded-none shadow-2xl overflow-hidden flex flex-col animate-fade-in-up border-t-4 border-red-700">
        {/* Header */}
        <div className="px-6 py-4 md:px-8 md:py-6 border-b border-red-50 flex justify-between items-center bg-red-50/50 backdrop-blur-xl sticky top-0 z-10">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-red-900 tracking-tight">
              {view === 'LIST' ? 'Quản lý Nhân sự' : (editingUser ? 'Cập nhật' : 'Thêm mới')}
            </h2>
            <p className="text-xs md:text-sm text-red-700/60 mt-1">Danh sách tài khoản hệ thống</p>
          </div>
          <button onClick={onClose} className="p-2 bg-white rounded-full text-red-800 hover:bg-red-100 transition-colors active:scale-90 shadow-sm border border-red-100">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 md:p-8 overflow-y-auto flex-1 bg-orange-50/30">
          
          {view === 'LIST' ? (
            <>
              <div className="flex justify-between items-center mb-6">
                <div className="inline-flex items-center px-4 py-2 bg-white border border-red-200 rounded-full text-sm font-semibold text-red-900 shadow-sm">
                   Tổng: <span className="text-red-600 font-bold ml-1">{users.length}</span>
                </div>
                <Button onClick={handleAddClick} icon={<span>+</span>}>Thêm mới</Button>
              </div>
              
              <div className="space-y-3 md:hidden">
                 {/* Mobile List View */}
                 {users.map(u => (
                   <div key={u.id} className="bg-white p-4 rounded-xl shadow-sm border border-orange-100 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                         <img src={u.avatarUrl} className="w-10 h-10 rounded-full ring-2 ring-orange-100" alt="" />
                         <div>
                            <p className="font-bold text-red-900">{u.fullName}</p>
                            <p className="text-xs text-stone-500 font-mono">@{u.username}</p>
                            <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold ${u.role === UserRole.MANAGER ? 'bg-amber-100 text-amber-800' : 'bg-stone-100 text-stone-600'}`}>
                               {u.role === UserRole.MANAGER ? 'Lãnh đạo' : 'Cán bộ'}
                            </span>
                         </div>
                      </div>
                      <div className="flex flex-col gap-2">
                         <button onClick={() => handleEditClick(u)} className="text-amber-700 bg-amber-50 p-2 rounded-lg text-xs font-bold border border-amber-100">Sửa</button>
                         <button onClick={() => handleDeleteClick(u.id)} className="text-red-700 bg-red-50 p-2 rounded-lg text-xs font-bold border border-red-100">Xóa</button>
                      </div>
                   </div>
                 ))}
              </div>

              <div className="hidden md:block overflow-hidden border border-red-100 rounded-2xl bg-white shadow-sm">
                <table className="w-full text-sm text-left text-stone-600">
                  <thead className="text-xs text-red-800 uppercase bg-red-50/50 border-b border-red-100 font-bold tracking-wider">
                    <tr>
                      <th className="px-6 py-4">Họ và tên</th>
                      <th className="px-6 py-4">Tên đăng nhập</th>
                      <th className="px-6 py-4">Chức vụ</th>
                      <th className="px-6 py-4 text-right">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-orange-50">
                    {users.map(u => (
                      <tr key={u.id} className="bg-white hover:bg-orange-50/50 transition-colors">
                        <td className="px-6 py-4 font-semibold text-red-900 flex items-center gap-4">
                          <img src={u.avatarUrl} className="w-9 h-9 rounded-full shadow-sm ring-2 ring-white" alt="" />
                          {u.fullName}
                        </td>
                        <td className="px-6 py-4 font-mono text-stone-500">{u.username}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${u.role === UserRole.MANAGER ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-stone-100 text-stone-600 border border-stone-200'}`}>
                            {u.role === UserRole.MANAGER ? 'Lãnh đạo' : 'Cán bộ'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right space-x-3">
                           <button onClick={() => handleEditClick(u)} className="text-amber-600 hover:text-amber-800 font-bold text-sm">Sửa</button>
                           <button onClick={() => handleDeleteClick(u.id)} className="text-red-600 hover:text-red-800 font-bold text-sm">Xóa</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            /* FORM VIEW */
            <form onSubmit={handleSubmit} className="max-w-xl mx-auto space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="col-span-2">
                   <Input 
                     label="Họ và tên" 
                     value={fullName} 
                     onChange={e => setFullName(e.target.value)} 
                     required 
                     placeholder="Ví dụ: Nguyễn Văn A"
                   />
                 </div>
                 
                 <Input 
                   label="Tên đăng nhập" 
                   value={username} 
                   onChange={e => setUsername(e.target.value)} 
                   required 
                   placeholder="nguyenvana"
                   disabled={!!editingUser} 
                 />
                 
                 <Select
                   label="Chức vụ"
                   value={role}
                   onChange={e => setRole(e.target.value as UserRole)}
                   options={[
                     { value: UserRole.OFFICER, label: 'Cán bộ' },
                     { value: UserRole.MANAGER, label: 'Lãnh đạo / Quản lý' }
                   ]}
                 />

                 <div className="col-span-2 border-t border-red-100 pt-6">
                    <label className="block text-sm font-bold text-red-900 mb-2">
                      {editingUser ? 'Đổi mật khẩu' : 'Mật khẩu khởi tạo'}
                    </label>
                    <input
                      type="password"
                      className="w-full px-4 py-3 border border-stone-200 rounded-xl bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder={editingUser ? 'Nhập nếu muốn thay đổi...' : 'Mặc định: 123123'}
                    />
                 </div>
               </div>

               <div className="flex justify-end gap-3 pt-6">
                 <Button type="button" variant="secondary" onClick={() => setView('LIST')}>Quay lại</Button>
                 <Button type="submit" isLoading={isSubmitting}>
                   {editingUser ? 'Lưu thay đổi' : 'Tạo tài khoản'}
                 </Button>
               </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};