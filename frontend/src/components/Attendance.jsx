import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import axios from 'axios';
import * as faceapi from 'face-api.js';
import { Camera, AlertCircle, Loader2, ScanFace, WifiOff, Users, ArrowLeft, PenTool, CheckSquare, UploadCloud, X, MapPin, Clock } from 'lucide-react';
import { loadModels, getFaceDescriptor } from '../lib/faceApi';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

export default function Attendance({ user }) {
  const navigate = useNavigate();
  const webcamRef = useRef(null);

  // Phase Management
  const [availableCampuses, setAvailableCampuses] = useState([]);
  const [campus, setCampus] = useState(user?.role === 'staff' ? (user.campus || '') : '');
  const [isCampusSelected, setIsCampusSelected] = useState(false);
  const [slot, setSlot] = useState(1);

  // System State
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [students, setStudents] = useState([]);
  const [faceMatcher, setFaceMatcher] = useState(null);
  const [status, setStatus] = useState('Waiting for campus selection...');
  const [cameraError, setCameraError] = useState(false);
  const [matchState, setMatchState] = useState(null); // { name, rollNo }

  // Time and Config State
  const [campusConfig, setCampusConfig] = useState(null);
  const [activeSlotName, setActiveSlotName] = useState(null);

  // Session Queue for Bulk Submit
  const [sessionRecords, setSessionRecords] = useState([]);
  const [recentScans, setRecentScans] = useState([]); // Keeps a visual log
  const sessionRecordsRef = useRef([]); // for interval closure
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Manual Mode & Summary Modals
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualSearch, setManualSearch] = useState('');
  const [showSummaryModal, setShowSummaryModal] = useState(false);

  // Stats
  const [totalEnrolled, setTotalEnrolled] = useState(0);
  const [markedCount, setMarkedCount] = useState(0);
  const [markedRecords, setMarkedRecords] = useState([]); // Array of studentIds already in DB
  const markedRecordsRef = useRef([]);

  const isDetecting = useRef(false);
  const recentDetections = useRef(new Set()); // Debounce map

  // Update refs when state changes
  useEffect(() => {
    sessionRecordsRef.current = sessionRecords;
  }, [sessionRecords]);

  // Initial Model Load
  useEffect(() => {
    const initModels = async () => {
      try {
        setStatus('Loading AI Models...');
        await loadModels();
        setModelsLoaded(true);
        setStatus('Ready. Select a campus.');
      } catch (err) {
        console.error(err);
        setStatus('AI Model Error');
      }
    };

    const fetchConfigs = async () => {
      try {
        const token = localStorage.getItem('adminToken');
        const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5555'}/api/config`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setAvailableCampuses(res.data);
        if (res.data.length > 0) {
          setCampus(res.data[0].campusName);
        }
      } catch (err) {
        console.error("Failed to load configs", err);
      }
    };

    initModels();
    fetchConfigs();
  }, []);

  // Fetch Data when Campus is selected
  const startSession = async (e) => {
    e.preventDefault();
    if (!campus.trim()) {
      toast.error("Please enter a campus name.");
      return;
    }

    setIsCampusSelected(true);
    setStatus('Fetching student data...');

    try {
      const token = localStorage.getItem('adminToken');
      const headers = { Authorization: `Bearer ${token}` };

      // Fetch Config and Students
      const [configRes, studentsRes] = await Promise.all([
        axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5555'}/api/config`, { headers }),
        axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5555'}/api/students?includeEmbeddings=true&campus=${encodeURIComponent(campus)}`, { headers })
      ]);

      const config = configRes.data.find(c => c.campusName === campus);
      setCampusConfig(config || null);

      const studentsData = studentsRes.data;
      setStudents(studentsData);

      // Fetch today's stats for this campus and slot
      const todayDate = new Date().toISOString().split("T")[0];
      const statsRes = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5555'}/api/attendance?date=${todayDate}&campus=${encodeURIComponent(campus)}&slot=${slot}`, { headers });

      setTotalEnrolled(statsRes.data.totalEnrolled || studentsData.length);
      const records = statsRes.data.records || [];
      const validRecords = records.filter(r => r.studentId);
      setMarkedCount(validRecords.length);

      const initialMarked = validRecords.map(r => r.studentId._id || r.studentId);
      setMarkedRecords(initialMarked);
      markedRecordsRef.current = initialMarked;

      console.log("DEBUG studentsData received from API:", studentsData);
      
      const validStudents = studentsData.filter(s => s.embeddings && s.embeddings.length > 0);
      console.log("DEBUG validStudents count:", validStudents.length);
      
      if (validStudents.length > 0) {
        setStatus('Building Face Matcher...');
        // Add slight delay so UI doesn't freeze harshly
        setTimeout(() => {
          const labeledDescriptors = validStudents.map(student => {
            const descriptors = student.embeddings.map(emb => new Float32Array(emb));
            return new faceapi.LabeledFaceDescriptors(student._id, descriptors);
          });

          const matcher = new faceapi.FaceMatcher(labeledDescriptors, 0.60);
          setFaceMatcher(matcher);
          setStatus('Active');
        }, 100);
      } else {
        setStatus(`No face data found in ${campus}.`);
      }
    } catch (err) {
      console.error(err);
      setStatus(err.message || 'System Error');
      toast.error("Failed to load campus data.");
      setIsCampusSelected(false); // Reset on error
    }
  };

  const playSuccessSound = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      // Duolingo-style pleasant ding (two quick notes)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5

      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch (e) {
      console.warn("Audio Context not supported");
    }
  };

  // (Manual Slot Selection replaces Automatic Time Window)

  // Main Detection Loop
  useEffect(() => {
    // Only detect if models loaded, face matcher exists, no camera error, no current match shown, campus is selected, AND an active slot exists
    if (!modelsLoaded || !faceMatcher || cameraError || matchState || !isCampusSelected || slot === null) return;

    const interval = setInterval(async () => {
      if (isDetecting.current) return;
      if (!webcamRef.current || !webcamRef.current.video) return;

      isDetecting.current = true;
      try {
        const result = await getFaceDescriptor(webcamRef.current.video);
        if (!result.error && result.descriptor) {
          const bestMatch = faceMatcher.findBestMatch(new Float32Array(result.descriptor));

          if (bestMatch.label !== 'unknown' && bestMatch.distance < 0.60) {
            const matchedStudent = students.find(s => s._id === bestMatch.label);
            if (matchedStudent) {
              if (!recentDetections.current.has(matchedStudent._id)) {

                // If already in DB
                if (markedRecordsRef.current.includes(matchedStudent._id)) {
                  toast(`${matchedStudent.name} is already marked today.`, { icon: 'ℹ️' });
                  recentDetections.current.add(matchedStudent._id);
                  setTimeout(() => recentDetections.current.delete(matchedStudent._id), 10000);
                  return;
                }

                // If already in local queue
                if (sessionRecordsRef.current.find(r => r.studentId === matchedStudent._id)) {
                  recentDetections.current.add(matchedStudent._id);
                  setTimeout(() => recentDetections.current.delete(matchedStudent._id), 10000);
                  return; // Silently ignore if they are just standing there
                }

                // Trigger match state UI and sound
                playSuccessSound();
                setMatchState({ name: matchedStudent.name, rollNo: matchedStudent.rollNo });

                // Add to local Queue!
                const newRecord = {
                  studentId: matchedStudent._id,
                  name: matchedStudent.name,
                  rollNo: matchedStudent.rollNo,
                  class: matchedStudent.class,
                  confidence: 1 - bestMatch.distance,
                  time: new Date(),
                  markedBy: 'face',
                  slot: slot
                };

                setSessionRecords(prev => [newRecord, ...prev]);
                setRecentScans(prev => [newRecord, ...prev].slice(0, 50)); // Keep last 50 for UI

                // Debounce
                recentDetections.current.add(matchedStudent._id);
                setTimeout(() => recentDetections.current.delete(matchedStudent._id), 15000); // 15s cooldown

                // Reset UI after 1.5 seconds
                setTimeout(() => setMatchState(null), 1500);
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
  }, [modelsLoaded, faceMatcher, students, cameraError, matchState, isCampusSelected]);

  // Bulk Submit Handler
  const handleBulkSubmit = async (isAuto = false) => {
    const currentRecords = sessionRecordsRef.current;
    if (currentRecords.length === 0) return;
    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('adminToken');
      const response = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5555'}/api/attendance/bulk`, {
        records: currentRecords
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!isAuto) {
        toast.success(`Successfully submitted ${response.data.count} records!`, { icon: '🎉' });
      }

      const submittedIds = currentRecords.map(r => r.studentId);
      setMarkedRecords(prev => [...prev, ...submittedIds]);
      markedRecordsRef.current = [...markedRecordsRef.current, ...submittedIds];
      setMarkedCount(prev => prev + response.data.count);

      // Clear successfully submitted records from queue
      setSessionRecords(prev => prev.filter(r => !submittedIds.includes(r.studentId)));
      setRetryCount(0); // Reset retry count on success
    } catch (error) {
      console.error(error);
      setRetryCount(prev => prev + 1);
      if (!isAuto) {
        toast.error("Bulk submission failed. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Auto-Submit Loop (Retries every 5 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      if (sessionRecordsRef.current.length > 0 && !isSubmitting) {
        handleBulkSubmit(true);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [isSubmitting]);

  const removeFromQueue = (studentId) => {
    setSessionRecords(prev => prev.filter(r => r.studentId !== studentId));
  };

  // ----------------------------------------------------------------------
  // PHASE 1 UI: Campus Selection
  // ----------------------------------------------------------------------
  if (!isCampusSelected) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto mt-20"
      >
        <div className="bg-white p-10 rounded-[2rem] shadow-xl border border-slate-100 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-16 -mr-16 w-32 h-32 bg-indigo-50 rounded-full blur-2xl pointer-events-none"></div>

          <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
            <MapPin className="w-10 h-10 text-indigo-600" />
          </div>

          <h1 className="text-3xl font-black text-slate-900 mb-3 tracking-tight">Select Campus</h1>
          <p className="text-slate-500 font-medium mb-8">Enter the campus name to load the AI face embeddings for that specific location.</p>

          <form onSubmit={startSession} className="flex flex-col gap-4 relative z-10">
            <div className="flex flex-col sm:flex-row gap-4 w-full">
              {user?.role === 'superadmin' ? (
                <select
                  required
                  autoFocus
                  value={campus}
                  onChange={e => setCampus(e.target.value)}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-lg font-bold text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
                >
                  <option value="" disabled>Select a campus</option>
                  {availableCampuses.map(c => (
                    <option key={c._id} value={c.campusName}>{c.campusName}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  disabled
                  value={user?.campus || 'Global'}
                  className="flex-1 bg-slate-100 border border-slate-200 rounded-2xl px-6 py-4 text-lg font-bold text-slate-500 cursor-not-allowed transition-all shadow-sm text-center"
                />
              )}
            </div>
            
            <div className="w-full">
              <select
                required
                value={slot}
                onChange={e => setSlot(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-lg font-bold text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
              >
                {!campus ? (
                  <option value="" disabled>Select campus first</option>
                ) : (
                  (availableCampuses.find(c => c.campusName === campus)?.slots || [{ slotNumber: 1, name: 'Default Slot' }]).map(s => (
                    <option key={s.slotNumber} value={s.slotNumber}>
                      {s.name} {s.startTime && s.endTime ? `| ${s.startTime} - ${s.endTime}` : ''}
                    </option>
                  ))
                )}
              </select>
            </div>
            <button
              type="submit"
              disabled={!modelsLoaded}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-8 py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-1"
            >
              {!modelsLoaded ? <Loader2 className="w-6 h-6 animate-spin" /> : <ScanFace className="w-6 h-6" />}
              Start Scanner
            </button>
          </form>
        </div>
      </motion.div>
    );
  }

  // ----------------------------------------------------------------------
  // PHASE 2 UI: Live Scanner & Bulk Queue
  // ----------------------------------------------------------------------
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-7xl mx-auto flex flex-col h-[calc(100vh-8rem)]"
    >
      {/* Persistent Sync Warning */}
      {retryCount >= 3 && sessionRecords.length > 0 && (
        <div className="mb-4 bg-red-100 border border-red-300 text-red-800 px-4 py-3 rounded-xl flex items-center gap-3 shadow-sm animate-pulse">
          <WifiOff className="w-5 h-5" />
          <div className="flex-1 font-semibold">
            {sessionRecords.length} records pending sync — check connection
          </div>
          <Loader2 className="w-4 h-4 animate-spin text-red-500" />
        </div>
      )}


      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <button onClick={() => { setIsCampusSelected(false); setFaceMatcher(null); }} className="p-2 bg-white rounded-xl shadow-sm border border-slate-200 hover:bg-slate-50 transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3 tracking-tight">
              {campus} Attendance
            </h1>
          </div>
          <p className="text-slate-500 font-medium mt-1 ml-12">Automatically detecting and queuing students.</p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
            <Users className="w-5 h-5 text-slate-500" />
            <div className="flex flex-col text-left">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider leading-none mb-0.5">DB Present</span>
              <span className="text-base font-bold text-slate-900 leading-none">
                {markedCount} <span className="text-slate-400 font-medium text-xs">/ {totalEnrolled}</span>
              </span>
            </div>
          </div>

          <button
            onClick={() => setShowManualModal(true)}
            className="flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm hover:shadow"
          >
            <PenTool className="w-4 h-4" />
            <span className="hidden sm:inline">Manual Mark</span>
          </button>

          <button
            onClick={() => setShowSummaryModal(true)}
            className="flex items-center gap-1.5 bg-slate-900 hover:bg-black text-white px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm hover:shadow"
          >
            <CheckSquare className="w-4 h-4" />
            <span className="hidden sm:inline">Summary</span>
          </button>
        </div>
      </div>

      {/* Main Content Area: Kiosk with Sidebar */}
      <div className="flex-1 w-full h-full relative flex flex-col lg:flex-row gap-6 pb-6">
        
        {/* LEFT: Square Camera Section */}
        <div className="flex-1 w-full relative bg-slate-900 rounded-[2.5rem] border-4 border-slate-200 overflow-hidden shadow-2xl aspect-square max-h-[75vh] flex items-center justify-center mx-auto">
          {modelsLoaded ? (
            cameraError ? (
              <div className="flex flex-col items-center justify-center text-slate-400 p-8 text-center bg-slate-900 w-full h-full">
                <AlertCircle className="w-16 h-16 mb-4 text-red-500/80" />
                <h3 className="text-xl font-bold text-slate-300 mb-2">Camera Error</h3>
                <p className="text-base font-medium">Please allow camera permissions to use the Kiosk.</p>
              </div>
            ) : (
              <>
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  screenshotFormat="image/jpeg"
                  videoConstraints={{ facingMode: "user", aspectRatio: 1 }}
                  onUserMediaError={() => setCameraError(true)}
                  className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1] opacity-90"
                />

                <div className="absolute inset-0 bg-slate-900/10 pointer-events-none"></div>

                {/* Status Indicator */}
                <div className="absolute top-6 left-6 bg-black/60 backdrop-blur-xl px-5 py-2.5 rounded-full border border-white/10 flex items-center gap-3 shadow-xl z-20">
                  <div className={`w-3 h-3 rounded-full ${status === 'Active' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></div>
                  <span className="text-white text-sm font-bold uppercase tracking-[0.1em]">{status}</span>
                </div>

                {/* Scanning UI Reticle */}
                <AnimatePresence>
                  {!matchState && status === 'Active' && slot && (
                    <motion.div
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="absolute inset-0 pointer-events-none flex items-center justify-center p-4 z-10"
                    >
                      <div className="relative w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96">
                        <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-white/80 rounded-tl-[2rem]"></div>
                        <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-white/80 rounded-tr-[2rem]"></div>
                        <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-white/80 rounded-bl-[2rem]"></div>
                        <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-white/80 rounded-br-[2rem]"></div>
                        <motion.div
                          className="w-full h-[3px] bg-emerald-400 shadow-[0_0_25px_5px_rgba(52,211,153,0.6)]"
                          animate={{ top: ['5%', '95%', '5%'] }}
                          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                          style={{ position: 'absolute' }}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Match Overlay */}
                <AnimatePresence>
                  {matchState && (
                    <motion.div
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center bg-emerald-900/60 backdrop-blur-md p-4 z-30"
                    >
                      <motion.div
                        initial={{ scale: 0.8, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: -20 }}
                        transition={{ type: 'spring', bounce: 0.4 }}
                        className="bg-white/95 backdrop-blur-xl rounded-[2rem] p-10 flex flex-col items-center text-center shadow-2xl border border-white/20"
                      >
                        <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mb-6 border-4 border-white shadow-inner">
                          <svg className="w-12 h-12 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <h2 className="text-4xl font-black text-slate-900 mb-2">{matchState.name}</h2>
                        <p className="text-slate-500 font-bold text-xl">Roll: {matchState.rollNo}</p>
                        <div className="mt-6 bg-emerald-500 text-white px-6 py-2.5 rounded-xl text-sm font-black tracking-widest uppercase shadow-md">
                          Synced
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )
          ) : (
            <div className="flex flex-col items-center text-slate-400 z-10">
              <Loader2 className="w-12 h-12 animate-spin mb-4 text-indigo-500" />
              <span className="text-base font-bold tracking-widest uppercase">Initializing Kiosk...</span>
            </div>
          )}
        </div>
        
        {/* RIGHT: Recent Scans Sidebar */}
        <div className="w-full lg:w-[400px] flex flex-col bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden lg:h-full max-h-[50vh] lg:max-h-full">
          <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                Recent Scans
                {recentScans.length > 0 && (
                  <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md text-sm font-black">{recentScans.length}</span>
                )}
              </h3>
              <p className="text-xs font-semibold text-slate-500 mt-1 uppercase tracking-wider">Auto-Synced to DB</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
            <AnimatePresence>
              {recentScans.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="h-full flex flex-col items-center justify-center text-slate-400 text-center p-6"
                >
                  <ScanFace className="w-12 h-12 mb-3 text-slate-300" />
                  <p className="font-semibold text-slate-500">No scans yet</p>
                  <p className="text-sm mt-1 text-slate-400">Marked students will appear here.</p>
                </motion.div>
              ) : (
                recentScans.map(record => (
                  <motion.div
                    layout
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.9 }}
                    key={record.time.getTime() + record.studentId}
                    className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 font-bold flex items-center justify-center border border-emerald-100">
                        {record.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-sm">{record.name}</p>
                        <p className="text-xs font-semibold text-slate-500">{record.rollNo}</p>
                      </div>
                    </div>
                    <div className="bg-emerald-100 p-1.5 rounded-full">
                      <CheckSquare className="w-4 h-4 text-emerald-600" />
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Manual Fallback Modal */}
      <AnimatePresence>
        {showManualModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="bg-white rounded-[2rem] w-full max-w-lg overflow-hidden shadow-2xl flex flex-col"
              style={{ maxHeight: '80vh' }}
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h2 className="text-xl font-bold text-slate-900">Manual Entry (Queue)</h2>
                <button onClick={() => setShowManualModal(false)} className="text-slate-400 hover:text-slate-900 p-2 rounded-xl hover:bg-slate-200 transition-colors">
                  <X className="w-5 h-5" />
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
                      onClick={() => {
                        if (markedRecords.includes(student._id)) {
                          toast(`${student.name} is already marked in DB today.`, { icon: 'ℹ️' });
                          return;
                        }
                        if (sessionRecords.find(r => r.studentId === student._id)) {
                          toast(`${student.name} is already in the queue.`, { icon: 'ℹ️' });
                          return;
                        }
                        setSessionRecords(prev => [{
                          studentId: student._id,
                          name: student.name,
                          rollNo: student.rollNo,
                          class: student.class,
                          confidence: 1,
                          time: new Date(),
                          markedBy: 'manual',
                          slot: slot
                        }, ...prev]);

                        toast.success(`${student.name} added to queue.`);
                        setShowManualModal(false);
                        setManualSearch('');
                      }}>
                      <div>
                        <p className="font-bold text-slate-900">{student.name}</p>
                        <p className="text-xs font-semibold text-slate-500 mt-1">Roll: {student.rollNo} • Class: {student.class}</p>
                      </div>
                      <button className="bg-white border border-slate-200 text-indigo-600 px-4 py-2 rounded-xl text-sm font-bold group-hover:bg-indigo-600 group-hover:text-white transition-colors shadow-sm group-hover:shadow">
                        Add to Queue
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
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2rem] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col"
              style={{ maxHeight: '90vh' }}
            >
              <div className="p-6 sm:p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Campus Summary</h2>
                  <p className="text-sm font-semibold text-slate-500 mt-1">{campus} • {new Date().toLocaleDateString()}</p>
                </div>
                <button onClick={() => setShowSummaryModal(false)} className="text-slate-400 hover:text-slate-900 p-2 rounded-xl hover:bg-slate-200 transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 flex gap-4">
                <div className="flex-1 bg-emerald-50 p-5 rounded-2xl border border-emerald-100/50">
                  <p className="text-emerald-800 text-sm font-bold uppercase tracking-wider mb-1">Present (DB)</p>
                  <p className="text-4xl font-black text-emerald-600">{markedCount}</p>
                </div>
                <div className="flex-1 bg-rose-50 p-5 rounded-2xl border border-rose-100/50">
                  <p className="text-rose-800 text-sm font-bold uppercase tracking-wider mb-1">Absent (Remaining)</p>
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
                      Everyone in {campus} is present! 🎉
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
                    a.download = `${campus}_absentees_${new Date().toISOString().split('T')[0]}.csv`;
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
