export enum UserRole {
  MANAGER = 'MANAGER',
  OFFICER = 'OFFICER'
}

export enum TaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  OVERDUE = 'OVERDUE' // New status
}

export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT'
}

export enum RecurringType {
  NONE = 'NONE',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY'
}

export interface User {
  id: string;
  username: string;
  password?: string;
  isFirstLogin?: boolean;
  fullName: string;
  role: UserRole;
  avatarUrl?: string;
}

export interface ManagerResponse {
  type: 'AGREE' | 'REJECT' | 'OTHER';
  content?: string;
  respondedAt: number;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  
  proposal?: string;
  isProposalRead?: boolean; // Check if manager viewed the proposal
  managerResponse?: ManagerResponse; // Manager's reply to proposal

  dispatchNumber?: string;
  issuingAuthority?: string;
  issueDate?: string;
  
  recurring?: RecurringType;

  assigneeId: string;
  creatorId: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  createdAt: number;
  aiSuggestedSteps?: string[];
}

export interface DashboardStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  overdue: number;
  dueSoon: number;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: number;
  type: 'TASK_ASSIGNED' | 'TASK_UPDATED' | 'DEADLINE_WARNING' | 'SYSTEM' | 'PROPOSAL_RESPONSE';
  taskId?: string;
}