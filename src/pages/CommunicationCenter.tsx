import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, Filter, Plus, Send, Paperclip, Mail, MailOpen, Star, 
  MessageSquare, AlertCircle, Download, User as UserIcon, Calendar, 
  ChevronRight, Tag, Volume2, X, RefreshCw, Briefcase, FileText, Check, CheckCheck
} from 'lucide-react';

interface MessageType {
  _id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  recipientId: string;
  recipientName: string;
  recipientRole: string;
  subject: string;
  content: string;
  attachmentPath?: string;
  attachmentName?: string;
  isRead: boolean;
  isImportant: boolean;
  type: 'direct' | 'announcement';
  internshipId?: string;
  parentMessageId?: string;
  createdAt: string;
  updatedAt: string;
  
  // Targeted fields
  targetedStudentName?: string;
  targetedRollNumber?: string;
  targetedSemester?: string;
  targetedBranch?: string;
  targetedFacultyName?: string;
  targetedDepartment?: string;
  principalMsgType?: 'approval_remark' | 'clarification_request' | 'official_notice' | 'none';
  status: 'sent' | 'delivered' | 'read';
}

interface RecipientType {
  _id: string;
  name: string;
  email: string;
  role: string;
  rollNumber?: string;
  branch?: string;
}

interface InternshipType {
  _id: string;
  studentDetails: { name: string };
  internshipDetails: { companyName: string };
  eligibilityStatus: string;
  finalStatus: string;
}

interface ThreadGroup {
  threadId: string;
  messages: MessageType[];
  rootMessage: MessageType;
  latestMessage: MessageType;
  isRead: boolean;
  isImportant: boolean;
}

export default function CommunicationCenter() {
  let user: any = null;
  try {
    const storedUser = localStorage.getItem('user');
    if (storedUser && storedUser !== 'undefined') {
      user = JSON.parse(storedUser);
    }
  } catch (e) {
    console.error('Failed to parse user in CommunicationCenter', e);
  }
  
  // UI Tabs & Filters State
  const [activeTab, setActiveTab] = useState<'inbox' | 'sent' | 'announcements'>('inbox');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterUnread, setFilterUnread] = useState(false);

  // Active Data State
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<MessageType | null>(null);
  const [selectedThread, setSelectedThread] = useState<MessageType[]>([]);
  const [recipients, setRecipients] = useState<RecipientType[]>([]);
  const [internships, setInternships] = useState<InternshipType[]>([]);
  
  // Modals & Forms State
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [recipientCategory, setRecipientCategory] = useState<'student' | 'cdc' | 'principal' | ''>('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  
  const [composeForm, setComposeForm] = useState({
    recipientId: '',
    subject: '',
    content: '',
    type: 'direct' as 'direct' | 'announcement',
    internshipId: '',
    attachment: null as File | null,
    
    // Targeted messaging
    targetedStudentName: '',
    targetedRollNumber: '',
    targetedSemester: '',
    targetedBranch: '',
    targetedFacultyName: '',
    targetedDepartment: '',
    principalMsgType: 'none'
  });

  const [replyContent, setReplyContent] = useState('');
  const [replyAttachment, setReplyAttachment] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const replyFileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch all inbox / sent / announcements
  const fetchMessages = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/messages/conversations', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const data: MessageType[] = response.data || [];
      setMessages(data);

      // Keep selected message reference updated if it exists
      if (selectedMessage) {
        const rootId = selectedMessage.parentMessageId || selectedMessage._id;
        const updatedSelected = data.find(m => m._id === selectedMessage._id) || data.find(m => m._id === rootId);
        if (updatedSelected) {
          const threadRes = await axios.get(`/api/messages/thread/${rootId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setSelectedThread(threadRes.data || []);
        }
      }
    } catch (err: any) {
      console.error('Error fetching messages:', err);
      setError('Could not retrieve messages. Please check connectivity.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch recipients list
  const fetchRecipients = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/messages/recipients', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRecipients(response.data || []);
    } catch (err) {
      console.error('Error fetching recipients:', err);
    }
  };

  // Fetch internships list
  const fetchInternships = async (studentId?: string) => {
    try {
      const token = localStorage.getItem('token');
      const url = studentId ? `/api/messages/internships?studentId=${studentId}` : '/api/messages/internships';
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setInternships(response.data || []);
    } catch (err) {
      console.error('Error fetching internships:', err);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [activeTab]);

  useEffect(() => {
    if (showComposeModal) {
      fetchRecipients();
      if (user?.role === 'student') {
        fetchInternships();
      }
    }
  }, [showComposeModal]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedThread]);

  // Load internships for selected student in compose dropdown
  const handleComposeRecipientChange = (recipientId: string) => {
    setComposeForm(prev => ({ 
      ...prev, 
      recipientId, 
      internshipId: '',
      targetedStudentName: '',
      targetedRollNumber: '',
      targetedSemester: '',
      targetedBranch: '',
      targetedFacultyName: '',
      targetedDepartment: '',
      principalMsgType: 'none'
    }));

    if (!recipientId) return;

    const rc = recipients.find(r => r._id === recipientId);
    if (!rc) return;

    if (rc.role === 'student') {
      setComposeForm(prev => ({
        ...prev,
        targetedStudentName: rc.name,
        targetedRollNumber: rc.rollNumber || '',
        targetedBranch: rc.branch || '',
        targetedSemester: '' // User will fill
      }));
      if (user?.role !== 'student') {
        fetchInternships(rc._id);
      }
    } else if (rc.role === 'cdc') {
      setComposeForm(prev => ({
        ...prev,
        targetedFacultyName: rc.name,
        targetedDepartment: '' // User will fill
      }));
      setInternships([]);
    } else if (rc.role === 'principal') {
      setComposeForm(prev => ({
        ...prev,
        principalMsgType: 'official_notice'
      }));
      setInternships([]);
    }
  };

  // Select message thread & mark all unread incoming messages in the thread as read
  const handleSelectThread = async (thread: ThreadGroup) => {
    try {
      const token = localStorage.getItem('token');
      
      const unreadIncomingMsgs = thread.messages.filter(
        m => !m.isRead && m.recipientId === user?.id
      );

      if (unreadIncomingMsgs.length > 0) {
        await Promise.all(
          unreadIncomingMsgs.map(m => 
            axios.patch(`/api/messages/read/${m._id}`, { isRead: true }, {
              headers: { Authorization: `Bearer ${token}` }
            })
          )
        );
        
        setMessages(prev => 
          prev.map(m => 
            unreadIncomingMsgs.some(um => um._id === m._id) 
              ? { ...m, isRead: true, status: 'read' } 
              : m
          )
        );
        
        window.dispatchEvent(new Event('pathnamechange'));
      }

      const threadRes = await axios.get(`/api/messages/thread/${thread.threadId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedThread(threadRes.data || thread.messages);
      setSelectedMessage(thread.latestMessage);
    } catch (err) {
      console.error('Error marking thread read or loading thread:', err);
      setSelectedThread(thread.messages);
      setSelectedMessage(thread.latestMessage);
    }
  };

  // Toggle important tag
  const handleToggleImportant = async (e: React.MouseEvent, msg: MessageType) => {
    e.stopPropagation();
    try {
      const token = localStorage.getItem('token');
      const response = await axios.patch(`/api/messages/important/${msg._id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data?.data) {
        const updated = response.data.data;
        setMessages(prev => prev.map(m => m._id === msg._id ? { ...m, isImportant: updated.isImportant } : m));
        if (selectedMessage?._id === msg._id) {
          setSelectedMessage(prev => prev ? { ...prev, isImportant: updated.isImportant } : null);
        }
      }
    } catch (err) {
      console.error('Error toggling important status:', err);
    }
  };

  // Send Direct Message/Announcement
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('subject', composeForm.subject);
      formData.append('content', composeForm.content);
      formData.append('type', composeForm.type);
      
      if (composeForm.type === 'direct') {
        formData.append('recipientId', composeForm.recipientId);
        
        // Append targeted messaging fields
        const rc = recipients.find(r => r._id === composeForm.recipientId);
        if (rc) {
          if (rc.role === 'student') {
            formData.append('targetedStudentName', composeForm.targetedStudentName);
            formData.append('targetedRollNumber', composeForm.targetedRollNumber);
            formData.append('targetedSemester', composeForm.targetedSemester);
            formData.append('targetedBranch', composeForm.targetedBranch);
          } else if (rc.role === 'cdc') {
            formData.append('targetedFacultyName', composeForm.targetedFacultyName);
            formData.append('targetedDepartment', composeForm.targetedDepartment);
          } else if (rc.role === 'principal') {
            formData.append('principalMsgType', composeForm.principalMsgType);
          }
        }
      }

      // If sender is Principal, or we are doing a broadcast, we can support message category too
      if (user?.role === 'principal') {
        formData.append('principalMsgType', composeForm.principalMsgType);
      }

      if (composeForm.internshipId) {
        formData.append('internshipId', composeForm.internshipId);
      }
      if (composeForm.attachment) {
        formData.append('attachment', composeForm.attachment);
      }

      await axios.post('/api/messages/send', formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      // Clear form
      setComposeForm({
        recipientId: '',
        subject: '',
        content: '',
        type: 'direct',
        internshipId: '',
        attachment: null,
        targetedStudentName: '',
        targetedRollNumber: '',
        targetedSemester: '',
        targetedBranch: '',
        targetedFacultyName: '',
        targetedDepartment: '',
        principalMsgType: 'none'
      });
      setRecipientCategory('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      
      setShowComposeModal(false);
      fetchMessages();
      alert('Message sent successfully!');
    } catch (err: any) {
      console.error('Error sending message:', err);
      setError(err.response?.data?.message || 'Error occurred while sending the message.');
    } finally {
      setSending(false);
    }
  };

  // Inline Quick Reply
  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMessage || !replyContent.trim()) return;

    setSending(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      
      const rootId = selectedMessage.parentMessageId || selectedMessage._id;
      const rootMsg = selectedThread.find(m => m._id === rootId) || selectedMessage;
      
      // Send reply to the other participant in the root conversation
      const recipientId = rootMsg.senderId === user?.id ? rootMsg.recipientId : rootMsg.senderId;
      formData.append('recipientId', recipientId);
      formData.append('subject', rootMsg.subject.startsWith('Re:') ? rootMsg.subject : `Re: ${rootMsg.subject}`);
      formData.append('content', replyContent);
      formData.append('type', 'direct');
      formData.append('parentMessageId', rootId);
      
      if (rootMsg.internshipId) {
        formData.append('internshipId', rootMsg.internshipId);
      }
      if (replyAttachment) {
        formData.append('attachment', replyAttachment);
      }

      await axios.post('/api/messages/send', formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setReplyContent('');
      setReplyAttachment(null);
      if (replyFileInputRef.current) replyFileInputRef.current.value = '';
      
      // Re-fetch thread
      const threadRes = await axios.get(`/api/messages/thread/${rootId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedThread(threadRes.data || []);
      
      fetchMessages();
      alert('Reply sent successfully!');
    } catch (err: any) {
      console.error('Error sending reply:', err);
      alert('Failed to send reply. Please try again.');
    } finally {
      setSending(false);
    }
  };
  // Grouping logic helper
  const getThreadGroups = (msgList: MessageType[]): ThreadGroup[] => {
    const groups: { [key: string]: MessageType[] } = {};
    
    // Group by threadId
    msgList.forEach(msg => {
      const threadId = msg.parentMessageId || msg._id;
      if (!groups[threadId]) {
        groups[threadId] = [];
      }
      groups[threadId].push(msg);
    });

    // For each thread group:
    const threadGroups: ThreadGroup[] = Object.keys(groups).map(threadId => {
      const msgs = groups[threadId];
      // Sort messages chronologically (ascending)
      msgs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      
      const rootMessage = msgs[0];
      const latestMessage = msgs[msgs.length - 1];
      
      // Determine if there is any unread message in the thread sent to the current user
      const isUnread = msgs.some(m => !m.isRead && m.recipientId === user?.id);
      const isImportant = msgs.some(m => m.isImportant);

      return {
        threadId,
        messages: msgs,
        rootMessage,
        latestMessage,
        isRead: !isUnread,
        isImportant
      };
    });

    // Sort thread groups by latestMessage.createdAt descending
    threadGroups.sort((a, b) => new Date(b.latestMessage.createdAt).getTime() - new Date(a.latestMessage.createdAt).getTime());

    return threadGroups;
  };

  // Grouped and filtered threads
  const allThreads = getThreadGroups(messages);
  const filteredThreads = allThreads.filter(thread => {
    // 1. Tab filter
    if (activeTab === 'announcements') {
      if (thread.latestMessage.type !== 'announcement') return false;
    } else if (activeTab === 'inbox') {
      if (thread.latestMessage.type !== 'direct') return false;
      // Must contain at least one message received by this user
      const hasReceived = thread.messages.some(m => m.recipientId === user?.id);
      if (!hasReceived) return false;
    } else if (activeTab === 'sent') {
      if (thread.latestMessage.type !== 'direct') return false;
      // Must contain at least one message sent by this user
      const hasSent = thread.messages.some(m => m.senderId === user?.id);
      if (!hasSent) return false;
    }

    // 2. Unread filter
    if (filterUnread) {
      if (thread.isRead) return false;
    }

    // 3. Dynamic search filter - matches any message in the thread
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const rollMatch = q.match(/^([0-9]{2}e51a[0-9a-z]{4})@hitam\.org$/);
      const rollNumberQuery = rollMatch ? rollMatch[1] : '';

      const matchesSearch = thread.messages.some(m => 
        (m.subject || '').toLowerCase().includes(q) ||
        (m.content || '').toLowerCase().includes(q) ||
        (m.senderName || '').toLowerCase().includes(q) ||
        (m.recipientName || '').toLowerCase().includes(q) ||
        (m.targetedStudentName || '').toLowerCase().includes(q) ||
        (m.targetedRollNumber || '').toLowerCase().includes(q) ||
        (rollNumberQuery && (m.targetedRollNumber || '').toLowerCase().includes(rollNumberQuery)) ||
        (m.targetedBranch || '').toLowerCase().includes(q) ||
        (m.targetedFacultyName || '').toLowerCase().includes(q) ||
        (m.targetedDepartment || '').toLowerCase().includes(q)
      );
      if (!matchesSearch) return false;
    }

    return true;
  });

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col gap-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <MessageSquare className="text-[#78be21]" size={24} />
            Communication Center
          </h2>
          <p className="text-slate-500 text-xs mt-0.5 font-medium uppercase tracking-wider">
            Internal Messages, Queries, and Approvals Channel
          </p>
        </div>
        
        <button
          onClick={() => setShowComposeModal(true)}
          className="px-5 py-2.5 bg-[#78be21] hover:bg-[#68a61d] text-white font-bold rounded-xl shadow-lg shadow-[#78be21]/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-sm shrink-0 cursor-pointer"
        >
          <Plus size={16} />
          Compose Message
        </button>
      </div>

      {/* Main Split-Pane Workspace */}
      <div className="flex-1 bg-white border border-slate-200 rounded-2xl overflow-hidden flex shadow-sm min-h-0">
        
        {/* LEFT WORKSPACE: Master List Panel */}
        <div className="w-full md:w-5/12 border-r border-slate-200 flex flex-col min-h-0 bg-slate-50/30">
          
          {/* Tabs bar */}
          <div className="flex border-b border-slate-200 bg-white">
            <button
              onClick={() => { setActiveTab('inbox'); setSelectedMessage(null); }}
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center justify-center gap-2 ${
                activeTab === 'inbox' 
                  ? 'border-[#78be21] text-[#78be21]' 
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <Mail size={14} />
              Inbox
            </button>
            <button
              onClick={() => { setActiveTab('sent'); setSelectedMessage(null); }}
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center justify-center gap-2 ${
                activeTab === 'sent' 
                  ? 'border-[#78be21] text-[#78be21]' 
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <Send size={14} />
              Sent
            </button>
            <button
              onClick={() => { setActiveTab('announcements'); setSelectedMessage(null); }}
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center justify-center gap-2 ${
                activeTab === 'announcements' 
                  ? 'border-[#78be21] text-[#78be21]' 
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <Volume2 size={14} />
              Announcements
            </button>
          </div>

          {/* Search and Filters */}
          <div className="p-4 bg-white border-b border-slate-100 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search subject, content, name, roll no..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#78be21]/20 focus:border-[#78be21] outline-none transition-all text-xs text-slate-800 font-semibold"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase mr-1 flex items-center gap-1">
                <Filter size={10} /> Filter:
              </span>
              <button
                onClick={() => setFilterUnread(prev => !prev)}
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all border ${
                  filterUnread 
                    ? 'bg-blue-50 text-blue-600 border-blue-200' 
                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                }`}
              >
                Unread
              </button>
              {filterUnread && (
                <button
                  onClick={() => {
                    setFilterUnread(false);
                  }}
                  className="text-[10px] font-bold text-red-500 hover:text-red-600 underline ml-auto cursor-pointer"
                >
                  Clear All
                </button>
              )}
            </div>
          </div>

          {/* Conversations Scroll List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 min-h-0">
            {loading ? (
              <div className="p-8 text-center text-slate-400 flex flex-col items-center gap-2">
                <RefreshCw className="animate-spin text-[#78be21]" size={20} />
                <span className="text-xs font-semibold">Loading conversations...</span>
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-1.5">
                <MailOpen className="mx-auto text-slate-300" size={28} />
                <h3 className="text-xs font-bold text-slate-700">No conversations available</h3>
                <p className="text-[10px] text-slate-400 font-semibold">
                  Start a new conversation using Compose Message
                </p>
              </div>
            ) : (
              filteredThreads.map((thread) => {
                const isSelected = selectedMessage && (selectedMessage.parentMessageId || selectedMessage._id) === thread.threadId;
                const isUnread = !thread.isRead;
                const msg = thread.latestMessage;
                
                return (
                  <div
                    key={thread.threadId}
                    onClick={() => handleSelectThread(thread)}
                    className={`p-4 transition-all cursor-pointer border-l-4 relative hover:bg-slate-50/50 ${
                      isSelected 
                        ? 'bg-slate-50 border-l-[#78be21]' 
                        : isUnread 
                          ? 'border-l-blue-500 bg-blue-50/10 font-bold' 
                          : 'border-l-transparent bg-transparent'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-xs truncate ${isUnread ? 'font-extrabold text-slate-900' : 'font-bold text-slate-800'}`}>
                            {msg.senderId === user?.id ? `To: ${msg.recipientName}` : msg.senderName}
                          </span>
                          <span className={`px-1.5 py-0.2 rounded text-[8px] font-bold uppercase tracking-wider ${
                            (msg.senderId === user?.id ? msg.recipientRole : msg.senderRole) === 'student' 
                              ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' 
                              : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                          }`}>
                            {msg.senderId === user?.id ? msg.recipientRole : msg.senderRole}
                          </span>
                          {msg.type === 'announcement' && (
                            <span className="bg-amber-50 text-amber-600 border border-amber-100 px-1.5 py-0.2 rounded text-[8px] font-bold uppercase tracking-wider flex items-center gap-0.5">
                              <Volume2 size={8} /> NOTICE
                            </span>
                          )}
                        </div>
                        <h4 className={`text-xs truncate ${isUnread ? 'font-extrabold text-slate-900' : 'font-semibold text-slate-700'}`}>
                          {msg.subject}
                        </h4>
                      </div>

                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className="text-[8px] text-slate-400 font-bold whitespace-nowrap">
                          {new Date(msg.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                        {isUnread && (
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-sm" />
                        )}
                        {thread.isImportant && !isUnread && (
                          <Star size={11} fill="currentColor" className="text-amber-400" />
                        )}
                      </div>
                    </div>

                    <p className="text-[10px] text-slate-500 line-clamp-2 mt-1 font-medium leading-relaxed">
                      {msg.content}
                    </p>
                    
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      {thread.messages.some(m => m.attachmentPath) && (
                        <span className="inline-flex items-center gap-0.5 text-[8px] text-slate-400 font-bold uppercase bg-slate-100 px-1.5 py-0.5 rounded-md">
                          <Paperclip size={8} /> Attachment
                        </span>
                      )}
                      {thread.messages.some(m => m.internshipId) && (
                        <span className="inline-flex items-center gap-0.5 text-[8px] text-[#78be21] font-bold uppercase bg-[#78be21]/10 px-1.5 py-0.5 rounded-md">
                          <Briefcase size={8} /> Linked App
                        </span>
                      )}
                      {thread.messages.length > 1 && (
                        <span className="inline-flex items-center gap-0.5 text-[8px] text-indigo-500 font-bold uppercase bg-indigo-50 px-1.5 py-0.5 rounded-md border border-indigo-100">
                          {thread.messages.length} messages
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT WORKSPACE: Detailed View Panel */}
        <div className="hidden md:flex flex-1 flex-col min-h-0 bg-white">
          {selectedMessage ? (
            <div className="flex-1 flex flex-col min-h-0">
              
              {/* Sticky Chat Header */}
              <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between shadow-sm shrink-0">
                <div className="space-y-0.5 min-w-0">
                  <h3 className="text-sm font-extrabold text-slate-800 truncate">
                    {selectedMessage.subject}
                  </h3>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    <span>Thread Participants:</span>
                    <span className="text-[#78be21]">{selectedMessage.senderName}</span>
                    <span className="text-slate-300">&amp;</span>
                    <span className="text-[#78be21]">{selectedMessage.recipientName}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => handleToggleImportant(e, selectedMessage)}
                    className={`p-2 border rounded-xl transition-all cursor-pointer ${
                      selectedMessage.isImportant 
                        ? 'bg-amber-50 border-amber-200 text-amber-500' 
                        : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600'
                    }`}
                    title="Important"
                  >
                    <Star size={14} fill={selectedMessage.isImportant ? 'currentColor' : 'none'} />
                  </button>
                </div>
              </div>

              {/* Message Details scroll area */}
              <div className="flex-1 overflow-y-auto p-6 bg-slate-50/20">
                
                {/* Conversation Thread Messages */}
                <div className="space-y-4">
                  {Array.isArray(selectedThread) && selectedThread.map((threadMsg) => {
                    const isSelf = threadMsg.senderId === user?.id;
                    return (
                      <div 
                        key={threadMsg._id} 
                        className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'} w-full`}
                      >
                        <div className={`p-4 rounded-2xl border shadow-sm max-w-[85%] md:max-w-[75%] transition-all ${
                          isSelf 
                            ? 'bg-[#78be21]/10 border-[#78be21]/30 rounded-tr-none' 
                            : 'bg-slate-50 border-slate-200 rounded-tl-none'
                        }`}>
                          {/* Header of message item */}
                          <div className="flex items-center justify-between gap-4 mb-2 pb-1.5 border-b border-slate-200/50">
                            <div className="flex items-center gap-2">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] uppercase font-mono ${
                                isSelf ? 'bg-[#78be21] text-white' : 'bg-slate-200 text-slate-600'
                              }`}>
                                {(threadMsg.senderName?.[0] || 'U').toUpperCase()}
                              </div>
                              <div>
                                <span className="font-extrabold text-[11px] text-slate-800">{threadMsg.senderName || 'Unknown User'}</span>
                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider ml-1">
                                  ({(threadMsg.senderRole || '').toUpperCase()})
                                </span>
                              </div>
                            </div>
                            
                            {/* Short Time display inside bubble */}
                            <span className="text-slate-400 text-[8px] font-bold">
                              {new Date(threadMsg.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          {/* Targeted dynamic fields display if present in this specific message */}
                          {(threadMsg.targetedStudentName || threadMsg.targetedFacultyName || (threadMsg.principalMsgType && threadMsg.principalMsgType !== 'none')) && (
                            <div className="mb-2.5 p-2.5 bg-white/80 border border-slate-200 rounded-xl grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px] font-semibold text-slate-600">
                              {threadMsg.targetedStudentName && (
                                <>
                                  <div className="col-span-2 border-b border-slate-100 pb-1 mb-1 font-bold text-slate-700 uppercase tracking-wider text-[9px]">Student Details</div>
                                  <div><span className="font-extrabold text-slate-400 uppercase text-[8px] block">Name</span> {threadMsg.targetedStudentName}</div>
                                  <div><span className="font-extrabold text-slate-400 uppercase text-[8px] block">Roll Number</span> {threadMsg.targetedRollNumber}</div>
                                  <div><span className="font-extrabold text-slate-400 uppercase text-[8px] block">Semester</span> {threadMsg.targetedSemester}</div>
                                  <div><span className="font-extrabold text-slate-400 uppercase text-[8px] block">Branch</span> {threadMsg.targetedBranch}</div>
                                </>
                              )}
                              {threadMsg.targetedFacultyName && (
                                <>
                                  <div className="col-span-2 border-b border-slate-100 pb-1 mb-1 font-bold text-slate-700 uppercase tracking-wider text-[9px]">Faculty Details</div>
                                  <div><span className="font-extrabold text-slate-400 uppercase text-[8px] block">Name</span> {threadMsg.targetedFacultyName}</div>
                                  <div><span className="font-extrabold text-slate-400 uppercase text-[8px] block">Department</span> {threadMsg.targetedDepartment}</div>
                                </>
                              )}
                              {threadMsg.principalMsgType && threadMsg.principalMsgType !== 'none' && typeof threadMsg.principalMsgType === 'string' && (
                                <div className="col-span-2">
                                  <span className="font-extrabold text-slate-400 uppercase text-[8px] block mb-0.5">Notice Category</span>
                                  <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-extrabold text-[9px] border border-purple-100 uppercase tracking-wider">
                                    {threadMsg.principalMsgType.replace('_', ' ')}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Content text */}
                          <div className="text-slate-700 text-xs font-semibold leading-relaxed whitespace-pre-wrap">
                            {threadMsg.content}
                          </div>

                          {/* Attachment section */}
                          {threadMsg.attachmentPath && (
                            <div className="mt-3 p-2.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-3 shadow-sm">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                                  <FileText size={14} />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-[10px] font-bold text-slate-800 truncate max-w-[150px] md:max-w-[200px]">
                                    {threadMsg.attachmentName || 'Attachment File'}
                                  </p>
                                  <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">
                                    Document File
                                  </p>
                                </div>
                              </div>
                              <a
                                href={`/${threadMsg.attachmentPath}`}
                                download
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2 py-1 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 text-slate-600 hover:text-[#78be21] transition-all flex items-center gap-0.5 text-[9px] font-bold shadow-sm cursor-pointer shrink-0"
                              >
                                <Download size={10} />
                                Download
                              </a>
                            </div>
                          )}

                          {/* Linked Internship Context Details */}
                          {threadMsg.internshipId && (
                            <div className="mt-3 p-2.5 border border-[#78be21]/20 bg-[#78be21]/5 rounded-xl space-y-1">
                              <div className="flex items-center gap-1">
                                <Briefcase size={10} className="text-[#78be21]" />
                                <span className="text-[9px] font-bold text-[#78be21] uppercase tracking-wider">
                                  Linked Internship
                                </span>
                              </div>
                              <div className="text-[9px] text-slate-500 font-bold">
                                Ref ID: <span className="font-mono">{threadMsg.internshipId}</span>
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {/* Under bubble: Date & Status */}
                        <div className="mt-1 flex items-center gap-1.5 text-[9px] text-slate-400 px-1 font-bold">
                          <span>
                            {new Date(threadMsg.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </span>
                          {isSelf && (
                            <>
                              <span className="text-slate-300">•</span>
                              {threadMsg.status === 'sent' && (
                                <span className="flex items-center gap-0.5"><Check size={10} className="text-slate-400" /> Sent</span>
                              )}
                              {threadMsg.status === 'delivered' && (
                                <span className="flex items-center gap-0.5"><CheckCheck size={10} className="text-slate-400" /> Delivered</span>
                              )}
                              {threadMsg.status === 'read' && (
                                <span className="flex items-center gap-0.5 text-[#78be21]"><CheckCheck size={10} className="text-[#78be21]" /> Read</span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

              </div>

              {/* Quick Reply Form */}
              {selectedMessage.type === 'direct' && (
                <form onSubmit={handleSendReply} className="p-4 border-t border-slate-200 bg-slate-50/50 space-y-3">
                  <div className="relative">
                    <textarea
                      rows={2}
                      required
                      placeholder={`Reply to this conversation...`}
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      className="w-full p-3.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#78be21]/20 focus:border-[#78be21] outline-none transition-all text-xs text-slate-800 font-semibold"
                    />
                  </div>
                  
                  <div className="flex items-center justify-between gap-4">
                    {/* Attachment selection */}
                    <div className="relative">
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                        ref={replyFileInputRef}
                        onChange={(e) => setReplyAttachment(e.target.files?.[0] || null)}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => replyFileInputRef.current?.click()}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-800 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                      >
                        <Paperclip size={12} />
                        {replyAttachment ? replyAttachment.name : 'Add Attachment'}
                      </button>
                      {replyAttachment && (
                        <button
                          type="button"
                          onClick={() => {
                            setReplyAttachment(null);
                            if (replyFileInputRef.current) replyFileInputRef.current.value = '';
                          }}
                          className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 shadow-sm"
                        >
                          <X size={8} />
                        </button>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={sending || !replyContent.trim()}
                      className="px-4 py-2 bg-[#78be21] hover:bg-[#68a61d] disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none text-white font-bold rounded-lg transition-all text-xs flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                    >
                      <Send size={12} />
                      {sending ? 'Sending...' : 'Send Reply'}
                    </button>
                  </div>
                </form>
              )}

            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 gap-1.5">
              <Mail className="text-slate-200" size={48} />
              <h3 className="font-bold text-slate-700 text-sm">No conversations available</h3>
              <p className="text-slate-400 text-xs max-w-xs leading-relaxed font-semibold">
                Start a new conversation using Compose Message
              </p>
            </div>
          )}
        </div>
      </div>

      {/* COMPOSE NEW MESSAGE MODAL */}
      <AnimatePresence>
        {showComposeModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col"
            >
              {/* Header */}
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Compose New Message</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Communication Panel</p>
                </div>
                <button
                  onClick={() => setShowComposeModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleSendMessage} className="p-6 space-y-4">
                {error && (
                  <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex gap-2 text-red-600 text-xs font-semibold">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <p>{error}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Message Type Selection (Announcements restricted to Principal) */}
                  {user?.role === 'principal' ? (
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">Message Type</label>
                      <select
                        value={composeForm.type}
                        onChange={(e) => setComposeForm(prev => ({ 
                          ...prev, 
                          type: e.target.value as 'direct' | 'announcement',
                          recipientId: e.target.value === 'announcement' ? '' : prev.recipientId
                        }))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none text-xs text-slate-800 font-bold focus:border-[#78be21]"
                      >
                        <option value="direct">Direct Message</option>
                        <option value="announcement">Broadcast Announcement</option>
                      </select>
                    </div>
                  ) : null}

                  {/* Recipient Selector (Hide for Announcements) */}
                  {composeForm.type === 'direct' && (
                    <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">Recipient Category</label>
                        <select
                          required
                          value={recipientCategory}
                          onChange={(e) => {
                            setRecipientCategory(e.target.value as any);
                            setComposeForm(prev => ({ ...prev, recipientId: '' }));
                          }}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none text-xs text-slate-800 font-bold focus:border-[#78be21]"
                        >
                          <option value="">Choose Category...</option>
                          {user?.role !== 'student' && <option value="student">Student</option>}
                          <option value="cdc">CDC Faculty</option>
                          <option value="principal">Principal</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">Select Recipient</label>
                        <select
                          required
                          disabled={!recipientCategory}
                          value={composeForm.recipientId}
                          onChange={(e) => handleComposeRecipientChange(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none text-xs text-slate-800 font-semibold focus:border-[#78be21] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="">Choose User...</option>
                          {recipients
                            .filter((rc) => rc.role === recipientCategory)
                            .map((rc) => (
                              <option key={rc._id} value={rc._id}>
                                {rc.name} {rc.rollNumber ? `- ${rc.rollNumber}` : ''}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Dynamic Targeted Fields */}
                  {composeForm.type === 'direct' && composeForm.recipientId && (
                    <div className="sm:col-span-2 border-t border-slate-100 pt-3 mt-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {recipientCategory === 'student' && (
                        <>
                          <div>
                            <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">Student Name</label>
                            <input
                              type="text"
                              required
                              placeholder="Student Full Name"
                              value={composeForm.targetedStudentName}
                              onChange={(e) => setComposeForm(prev => ({ ...prev, targetedStudentName: e.target.value }))}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none text-xs text-slate-800 font-semibold focus:border-[#78be21]"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">Roll Number</label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. rollnumber"
                              value={composeForm.targetedRollNumber}
                              onChange={(e) => setComposeForm(prev => ({ ...prev, targetedRollNumber: e.target.value }))}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none text-xs text-slate-800 font-semibold focus:border-[#78be21]"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">Semester</label>
                            <select
                              required
                              value={composeForm.targetedSemester}
                              onChange={(e) => setComposeForm(prev => ({ ...prev, targetedSemester: e.target.value }))}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none text-xs text-slate-800 font-semibold focus:border-[#78be21]"
                            >
                              <option value="">Select Semester...</option>
                              <option value="Semester 1">Semester 1</option>
                              <option value="Semester 2">Semester 2</option>
                              <option value="Semester 3">Semester 3</option>
                              <option value="Semester 4">Semester 4</option>
                              <option value="Semester 5">Semester 5</option>
                              <option value="Semester 6">Semester 6</option>
                              <option value="Semester 7">Semester 7</option>
                              <option value="Semester 8">Semester 8</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">Branch</label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. CSE"
                              value={composeForm.targetedBranch}
                              onChange={(e) => setComposeForm(prev => ({ ...prev, targetedBranch: e.target.value }))}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none text-xs text-slate-800 font-semibold focus:border-[#78be21]"
                            />
                          </div>
                        </>
                      )}
                      {recipientCategory === 'cdc' && (
                        <>
                          <div>
                            <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">Faculty Name</label>
                            <input
                              type="text"
                              required
                              placeholder="Faculty Name"
                              value={composeForm.targetedFacultyName}
                              onChange={(e) => setComposeForm(prev => ({ ...prev, targetedFacultyName: e.target.value }))}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none text-xs text-slate-800 font-semibold focus:border-[#78be21]"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">Department</label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. Careers & Placements / CSE"
                              value={composeForm.targetedDepartment}
                              onChange={(e) => setComposeForm(prev => ({ ...prev, targetedDepartment: e.target.value }))}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none text-xs text-slate-800 font-semibold focus:border-[#78be21]"
                            />
                          </div>
                        </>
                      )}
                      {recipientCategory === 'principal' && (
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">Principal Notice Category</label>
                          <select
                            required
                            value={composeForm.principalMsgType}
                            onChange={(e) => setComposeForm(prev => ({ ...prev, principalMsgType: e.target.value }))}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none text-xs text-slate-800 font-bold focus:border-[#78be21]"
                          >
                            <option value="approval_remark">Approval Remark</option>
                            <option value="clarification_request">Clarification Request</option>
                            <option value="official_notice">Official Notice</option>
                          </select>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Broadcast Category (Principal Announcements only) */}
                  {composeForm.type === 'announcement' && user?.role === 'principal' && (
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">Broadcast Category</label>
                      <select
                        required
                        value={composeForm.principalMsgType}
                        onChange={(e) => setComposeForm(prev => ({ ...prev, principalMsgType: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none text-xs text-slate-800 font-bold focus:border-[#78be21]"
                      >
                        <option value="official_notice">Official Notice</option>
                        <option value="approval_remark">Approval Remark</option>
                        <option value="clarification_request">Clarification Request</option>
                      </select>
                    </div>
                  )}

                  {/* Internship Linkage Dropdown */}
                  {composeForm.type === 'direct' && (user?.role === 'student' || internships.length > 0) && (
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">Link Internship Application (Optional)</label>
                      <select
                        value={composeForm.internshipId}
                        onChange={(e) => setComposeForm(prev => ({ ...prev, internshipId: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none text-xs text-slate-800 font-semibold focus:border-[#78be21]"
                      >
                        <option value="">No Linked Application</option>
                        {internships.map((app) => (
                          <option key={app._id} value={app._id}>
                            {app.internshipDetails.companyName} ({app.eligibilityStatus} - {app.finalStatus})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Subject */}
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">Subject</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Clarification regarding Missing SPF Certificate"
                      value={composeForm.subject}
                      onChange={(e) => setComposeForm(prev => ({ ...prev, subject: e.target.value }))}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-xs text-slate-800 font-semibold focus:border-[#78be21]"
                    />
                  </div>

                  {/* Content Box */}
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">Message Body</label>
                    <textarea
                      rows={5}
                      required
                      placeholder="Write your query, instruction, or notice here..."
                      value={composeForm.content}
                      onChange={(e) => setComposeForm(prev => ({ ...prev, content: e.target.value }))}
                      className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-xs text-slate-800 font-semibold focus:border-[#78be21]"
                    />
                  </div>

                  {/* Attachment upload */}
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">Attachment (Optional - PDF/JPG/PNG/DOCX)</label>
                    <div className="relative group">
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                        ref={fileInputRef}
                        onChange={(e) => setComposeForm(prev => ({ ...prev, attachment: e.target.files?.[0] || null }))}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <div className="border border-dashed border-slate-200 rounded-xl p-3 flex items-center justify-center gap-2 bg-slate-50/50 group-hover:border-[#78be21] group-hover:bg-[#78be21]/5 transition-all text-xs font-bold text-slate-500">
                        <Paperclip size={16} className="text-slate-400 group-hover:text-[#78be21]" />
                        <span>
                          {composeForm.attachment ? composeForm.attachment.name : 'Click to select attachment file'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 bg-white">
                  <button
                    type="button"
                    onClick={() => setShowComposeModal(false)}
                    className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-bold rounded-xl transition-all text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={sending}
                    className="px-6 py-2 bg-[#78be21] hover:bg-[#68a61d] disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none text-white font-bold rounded-xl shadow-md shadow-[#78be21]/10 transition-all text-xs flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <Send size={12} />
                    {sending ? 'Sending...' : 'Send Message'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
