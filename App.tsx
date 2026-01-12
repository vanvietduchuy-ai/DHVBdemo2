import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, Task, UserRole, TaskStatus, RecurringType, Notification, TaskPriority } from './types';
import { MockDB } from './services/mockDatabase';
import { Button, Input, StatusBadge, PriorityBadge, RecurringBadge } from './components/UI';
import { TaskModal } from './components/TaskModal';
import { UserManagementModal } from './components/UserManagementModal';
import { CloudSyncModal } from './components/CloudSyncModal';

// Logo Công An (Standard Police Badge URL)
const LOGO_URL = "https://upload.wikimedia.org/wikipedia/commons/a/a1/Cong_an_Hieu.svg";

const App: React.FC = () => {
  // Global State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  // UI State
  const [isLoading, setIsLoading] = useState(true);
  const [currentView, setCurrentView] = useState<'DASHBOARD' | 'STATISTICS' | 'PROPOSALS'>('DASHBOARD');
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showChangePassModal, setShowChangePassModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false); // New Modal State
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isCloudActive, setIsCloudActive] = useState(false);
  
  // Filter State - Expanded to handle special filters like DUE_SOON
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  
  const [filterAssignee, setFilterAssignee] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState(''); 
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Login State
  const [usernameInput, setUsernameInput] = useState('ldthang');
  const [passwordInput, setPasswordInput] = useState('');
  
  // Change Pass State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const notifRef = useRef<HTMLDivElement>(null);

  const reloadData = async () => {
    // Check local storage for cloud config auto-connect
    if (!MockDB.isCloudEnabled()) {
       const storedConfig = localStorage.getItem('firebaseConfig');
       if (storedConfig) {
          try {
             MockDB.initializeCloud(JSON.parse(storedConfig));
          } catch(e) {}
       }
    }
    setIsCloudActive(MockDB.isCloudEnabled());

    const [fetchedUsers, fetchedTasks] = await Promise.all([
      MockDB.getUsers(),
      MockDB.getTasks()
    ]);
    setUsers(fetchedUsers);
    setTasks(fetchedTasks);
    if (currentUser) {
       const notifs = await MockDB.getNotifications(currentUser.id);
       setNotifications(notifs);
    }
    return { users: fetchedUsers, tasks: fetchedTasks };
  };

  useEffect(() => {
    const initData = async () => {
      setIsLoading(true);
      await reloadData();
      
      const savedUser = localStorage.getItem('currentUser');
      if (savedUser) {
        const u = JSON.parse(savedUser);
        setCurrentUser(u);
        const notifs = await MockDB.getNotifications(u.id);
        setNotifications(notifs);
        if (u.isFirstLogin) setShowChangePassModal(true);
      }
      setIsLoading(false);
    };
    initData();

    // Subscribe to realtime updates from MockDB (Firebase)
    const unsubscribe = MockDB.subscribe(async () => {
       console.log('Syncing data from cloud...');
       // When data changes in cloud, refresh local state
       const [fetchedUsers, fetchedTasks] = await Promise.all([
          MockDB.getUsers(),
          MockDB.getTasks()
       ]);
       setUsers(fetchedUsers);
       setTasks(fetchedTasks);
       // Also update notifications if logged in
       const savedUser = localStorage.getItem('currentUser');
       if (savedUser) {
          const u = JSON.parse(savedUser);
          const notifs = await MockDB.getNotifications(u.id);
          setNotifications(notifs);
       }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifPanel(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [notifRef]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const user = await MockDB.login(usernameInput, passwordInput);
    if (user) {
      setCurrentUser(user);
      localStorage.setItem('currentUser', JSON.stringify(user));
      const notifs = await MockDB.getNotifications(user.id);
      setNotifications(notifs);
      if (user.isFirstLogin) {
        setShowChangePassModal(true);
      }
    } else {
      alert('Đăng nhập thất bại. Kiểm tra lại thông tin. Mật khẩu mặc định là 123123');
    }
    setIsLoading(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      alert('Mật khẩu xác nhận không khớp');
      return;
    }
    if (newPassword.length < 6) {
      alert('Mật khẩu phải từ 6 ký tự trở lên');
      return;
    }

    if (currentUser) {
      const updatedUser = { ...currentUser, password: newPassword, isFirstLogin: false };
      await MockDB.updateUser(updatedUser);
      setCurrentUser(updatedUser);
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));
      setShowChangePassModal(false);
      alert('Đổi mật khẩu thành công!');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
    setUsernameInput('');
    setPasswordInput('');
  };

  const handleSaveTask = async (task: Task) => {
    setIsLoading(true);
    await MockDB.saveTask(task);
    // Reload is handled by subscription if cloud is on, but manual reload ensures snappy UI locally
    if (!isCloudActive) await reloadData();
    setShowTaskModal(false);
    setEditingTask(null);
    setIsLoading(false);
  };

  const handleDeleteTask = async (id: string) => {
    if (!window.confirm('Bạn có chắc muốn xóa công việc này?')) return;
    setIsLoading(true);
    await MockDB.deleteTask(id);
    if (!isCloudActive) setTasks(prev => prev.filter(t => t.id !== id));
    setIsLoading(false);
  };

  const handleMarkAllRead = async () => {
    if (!currentUser) return;
    await MockDB.markAllRead(currentUser.id);
    if (!isCloudActive) setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!isCloudActive) setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, isRead: true } : n));
    MockDB.markRead(notification.id);

    if (notification.taskId) {
      const task = tasks.find(t => t.id === notification.taskId);
      if (task) {
         setEditingTask(task);
         setShowTaskModal(true);
         setShowNotifPanel(false); 
         
         if (currentUser?.role === UserRole.MANAGER && task.proposal) {
            handleViewProposal(task);
         }
      } else {
         alert('Công việc này có thể đã bị xóa.');
      }
    }
  };

  const openNewTaskModal = () => { setEditingTask(null); setShowTaskModal(true); };
  
  const openEditTaskModal = (task: Task) => { 
    setEditingTask(task); 
    setShowTaskModal(true);
    if (currentUser?.role === UserRole.MANAGER && task.proposal && !task.isProposalRead) {
       handleViewProposal(task);
    }
  };

  const handleViewProposal = async (task: Task) => {
     const updatedTask = { ...task, isProposalRead: true };
     // Local update for responsiveness
     setTasks(prev => prev.map(t => t.id === task.id ? updatedTask : t));
     await MockDB.saveTask(updatedTask);
  };

  // --- Statistics Logic ---
  const officerStats = useMemo(() => {
    if (!users.length || !tasks.length) return [];
    
    const officers = users.filter(u => u.role === UserRole.OFFICER);
    const now = new Date();

    return officers.map(officer => {
      const officerTasks = tasks.filter(t => t.assigneeId === officer.id);
      const total = officerTasks.length;
      const completed = officerTasks.filter(t => t.status === TaskStatus.COMPLETED).length;
      const pending = officerTasks.filter(t => t.status === TaskStatus.PENDING).length;
      const inProgress = officerTasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length;
      const overdue = officerTasks.filter(t => {
         const dueDate = new Date(t.dueDate);
         return (dueDate < now && t.status !== TaskStatus.COMPLETED && t.status !== TaskStatus.CANCELLED) || t.status === TaskStatus.OVERDUE;
      }).length;
      
      const todo = pending + inProgress;
      const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

      return {
        user: officer,
        total,
        completed,
        todo,
        overdue,
        completionRate
      };
    }).sort((a, b) => b.todo - a.todo);
  }, [users, tasks]);

  const filteredTasks = useMemo(() => {
    if (!currentUser) return [];
    let result = tasks;
    const now = new Date();
    
    // Role Filter
    if (currentUser.role === UserRole.OFFICER) {
      result = result.filter(t => t.assigneeId === currentUser.id);
    } else if (filterAssignee !== 'ALL') {
      result = result.filter(t => t.assigneeId === filterAssignee);
    }
    
    // Status / Special Filter
    if (filterStatus === 'DUE_SOON') {
       const threeDaysFromNow = new Date();
       threeDaysFromNow.setDate(now.getDate() + 3);
       result = result.filter(t => {
         const dueDate = new Date(t.dueDate);
         return dueDate >= now && dueDate <= threeDaysFromNow && t.status !== TaskStatus.COMPLETED && t.status !== TaskStatus.CANCELLED && t.status !== TaskStatus.OVERDUE;
       });
    } else if (filterStatus === 'OVERDUE_FILTER') {
       result = result.filter(t => {
         const dueDate = new Date(t.dueDate);
         return (dueDate < now && t.status !== TaskStatus.COMPLETED && t.status !== TaskStatus.CANCELLED) || t.status === TaskStatus.OVERDUE;
       });
    } else if (filterStatus === 'RECURRING_ATTENTION') {
       // Filter for active recurring tasks
       result = result.filter(t => 
         t.recurring && t.recurring !== RecurringType.NONE && 
         t.status !== TaskStatus.COMPLETED &&
         t.status !== TaskStatus.CANCELLED
       );
    } else if (filterStatus !== 'ALL') {
       result = result.filter(t => t.status === filterStatus);
    }

    // Search Filter
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(t => 
        t.title.toLowerCase().includes(lowerQuery) || 
        t.description.toLowerCase().includes(lowerQuery) ||
        (t.dispatchNumber && t.dispatchNumber.toLowerCase().includes(lowerQuery))
      );
    }

    return result.sort((a, b) => b.createdAt - a.createdAt);
  }, [tasks, currentUser, filterStatus, filterAssignee, searchQuery]);

  const proposalTasks = useMemo(() => {
    return tasks.filter(t => t.proposal && t.proposal.trim() !== '' && !t.isProposalRead);
  }, [tasks]);

  const allProposalsHistory = useMemo(() => {
     return tasks.filter(t => t.proposal && t.proposal.trim() !== '');
  }, [tasks]);

  const stats = useMemo(() => {
    const base = currentUser?.role === UserRole.OFFICER 
      ? tasks.filter(t => t.assigneeId === currentUser?.id)
      : tasks;
    
    const now = new Date();
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(now.getDate() + 3);

    return {
      total: base.length,
      pending: base.filter(t => t.status === TaskStatus.PENDING).length,
      inProgress: base.filter(t => t.status === TaskStatus.IN_PROGRESS).length,
      completed: base.filter(t => t.status === TaskStatus.COMPLETED).length,
      overdue: base.filter(t => {
         const dueDate = new Date(t.dueDate);
         return (dueDate < now && t.status !== TaskStatus.COMPLETED && t.status !== TaskStatus.CANCELLED) || t.status === TaskStatus.OVERDUE;
      }).length,
      dueSoon: base.filter(t => {
         const dueDate = new Date(t.dueDate);
         return dueDate >= now && dueDate <= threeDaysFromNow && t.status !== TaskStatus.COMPLETED && t.status !== TaskStatus.CANCELLED && t.status !== TaskStatus.OVERDUE;
      }).length
    };
  }, [tasks, currentUser]);

  const recurringAlerts = useMemo(() => {
     if (currentUser?.role !== UserRole.MANAGER) return [];
     return tasks.filter(t => 
       t.recurring !== RecurringType.NONE && 
       t.status !== TaskStatus.COMPLETED &&
       t.status !== TaskStatus.CANCELLED
     );
  }, [tasks, currentUser]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  // --- Change Password Modal ---
  if (showChangePassModal) {
    return (
      <div className="min-h-screen bg-stone-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full border-t-4 border-red-700">
           <div className="text-center mb-6">
             <div className="w-16 h-16 mx-auto mb-4 bg-red-50 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-red-800" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
             </div>
             <h2 className="text-xl font-bold text-red-900">Cập nhật mật khẩu</h2>
             <p className="text-stone-500 text-sm mt-2">Vui lòng đổi mật khẩu cho lần đăng nhập đầu tiên.</p>
           </div>
           <form onSubmit={handleChangePassword} className="space-y-4">
             <Input type="password" label="Mật khẩu mới" value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
             <Input type="password" label="Xác nhận mật khẩu" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
             <Button type="submit" className="w-full mt-2">Đổi mật khẩu</Button>
           </form>
        </div>
      </div>
    );
  }

  // --- Login Screen ---
  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-orange-50 relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-red-200/50 blur-3xl"></div>
          <div className="absolute bottom-[0%] right-[0%] w-[50%] h-[50%] rounded-full bg-yellow-200/50 blur-3xl"></div>
        </div>

        <div className="max-w-md w-full bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl p-10 border border-white/50 relative z-10 m-4 card-3d border-t-4 border-red-700">
          <div className="text-center mb-8">
            <div className="w-24 h-24 mx-auto mb-6 shadow-md rounded-full p-2 bg-red-900 flex items-center justify-center overflow-hidden ring-4 ring-yellow-400">
              <img src={LOGO_URL} alt="Công An Hiệu" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-lg font-extrabold text-red-900 tracking-wider uppercase leading-tight">Công An Tỉnh Quảng Trị</h1>
            <h2 className="text-base font-bold text-red-700 uppercase mt-1">Công An Phường Nam Đông Hà</h2>
            <p className="text-stone-500 font-bold text-xs mt-3 uppercase tracking-widest">Hệ thống quản lý công việc</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-6">
            <Input 
              label="Tên đăng nhập" 
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              placeholder="Nhập tên đăng nhập..."
              className="bg-white"
            />
            <div>
              <Input 
                type="password"
                label="Mật khẩu" 
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Nhập mật khẩu..."
                className="bg-white"
              />
              <div className="text-right mt-1">
                <span className="text-xs text-red-600 hover:underline cursor-pointer font-semibold">Quên mật khẩu?</span>
              </div>
            </div>
            <Button type="submit" className="w-full py-3.5 shadow-xl shadow-red-900/20 bg-red-800 hover:bg-red-900 text-white font-bold uppercase tracking-wider" isLoading={isLoading}>
              Đăng nhập
            </Button>
          </form>
          <div className="mt-8 text-center border-t border-stone-200 pt-4">
             <p className="text-xs text-stone-400 font-semibold">Vì Nhân Dân Phục Vụ</p>
          </div>
        </div>
      </div>
    );
  }

  // --- Main App ---
  return (
    <div className="min-h-screen bg-orange-50/50 flex flex-col md:flex-row font-sans text-stone-800">
      
      {/* Mobile Header (Fixed Top) */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-red-900 backdrop-blur-md shadow-md z-30 flex items-center justify-between px-4 text-white">
        <div className="flex items-center gap-3">
           <img src={LOGO_URL} alt="Logo" className="w-9 h-9 p-0.5 bg-white rounded-full" />
           <div>
              <p className="font-bold text-[10px] uppercase text-yellow-400 leading-none mb-0.5">CA TỈNH QUẢNG TRỊ</p>
              <p className="font-bold text-xs uppercase leading-none">CAP NAM ĐÔNG HÀ</p>
           </div>
        </div>
        <div className="flex items-center gap-4">
           {/* Notification Icon Mobile */}
           <div className="relative" ref={notifRef}>
             <button onClick={() => setShowNotifPanel(!showNotifPanel)} className="p-2 text-white/80 active:bg-red-800 rounded-full relative">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
                {unreadCount > 0 && <span className="absolute top-1.5 right-2 w-2.5 h-2.5 bg-yellow-400 rounded-full border border-red-900"></span>}
             </button>
              {showNotifPanel && (
                <div className="absolute top-12 right-[-10px] w-[300px] bg-white rounded-xl shadow-2xl border border-red-100 overflow-hidden z-50 animate-fade-in-up text-stone-800">
                  <div className="px-4 py-3 bg-red-50 border-b border-red-100 flex justify-between items-center">
                     <h3 className="text-sm font-bold text-red-900">Thông báo</h3>
                     <button onClick={handleMarkAllRead} className="text-xs text-red-600 font-medium">Đã xem tất cả</button>
                  </div>
                  <div className="max-h-[60vh] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center text-stone-400 text-xs">Không có thông báo mới</div>
                    ) : (
                      notifications.map(n => (
                        <div key={n.id} onClick={() => handleNotificationClick(n)} className={`p-4 border-b border-stone-50 hover:bg-stone-50 transition-colors ${!n.isRead ? 'bg-orange-50' : ''}`}>
                          <div className="flex gap-3">
                             <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${!n.isRead ? 'bg-red-500' : 'bg-transparent'}`}></div>
                             <div>
                               <p className="text-xs font-bold text-stone-800 mb-0.5">{n.title}</p>
                               <p className="text-xs text-stone-600 leading-snug">{n.message}</p>
                               <span className="text-[10px] text-stone-400 mt-1 block">{new Date(n.createdAt).toLocaleString('vi-VN')}</span>
                             </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
           </div>

           <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-white/90 active:bg-red-800 rounded-lg">
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
           </button>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden" onClick={() => setIsMobileMenuOpen(false)}></div>
      )}

      {/* Sidebar - Dark Red Police Style */}
      <aside className={`fixed md:sticky top-0 left-0 bottom-0 w-72 bg-red-950 text-stone-300 h-screen z-50 shadow-2xl transform transition-transform duration-300 md:translate-x-0 flex flex-col ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex items-center gap-3 border-b border-red-900 shrink-0">
          <div className="w-12 h-12 rounded-full bg-red-900 flex items-center justify-center p-1 overflow-hidden ring-2 ring-yellow-500 shadow-lg">
             <img src={LOGO_URL} alt="Logo" className="w-full h-full object-contain" />
          </div>
          <div>
             <h2 className="text-[10px] font-bold text-yellow-500 leading-tight uppercase">CA TỈNH QUẢNG TRỊ</h2>
             <h3 className="text-xs font-extrabold text-white leading-tight uppercase mt-0.5">CAP Nam Đông Hà</h3>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden ml-auto text-red-300">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {/* Navigation Items */}
          <button onClick={() => { setCurrentView('DASHBOARD'); setFilterStatus('ALL'); setFilterAssignee('ALL'); setIsMobileMenuOpen(false); }} 
             className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-all duration-200 ${currentView === 'DASHBOARD' ? 'bg-red-800 text-white shadow-lg shadow-red-900/50 font-bold border border-red-700' : 'hover:bg-red-900 text-red-200 hover:text-white'}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
            Sổ Giao Việc
          </button>

          {currentUser.role === UserRole.MANAGER && (
            <>
             <button onClick={() => { setCurrentView('PROPOSALS'); setIsMobileMenuOpen(false); }} 
               className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-all duration-200 ${currentView === 'PROPOSALS' ? 'bg-red-800 text-white shadow-lg shadow-red-900/50 font-bold border border-red-700' : 'hover:bg-red-900 text-red-200 hover:text-white'}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
              Hòm thư Đề xuất
              {proposalTasks.length > 0 && <span className="ml-auto bg-yellow-500 text-red-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{proposalTasks.length}</span>}
            </button>
            
             <button onClick={() => { setCurrentView('STATISTICS'); setIsMobileMenuOpen(false); }} 
               className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-all duration-200 ${currentView === 'STATISTICS' ? 'bg-red-800 text-white shadow-lg shadow-red-900/50 font-bold border border-red-700' : 'hover:bg-red-900 text-red-200 hover:text-white'}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z"></path></svg>
              Thống kê & Đánh giá
            </button>
            </>
          )}
          
          <div className="pt-6 pb-2 px-4 text-[11px] font-bold text-red-400 uppercase tracking-wider">Trạng thái</div>
          
          {[TaskStatus.PENDING, TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED, TaskStatus.OVERDUE].map(st => {
             const labels: Record<string, string> = { [TaskStatus.PENDING]: 'Chờ xử lý', [TaskStatus.IN_PROGRESS]: 'Đang thực hiện', [TaskStatus.COMPLETED]: 'Hoàn thành', [TaskStatus.OVERDUE]: 'Quá hạn' };
             const icons: Record<string, React.ReactNode> = {
               [TaskStatus.PENDING]: <span className="w-2 h-2 rounded-full bg-stone-400"></span>,
               [TaskStatus.IN_PROGRESS]: <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></span>,
               [TaskStatus.COMPLETED]: <span className="w-2 h-2 rounded-full bg-green-400"></span>,
               [TaskStatus.OVERDUE]: <span className="w-2 h-2 rounded-full bg-red-600"></span>
             };

             return (
              <button key={st} onClick={() => { setCurrentView('DASHBOARD'); setFilterStatus(st); setIsMobileMenuOpen(false); }} className={`w-full text-left px-4 py-2.5 rounded-xl text-sm flex items-center gap-3 transition-all ${filterStatus === st && currentView === 'DASHBOARD' ? 'bg-red-900 text-white font-medium border-l-4 border-yellow-500 pl-3' : 'hover:bg-red-900/50 text-red-200 hover:text-white'}`}>
                {icons[st]} {labels[st]}
              </button>
             );
          })}

          {currentUser.role === UserRole.MANAGER && (
            <>
               <div className="pt-6 pb-2 px-4 text-[11px] font-bold text-red-400 uppercase tracking-wider">Hệ thống</div>
               
               <button onClick={() => { setShowUserModal(true); setIsMobileMenuOpen(false); }} className="w-full text-left px-4 py-2.5 rounded-xl text-sm flex items-center gap-3 transition-all text-red-200 hover:bg-red-900 hover:text-white">
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                 Cán bộ chiến sĩ
               </button>
               
               {/* Cloud Sync Button - Only for Managers */}
               <button onClick={() => { setShowSyncModal(true); setIsMobileMenuOpen(false); }} className={`w-full text-left px-4 py-2.5 rounded-xl text-sm flex items-center gap-3 transition-all ${isCloudActive ? 'text-green-300 hover:text-white' : 'text-red-200 hover:bg-red-900 hover:text-white'}`}>
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                 <span>
                    {isCloudActive ? 'Đang đồng bộ' : 'Cấu hình đồng bộ'}
                    {isCloudActive && <span className="ml-2 inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>}
                 </span>
               </button>
            </>
          )}
        </nav>

        <div className="p-4 bg-red-950 border-t border-red-900">
          <div className="flex items-center gap-3 mb-4">
            <img src={currentUser.avatarUrl} alt="Avatar" className="w-9 h-9 rounded-full ring-2 ring-yellow-500" />
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-white truncate">{currentUser.fullName}</p>
              <p className="text-[10px] text-red-300 truncate uppercase">{currentUser.role === UserRole.MANAGER ? 'Chỉ huy' : 'Cán bộ'}</p>
            </div>
          </div>
          <Button variant="danger" className="w-full text-xs py-2 bg-red-900 hover:bg-stone-800 text-white shadow-none hover:shadow-none border border-red-800 font-bold" onClick={handleLogout}>Đăng xuất</Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 pt-20 md:p-12 md:pt-12 overflow-y-auto h-screen custom-scrollbar relative z-0">
        {/* Header Desktop Only */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-10 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-red-900 tracking-tight uppercase">
              {currentView === 'DASHBOARD' && 'Sổ Giao Việc'}
              {currentView === 'STATISTICS' && 'Thống kê & Đánh giá'}
              {currentView === 'PROPOSALS' && 'Hòm thư Đề xuất'}
            </h1>
            <p className="text-stone-500 mt-1 font-bold text-sm md:text-base">
              {currentView === 'DASHBOARD' && `Hôm nay là ${new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`}
              {currentView === 'STATISTICS' && 'Tổng hợp số liệu năng suất và chất lượng công việc.'}
              {currentView === 'PROPOSALS' && 'Tổng hợp ý kiến, kiến nghị từ cán bộ chiến sĩ.'}
            </p>
          </div>
          
          <div className="flex items-center gap-4 w-full md:w-auto">
             {/* Notification Desktop */}
             <div className="relative hidden md:block" ref={notifRef}>
                <button 
                  onClick={() => setShowNotifPanel(!showNotifPanel)} 
                  className="p-3 bg-white rounded-xl shadow-sm border border-stone-100 text-stone-500 hover:text-red-700 hover:shadow-md transition-all relative"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
                  {unreadCount > 0 && (
                    <span className="absolute top-2 right-2 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span>
                    </span>
                  )}
                </button>
                {/* Desktop Notification Dropdown */}
                {showNotifPanel && (
                  <div className="absolute top-14 right-0 w-[380px] bg-white rounded-2xl shadow-2xl border border-stone-100 overflow-hidden z-50 animate-fade-in-up origin-top-right">
                    <div className="px-5 py-4 bg-red-50 border-b border-red-100 flex justify-between items-center">
                       <h3 className="text-base font-bold text-red-900">Thông báo</h3>
                       <button onClick={handleMarkAllRead} className="text-xs text-red-600 font-bold hover:underline">Đánh dấu đã đọc</button>
                    </div>
                    <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                      {notifications.length === 0 ? (
                        <div className="p-10 text-center flex flex-col items-center">
                           <div className="w-12 h-12 bg-stone-100 rounded-full flex items-center justify-center mb-3 text-2xl">🔕</div>
                           <p className="text-stone-400 text-sm font-medium">Không có thông báo mới</p>
                        </div>
                      ) : (
                        notifications.map(n => (
                          <div key={n.id} onClick={() => handleNotificationClick(n)} className={`p-4 border-b border-stone-50 hover:bg-stone-50 transition-colors cursor-pointer group ${!n.isRead ? 'bg-orange-50/50' : ''}`}>
                            <div className="flex gap-4">
                               <div className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${!n.isRead ? 'bg-red-500 shadow-sm shadow-red-300' : 'bg-transparent'}`}></div>
                               <div className="flex-1">
                                 <p className="text-sm font-bold text-stone-800 mb-1 group-hover:text-red-700 transition-colors">{n.title}</p>
                                 <p className="text-sm text-stone-600 leading-relaxed">{n.message}</p>
                                 <span className="text-[11px] text-stone-400 mt-2 block font-medium">{new Date(n.createdAt).toLocaleString('vi-VN')}</span>
                               </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
             </div>

             {currentUser.role === UserRole.MANAGER && currentView === 'DASHBOARD' && (
                <Button 
                  onClick={openNewTaskModal} 
                  icon={<span className="text-lg font-bold">+</span>}
                  className="w-full md:w-auto px-6 py-3 shadow-red-500/20 card-3d"
                >
                  Giao việc mới
                </Button>
              )}
          </div>
        </div>

        {/* --- VIEW SWITCH --- */}
        {currentView === 'PROPOSALS' ? (
           /* --- PROPOSALS VIEW (Active Only) --- */
           <div className="pb-20">
              {allProposalsHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white/50 backdrop-blur rounded-3xl border border-dashed border-stone-300">
                  <div className="w-16 h-16 bg-blue-50 text-blue-400 rounded-full flex items-center justify-center mb-4 text-4xl">📬</div>
                  <p className="text-stone-500 font-medium">Chưa có đề xuất nào từ cán bộ.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                   {allProposalsHistory.map(task => {
                     const assignee = users.find(u => u.id === task.assigneeId);
                     const isRead = task.isProposalRead;
                     
                     return (
                       <div key={task.id} onClick={() => openEditTaskModal(task)} className={`p-6 rounded-2xl shadow-sm border cursor-pointer transition-all card-3d group relative overflow-hidden ${isRead ? 'bg-white border-stone-100 opacity-80' : 'bg-white border-blue-200 ring-2 ring-blue-50'}`}>
                          <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${isRead ? 'bg-stone-300' : 'bg-blue-500'}`}></div>
                          <div className="flex flex-col md:flex-row gap-6">
                             {/* Officer Info */}
                             <div className="flex items-start gap-4 md:w-1/4 min-w-[200px] border-b md:border-b-0 md:border-r border-stone-100 pb-4 md:pb-0">
                                <img src={assignee?.avatarUrl} className="w-12 h-12 rounded-full ring-2 ring-blue-100" alt="" />
                                <div>
                                   <p className="text-sm font-bold text-stone-800">{assignee?.fullName}</p>
                                   <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded mt-1 inline-block ${isRead ? 'text-stone-500 bg-stone-100' : 'text-blue-600 bg-blue-50'}`}>
                                      {isRead ? 'Đã xem' : 'Đề xuất mới'}
                                   </span>
                                </div>
                             </div>
                             
                             {/* Content */}
                             <div className="flex-1">
                                <div className={`p-4 rounded-xl border mb-3 relative ${isRead ? 'bg-stone-50 border-stone-100' : 'bg-blue-50/50 border-blue-100'}`}>
                                   <svg className={`absolute top-2 left-2 w-6 h-6 ${isRead ? 'text-stone-300' : 'text-blue-200'}`} fill="currentColor" viewBox="0 0 24 24"><path d="M14.017 21L14.017 18C14.017 16.8954 13.1216 16 12.017 16H9.01699V21H14.017ZM16.017 21V16H19.017C20.1216 16 21.017 16.8954 21.017 18V21H16.017ZM7.01699 16H4.01699C2.91243 16 2.01699 16.8954 2.01699 18V21H7.01699V16Z"></path></svg>
                                   <p className="text-stone-800 text-sm font-medium italic pl-6">"{task.proposal}"</p>
                                </div>
                                
                                <div className="flex items-center gap-2 text-xs text-stone-400">
                                   <span>Thuộc nhiệm vụ:</span>
                                   <span className="font-bold text-stone-600 bg-stone-100 px-2 py-0.5 rounded max-w-[300px] truncate">{task.title}</span>
                                </div>
                                {task.managerResponse && (
                                   <div className="mt-2 text-xs flex items-center gap-2">
                                     <span>Phản hồi:</span>
                                     <span className={`font-bold ${task.managerResponse.type === 'AGREE' ? 'text-green-600' : (task.managerResponse.type === 'REJECT' ? 'text-red-600' : 'text-stone-600')}`}>
                                        {task.managerResponse.type === 'AGREE' ? 'ĐỒNG Ý' : (task.managerResponse.type === 'REJECT' ? 'TỪ CHỐI' : 'CHỈ ĐẠO KHÁC')}
                                     </span>
                                   </div>
                                )}
                             </div>

                             {/* Action */}
                             <div className="flex items-center justify-end md:w-auto">
                                <button className="p-2 rounded-full bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                                </button>
                             </div>
                          </div>
                       </div>
                     );
                   })}
                </div>
              )}
           </div>
        ) : currentView === 'STATISTICS' ? (
           /* --- STATISTICS VIEW --- */
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-10">
              {officerStats.map(stat => (
                <div key={stat.user.id} className="bg-white/90 backdrop-blur rounded-2xl p-6 shadow-sm border border-stone-100 card-3d flex flex-col">
                   <div className="flex items-center gap-4 mb-6">
                      <img src={stat.user.avatarUrl} className="w-16 h-16 rounded-full ring-4 ring-orange-50" alt="" />
                      <div>
                         <h3 className="font-bold text-lg text-red-900">{stat.user.fullName}</h3>
                         <p className="text-stone-500 text-sm">{stat.user.username}</p>
                         <div className="mt-1 flex items-center gap-2">
                            {stat.completionRate >= 80 ? (
                               <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700">Hoàn thành tốt</span>
                            ) : stat.overdue > 0 ? (
                               <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">Cần nhắc nhở</span>
                            ) : (
                               <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-stone-100 text-stone-600">Đang hoạt động</span>
                            )}
                         </div>
                      </div>
                   </div>
                   
                   <div className="mb-4">
                      <div className="flex justify-between text-xs font-bold text-stone-600 mb-1">
                         <span>Tiến độ tổng thể</span>
                         <span>{stat.completionRate}%</span>
                      </div>
                      <div className="w-full bg-stone-100 rounded-full h-2.5 overflow-hidden">
                         <div className={`h-2.5 rounded-full ${stat.completionRate >= 80 ? 'bg-green-600' : (stat.completionRate >= 50 ? 'bg-yellow-500' : 'bg-orange-500')}`} style={{ width: `${stat.completionRate}%` }}></div>
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-3 mt-auto">
                      <div className="bg-stone-50 rounded-xl p-3 border border-stone-100 text-center">
                         <p className="text-[10px] text-stone-500 font-bold uppercase">Tổng số việc</p>
                         <p className="text-xl font-extrabold text-stone-800">{stat.total}</p>
                      </div>
                      <div className="bg-orange-50 rounded-xl p-3 border border-orange-100 text-center">
                         <p className="text-[10px] text-orange-600 font-bold uppercase">Cần làm ngay</p>
                         <p className="text-xl font-extrabold text-orange-600">{stat.todo}</p>
                      </div>
                      <div className="bg-red-50 rounded-xl p-3 border border-red-100 text-center">
                         <p className="text-[10px] text-red-600 font-bold uppercase">Quá hạn</p>
                         <p className="text-xl font-extrabold text-red-600">{stat.overdue}</p>
                      </div>
                      <div className="bg-green-50 rounded-xl p-3 border border-green-100 text-center">
                         <p className="text-[10px] text-green-600 font-bold uppercase">Đã xong</p>
                         <p className="text-xl font-extrabold text-green-600">{stat.completed}</p>
                      </div>
                   </div>
                </div>
              ))}
           </div>
        ) : (
           /* --- DASHBOARD VIEW --- */
           <>
              {/* Recurring Alert */}
              {recurringAlerts.length > 0 && (
                <div 
                  onClick={() => setFilterStatus('RECURRING_ATTENTION')}
                  className={`mb-6 bg-white/80 backdrop-blur border p-4 rounded-2xl shadow-sm flex items-start gap-4 card-3d cursor-pointer hover:bg-yellow-50 transition-all ${filterStatus === 'RECURRING_ATTENTION' ? 'border-yellow-400 ring-2 ring-yellow-100' : 'border-yellow-100'}`}
                >
                  <div className="bg-yellow-50 p-2.5 rounded-full text-yellow-600 shrink-0">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  </div>
                  <div>
                      <h4 className="font-bold text-yellow-900 text-sm">Nhiệm vụ định kỳ</h4>
                      <p className="text-yellow-700/80 text-xs mt-0.5">
                        Có <strong>{recurringAlerts.length}</strong> công việc lặp lại cần chú ý.
                      </p>
                  </div>
                </div>
              )}

              {/* Stats Grid - Clickable Filters */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                {/* Total */}
                <div 
                  onClick={() => setFilterStatus('ALL')}
                  className={`bg-white/80 backdrop-blur p-4 rounded-2xl shadow-sm border card-3d cursor-pointer hover:bg-white transition-all ${filterStatus === 'ALL' ? 'border-red-400 ring-2 ring-red-100' : 'border-stone-100'}`}
                >
                  <p className="text-stone-500 text-[10px] font-bold uppercase tracking-wider mb-2">Tổng việc</p>
                  <p className="text-3xl font-extrabold text-stone-800">{stats.total}</p>
                </div>
                {/* Pending */}
                <div 
                  onClick={() => setFilterStatus(TaskStatus.PENDING)}
                  className={`bg-white/80 backdrop-blur p-4 rounded-2xl shadow-sm border card-3d cursor-pointer hover:bg-white transition-all ${filterStatus === TaskStatus.PENDING ? 'border-stone-400 ring-2 ring-stone-100' : 'border-stone-100'}`}
                >
                  <p className="text-stone-500 text-[10px] font-bold uppercase tracking-wider mb-2">Chờ xử lý</p>
                  <p className="text-3xl font-extrabold text-stone-600">{stats.pending}</p>
                </div>
                {/* In Progress */}
                <div 
                   onClick={() => setFilterStatus(TaskStatus.IN_PROGRESS)}
                   className={`bg-white/80 backdrop-blur p-4 rounded-2xl shadow-sm border card-3d cursor-pointer hover:bg-white transition-all ${filterStatus === TaskStatus.IN_PROGRESS ? 'border-amber-400 ring-2 ring-amber-100' : 'border-stone-100'}`}
                >
                  <p className="text-amber-600/70 text-[10px] font-bold uppercase tracking-wider mb-2">Đang làm</p>
                  <p className="text-3xl font-extrabold text-amber-500">{stats.inProgress}</p>
                </div>
                {/* Completed */}
                <div 
                  onClick={() => setFilterStatus(TaskStatus.COMPLETED)}
                  className={`bg-white/80 backdrop-blur p-4 rounded-2xl shadow-sm border card-3d cursor-pointer hover:bg-white transition-all ${filterStatus === TaskStatus.COMPLETED ? 'border-green-400 ring-2 ring-green-100' : 'border-stone-100'}`}
                >
                  <p className="text-green-600/70 text-[10px] font-bold uppercase tracking-wider mb-2">Hoàn thành</p>
                  <p className="text-3xl font-extrabold text-green-600">{stats.completed}</p>
                </div>
                {/* Overdue */}
                <div 
                  onClick={() => setFilterStatus('OVERDUE_FILTER')}
                  className={`bg-red-50/90 backdrop-blur p-4 rounded-2xl shadow-sm border card-3d cursor-pointer hover:bg-red-50 transition-all ${filterStatus === 'OVERDUE_FILTER' || filterStatus === TaskStatus.OVERDUE ? 'border-red-400 ring-2 ring-red-100' : 'border-red-100'}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                      <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
                      <p className="text-red-700 text-[10px] font-bold uppercase tracking-wider">Quá hạn</p>
                  </div>
                  <p className="text-3xl font-extrabold text-red-700">{stats.overdue}</p>
                </div>
                {/* Due Soon */}
                <div 
                   onClick={() => setFilterStatus('DUE_SOON')}
                   className={`bg-orange-50/90 backdrop-blur p-4 rounded-2xl shadow-sm border card-3d cursor-pointer hover:bg-orange-50 transition-all ${filterStatus === 'DUE_SOON' ? 'border-orange-400 ring-2 ring-orange-100' : 'border-orange-100'}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                      <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                      <p className="text-orange-700 text-[10px] font-bold uppercase tracking-wider">Sắp đến hạn</p>
                  </div>
                  <p className="text-3xl font-extrabold text-orange-600">{stats.dueSoon}</p>
                </div>
              </div>

              {/* Task List Header */}
              <div className="flex flex-col sm:flex-row justify-between items-end sm:items-center mb-4 gap-2">
                  <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
                     <h3 className="text-lg md:text-xl font-bold text-stone-800 whitespace-nowrap">
                        {filterAssignee !== 'ALL' ? 'Công việc của:' : (
                          filterStatus === 'DUE_SOON' ? 'Danh sách sắp đến hạn' :
                          filterStatus === 'OVERDUE_FILTER' ? 'Danh sách quá hạn' :
                          filterStatus === 'RECURRING_ATTENTION' ? 'Nhiệm vụ định kỳ cần chú ý' :
                          filterStatus !== 'ALL' ? `Danh sách ${filterStatus === TaskStatus.PENDING ? 'chờ xử lý' : filterStatus === TaskStatus.IN_PROGRESS ? 'đang thực hiện' : 'hoàn thành'}` : 
                          'Toàn bộ nhiệm vụ'
                        )}
                     </h3>
                     {filterAssignee !== 'ALL' && (
                       <span className="bg-red-50 text-red-800 px-3 py-1 rounded-full text-xs md:text-sm truncate max-w-[120px]">{users.find(u => u.id === filterAssignee)?.fullName}</span>
                     )}
                     {(filterAssignee !== 'ALL' || filterStatus !== 'ALL') && (
                        <button onClick={() => { setFilterAssignee('ALL'); setFilterStatus('ALL'); }} className="text-xs text-stone-400 hover:text-red-600 transition-colors ml-2 font-semibold">✕ Xóa bộ lọc</button>
                     )}
                  </div>
                  
                  {/* Search Bar */}
                  <div className="w-full sm:w-auto min-w-[250px]">
                    <Input 
                      type="search" 
                      placeholder="Tìm kiếm công việc..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="py-2 text-sm shadow-sm"
                    />
                  </div>
              </div>

              {/* Task List */}
              <div className="space-y-4 pb-20">
                {filteredTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 bg-white/50 backdrop-blur rounded-3xl border border-dashed border-stone-300">
                    <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center mb-4 text-4xl">📂</div>
                    <p className="text-stone-500 font-medium">{searchQuery ? 'Không tìm thấy kết quả phù hợp.' : 'Chưa có nhiệm vụ nào.'}</p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:gap-5">
                    {filteredTasks.map(task => {
                      const assignee = users.find(u => u.id === task.assigneeId);
                      const isOverdue = (new Date(task.dueDate) < new Date() && task.status !== TaskStatus.COMPLETED && task.status !== TaskStatus.CANCELLED) || task.status === TaskStatus.OVERDUE;
                      // Check if due soon (within 3 days)
                      const due = new Date(task.dueDate);
                      const now = new Date();
                      const diffTime = due.getTime() - now.getTime();
                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                      const isDueSoon = diffDays >= 0 && diffDays <= 3 && task.status !== TaskStatus.COMPLETED && task.status !== TaskStatus.OVERDUE;

                      return (
                        <div key={task.id} 
                          className={`bg-white/90 backdrop-blur p-5 rounded-2xl border cursor-pointer group relative overflow-hidden card-3d ${isOverdue ? 'border-red-200 ring-1 ring-red-100' : (isDueSoon ? 'border-orange-200 ring-1 ring-orange-100' : 'border-stone-100')}`}
                          onClick={() => openEditTaskModal(task)}
                        >
                          <div className="flex flex-col md:flex-row gap-3 md:items-start">
                            
                            {/* Left: Status Indicator & Meta */}
                            <div className="flex-1">
                              <div className="flex items-center flex-wrap gap-2 mb-2">
                                <StatusBadge status={task.status} />
                                {task.dispatchNumber && (
                                  <span className="text-[10px] font-mono text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded border border-stone-200">
                                    #{task.dispatchNumber}
                                  </span>
                                )}
                                <RecurringBadge type={task.recurring} />
                                {isOverdue && task.status !== TaskStatus.OVERDUE && <span className="text-[10px] font-bold text-white bg-red-600 px-2 py-0.5 rounded shadow-sm">QUÁ HẠN</span>}
                                {isDueSoon && <span className="text-[10px] font-bold text-white bg-orange-500 px-2 py-0.5 rounded shadow-sm">GẤP</span>}
                              </div>
                              
                              <h4 className="text-base md:text-lg font-bold text-stone-800 group-hover:text-red-700 transition-colors leading-snug mb-2">
                                {task.title}
                              </h4>
                              
                              <p className="text-stone-500 text-sm line-clamp-2 leading-relaxed mb-3">
                                {task.description}
                              </p>

                              <div className="flex items-center flex-wrap gap-3 text-xs font-medium text-stone-400">
                                {assignee && (
                                  <div className="flex items-center gap-1.5 bg-stone-50 px-2 py-1 rounded-full">
                                    <img src={assignee.avatarUrl} alt="" className="w-4 h-4 rounded-full"/>
                                    <span className="text-stone-600 max-w-[100px] truncate">{assignee.fullName}</span>
                                  </div>
                                )}
                                <div className={`flex items-center gap-1 ml-auto md:ml-0 ${isOverdue ? 'text-red-600 font-bold' : (isDueSoon ? 'text-orange-600 font-bold' : '')}`}>
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                  {new Date(task.dueDate).toLocaleDateString('vi-VN')}
                                </div>
                              </div>
                            </div>

                            {/* Right: Priority & Actions */}
                            <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-start gap-3 mt-2 md:mt-0 border-t md:border-t-0 border-stone-100 pt-3 md:pt-0">
                              <PriorityBadge priority={task.priority} />
                              
                              {currentUser.role === UserRole.MANAGER && (
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id); }}
                                  className="p-2 text-stone-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors md:opacity-0 md:group-hover:opacity-100"
                                  title="Xóa công việc"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                </button>
                              )}
                            </div>

                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
           </>
        )}
      </main>

      <TaskModal 
        isOpen={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        onSave={handleSaveTask}
        initialTask={editingTask}
        users={users}
        currentUser={currentUser}
      />

      <UserManagementModal
        isOpen={showUserModal}
        onClose={() => setShowUserModal(false)}
        users={users}
        onUsersUpdated={reloadData}
      />

      <CloudSyncModal
        isOpen={showSyncModal}
        onClose={() => setShowSyncModal(false)}
        onConfigSaved={reloadData}
      />
    </div>
  );
};

export default App;