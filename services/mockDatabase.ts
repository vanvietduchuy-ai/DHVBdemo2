import { User, UserRole, Task, TaskStatus, TaskPriority, RecurringType, Notification } from '../types';
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getDatabase, ref, set, get, child, onValue, Database } from 'firebase/database';

// Default password for everyone
const DEFAULT_PASS = '123123';

const MOCK_USERS: User[] = [
  // --- BAN LÃNH ĐẠO (Managers) ---
  { id: 'u1', username: 'ldthang', password: DEFAULT_PASS, isFirstLogin: true, fullName: 'Lê Đình Thắng', role: UserRole.MANAGER, avatarUrl: 'https://ui-avatars.com/api/?name=Le+Dinh+Thang&background=ef4444&color=fff' }, 
  { id: 'u2', username: 'lqtuan', password: DEFAULT_PASS, isFirstLogin: true, fullName: 'Lê Quốc Tuấn', role: UserRole.MANAGER, avatarUrl: 'https://ui-avatars.com/api/?name=Le+Quoc+Tuan&background=f97316&color=fff' },
  { id: 'u3', username: 'nthao', password: DEFAULT_PASS, isFirstLogin: true, fullName: 'Nguyễn Thị Hảo', role: UserRole.MANAGER, avatarUrl: 'https://ui-avatars.com/api/?name=Nguyen+Thi+Hao&background=f97316&color=fff' },

  // --- CÁN BỘ (Officers) ---
  { id: 'u4', username: 'ptadao', password: DEFAULT_PASS, isFirstLogin: true, fullName: 'Phan Thị Anh Đào', role: UserRole.OFFICER, avatarUrl: 'https://ui-avatars.com/api/?name=Phan+Thi+Anh+Dao&background=059669&color=fff' },
  { id: 'u5', username: 'nthuong', password: DEFAULT_PASS, isFirstLogin: true, fullName: 'Nguyễn Thị Hường', role: UserRole.OFFICER, avatarUrl: 'https://ui-avatars.com/api/?name=Nguyen+Thi+Huong&background=059669&color=fff' },
  { id: 'u6', username: 'nqtrang', password: DEFAULT_PASS, isFirstLogin: true, fullName: 'Nguyễn Quỳnh Trang', role: UserRole.OFFICER, avatarUrl: 'https://ui-avatars.com/api/?name=Nguyen+Quynh+Trang&background=059669&color=fff' },
  { id: 'u7', username: 'cphang', password: DEFAULT_PASS, isFirstLogin: true, fullName: 'Cao Phương Hằng', role: UserRole.OFFICER, avatarUrl: 'https://ui-avatars.com/api/?name=Cao+Phuong+Hang&background=059669&color=fff' },
  { id: 'u8', username: 'nttsuong', password: DEFAULT_PASS, isFirstLogin: true, fullName: 'Nguyễn Thị Thu Sương', role: UserRole.OFFICER, avatarUrl: 'https://ui-avatars.com/api/?name=Nguyen+Thi+Thu+Suong&background=059669&color=fff' },
  { id: 'u9', username: 'ndnguyen', password: DEFAULT_PASS, isFirstLogin: true, fullName: 'Nguyễn Đình Nguyên', role: UserRole.OFFICER, avatarUrl: 'https://ui-avatars.com/api/?name=Nguyen+Dinh+Nguyen&background=059669&color=fff' },
  { id: 'u10', username: 'hhquynh', password: DEFAULT_PASS, isFirstLogin: true, fullName: 'Hoàng Hương Quỳnh', role: UserRole.OFFICER, avatarUrl: 'https://ui-avatars.com/api/?name=Hoang+Huong+Quynh&background=059669&color=fff' },
  { id: 'u11', username: 'nklinh', password: DEFAULT_PASS, isFirstLogin: true, fullName: 'Nguyễn Khánh Linh', role: UserRole.OFFICER, avatarUrl: 'https://ui-avatars.com/api/?name=Nguyen+Khanh+Linh&background=059669&color=fff' },
  { id: 'u12', username: 'hphai', password: DEFAULT_PASS, isFirstLogin: true, fullName: 'Hoàng Phi Hải', role: UserRole.OFFICER, avatarUrl: 'https://ui-avatars.com/api/?name=Hoang+Phi+Hai&background=059669&color=fff' },
  { id: 'u13', username: 'nthue', password: DEFAULT_PASS, isFirstLogin: true, fullName: 'Nguyễn Thị Như Huế', role: UserRole.OFFICER, avatarUrl: 'https://ui-avatars.com/api/?name=Nguyen+Thi+Nhu+Hue&background=059669&color=fff' },
  { id: 'u14', username: 'vvdhuy', password: DEFAULT_PASS, isFirstLogin: true, fullName: 'Văn Viết Đức Huy', role: UserRole.OFFICER, avatarUrl: 'https://ui-avatars.com/api/?name=Van+Viet+Duc+Huy&background=059669&color=fff' },
  { id: 'u15', username: 'lqchung', password: DEFAULT_PASS, isFirstLogin: true, fullName: 'Lê Quang Chung', role: UserRole.OFFICER, avatarUrl: 'https://ui-avatars.com/api/?name=Le+Quang+Chung&background=059669&color=fff' },
  { id: 'u16', username: 'dvtdat', password: DEFAULT_PASS, isFirstLogin: true, fullName: 'Dương Văn Tiến Đạt', role: UserRole.OFFICER, avatarUrl: 'https://ui-avatars.com/api/?name=Duong+Van+Tien+Dat&background=059669&color=fff' },
];

const MOCK_TASKS: Task[] = [
  {
    id: 't1',
    title: 'V/v Rà soát quy hoạch phân khu B tại quận Liên Chiểu',
    description: 'Thực hiện rà soát theo chỉ đạo của UBND TP. Báo cáo kết quả trước ngày 25.',
    proposal: 'Đã liên hệ phòng TNMT nhưng chưa nhận được bản đồ mới. Đề xuất gia hạn thêm 2 ngày.',
    dispatchNumber: '128/UBND-QLĐT',
    issuingAuthority: 'UBND Thành Phố',
    issueDate: '2024-05-15',
    assigneeId: 'u4',
    creatorId: 'u1',
    recurring: RecurringType.NONE,
    status: TaskStatus.IN_PROGRESS,
    priority: TaskPriority.HIGH,
    dueDate: new Date(Date.now() - 86400000).toISOString(), // Yesterday (Overdue)
    createdAt: Date.now(),
    aiSuggestedSteps: ['Thu thập hồ sơ quy hoạch cũ', 'Khảo sát hiện trạng', 'Lập báo cáo so sánh']
  },
  {
    id: 't2',
    title: 'Báo cáo số liệu đền bù GPMB định kỳ tháng',
    description: 'Tổng hợp số liệu và báo cáo phòng Kế hoạch.',
    dispatchNumber: '45/KH-TNMT',
    issuingAuthority: 'Sở TN&MT',
    issueDate: '2024-05-20',
    assigneeId: 'u15',
    creatorId: 'u2',
    recurring: RecurringType.MONTHLY,
    status: TaskStatus.PENDING,
    priority: TaskPriority.MEDIUM,
    dueDate: new Date(Date.now() + 86400000 * 2).toISOString(), // In 2 days (Due Soon)
    createdAt: Date.now() - 100000,
  }
];

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: 'n1',
    userId: 'u4',
    title: 'Nhiệm vụ mới',
    message: 'Bạn được giao nhiệm vụ: V/v Rà soát quy hoạch phân khu B',
    isRead: false,
    createdAt: Date.now() - 3600000,
    type: 'TASK_ASSIGNED',
    taskId: 't1'
  },
  {
    id: 'n2',
    userId: 'u4',
    title: 'Cảnh báo quá hạn',
    message: 'Nhiệm vụ "V/v Rà soát quy hoạch..." đã quá hạn xử lý!',
    isRead: false,
    createdAt: Date.now(),
    type: 'DEADLINE_WARNING',
    taskId: 't1'
  }
];

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to calculate next due date
const getNextDueDate = (currentDueDate: string, type: RecurringType): string => {
  const date = new Date(currentDueDate);
  if (type === RecurringType.WEEKLY) {
    date.setDate(date.getDate() + 7);
  } else if (type === RecurringType.MONTHLY) {
    date.setMonth(date.getMonth() + 1);
  } else if (type === RecurringType.QUARTERLY) {
    date.setMonth(date.getMonth() + 3);
  }
  return date.toISOString();
};

// --- REALTIME DATABASE LOGIC ---
let firebaseApp: FirebaseApp | null = null;
let firebaseDb: Database | null = null;
let subscriptions: Array<() => void> = [];

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  databaseURL: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export const MockDB = {
  // --- CLOUD SYNC CONFIGURATION ---
  initializeCloud: (config: FirebaseConfig): boolean => {
    try {
      if (firebaseApp) return true; // Already initialized
      firebaseApp = initializeApp(config);
      firebaseDb = getDatabase(firebaseApp);
      console.log('Firebase initialized successfully');
      
      // Setup Realtime Listeners
      const dbRef = ref(firebaseDb, '/');
      onValue(dbRef, (snapshot) => {
        if (snapshot.exists()) {
          // Data changed in cloud, notify subscribers
          subscriptions.forEach(cb => cb());
        }
      });
      
      return true;
    } catch (error) {
      console.error('Firebase initialization failed:', error);
      return false;
    }
  },

  isCloudEnabled: (): boolean => {
    return !!firebaseDb;
  },

  disconnectCloud: () => {
    firebaseApp = null;
    firebaseDb = null;
  },

  subscribe: (callback: () => void) => {
    subscriptions.push(callback);
    return () => {
      subscriptions = subscriptions.filter(cb => cb !== callback);
    };
  },

  // --- HYBRID DATA METHODS (Cloud > LocalStorage) ---

  getUsers: async (): Promise<User[]> => {
    if (firebaseDb) {
       try {
         const snapshot = await get(child(ref(firebaseDb), 'users'));
         if (snapshot.exists()) return snapshot.val();
         // If cloud is empty, seed it
         await set(ref(firebaseDb, 'users'), MOCK_USERS);
         return MOCK_USERS;
       } catch(e) { console.error(e); }
    }

    await delay(300);
    const stored = localStorage.getItem('users');
    if (!stored) {
      localStorage.setItem('users', JSON.stringify(MOCK_USERS));
      return MOCK_USERS;
    }
    return JSON.parse(stored);
  },

  updateUser: async (user: User): Promise<void> => {
    const users = await MockDB.getUsers();
    const index = users.findIndex(u => u.id === user.id);
    if (index !== -1) {
      users[index] = user;
      
      if (firebaseDb) {
        await set(ref(firebaseDb, 'users'), users);
      } else {
        localStorage.setItem('users', JSON.stringify(users));
      }
    }
  },

  addUser: async (user: User): Promise<User> => {
    const users = await MockDB.getUsers();
    const newUsers = [...users, user];
    
    if (firebaseDb) {
       await set(ref(firebaseDb, 'users'), newUsers);
    } else {
       await delay(300);
       localStorage.setItem('users', JSON.stringify(newUsers));
    }
    return user;
  },

  deleteUser: async (id: string): Promise<void> => {
    const users = await MockDB.getUsers();
    const newUsers = users.filter(u => u.id !== id);
    
    if (firebaseDb) {
      await set(ref(firebaseDb, 'users'), newUsers);
    } else {
      await delay(300);
      localStorage.setItem('users', JSON.stringify(newUsers));
    }
  },

  getTasks: async (): Promise<Task[]> => {
    if (firebaseDb) {
       try {
         const snapshot = await get(child(ref(firebaseDb), 'tasks'));
         if (snapshot.exists()) return snapshot.val() || [];
         await set(ref(firebaseDb, 'tasks'), MOCK_TASKS);
         return MOCK_TASKS;
       } catch(e) { console.error(e); return []; }
    }

    await delay(300);
    const stored = localStorage.getItem('tasks');
    if (!stored) {
      localStorage.setItem('tasks', JSON.stringify(MOCK_TASKS));
      return MOCK_TASKS;
    }
    return JSON.parse(stored);
  },

  saveTask: async (task: Task): Promise<Task> => {
    // Note: We use the local helper delay if NOT cloud, but cloud methods are async anyway
    let tasks = await MockDB.getTasks();
    const index = tasks.findIndex(t => t.id === task.id);
    const existingTask = index !== -1 ? tasks[index] : null;
    
    // Auto-create Recurring Task Logic
    if (
      existingTask && 
      existingTask.status !== TaskStatus.COMPLETED && 
      task.status === TaskStatus.COMPLETED &&
      task.recurring && 
      task.recurring !== RecurringType.NONE
    ) {
      const nextDueDate = getNextDueDate(task.dueDate, task.recurring);
      const newTask: Task = {
        ...task,
        id: `t${Date.now()}_rec`, // Unique ID for new task
        status: TaskStatus.PENDING,
        dueDate: nextDueDate,
        createdAt: Date.now(),
      };
      tasks = [newTask, ...tasks];
      
      await MockDB.createNotification({
        id: `n${Date.now()}_rec`,
        userId: task.assigneeId,
        title: 'Công việc định kỳ mới',
        message: `Hệ thống tự động tạo việc định kỳ: ${task.title}`,
        isRead: false,
        createdAt: Date.now(),
        type: 'TASK_ASSIGNED',
        taskId: newTask.id
      });
    }

    const isNew = index === -1;
    if (isNew) {
      tasks = [task, ...tasks];
      await MockDB.createNotification({
        id: `n${Date.now()}`,
        userId: task.assigneeId,
        title: 'Nhiệm vụ mới',
        message: `Bạn vừa được giao việc: ${task.title}`,
        isRead: false,
        createdAt: Date.now(),
        type: 'TASK_ASSIGNED',
        taskId: task.id
      });
    } else {
      const currentIndex = tasks.findIndex(t => t.id === task.id);
      if (currentIndex !== -1) {
        if (task.managerResponse && (!existingTask?.managerResponse || existingTask.managerResponse.respondedAt !== task.managerResponse.respondedAt)) {
           let msg = 'Chỉ huy đã phản hồi đề xuất của bạn.';
           if (task.managerResponse.type === 'AGREE') msg = 'Chỉ huy đã ĐỒNG Ý với đề xuất của bạn.';
           else if (task.managerResponse.type === 'REJECT') msg = 'Chỉ huy đã TỪ CHỐI đề xuất của bạn.';
           else msg = 'Chỉ huy có ý kiến chỉ đạo khác cho đề xuất.';

           await MockDB.createNotification({
              id: `n${Date.now()}_resp`,
              userId: task.assigneeId,
              title: 'Phản hồi đề xuất',
              message: `${msg} Công việc: ${task.title}`,
              isRead: false,
              createdAt: Date.now(),
              type: 'PROPOSAL_RESPONSE',
              taskId: task.id
           });
        }

        const oldProposal = existingTask?.proposal || '';
        const newProposal = task.proposal || '';
        const proposalChanged = newProposal !== oldProposal && newProposal.trim() !== '';

        if (task.assigneeId !== task.creatorId) {
             const statusChanged = existingTask?.status !== task.status;
             if (proposalChanged) {
                 await MockDB.createNotification({
                  id: `n${Date.now()}`,
                  userId: task.creatorId,
                  title: 'Có đề xuất mới',
                  message: `Cán bộ vừa gửi đề xuất/ý kiến cho: "${task.title}".`,
                  isRead: false,
                  createdAt: Date.now(),
                  type: 'TASK_UPDATED',
                  taskId: task.id
                });
             } else if (statusChanged) {
                await MockDB.createNotification({
                  id: `n${Date.now()}`,
                  userId: task.creatorId, 
                  title: 'Cập nhật tiến độ',
                  message: `Cán bộ đã cập nhật trạng thái cho: "${task.title}".`,
                  isRead: false,
                  createdAt: Date.now(),
                  type: 'TASK_UPDATED',
                  taskId: task.id
                });
             }
        }
        tasks[currentIndex] = task;
      }
    }
    
    if (firebaseDb) {
      await set(ref(firebaseDb, 'tasks'), tasks);
    } else {
      await delay(400);
      localStorage.setItem('tasks', JSON.stringify(tasks));
    }
    return task;
  },

  deleteTask: async (id: string): Promise<void> => {
    const tasks = await MockDB.getTasks();
    const newTasks = tasks.filter(t => t.id !== id);
    
    if (firebaseDb) {
      await set(ref(firebaseDb, 'tasks'), newTasks);
    } else {
      await delay(300);
      localStorage.setItem('tasks', JSON.stringify(newTasks));
    }
  },

  login: async (username: string, passwordAttempt: string): Promise<User | null> => {
    const users = await MockDB.getUsers();
    return users.find(u => u.username === username && u.password === passwordAttempt) || null;
  },

  getNotifications: async (userId: string): Promise<Notification[]> => {
    if (firebaseDb) {
       try {
          const snapshot = await get(child(ref(firebaseDb), 'notifications'));
          const allNotifs: Notification[] = snapshot.exists() ? snapshot.val() : [];
          return allNotifs.filter(n => n.userId === userId).sort((a, b) => b.createdAt - a.createdAt);
       } catch(e) { return []; }
    }

    await delay(200);
    const stored = localStorage.getItem('notifications');
    let notifs: Notification[] = stored ? JSON.parse(stored) : MOCK_NOTIFICATIONS;
    return notifs.filter(n => n.userId === userId).sort((a, b) => b.createdAt - a.createdAt);
  },

  markRead: async (notifId: string): Promise<void> => {
    // Note: This is a bit inefficient for Firebase (fetching all), but fine for mock
    if (firebaseDb) {
       const snapshot = await get(child(ref(firebaseDb), 'notifications'));
       let notifs: Notification[] = snapshot.exists() ? snapshot.val() : [];
       const index = notifs.findIndex(n => n.id === notifId);
       if (index !== -1) {
         notifs[index].isRead = true;
         await set(ref(firebaseDb, 'notifications'), notifs);
       }
       return;
    }

    const stored = localStorage.getItem('notifications');
    let notifs: Notification[] = stored ? JSON.parse(stored) : MOCK_NOTIFICATIONS;
    const index = notifs.findIndex(n => n.id === notifId);
    if (index !== -1) {
      notifs[index].isRead = true;
      localStorage.setItem('notifications', JSON.stringify(notifs));
    }
  },

  markAllRead: async (userId: string): Promise<void> => {
    if (firebaseDb) {
       const snapshot = await get(child(ref(firebaseDb), 'notifications'));
       let notifs: Notification[] = snapshot.exists() ? snapshot.val() : [];
       const updated = notifs.map(n => n.userId === userId ? { ...n, isRead: true } : n);
       await set(ref(firebaseDb, 'notifications'), updated);
       return;
    }

    const stored = localStorage.getItem('notifications');
    let notifs: Notification[] = stored ? JSON.parse(stored) : MOCK_NOTIFICATIONS;
    const updated = notifs.map(n => n.userId === userId ? { ...n, isRead: true } : n);
    localStorage.setItem('notifications', JSON.stringify(updated));
  },

  createNotification: async (notif: Notification): Promise<void> => {
     if (firebaseDb) {
        // Need to fetch current list to append. In real app, push() is better.
        const snapshot = await get(child(ref(firebaseDb), 'notifications'));
        let notifs: Notification[] = snapshot.exists() ? snapshot.val() : [];
        notifs.push(notif);
        await set(ref(firebaseDb, 'notifications'), notifs);
        return;
     }

     const stored = localStorage.getItem('notifications');
     let notifs: Notification[] = stored ? JSON.parse(stored) : MOCK_NOTIFICATIONS;
     notifs.push(notif);
     localStorage.setItem('notifications', JSON.stringify(notifs));
  }
};