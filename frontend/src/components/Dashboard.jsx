import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import io from 'socket.io-client';
import { LayoutDashboard, Download, Filter, SearchX, Loader2, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Dashboard() {
  const navigate = useNavigate();
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterClass, setFilterClass] = useState('');
  
  const todayDate = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  useEffect(() => {
    // 1. Fetch initial data for today
    const fetchAttendance = async () => {
      try {
        const response = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5555'}/api/attendance?date=${todayDate}`);
        // Filter out records where studentId is null (which happens if a student was deleted from the DB)
        setAttendance(response.data.records.filter(record => record.studentId));
      } catch (err) {
        console.error("Failed to fetch attendance:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchAttendance();

    // 2. Setup socket.io connection for live updates
    const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:5555');
    
    socket.on('attendance:marked', (data) => {
      const newRecord = {
        _id: Math.random().toString(), // temporary ID for react key
        studentId: {
          name: data.studentName,
          rollNo: data.rollNo,
          class: data.class || 'N/A'
        },
        time: data.time,
        confidence: data.confidence,
        date: todayDate,
        status: 'present'
      };
      
      setAttendance(prev => {
        if (prev.find(r => r.studentId.rollNo === data.rollNo)) return prev;
        return [newRecord, ...prev];
      });
    });

    return () => socket.disconnect();
  }, [todayDate]);

  const exportCSV = () => {
    const headers = ['Name', 'Roll Number', 'Class', 'Time', 'Confidence'];
    
    const filteredRecords = filterClass 
      ? attendance.filter(record => (record.studentId.class || '').toLowerCase().includes(filterClass.toLowerCase()))
      : attendance;

    const rows = filteredRecords.map(record => [
      record.studentId.name,
      record.studentId.rollNo,
      record.studentId.class || 'N/A',
      new Date(record.time).toLocaleTimeString(),
      (record.confidence * 100).toFixed(1) + '%'
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n" 
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `attendance_${todayDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const visibleAttendance = filterClass 
    ? attendance.filter(record => (record.studentId.class || '').toLowerCase().includes(filterClass.toLowerCase()))
    : attendance;

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -10 },
    show: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  return (
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
              Live Dashboard
            </h1>
          </div>
          <p className="text-slate-500 font-medium mt-2">Today's Attendance for {todayDate}</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 items-center w-full md:w-auto">
          <div className="relative w-full sm:w-auto">
            <Filter className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Filter by class..."
              className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl w-full sm:w-56 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm text-sm transition-all"
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <motion.div 
          whileHover={{ y: -4 }}
          className="bg-gradient-to-br from-indigo-500 to-indigo-600 p-6 rounded-3xl shadow-lg shadow-indigo-200 flex items-center gap-5 text-white"
        >
          <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-sm">
            <CheckCircle2 className="w-8 h-8 text-white" />
          </div>
          <div>
            <p className="text-indigo-100 font-medium tracking-wide text-sm mb-1 uppercase">Present Today</p>
            <h3 className="text-4xl font-bold">{attendance.length}</h3>
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
            <p className="text-slate-500 font-medium">Loading live dashboard...</p>
          </motion.div>
        ) : visibleAttendance.length === 0 ? (
          <motion.div 
            key="empty"
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            className="bg-white p-12 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center"
          >
            <div className="bg-slate-50 p-6 rounded-full mb-6">
              <SearchX className="w-10 h-10 text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">No attendance records found</h3>
            <p className="text-slate-500 max-w-sm">No one has been marked present matching your filters today.</p>
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
                      Roll Number
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 tracking-wider">
                      Class
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 tracking-wider">
                      Time Marked
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 tracking-wider">
                      Confidence
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
                    {visibleAttendance.map((record) => (
                      <motion.tr 
                        variants={itemVariants}
                        layout
                        key={record._id} 
                        className="hover:bg-slate-50/80 transition-colors group"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold text-sm border border-emerald-100/50 group-hover:scale-105 transition-transform">
                              {record.studentId.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="font-semibold text-slate-900 group-hover:text-emerald-600 transition-colors">{record.studentId.name}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-medium">
                          {record.studentId.rollNo}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700">
                            {record.studentId.class || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-700">
                          {new Date(record.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100/50">
                            {(record.confidence * 100).toFixed(1)}%
                          </span>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </motion.tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
