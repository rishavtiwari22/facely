import React, { useEffect, useState } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import { LayoutDashboard, Download, Filter, SearchX, Loader2, CheckCircle2, MapPin, Users, Edit3, Save, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

export default function Dashboard({ user }) {
  const [students, setStudents] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterClass, setFilterClass] = useState('');
  const [filterCampus, setFilterCampus] = useState('');
  const [editStudentModal, setEditStudentModal] = useState({ isOpen: false, data: null });
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', action: null });

  const todayDate = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  const handleEditStudent = (student) => {
    setEditStudentModal({ isOpen: true, data: { ...student } });
  };

  const handleUpdateStudent = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('adminToken');
      await axios.patch(`${import.meta.env.VITE_API_URL || 'http://localhost:5555'}/api/students/${editStudentModal.data._id}`, editStudentModal.data, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Student updated successfully");
      setEditStudentModal({ isOpen: false, data: null });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to update student");
    }
  };

  const handleManualAttendance = (student, slotObj, isPresent, record) => {
    if (isPresent) {
      setConfirmModal({
        isOpen: true,
        title: 'Remove Attendance',
        message: `Remove attendance for ${student.name} in ${slotObj.name}?`,
        action: async () => {
          try {
            const token = localStorage.getItem('adminToken');
            await axios.delete(`${import.meta.env.VITE_API_URL || 'http://localhost:5555'}/api/attendance/${record._id}`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            toast.success("Attendance removed");
            setConfirmModal({ isOpen: false, title: '', message: '', action: null });
            fetchData();
          } catch (err) {
            toast.error("Failed to remove attendance");
          }
        }
      });
    } else {
      setConfirmModal({
        isOpen: true,
        title: 'Mark Attendance',
        message: `Mark ${student.name} as present for ${slotObj.name}?`,
        action: async () => {
          try {
            const token = localStorage.getItem('adminToken');
            await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5555'}/api/attendance/manual`, {
              studentId: student._id,
              date: todayDate,
              slot: slotObj.slotNumber
            }, {
              headers: { Authorization: `Bearer ${token}` }
            });
            toast.success("Attendance marked");
            setConfirmModal({ isOpen: false, title: '', message: '', action: null });
            fetchData();
          } catch (err) {
            toast.error(err.response?.data?.error || "Failed to mark attendance");
          }
        }
      });
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('adminToken');
      const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5555'}/api/attendance/aggregate?date=${todayDate}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setStudents(res.data.students);
      setAttendanceRecords(res.data.attendanceRecords.filter(record => record.studentId));
      setConfigs(res.data.configs);
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:5555');

    let fetchTimeout;
    const debouncedFetch = () => {
      clearTimeout(fetchTimeout);
      fetchTimeout = setTimeout(() => {
        fetchData();
      }, 2000); // 2-second debounce
    };

    socket.on('attendance:bulk_marked', debouncedFetch);
    socket.on('attendance:marked', debouncedFetch);

    return () => socket.disconnect();
  }, [todayDate]);

  // Build filter options from actual student data
  const uniqueCampuses = [...new Set(students.map(s => s.campus || 'N/A'))].sort();
  const uniqueClasses = [...new Set(students.map(s => s.class || 'N/A'))].sort();

  // Filter students
  const filteredStudents = students.filter(s => {
    const studentCampus = s.campus || 'N/A';
    const studentClass = s.class || 'N/A';
    if (filterCampus && studentCampus !== filterCampus) return false;
    if (filterClass && !studentClass.toLowerCase().includes(filterClass.toLowerCase())) return false;
    return true;
  });

  const getAttendanceForStudent = (studentId) => {
    return attendanceRecords.filter(r => r.studentId._id === studentId || r.studentId === studentId);
  };

  const exportCSV = () => {
    const headers = ['Name', 'Roll Number', 'Campus', 'Class', 'Slot 1', 'Slot 2', 'Slot 3'];

    const rows = filteredStudents.map(student => {
      const records = getAttendanceForStudent(student._id);

      const campusConfig = configs.find(c => c.campusName === student.campus);
      const slotCount = campusConfig && Array.isArray(campusConfig.slots) ? campusConfig.slots.length : (student.campus === 'Eternal Campus' ? 3 : 1);

      const slotData = Array.from({ length: Math.max(3, slotCount) }).map((_, i) => {
        const slot = i + 1;
        if (slot > slotCount) return 'N/A';
        const record = records.find(r => r.slot === slot);
        return record ? 'Present' : 'Absent';
      });

      return [
        student.name,
        student.rollNo,
        student.campus || 'N/A',
        student.class || 'N/A',
        ...slotData
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8,"
      + headers.join(",") + "\n"
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `dashboard_${todayDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -10 },
    show: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  return (
    <>
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-6xl mx-auto"
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <div className="bg-indigo-100 p-2 rounded-xl text-indigo-600">
                <LayoutDashboard className="w-6 h-6" />
              </div>
              Students & Attendance
            </h1>
          </div>
          <p className="text-slate-500 font-medium mt-2">Unified Dashboard for {todayDate}</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-center w-full md:w-auto">
          <div className="relative w-full sm:w-auto">
            <MapPin className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            {user?.role === 'superadmin' ? (
              <select
                value={filterCampus}
                onChange={(e) => setFilterCampus(e.target.value)}
                className="pl-10 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl w-full sm:w-48 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm text-sm transition-all appearance-none"
              >
                <option value="">All Campuses (Global)</option>
                {uniqueCampuses.map(campus => (
                  <option key={campus} value={campus}>{campus}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                disabled
                value={user?.campus || 'Global'}
                className="pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl w-full sm:w-48 text-sm transition-all appearance-none cursor-not-allowed text-slate-600 font-semibold"
              />
            )}
          </div>
          <div className="relative w-full sm:w-auto">
            <Filter className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter Class..."
              className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl w-full sm:w-40 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm text-sm transition-all"
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
            />
          </div>
          <button
            onClick={exportCSV}
            className="flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold py-2.5 px-5 rounded-xl shadow-sm hover:shadow transition-all w-full sm:w-auto text-sm"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <motion.div
          whileHover={{ y: -4 }}
          className="bg-gradient-to-br from-indigo-500 to-indigo-600 p-6 rounded-3xl shadow-lg shadow-indigo-200 flex items-center gap-5 text-white"
        >
          <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-sm">
            <Users className="w-8 h-8 text-white" />
          </div>
          <div>
            <p className="text-indigo-100 font-medium tracking-wide text-sm mb-1 uppercase">Total Enrolled</p>
            <h3 className="text-4xl font-bold">{filteredStudents.length}</h3>
          </div>
        </motion.div>

        <motion.div
          whileHover={{ y: -4 }}
          className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 rounded-3xl shadow-lg shadow-emerald-200 flex items-center gap-5 text-white"
        >
          <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-sm">
            <CheckCircle2 className="w-8 h-8 text-white" />
          </div>
          <div>
            <p className="text-emerald-100 font-medium tracking-wide text-sm mb-1 uppercase">Total Attendance Marks (Today)</p>
            <h3 className="text-4xl font-bold">{attendanceRecords.length}</h3>
          </div>
        </motion.div>
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-20"
          >
            <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
            <p className="text-slate-500 font-medium">Loading unified dashboard...</p>
          </motion.div>
        ) : filteredStudents.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            className="bg-white p-12 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center"
          >
            <div className="bg-slate-50 p-6 rounded-full mb-6">
              <SearchX className="w-10 h-10 text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">No students found</h3>
            <p className="text-slate-500 max-w-sm">No students match your current filters.</p>
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="bg-white shadow-sm rounded-3xl overflow-hidden border border-slate-100"
          >
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 tracking-wider">
                      Campus
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 tracking-wider">
                      Class
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 tracking-wider">
                      Roll No
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 tracking-wider">
                      Today's Attendance
                    </th>
                  </tr>
                </thead>
                <motion.tbody
                  variants={containerVariants}
                  initial="hidden"
                  animate="show"
                  className="bg-white divide-y divide-slate-50"
                >
                  <AnimatePresence>
                    {filteredStudents.map((student) => {
                      const records = getAttendanceForStudent(student._id);

                      const campusConfig = configs.find(c =>
                        c.campusName?.toLowerCase().trim() === student.campus?.toLowerCase().trim()
                      );

                      // Support both dynamic slot configs and legacy fallback (1 slot default)
                      const slotsToRender = campusConfig && Array.isArray(campusConfig.slots) && campusConfig.slots.length > 0
                        ? campusConfig.slots
                        : [{ slotNumber: 1, name: 'Slot 1' }];

                      const options = { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false };
                      const istTimeStr = new Intl.DateTimeFormat('en-GB', options).format(new Date());

                      return (
                        <motion.tr
                          variants={itemVariants}
                          layout
                          key={student._id}
                          className="hover:bg-slate-50/80 transition-colors group"
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-sm border border-indigo-100/50 group-hover:scale-105 transition-transform">
                                {student.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors flex items-center gap-2">
                                {student.name}
                                {(user?.role === 'staff' || user?.role === 'superadmin') && (
                                  <button onClick={() => handleEditStudent(student)} className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-indigo-600 transition-all rounded-lg hover:bg-indigo-50">
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700">
                              {student.campus || 'N/A'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-semibold ${
                              student.campus === 'Eternal Campus' 
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' 
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            }`}>
                              {student.class || 'N/A'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-semibold font-mono">
                            {student.rollNo}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              {slotsToRender.map((slotObj) => {
                                const isPresent = records.some(r => r.slot === slotObj.slotNumber);

                                let circleClass = 'bg-slate-200 border-slate-300';
                                let titleText = `${slotObj.name}: Not Marked`;

                                if (isPresent) {
                                  circleClass = 'bg-emerald-500 border-emerald-600 shadow-sm shadow-emerald-200';
                                  titleText = `${slotObj.name}: Present`;
                                } else if (slotObj.endTime && istTimeStr > slotObj.endTime) {
                                  circleClass = 'bg-rose-500 border-rose-600 shadow-sm shadow-rose-200';
                                  titleText = `${slotObj.name}: Absent (Missed Window)`;
                                }

                                return (
                                  <div
                                    key={slotObj.slotNumber}
                                    title={titleText}
                                    onClick={() => user?.role === 'superadmin' && handleManualAttendance(student, slotObj, isPresent, records.find(r => r.slot === slotObj.slotNumber))}
                                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${circleClass} ${user?.role === 'superadmin' ? 'cursor-pointer hover:ring-2 ring-indigo-300 ring-offset-1 hover:scale-110' : ''}`}
                                  />
                                );
                              })}
                              {slotsToRender.length > 1 && (
                                <span className="text-xs text-slate-400 ml-2 font-medium">{slotsToRender.length} Slots</span>
                              )}
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </motion.tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>

      {/* Edit Student Modal */}
      <AnimatePresence>
        {editStudentModal.isOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-xl border border-slate-100 p-6 max-w-md w-full relative"
            >
              <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-indigo-500" />
                Edit Student Details
              </h3>
              
              <form onSubmit={handleUpdateStudent} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Name</label>
                  <input type="text" value={editStudentModal.data?.name || ''} onChange={e => setEditStudentModal({...editStudentModal, data: {...editStudentModal.data, name: e.target.value}})} required className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Roll No</label>
                    <input type="text" value={editStudentModal.data?.rollNo || ''} onChange={e => setEditStudentModal({...editStudentModal, data: {...editStudentModal.data, rollNo: e.target.value}})} required className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Class/School</label>
                    <input type="text" value={editStudentModal.data?.class || ''} onChange={e => setEditStudentModal({...editStudentModal, data: {...editStudentModal.data, class: e.target.value}})} required className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Campus</label>
                  <input type="text" value={editStudentModal.data?.campus || ''} onChange={e => setEditStudentModal({...editStudentModal, data: {...editStudentModal.data, campus: e.target.value}})} required className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none" />
                </div>
                
                <div className="flex gap-3 justify-end mt-6">
                  <button type="button" onClick={() => setEditStudentModal({ isOpen: false, data: null })} className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition">
                    Cancel
                  </button>
                  <button type="submit" className="px-6 py-2 font-semibold bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl transition flex items-center gap-2">
                    <Save className="w-4 h-4" /> Save
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirm Action Modal */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-xl border border-slate-100 p-6 max-w-sm w-full relative"
            >
              <h3 className="text-xl font-bold text-slate-900 mb-2">{confirmModal.title}</h3>
              <p className="text-slate-600 mb-6">{confirmModal.message}</p>
              
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setConfirmModal({ isOpen: false, title: '', message: '', action: null })} className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition">
                  Cancel
                </button>
                <button type="button" onClick={confirmModal.action} className="px-6 py-2 font-semibold bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl transition">
                  Confirm
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
