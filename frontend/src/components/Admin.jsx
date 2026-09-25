import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Settings, Users, Save, Loader2, Server, Trash2, LogOut, ShieldCheck, Plus, Clock, ShieldAlert, UserPlus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { googleLogout } from '@react-oauth/google';

export default function Admin({ user, setAuthStatus }) {
  const token = localStorage.getItem('adminToken');
  
  const [activeTab, setActiveTab] = useState('config');
  const [students, setStudents] = useState([]);
  const [configs, setConfigs] = useState([]);
  const [staffUsers, setStaffUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffRole, setNewStaffRole] = useState('staff');
  const [newStaffCampus, setNewStaffCampus] = useState('');
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  const [editStaffModal, setEditStaffModal] = useState({ isOpen: false, staffId: null, name: '', email: '', role: 'staff', campus: '' });
  const [editConfigModal, setEditConfigModal] = useState({ isOpen: false, campusName: '', slots: [], classesInput: '', isSaving: false });

  // Form state for new config
  const [campusName, setCampusName] = useState('');
  const [classesInput, setClassesInput] = useState('');
  const [slots, setSlots] = useState([{ slotNumber: 1, name: 'Morning', startTime: '09:00', endTime: '10:00' }]);
  const [isSaving, setIsSaving] = useState(false);

  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  const fetchData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [studentsRes, configsRes, usersRes] = await Promise.all([
        axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5555'}/api/students?includeEmbeddings=false`, authHeaders),
        axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5555'}/api/config`, authHeaders),
        axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5555'}/api/users`, authHeaders)
      ]);
      setStudents(studentsRes.data);
      setConfigs(configsRes.data);
      setStaffUsers(usersRes.data);
    } catch (err) {
      console.error("Failed to fetch admin data:", err);
      toast.error("Failed to load admin data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleLogout = () => {
    googleLogout();
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    setAuthStatus({ token: null, user: null });
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!newStaffEmail) return toast.error("Email is required");
    
    try {
      await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5555'}/api/users`, {
        name: newStaffName,
        email: newStaffEmail,
        role: newStaffRole,
        campus: newStaffCampus || null
      }, authHeaders);
      toast.success("User added successfully");
      setNewStaffName('');
      setNewStaffEmail('');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to save user");
    }
  };

  const handleUpdateStaff = async (e) => {
    e.preventDefault();
    try {
      await axios.patch(`${import.meta.env.VITE_API_URL || 'http://localhost:5555'}/api/users/${editStaffModal.staffId}`, {
        name: editStaffModal.name,
        email: editStaffModal.email,
        role: editStaffModal.role,
        campus: editStaffModal.campus || null
      }, authHeaders);
      toast.success("User updated successfully");
      setEditStaffModal({ ...editStaffModal, isOpen: false });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to update user");
    }
  };

  const handleEditStaff = (staff) => {
    setEditStaffModal({
      isOpen: true,
      staffId: staff._id,
      name: staff.name || '',
      email: staff.email,
      role: staff.role,
      campus: staff.campus || ''
    });
  };

  const handleDeleteStudent = (id, name) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Student',
      message: `Are you sure you want to completely delete ${name} and their attendance history? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          await axios.delete(`${import.meta.env.VITE_API_URL || 'http://localhost:5555'}/api/students/${id}`, authHeaders);
          toast.success("Student deleted");
          fetchData();
        } catch (err) {
          toast.error("Failed to delete student");
        }
        setConfirmModal({ ...confirmModal, isOpen: false });
      }
    });
  };

  const handleDeleteStaff = (id, email) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Staff User',
      message: `Are you sure you want to permanently delete the account for ${email}?`,
      onConfirm: async () => {
        try {
          await axios.delete(`${import.meta.env.VITE_API_URL || 'http://localhost:5555'}/api/users/${id}`, authHeaders);
          toast.success("User deleted successfully");
          fetchData();
        } catch (err) {
          toast.error("Failed to delete user");
        }
        setConfirmModal({ ...confirmModal, isOpen: false });
      }
    });
  };

  const handleEditConfig = (config) => {
    setEditConfigModal({
      isOpen: true,
      campusName: config.campusName,
      isSaving: false,
      classesInput: config.classes ? config.classes.join(', ') : '',
      slots: config.slots.map(s => ({
        slotNumber: s.slotNumber,
        name: s.name,
        startTime: s.startTime,
        endTime: s.endTime
      }))
    });
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    if (!campusName) return toast.error("Campus name is required");
    
    setIsSaving(true);
    try {
      await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5555'}/api/config`, {
        campusName,
        slots,
        classes: classesInput.split(',').map(s => s.trim()).filter(Boolean)
      }, authHeaders);
      toast.success("Campus config created!");
      setCampusName('');
      setClassesInput('');
      setSlots([{ slotNumber: 1, name: 'Morning', startTime: '09:00', endTime: '10:00' }]);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to create config");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateConfig = async (e) => {
    e.preventDefault();
    setEditConfigModal({ ...editConfigModal, isSaving: true });
    try {
      await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5555'}/api/config`, {
        campusName: editConfigModal.campusName,
        slots: editConfigModal.slots,
        classes: editConfigModal.classesInput.split(',').map(s => s.trim()).filter(Boolean)
      }, authHeaders);
      toast.success("Campus config updated!");
      setEditConfigModal({ ...editConfigModal, isOpen: false, isSaving: false });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to update config");
      setEditConfigModal({ ...editConfigModal, isSaving: false });
    }
  };

  const handleDeleteConfig = (campusName) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Campus Config',
      message: `Are you sure you want to delete the configuration for ${campusName}?`,
      onConfirm: async () => {
        try {
          await axios.delete(`${import.meta.env.VITE_API_URL || 'http://localhost:5555'}/api/config/${encodeURIComponent(campusName)}`, authHeaders);
          toast.success("Config deleted");
          fetchData();
        } catch (err) {
          toast.error("Failed to delete config");
        }
        setConfirmModal({ ...confirmModal, isOpen: false });
      }
    });
  };

  const addSlot = () => setSlots([...slots, { slotNumber: slots.length + 1, name: '', startTime: '', endTime: '' }]);
  const updateSlot = (index, field, value) => {
    const newSlots = [...slots];
    newSlots[index][field] = value;
    setSlots(newSlots);
  };
  const removeSlot = (index) => setSlots(slots.filter((_, i) => i !== index));

  const addEditSlot = () => setEditConfigModal(prev => ({ ...prev, slots: [...prev.slots, { slotNumber: prev.slots.length + 1, name: '', startTime: '', endTime: '' }] }));
  const updateEditSlot = (index, field, value) => {
    setEditConfigModal(prev => {
      const newSlots = [...prev.slots];
      newSlots[index][field] = value;
      return { ...prev, slots: newSlots };
    });
  };
  const removeEditSlot = (index) => setEditConfigModal(prev => ({ ...prev, slots: prev.slots.filter((_, i) => i !== index) }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <ShieldAlert className="w-7 h-7 sm:w-8 sm:h-8 text-rose-500" />
            Super Admin Console
          </h1>
          <p className="text-slate-500 mt-2 font-medium text-sm sm:text-base">Manage campuses, slots, staff access, and dangerous operations.</p>
        </div>
        <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl shadow-sm border border-slate-100 w-full sm:w-auto">
          <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-sm flex-1 min-w-0">
            <div className="font-bold text-slate-900 truncate">{user?.name}</div>
            <div className="text-slate-500 text-xs truncate">{user?.email}</div>
          </div>
          <button 
            onClick={handleLogout}
            className="ml-2 p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors shrink-0"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto pb-1 gap-1 bg-slate-200/50 p-1 rounded-2xl w-full sm:w-max">
        <button
          onClick={() => setActiveTab('config')}
          className={`flex items-center gap-2 px-4 sm:px-6 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 whitespace-nowrap ${
            activeTab === 'config' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <Settings className="w-4 h-4" />
          Campus Config
        </button>
        <button
          onClick={() => setActiveTab('staff')}
          className={`flex items-center gap-2 px-4 sm:px-6 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 whitespace-nowrap ${
            activeTab === 'staff' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Staff Access
        </button>
        <button
          onClick={() => setActiveTab('students')}
          className={`flex items-center gap-2 px-4 sm:px-6 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 whitespace-nowrap ${
            activeTab === 'students' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <Trash2 className="w-4 h-4" />
          Delete Students
        </button>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        </div>
      ) : (
        <AnimatePresence mode="wait">
          
          {/* TAB: STAFF ACCESS */}
          {activeTab === 'staff' && (
            <motion.div
              key="staff"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Manage Staff Access</h3>
                  <p className="text-sm text-slate-500">Approve pending users and assign them to campuses.</p>
                </div>
              </div>
              
              {/* Add User Form */}
              <div className="p-4 bg-slate-50/50 border-b border-slate-100">
                <form onSubmit={handleAddUser} className="flex flex-col gap-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Name (Optional)</label>
                      <input type="text" value={newStaffName} onChange={e => setNewStaffName(e.target.value)} placeholder="e.g. John Doe" className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:border-indigo-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Pre-Authorize Email</label>
                      <input type="email" required value={newStaffEmail} onChange={e => setNewStaffEmail(e.target.value)} placeholder="teacher@school.com" className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:border-indigo-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Role</label>
                      <select value={newStaffRole} onChange={e => setNewStaffRole(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm outline-none">
                        <option value="staff">Staff</option>
                        <option value="superadmin">Super Admin</option>
                      </select>
                    </div>
                    {newStaffRole === 'staff' && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Campus</label>
                        <select value={newStaffCampus} onChange={e => setNewStaffCampus(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm outline-none">
                          <option value="">All Campuses (Global)</option>
                          {configs.map(c => <option key={c._id} value={c.campusName}>{c.campusName}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                  <button type="submit" className="w-full md:w-auto md:self-end bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition flex items-center justify-center gap-2">
                    <UserPlus className="w-4 h-4" /> Add User
                  </button>
                </form>
              </div>

              {/* Staff List — stacked on phone, 2-col on tablet, full row on desktop */}
              <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                {staffUsers.length === 0 && (
                  <p className="col-span-full p-8 text-center text-slate-500">No users found.</p>
                )}
                {staffUsers.map(staff => (
                  <div key={staff._id} className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-600 text-base shrink-0">
                        {(staff.name || staff.email).charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 truncate text-sm">{staff.name || 'No Name'}</div>
                        <div className="text-xs text-slate-500 truncate">{staff.email}</div>
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                            staff.role === 'superadmin' ? 'bg-rose-100 text-rose-700' :
                            staff.role === 'staff' ? 'bg-indigo-100 text-indigo-700' :
                            'bg-orange-100 text-orange-700'
                          }`}>
                            {staff.role?.toUpperCase() || 'UNKNOWN'}
                          </span>
                          <span className="text-xs font-medium text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-lg">{staff.campus || 'Global'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {staff.email !== 'rishav@navgurukul.org' && (
                        <button onClick={() => handleEditStaff(staff)} className="text-slate-400 hover:text-indigo-500 bg-white hover:bg-indigo-50 border border-slate-200 p-2 rounded-xl transition-colors" title="Edit User">
                          <Settings className="w-4 h-4" />
                        </button>
                      )}
                      {staff.email !== user?.email && staff.email !== 'rishav@navgurukul.org' && (
                        <button onClick={() => handleDeleteStaff(staff._id, staff.email)} className="text-slate-400 hover:text-rose-500 bg-white hover:bg-rose-50 border border-slate-200 p-2 rounded-xl transition-colors" title="Delete User">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* TAB: CONFIG */}
          {activeTab === 'config' && (
            <motion.div
              key="config"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
              {/* Add New Config Form */}
              <div className="lg:col-span-1 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 h-max">
                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-indigo-500" />
                  New Campus Config
                </h3>
                <form onSubmit={handleSaveConfig} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Campus Name</label>
                    <input 
                      type="text" required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:border-indigo-500"
                      placeholder="e.g. Eternal Campus"
                      value={campusName} onChange={e => setCampusName(e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Classes (Comma separated)</label>
                    <input 
                      type="text" 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:border-indigo-500"
                      placeholder="e.g. BCA-I, BCA-II, BCA-III"
                      value={classesInput} onChange={e => setClassesInput(e.target.value)}
                    />
                  </div>
                  
                  <div className="pt-2 border-t border-slate-100">
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-semibold text-slate-700">Time Slots</label>
                      <button type="button" onClick={addSlot} className="text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-2 py-1 rounded-md">
                        + Add Slot
                      </button>
                    </div>
                    
                    <div className="space-y-3">
                      {slots.map((slot, idx) => (
                        <div key={idx} className="bg-slate-50 p-3 rounded-xl border border-slate-200 relative group">
                          {slots.length > 1 && (
                            <button type="button" onClick={() => removeSlot(idx)} className="absolute -top-2 -right-2 bg-white rounded-full p-1 shadow-sm border border-slate-200 text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">
                              <X className="w-3 h-3" />
                            </button>
                          )}
                          <div className="grid grid-cols-2 gap-2 mb-2">
                            <div>
                              <div className="text-[10px] font-bold text-slate-400 uppercase">Slot #</div>
                              <input type="number" value={slot.slotNumber} onChange={e => updateSlot(idx, 'slotNumber', parseInt(e.target.value))} className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-sm" />
                            </div>
                            <div>
                              <div className="text-[10px] font-bold text-slate-400 uppercase">Name</div>
                              <input type="text" value={slot.name} onChange={e => updateSlot(idx, 'name', e.target.value)} placeholder="e.g. Morning" className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-sm" />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <div className="text-[10px] font-bold text-slate-400 uppercase">Start (24H)</div>
                              <input type="time" value={slot.startTime} onChange={e => updateSlot(idx, 'startTime', e.target.value)} required className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-sm" />
                            </div>
                            <div>
                              <div className="text-[10px] font-bold text-slate-400 uppercase">End (24H)</div>
                              <input type="time" value={slot.endTime} onChange={e => updateSlot(idx, 'endTime', e.target.value)} required className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-sm" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <button type="submit" disabled={isSaving} className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 transition flex justify-center items-center gap-2 mt-4">
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Create Configuration
                  </button>
                </form>
              </div>

              {/* Existing Configs */}
              <div className="lg:col-span-2 space-y-4">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 px-2">
                  <Server className="w-5 h-5 text-indigo-500" />
                  Active Configurations
                </h3>
                {configs.length === 0 ? (
                  <div className="bg-slate-50 border border-slate-200 border-dashed rounded-3xl p-8 text-center text-slate-500">
                    No configurations found. Add one on the left.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {configs.map(config => (
                      <div key={config._id} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 relative group">
                        <div className="absolute top-4 right-4 flex gap-2">
                          <button onClick={() => handleEditConfig(config)} className="text-slate-400 hover:text-indigo-500 bg-slate-50 hover:bg-indigo-50 p-2 rounded-xl transition-colors">
                            <Settings className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDeleteConfig(config.campusName)} className="text-slate-400 hover:text-rose-500 bg-slate-50 hover:bg-rose-50 p-2 rounded-xl transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <h4 className="font-bold text-slate-900 text-lg mb-4 pr-10">{config.campusName}</h4>
                        <div className="space-y-2">
                          {config.slots.map(s => (
                            <div key={s.slotNumber} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                              <div className="flex items-center gap-2">
                                <span className="bg-indigo-100 text-indigo-700 text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                                  {s.slotNumber}
                                </span>
                                <span className="font-medium text-slate-700 text-sm">{s.name}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-white px-2 py-1 rounded-lg border border-slate-200">
                                <Clock className="w-3 h-3 text-indigo-400" />
                                {s.startTime} - {s.endTime}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* TAB: STUDENTS */}
          {activeTab === 'students' && (
            <motion.div
              key="students"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 bg-rose-50/50">
                <h3 className="text-lg font-bold text-rose-900 flex items-center gap-2">
                  <Trash2 className="w-5 h-5 text-rose-500" />
                  Danger Zone: Delete Students
                </h3>
                <p className="text-sm text-rose-700/70 mt-1">Deleting a student permanently removes their face data and all attendance history.</p>
              </div>
              {/* Card grid — 1 col phone, 2 col tablet, 3 col desktop */}
              <div className="p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {students.length === 0 && (
                  <p className="col-span-full p-8 text-center text-slate-500">No students registered yet.</p>
                )}
                {students.map(student => (
                  <div key={student._id} className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center font-bold text-rose-500 text-base shrink-0">
                        {student.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 truncate text-sm">{student.name}</div>
                        <div className="text-xs text-slate-500 truncate">{student.rollNo}</div>
                        <div className="text-xs text-slate-400 truncate">{student.campus} · {student.class}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteStudent(student._id, student.name)}
                      className="inline-flex items-center justify-center bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white p-2.5 rounded-xl transition-colors shrink-0 border border-rose-100"
                      title="Delete Student"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      )}

      {/* Custom Confirm Modal */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-xl border border-slate-100 p-6 max-w-sm w-full relative"
            >
              <h3 className="text-xl font-bold text-slate-900 mb-2 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-500" />
                {confirmModal.title}
              </h3>
              <p className="text-slate-600 mb-6">{confirmModal.message}</p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmModal.onConfirm}
                  className="px-4 py-2 font-semibold bg-rose-500 text-white hover:bg-rose-600 rounded-xl transition shadow-sm"
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Staff Modal */}
      <AnimatePresence>
        {editStaffModal.isOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-xl border border-slate-100 p-6 max-w-md w-full relative"
            >
              <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-500" />
                Edit Staff Member
              </h3>
              
              <form onSubmit={handleUpdateStaff} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Name</label>
                  <input type="text" value={editStaffModal.name} onChange={e => setEditStaffModal({...editStaffModal, name: e.target.value})} placeholder="e.g. John Doe" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Email</label>
                  <input type="email" required value={editStaffModal.email} onChange={e => setEditStaffModal({...editStaffModal, email: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Role</label>
                  <select value={editStaffModal.role} onChange={e => setEditStaffModal({...editStaffModal, role: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none">
                    <option value="pending">Pending</option>
                    <option value="staff">Staff</option>
                    <option value="superadmin">Super Admin</option>
                  </select>
                </div>
                {editStaffModal.role === 'staff' && (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Campus</label>
                    <select value={editStaffModal.campus} onChange={e => setEditStaffModal({...editStaffModal, campus: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none">
                      <option value="">All Campuses (Global)</option>
                      {configs.map(c => <option key={c._id} value={c.campusName}>{c.campusName}</option>)}
                    </select>
                  </div>
                )}
                
                <div className="flex gap-3 justify-end mt-6">
                  <button type="button" onClick={() => setEditStaffModal({ ...editStaffModal, isOpen: false })} className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition">
                    Cancel
                  </button>
                  <button type="submit" className="px-6 py-2 font-semibold bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl transition shadow-sm">
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Config Modal */}
      <AnimatePresence>
        {editConfigModal.isOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-xl border border-slate-100 p-6 max-w-lg w-full relative max-h-[90vh] overflow-y-auto"
            >
              <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-500" />
                Edit Campus Configuration
              </h3>
              
              <form onSubmit={handleUpdateConfig} className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Campus Name</label>
                  <input type="text" value={editConfigModal.campusName} disabled className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none opacity-70 cursor-not-allowed" />
                  <p className="text-xs text-orange-600 mt-1">Campus name cannot be changed.</p>
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Classes (Comma separated)</label>
                  <input 
                    type="text" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:border-indigo-500"
                    placeholder="e.g. BCA-I, BCA-II, BCA-III"
                    value={editConfigModal.classesInput} onChange={e => setEditConfigModal({...editConfigModal, classesInput: e.target.value})}
                  />
                </div>
                
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex justify-between items-center mb-4">
                    <label className="block text-sm font-semibold text-slate-700">Time Slots</label>
                    <button type="button" onClick={addEditSlot} className="text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg">
                      + Add Slot
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {editConfigModal.slots.map((slot, idx) => (
                      <div key={idx} className="bg-slate-50 p-3 rounded-xl border border-slate-200 relative group">
                        {editConfigModal.slots.length > 1 && (
                          <button type="button" onClick={() => removeEditSlot(idx)} className="absolute -top-2 -right-2 bg-white rounded-full p-1.5 shadow-sm border border-slate-200 text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">
                            <X className="w-3 h-3" />
                          </button>
                        )}
                        <div className="grid grid-cols-2 gap-2 mb-2">
                          <div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase">Slot #</div>
                            <input type="number" value={slot.slotNumber} onChange={e => updateEditSlot(idx, 'slotNumber', parseInt(e.target.value))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm" />
                          </div>
                          <div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase">Name</div>
                            <input type="text" value={slot.name} onChange={e => updateEditSlot(idx, 'name', e.target.value)} placeholder="e.g. Morning" className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase">Start (24H)</div>
                            <input type="time" value={slot.startTime} onChange={e => updateEditSlot(idx, 'startTime', e.target.value)} required className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm" />
                          </div>
                          <div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase">End (24H)</div>
                            <input type="time" value={slot.endTime} onChange={e => updateEditSlot(idx, 'endTime', e.target.value)} required className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="flex gap-3 justify-end mt-6">
                  <button type="button" onClick={() => setEditConfigModal({ ...editConfigModal, isOpen: false })} className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition">
                    Cancel
                  </button>
                  <button type="submit" disabled={editConfigModal.isSaving} className="px-6 py-2 font-semibold bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl transition shadow-sm flex items-center gap-2">
                    {editConfigModal.isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Config
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
