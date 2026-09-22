import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import axios from 'axios';
import * as faceapi from 'face-api.js';
import { Camera, AlertCircle, Loader2, ScanFace, WifiOff, Users, ArrowLeft, PenTool, CheckSquare } from 'lucide-react';
import { loadModels, getFaceDescriptor } from '../lib/faceApi';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { get, set } from 'idb-keyval';

export default function Attendance() {
  const navigate = useNavigate();
  const webcamRef = useRef(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [students, setStudents] = useState([]);
  const [faceMatcher, setFaceMatcher] = useState(null);
  
  const [status, setStatus] = useState('Initializing AI Models...');
  const [cameraError, setCameraError] = useState(false);
  const [matchState, setMatchState] = useState(null); // { name, rollNo }
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualSearch, setManualSearch] = useState('');
  
  // Stats
  const [totalEnrolled, setTotalEnrolled] = useState(0);
  const [markedCount, setMarkedCount] = useState(0);
  const [markedRecords, setMarkedRecords] = useState([]); // Array of studentIds
  const markedRecordsRef = useRef([]); // Ref for interval closure
  const [showSummaryModal, setShowSummaryModal] = useState(false);

  const isDetecting = useRef(false);
  const recentDetections = useRef(new Set()); // Debounce map

  // Fetch initial data
  useEffect(() => {
    const init = async () => {
      try {
        await loadModels();
        setModelsLoaded(true);
        setStatus('Fetching student data...');

        const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5555'}/api/students?includeEmbeddings=true`);
        const studentsData = res.data;
        setStudents(studentsData);

        // Fetch today's stats
        const todayDate = new Date().toISOString().split("T")[0];
        const statsRes = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5555'}/api/attendance?date=${todayDate}`);
        setTotalEnrolled(statsRes.data.totalEnrolled || studentsData.length);
        const records = statsRes.data.records || [];
        const validRecords = records.filter(r => r.studentId);
        setMarkedCount(validRecords.length);
        const initialMarked = validRecords.map(r => r.studentId._id || r.studentId);
        setMarkedRecords(initialMarked);
        markedRecordsRef.current = initialMarked;

        const validStudents = studentsData.filter(s => s.embeddings && s.embeddings.length > 0);
        if (validStudents.length > 0) {
          const labeledDescriptors = validStudents.map(student => {
            const descriptors = student.embeddings.map(emb => new Float32Array(emb));
            return new faceapi.LabeledFaceDescriptors(student._id, descriptors);
          });
          
          const matcher = new faceapi.FaceMatcher(labeledDescriptors, 0.55);
          setFaceMatcher(matcher);
          setStatus('Active');
        } else {
          setStatus('No valid face data found.');
        }
      } catch (err) {
        console.error(err);
        setStatus(err.message || 'System Error');
      }
    };
    init();
  }, []);

  // Sync Offline Queue
  const syncOfflineQueue = useCallback(async () => {
    const queue = await get('offline_attendance_queue') || [];
    if (queue.length > 0) {
      toast.loading(`Syncing ${queue.length} offline records...`, { id: 'sync' });
      let successCount = 0;
      
      for (const record of queue) {
        try {
          await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5555'}/api/attendance/mark`, {
            studentId: record.studentId,
            confidence: record.confidence,
            markedBy: 'face'
          });
          successCount++;
        } catch (e) {
          console.error("Sync failed for record:", e);
        }
      }
      
      await set('offline_attendance_queue', []);
      toast.success(`Synced ${successCount} records!`, { id: 'sync' });
      setMarkedCount(prev => prev + successCount);
    }
  }, []);

  // Listen for online status
  useEffect(() => {
    window.addEventListener('online', syncOfflineQueue);
    return () => window.removeEventListener('online', syncOfflineQueue);
  }, [syncOfflineQueue]);

  const playSuccessSound = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1); // A6
      
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {
      console.warn("Audio Context not supported");
    }
  };

  const speakName = (name) => {
    playSuccessSound();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(`Welcome, ${name}`);
      utterance.rate = 1.1;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  const markAttendance = async (studentId, confidence, name, markedBy = 'face') => {
    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5555'}/api/attendance/mark`, {
        studentId,
        confidence,
        markedBy
      });
      
      if (response.status === 201) {
        setMarkedCount(prev => prev + 1);
        setMarkedRecords(prev => {
          const newRecords = [...prev, studentId];
          markedRecordsRef.current = newRecords;
          return newRecords;
        });
      } else if (response.status === 200) {
        toast(`${name} is already marked present today.`, { icon: 'ℹ️' });
      }
    } catch (err) {
      console.error(err);
      if (!navigator.onLine || err.message === 'Network Error') {
        // Offline Queue Fallback
        const queue = await get('offline_attendance_queue') || [];
        queue.push({ studentId, confidence, name, timestamp: Date.now() });
        await set('offline_attendance_queue', queue);
        toast('Offline mode: Attendance queued for sync', { icon: '🔄', style: { background: '#f59e0b', color: '#fff' } });
      }
    }
  };

  // Main Detection Loop
  useEffect(() => {
    if (!modelsLoaded || !faceMatcher || cameraError || matchState) return;

    const interval = setInterval(async () => {
      if (isDetecting.current) return;
      if (!webcamRef.current || !webcamRef.current.video) return;
      
      isDetecting.current = true;
      try {
        const result = await getFaceDescriptor(webcamRef.current.video);
        if (!result.error && result.descriptor) {
          const bestMatch = faceMatcher.findBestMatch(new Float32Array(result.descriptor));
          
          if (bestMatch.label !== 'unknown' && bestMatch.distance < 0.55) {
            const matchedStudent = students.find(s => s._id === bestMatch.label);
            if (matchedStudent) {
              if (!recentDetections.current.has(matchedStudent._id)) {
                // Add to debounce (60 seconds)
                recentDetections.current.add(matchedStudent._id);
                setTimeout(() => recentDetections.current.delete(matchedStudent._id), 60000);
                
                if (markedRecordsRef.current.includes(matchedStudent._id)) {
                  toast(`${matchedStudent.name} is already marked today.`, { icon: 'ℹ️' });
                  return;
                }

                // Trigger match state UI
                setMatchState({ name: matchedStudent.name, rollNo: matchedStudent.rollNo });
                speakName(matchedStudent.name);
                
                // Send to backend
                await markAttendance(matchedStudent._id, 1 - bestMatch.distance, matchedStudent.name);
                
                // Reset UI after 2.5 seconds
                setTimeout(() => setMatchState(null), 2500);
              }
            }
          }
        }
      } catch (err) {
        console.error("Detection error:", err);
      } finally {
        isDetecting.current = false;
      }
    }, 400);

    return () => clearInterval(interval);
  }, [modelsLoaded, faceMatcher, students, cameraError, matchState]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-6xl mx-auto flex flex-col h-[calc(100vh-10rem)]"
    >
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <div className="bg-indigo-100 p-2 rounded-xl text-indigo-600">
                <ScanFace className="w-6 h-6" />
              </div>
              Live Attendance
            </h1>
          </div>
          <p className="text-slate-500 font-medium mt-2">Automatically detecting and marking student faces.</p>
        </div>
        
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          {!navigator.onLine && (
            <div className="flex items-center gap-1.5 text-amber-600 bg-amber-50 px-3 py-2 rounded-xl text-sm font-semibold border border-amber-200">
              <WifiOff className="w-4 h-4" />
              <span>Queuing Marks</span>
            </div>
          )}
          <div className="flex items-center gap-2 sm:gap-3 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
            <Users className="w-5 h-5 text-slate-500" />
            <div className="flex flex-col text-left">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider leading-none mb-0.5">Present</span>
              <span className="text-base font-bold text-slate-900 leading-none">
                {markedCount} <span className="text-slate-400 font-medium text-xs">/ {totalEnrolled}</span>
              </span>
            </div>
          </div>
          
          <button 
            onClick={() => setShowManualModal(true)}
            className="flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm hover:shadow"
          >
            <PenTool className="w-4 h-4" />
            <span className="hidden sm:inline">Manual</span>
          </button>
          
          <button 
            onClick={() => setShowSummaryModal(true)}
            className="flex items-center gap-1.5 bg-slate-900 hover:bg-black text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm hover:shadow"
          >
            <CheckSquare className="w-4 h-4" />
            <span className="hidden sm:inline">Summary</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 w-full flex flex-col min-h-0">
        <div className="flex-1 relative bg-white rounded-3xl shadow-lg border border-slate-100 overflow-hidden flex flex-col md:flex-row min-h-0">
          
          {/* Camera Section (Half/Card) */}
          <div className="relative bg-slate-900 flex items-center justify-center h-[55%] md:h-full md:flex-1 overflow-hidden shadow-inner">
            {modelsLoaded ? (
              cameraError ? (
                <div className="flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                  <AlertCircle className="w-12 h-12 mb-3 text-red-500/80" />
                  <h3 className="text-lg font-bold text-slate-300 mb-1">Camera Error</h3>
                  <p className="text-sm font-medium">Please allow camera permissions.</p>
                </div>
              ) : (
                <>
                  <Webcam
                    ref={webcamRef}
                    audio={false}
                    screenshotFormat="image/jpeg"
                    videoConstraints={{ facingMode: "user" }}
                    onUserMediaError={() => setCameraError(true)}
                    className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1]"
                  />
                  
                  {/* Dark overlay for better contrast */}
                  <div className="absolute inset-0 bg-slate-900/10 pointer-events-none"></div>

                  {/* Modern Scanning UI */}
                  <AnimatePresence>
                    {!matchState && status === 'Active' && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 pointer-events-none flex items-center justify-center p-4"
                      >
                        <div className="w-full max-w-[280px] sm:max-w-[320px] aspect-[3/4] rounded-[2rem] border-2 border-indigo-400/40 relative overflow-hidden bg-indigo-500/5">
                          {/* Corner marks */}
                          <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-indigo-500 rounded-tl-[2rem]"></div>
                          <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-indigo-500 rounded-tr-[2rem]"></div>
                          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-indigo-500 rounded-bl-[2rem]"></div>
                          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-indigo-500 rounded-br-[2rem]"></div>
                          
                          <motion.div 
                            className="w-full h-[3px] bg-indigo-500 shadow-[0_0_15px_3px_rgba(99,102,241,0.7)]"
                            animate={{ top: ['0%', '100%', '0%'] }}
                            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                            style={{ position: 'absolute' }}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Success Match Overlay */}
                  <AnimatePresence>
                    {matchState && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center bg-emerald-900/60 backdrop-blur-md p-4"
                      >
                        <motion.div 
                          initial={{ scale: 0.8, y: 20 }}
                          animate={{ scale: 1, y: 0 }}
                          exit={{ scale: 0.9, y: -20 }}
                          transition={{ type: 'spring', bounce: 0.4 }}
                          className="bg-white/95 backdrop-blur-xl rounded-[2rem] p-8 flex flex-col items-center text-center shadow-2xl border border-white/20"
                        >
                           <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-5 shadow-inner border-4 border-white">
                             <svg className="w-10 h-10 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                           </div>
                           <h2 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">{matchState.name}</h2>
                           <p className="text-slate-500 font-semibold text-lg">Roll: {matchState.rollNo}</p>
                           <div className="mt-5 bg-gradient-to-r from-emerald-500 to-emerald-400 text-white px-5 py-2 rounded-xl text-sm font-bold tracking-widest uppercase shadow-md">
                             Marked Present
                           </div>
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )
            ) : (
              <div className="flex flex-col items-center text-slate-400">
                <Loader2 className="w-10 h-10 animate-spin mb-4 text-indigo-500" />
                <span className="text-sm font-bold tracking-widest uppercase">Loading AI...</span>
              </div>
            )}
          </div>
          
          {/* Instructions / Status Panel */}
          <div className="h-[45%] md:h-full w-full md:w-80 bg-white p-5 sm:p-8 flex flex-col border-t md:border-t-0 md:border-l border-slate-100 overflow-y-auto">
            <div className="mb-6">
              <h3 className="text-xl font-bold text-slate-900 mb-2">Instructions</h3>
              <p className="text-slate-500 text-sm leading-relaxed font-medium">
                Look directly at the camera. The system will automatically detect your face and mark your attendance. Wait for the green confirmation before leaving.
              </p>
            </div>
            
            <div className="mt-auto">
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 shadow-sm">
                <div className="relative">
                  <div className={`w-3.5 h-3.5 rounded-full ${status === 'Active' ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                  {status === 'Active' && <div className="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-60"></div>}
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-0.5">System Status</p>
                  <p className="text-sm font-bold text-slate-900">{status}</p>
                </div>
              </div>
            </div>
          </div>
          
        </div>
      </div>

      {/* Manual Fallback Modal */}
      <AnimatePresence>
        {showManualModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="bg-white rounded-[2rem] w-full max-w-lg overflow-hidden shadow-2xl flex flex-col"
              style={{ maxHeight: '80vh' }}
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h2 className="text-xl font-bold text-slate-900">Mark Manually</h2>
                <button onClick={() => setShowManualModal(false)} className="text-slate-400 hover:text-slate-900 p-2 rounded-xl hover:bg-slate-200 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="p-5 border-b border-slate-100">
                <input 
                  type="text" 
                  placeholder="Search by name or roll number..." 
                  className="w-full bg-slate-100 border-none rounded-xl px-5 py-3.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-900 font-medium placeholder-slate-400 transition-shadow"
                  value={manualSearch}
                  onChange={(e) => setManualSearch(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="overflow-y-auto flex-1 p-3">
                {students
                  .filter(s => s.name.toLowerCase().includes(manualSearch.toLowerCase()) || s.rollNo.toLowerCase().includes(manualSearch.toLowerCase()))
                  .map(student => (
                    <div key={student._id} className="flex items-center justify-between p-4 hover:bg-indigo-50 rounded-2xl cursor-pointer transition-colors group mb-1"
                         onClick={async () => {
                           if (markedRecords.includes(student._id)) {
                             toast(`${student.name} is already marked today.`, { icon: 'ℹ️' });
                             setShowManualModal(false);
                             setManualSearch('');
                             return;
                           }
                           await markAttendance(student._id, 1, student.name, 'manual');
                           toast.success(`${student.name} marked manually.`);
                           setShowManualModal(false);
                           setManualSearch('');
                         }}>
                      <div>
                        <p className="font-bold text-slate-900">{student.name}</p>
                        <p className="text-xs font-semibold text-slate-500 mt-1">Roll: {student.rollNo} • Class: {student.class}</p>
                      </div>
                      <button className="bg-white border border-slate-200 text-indigo-600 px-4 py-2 rounded-xl text-sm font-bold group-hover:bg-indigo-600 group-hover:text-white transition-colors shadow-sm group-hover:shadow">
                        Mark Present
                      </button>
                    </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Session Summary Modal */}
      <AnimatePresence>
        {showSummaryModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2rem] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col"
              style={{ maxHeight: '90vh' }}
            >
              <div className="p-6 sm:p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Session Summary</h2>
                  <p className="text-sm font-semibold text-slate-500 mt-1">{new Date().toLocaleDateString()}</p>
                </div>
                <button onClick={() => setShowSummaryModal(false)} className="text-slate-400 hover:text-slate-900 p-2 rounded-xl hover:bg-slate-200 transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              
              <div className="p-6 flex gap-4">
                <div className="flex-1 bg-emerald-50 p-5 rounded-2xl border border-emerald-100/50">
                  <p className="text-emerald-800 text-sm font-bold uppercase tracking-wider mb-1">Present Today</p>
                  <p className="text-4xl font-black text-emerald-600">{markedCount}</p>
                </div>
                <div className="flex-1 bg-rose-50 p-5 rounded-2xl border border-rose-100/50">
                  <p className="text-rose-800 text-sm font-bold uppercase tracking-wider mb-1">Absent Today</p>
                  <p className="text-4xl font-black text-rose-600">{students.length - markedCount}</p>
                </div>
              </div>

              <div className="px-6 pb-2">
                <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                  Absentee List
                  <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg text-xs font-bold border border-slate-200">{students.length - markedCount}</span>
                </h3>
              </div>

              <div className="overflow-y-auto flex-1 px-6 pb-6">
                <div className="space-y-3">
                  {students.filter(s => !markedRecords.includes(s._id)).length === 0 ? (
                    <div className="text-center py-10 text-slate-500 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 font-semibold">
                      Everyone is present! 🎉
                    </div>
                  ) : (
                    students.filter(s => !markedRecords.includes(s._id)).map(student => (
                      <div key={student._id} className="flex items-center justify-between p-4 bg-white border border-slate-100 shadow-sm rounded-2xl">
                        <div>
                          <p className="font-bold text-slate-900">{student.name}</p>
                          <p className="text-xs font-semibold text-slate-500 mt-0.5">Roll: {student.rollNo} • Class: {student.class}</p>
                        </div>
                        <span className="text-xs font-bold text-rose-600 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-100 uppercase tracking-wide">Absent</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
              
              <div className="p-6 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row gap-3">
                <button 
                  onClick={() => setShowSummaryModal(false)}
                  className="w-full sm:flex-1 px-5 py-3.5 border-2 border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-100 hover:text-slate-900 transition-colors"
                >
                  Return to Scanner
                </button>
                <button 
                  onClick={() => {
                    const absentees = students.filter(s => !markedRecords.includes(s._id));
                    const csv = "Name,Roll Number,Class\n" + absentees.map(a => `${a.name},${a.rollNo},${a.class}`).join("\n");
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `absentees_${new Date().toISOString().split('T')[0]}.csv`;
                    a.click();
                    toast.success("Absentees list exported!");
                  }}
                  className="w-full sm:flex-1 px-5 py-3.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-black transition-colors flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Export CSV
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}
