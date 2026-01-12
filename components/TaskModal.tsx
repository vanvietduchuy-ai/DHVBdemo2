import React, { useState, useEffect, useRef } from 'react';
import { Task, TaskPriority, TaskStatus, User, UserRole, RecurringType, ManagerResponse } from '../types';
import { Button, Input, Select } from './UI';
import { GeminiService } from '../services/geminiService';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Task) => void;
  initialTask?: Task | null;
  users: User[];
  currentUser: User;
}

export const TaskModal: React.FC<TaskModalProps> = ({ 
  isOpen, onClose, onSave, initialTask, users, currentUser 
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [proposal, setProposal] = useState(''); // New State for Proposal
  const [dispatchNumber, setDispatchNumber] = useState('');
  const [issuingAuthority, setIssuingAuthority] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [priority, setPriority] = useState<TaskPriority>(TaskPriority.MEDIUM);
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<TaskStatus>(TaskStatus.PENDING);
  const [recurring, setRecurring] = useState<RecurringType>(RecurringType.NONE);
  
  const [isImageScanning, setIsImageScanning] = useState(false);
  const [aiSuggestedSteps, setAiSuggestedSteps] = useState<string[]>([]);
  
  // Manager Response State
  const [managerResponseType, setManagerResponseType] = useState<'AGREE' | 'REJECT' | 'OTHER' | null>(null);
  const [managerResponseContent, setManagerResponseContent] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialTask) {
      setTitle(initialTask.title);
      setDescription(initialTask.description);
      setProposal(initialTask.proposal || ''); // Load proposal
      setDispatchNumber(initialTask.dispatchNumber || '');
      setIssuingAuthority(initialTask.issuingAuthority || '');
      setIssueDate(initialTask.issueDate || '');
      setAssigneeId(initialTask.assigneeId);
      setPriority(initialTask.priority);
      setDueDate(initialTask.dueDate.split('T')[0]);
      setStatus(initialTask.status);
      setRecurring(initialTask.recurring || RecurringType.NONE);
      setAiSuggestedSteps(initialTask.aiSuggestedSteps || []);
      
      if (initialTask.managerResponse) {
        setManagerResponseType(initialTask.managerResponse.type);
        setManagerResponseContent(initialTask.managerResponse.content || '');
      } else {
        setManagerResponseType(null);
        setManagerResponseContent('');
      }

    } else {
      resetForm();
    }
  }, [initialTask, isOpen]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setProposal('');
    setDispatchNumber('');
    setIssuingAuthority('');
    setIssueDate('');
    const defaultAssignee = users.find(u => u.role === UserRole.OFFICER)?.id || users[0]?.id;
    setAssigneeId(defaultAssignee);
    setPriority(TaskPriority.MEDIUM);
    setDueDate(new Date().toISOString().split('T')[0]);
    setStatus(TaskStatus.PENDING);
    setRecurring(RecurringType.NONE);
    setAiSuggestedSteps([]);
    setManagerResponseType(null);
    setManagerResponseContent('');
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImageScanning(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        const result = await GeminiService.extractDocumentDetails(base64String, file.type);
        
        if (result.abstract) setTitle(result.abstract);
        if (result.dispatchNumber) setDispatchNumber(result.dispatchNumber);
        if (result.issuingAuthority) setIssuingAuthority(result.issuingAuthority);
        if (result.issueDate) setIssueDate(result.issueDate);
        if (result.summary) setDescription(result.summary);
        if (result.deadline) setDueDate(result.deadline);

        setIsImageScanning(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setIsImageScanning(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    let managerResponse: ManagerResponse | undefined = undefined;
    if (managerResponseType) {
       managerResponse = {
         type: managerResponseType,
         content: managerResponseContent,
         respondedAt: Date.now()
       };
    }

    const task: Task = {
      id: initialTask ? initialTask.id : Date.now().toString(),
      title,
      description,
      proposal, // Save proposal
      dispatchNumber,
      issuingAuthority,
      issueDate,
      assigneeId,
      creatorId: initialTask ? initialTask.creatorId : currentUser.id,
      status,
      priority,
      recurring,
      dueDate: new Date(dueDate).toISOString(),
      createdAt: initialTask ? initialTask.createdAt : Date.now(),
      aiSuggestedSteps,
      managerResponse,
      // If saving as Manager and proposal exists, mark as read
      isProposalRead: (currentUser.role === UserRole.MANAGER && proposal) ? true : initialTask?.isProposalRead
    };
    onSave(task);
  };

  if (!isOpen) return null;

  const isManager = currentUser.role === UserRole.MANAGER;
  const isAssignee = initialTask?.assigneeId === currentUser.id;
  
  // Logic permissions
  // Title: Only Manager can edit (or creator)
  // Description: Only Manager can edit
  // Proposal: Assignee can edit (and Manager can too)
  
  const sortedUsers = [...users].sort((a, b) => {
    if (a.role === b.role) return a.fullName.localeCompare(b.fullName);
    return a.role === UserRole.MANAGER ? -1 : 1;
  });

  const assigneeOptions = sortedUsers.map(u => ({
    value: u.id,
    label: `${u.role === UserRole.MANAGER ? '⭐ Lãnh đạo:' : '👤 Cán bộ:'} ${u.fullName}`
  }));

  // Logic to show/hide proposal section
  // 1. Hide on New Task creation (initialTask is null).
  // 2. Show for Assignee on existing tasks (to write proposal).
  // 3. Show for Manager ONLY if a proposal actually exists.
  const showProposalSection = (isAssignee && !!initialTask) || (proposal && proposal.trim() !== '');

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-stone-900/60 backdrop-blur-sm transition-all p-0 md:p-4">
      <div className="bg-white w-full h-full md:h-auto md:max-h-[90vh] md:rounded-3xl rounded-none shadow-2xl overflow-hidden flex flex-col animate-fade-in-up border-t-4 border-red-700">
        
        {/* Header with Red/Gold depth */}
        <div className="px-6 py-4 md:px-8 md:py-6 border-b border-red-50 flex justify-between items-center bg-red-50/50 backdrop-blur-xl sticky top-0 z-10 shadow-sm">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-red-900 tracking-tight">
              {initialTask ? (isManager ? 'Cập nhật' : 'Chi tiết nhiệm vụ') : 'Giao việc mới'}
            </h2>
            <p className="text-xs md:text-sm text-red-700/70 mt-0.5 font-medium">
              {initialTask ? `Số hiệu: ${dispatchNumber || 'Chưa có'}` : 'Khởi tạo nhiệm vụ'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 bg-white rounded-full text-red-800 hover:bg-red-100 transition-colors active:scale-90 shadow-sm border border-red-100">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 md:p-8 overflow-y-auto flex-1 space-y-6 md:space-y-8 bg-orange-50/30">
          
          {/* Main Input Area */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-orange-100">
             <div className="flex justify-between items-center mb-3">
                <label className="text-sm font-bold text-red-900">Tiêu đề / Trích yếu <span className="text-red-600">*</span></label>
                {isManager && (
                 <>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                  <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isImageScanning}
                    className="text-[10px] md:text-xs flex items-center gap-1.5 text-amber-700 bg-amber-50 hover:bg-amber-100 font-bold px-3 py-1.5 rounded-lg transition-colors shadow-sm border border-amber-200"
                  >
                    {isImageScanning ? 'Đang quét...' : '📷 Quét ảnh'}
                  </button>
                 </>
               )}
             </div>
             <textarea
                className="w-full px-4 py-3 border border-stone-200 rounded-xl bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 resize-none h-20 text-stone-900 font-medium placeholder-stone-400 text-sm md:text-base transition-all"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Nhập nội dung công việc..."
                required
                disabled={!isManager} // STRICTLY Manager only
             />
          </div>

          {/* Metadata Grid */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-orange-100">
            <h3 className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-3">Thông tin văn bản</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input label="Số hiệu" placeholder="123/UBND..." value={dispatchNumber} onChange={(e) => setDispatchNumber(e.target.value)} disabled={!isManager} />
              <Input label="Cơ quan ban hành" placeholder="UBND..." value={issuingAuthority} onChange={(e) => setIssuingAuthority(e.target.value)} disabled={!isManager} />
              <Input type="date" label="Ngày ban hành" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} disabled={!isManager} />
            </div>
          </div>

          {/* Assignments */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Người thực hiện"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              disabled={!isManager}
              options={assigneeOptions}
            />
            
            <Select
              label="Loại công việc"
              value={recurring}
              onChange={(e) => setRecurring(e.target.value as RecurringType)}
              disabled={!isManager}
              options={[
                { value: RecurringType.NONE, label: 'Công việc một lần' },
                { value: RecurringType.WEEKLY, label: 'Định kỳ: Hàng Tuần' },
                { value: RecurringType.MONTHLY, label: 'Định kỳ: Hàng Tháng' },
                { value: RecurringType.QUARTERLY, label: 'Định kỳ: Hàng Quý' },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select
              label="Độ khẩn"
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              disabled={!isManager}
              options={[
                { value: TaskPriority.LOW, label: 'Thường' },
                { value: TaskPriority.MEDIUM, label: 'Trung bình' },
                { value: TaskPriority.HIGH, label: 'Cao' },
                { value: TaskPriority.URGENT, label: 'Hỏa tốc' },
              ]}
            />
            <Input 
              type="date" 
              label="Hạn hoàn thành" 
              value={dueDate} 
              onChange={(e) => setDueDate(e.target.value)}
              disabled={!isManager}
              required
              className="font-bold text-red-700 bg-red-50 border-red-100"
            />
            <Select
              label="Trạng thái"
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
              options={[
                { value: TaskStatus.PENDING, label: 'Chờ xử lý' },
                { value: TaskStatus.IN_PROGRESS, label: 'Đang thực hiện' },
                { value: TaskStatus.COMPLETED, label: 'Hoàn thành' },
                { value: TaskStatus.OVERDUE, label: 'ĐÃ QUÁ HẠN' },
                { value: TaskStatus.CANCELLED, label: 'Trả lại/Hủy' },
              ]}
            />
          </div>

          {/* Command / Instruction - MANAGER ONLY */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-orange-100">
            <div className="flex gap-2 items-center mb-2">
               <label className="text-sm font-bold text-red-900">Nội dung chỉ đạo (Chỉ huy)</label>
               {!isManager && <span className="text-[10px] bg-stone-100 text-stone-500 px-2 py-0.5 rounded border border-stone-200">Chỉ đọc</span>}
            </div>
            <textarea
              className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 h-24 resize-none text-sm leading-relaxed bg-stone-50"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!isManager} // STRICTLY Manager only
              placeholder={isManager ? "Nhập nội dung chỉ đạo chi tiết..." : "Chưa có nội dung chỉ đạo."}
            />
          </div>

          {/* Proposal - OFFICER (Assignee) & MANAGER 
              Logic: Show if it's the assignee viewing an existing task, OR if there is already content.
          */}
          {showProposalSection && (
            <div className="space-y-4">
              {/* Officer Proposal Input */}
              <div className="bg-blue-50/50 p-4 rounded-2xl shadow-sm border border-blue-100">
                <div className="flex gap-2 items-center mb-2">
                  <label className="text-sm font-bold text-blue-900">Ý kiến / Đề xuất của Cán bộ</label>
                  {isAssignee && <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded border border-blue-200 animate-pulse">Bạn có thể nhập tại đây</span>}
                </div>
                <textarea
                  className="w-full px-4 py-3 border border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 h-24 resize-none text-sm leading-relaxed bg-white"
                  value={proposal}
                  onChange={(e) => setProposal(e.target.value)}
                  disabled={!isAssignee && !isManager} 
                  placeholder={isAssignee ? "Nhập đề xuất, báo cáo khó khăn vướng mắc hoặc cập nhật tiến độ..." : "Chưa có đề xuất từ cán bộ."}
                />
              </div>

              {/* Manager Response Section */}
              {proposal && (
                <div className={`p-4 rounded-2xl shadow-sm border transition-all ${managerResponseType ? 'bg-white border-green-200' : 'bg-stone-50 border-stone-100'}`}>
                   <label className="text-sm font-bold text-red-900 mb-3 block">Phản hồi của Chỉ huy</label>
                   
                   {isManager ? (
                     <div className="space-y-3">
                        <div className="flex gap-2">
                           <button 
                             type="button"
                             onClick={() => setManagerResponseType('AGREE')}
                             className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold border transition-colors ${managerResponseType === 'AGREE' ? 'bg-green-600 text-white border-green-700' : 'bg-white text-green-700 border-green-200 hover:bg-green-50'}`}
                           >
                             Đồng ý
                           </button>
                           <button 
                             type="button"
                             onClick={() => setManagerResponseType('REJECT')}
                             className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold border transition-colors ${managerResponseType === 'REJECT' ? 'bg-red-600 text-white border-red-700' : 'bg-white text-red-700 border-red-200 hover:bg-red-50'}`}
                           >
                             Từ chối
                           </button>
                           <button 
                             type="button"
                             onClick={() => setManagerResponseType('OTHER')}
                             className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold border transition-colors ${managerResponseType === 'OTHER' ? 'bg-stone-600 text-white border-stone-700' : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'}`}
                           >
                             Chỉ đạo khác
                           </button>
                        </div>
                        <textarea
                          className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/30 h-20 resize-none text-sm bg-white"
                          value={managerResponseContent}
                          onChange={(e) => setManagerResponseContent(e.target.value)}
                          placeholder="Nhập nội dung chỉ đạo thêm..."
                        />
                     </div>
                   ) : (
                     /* Officer View of Response */
                     managerResponseType ? (
                       <div className="flex items-start gap-3">
                          <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${managerResponseType === 'AGREE' ? 'bg-green-500' : (managerResponseType === 'REJECT' ? 'bg-red-500' : 'bg-stone-500')}`}></div>
                          <div>
                             <p className={`text-sm font-bold ${managerResponseType === 'AGREE' ? 'text-green-700' : (managerResponseType === 'REJECT' ? 'text-red-700' : 'text-stone-700')}`}>
                               {managerResponseType === 'AGREE' ? 'ĐỒNG Ý' : (managerResponseType === 'REJECT' ? 'TỪ CHỐI' : 'CHỈ ĐẠO KHÁC')}
                             </p>
                             {managerResponseContent && <p className="text-sm text-stone-600 mt-1">{managerResponseContent}</p>}
                          </div>
                       </div>
                     ) : (
                       <p className="text-sm text-stone-400 italic">Chưa có phản hồi.</p>
                     )
                   )}
                </div>
              )}
            </div>
          )}

          {aiSuggestedSteps.length > 0 && (
            <div className="bg-yellow-50 p-5 rounded-2xl border border-yellow-100 shadow-sm">
              <h4 className="text-sm font-bold text-yellow-800 mb-2 flex items-center">
                <span className="mr-2">💡</span> Gợi ý các bước xử lý
              </h4>
              <ul className="space-y-2">
                {aiSuggestedSteps.map((step, idx) => (
                  <li key={idx} className="text-sm text-yellow-900 flex items-start bg-white/60 p-2 rounded-lg">
                    <span className="inline-block w-5 h-5 bg-yellow-300 rounded-full text-[10px] flex items-center justify-center mr-2 mt-0.5 text-yellow-900 font-bold shrink-0">{idx + 1}</span>
                    {step}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="px-6 py-4 md:px-8 md:py-5 bg-white border-t border-red-50 flex justify-end gap-3 safe-area-bottom shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] z-20">
          <Button variant="secondary" onClick={onClose} className="flex-1 md:flex-none">Đóng</Button>
          {(isManager || isAssignee) && (
            <Button onClick={handleSubmit} className="flex-1 md:flex-none">
              {isManager ? (initialTask ? 'Lưu & Phản hồi' : 'Giao việc') : 'Gửi đề xuất / Cập nhật'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};