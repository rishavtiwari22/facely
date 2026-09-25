import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import axios from 'axios';
import { UserPlus, Camera, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { loadModels, getFaceDescriptor } from '../lib/faceApi';
import { motion, AnimatePresence } from 'framer-motion';

export default function Register() {
  const navigate = useNavigate();
  const webcamRef = useRef(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [formData, setFormData] = useState({ 
    name: '', 
    schoolEmail: '',
    campus: '',
    rollNo: '', 
    studentClass: '' 
  });
  const [status, setStatus] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [availableCampuses, setAvailableCampuses] = useState([]);

  // For capturing 5 embeddings
  const [embeddings, setEmbeddings] = useState([]);
  const [isCapturing, setIsCapturing] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        await loadModels();
        setModelsLoaded(true);
      } catch (err) {
        setError('Failed to load face detection models.');
      }
    };
    const fetchConfigs = async () => {
      try {
        const token = localStorage.getItem('adminToken');
        const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5555'}/api/config`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setAvailableCampuses(res.data);
      } catch (err) {
        console.error("Failed to load configs", err);
      }
    };
    init();
    fetchConfigs();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'campus') {
      setFormData({ ...formData, campus: value, studentClass: '' });
    } else {
      setFormData({ ...formData, [name]: value });
    }
    setError(null);
  };

  const captureFace = async () => {
    if (!webcamRef.current || !webcamRef.current.video) {
      setError("Camera not ready.");
      return;
    }
    
    setIsCapturing(true);
    setError(null);
    setStatus('Detecting face...');

    try {
      const result = await getFaceDescriptor(webcamRef.current.video);
      
      if (result.error) {
        setError(result.error);
        setStatus('');
      } else if (result.descriptor) {
        setEmbeddings(prev => [...prev, Array.from(result.descriptor)]);
        setStatus('Face captured successfully!');
        setTimeout(() => setStatus(''), 1500);
      }
    } catch (err) {
      setError("An unexpected error occurred during capture.");
    } finally {
      setIsCapturing(false);
    }
  };

  const clearCaptures = () => {
    setEmbeddings([]);
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (embeddings.length < 5) {
      setError(`Please capture ${5 - embeddings.length} more face angles.`);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setStatus('Submitting registration...');
    
    try {
      const token = localStorage.getItem('adminToken');
      const response = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5555'}/api/students/register`, {
        ...formData,
        embeddings
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSuccess(`Registration successful for ${response.data.student.name}!`);
      setTimeout(() => setSuccess(null), 4000);
      setStatus('');
      setFormData({ name: '', schoolEmail: '', campus: '', rollNo: '', studentClass: '' });
      setEmbeddings([]);
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
      setTimeout(() => setError(null), 5000);
      setStatus('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto flex flex-col md:flex-row gap-8"
    >
      {/* Form Section */}
      <div className="flex-1 bg-white p-8 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden">
        {/* Subtle background decoration */}
        <div className="absolute top-0 right-0 -mt-16 -mr-16 w-32 h-32 bg-indigo-50 rounded-full blur-2xl pointer-events-none"></div>

        <div className="flex items-center gap-4 mb-8 relative">
          <div className="bg-indigo-100 p-2.5 rounded-2xl">
            <UserPlus className="w-7 h-7 text-indigo-600" />
          </div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Register</h2>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6 relative">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Full Name</label>
            <input
              type="text"
              name="name"
              required
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all font-medium text-slate-900 placeholder-slate-400"
              placeholder="e.g. Jane Doe"
              value={formData.name}
              onChange={handleInputChange}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">School Email</label>
            <input
              type="email"
              name="schoolEmail"
              required
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all font-medium text-slate-900 placeholder-slate-400"
              placeholder="e.g. jane.doe@school.edu"
              value={formData.schoolEmail}
              onChange={handleInputChange}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Campus</label>
            <select
              name="campus"
              required
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all font-medium text-slate-900"
              value={formData.campus}
              onChange={handleInputChange}
            >
              <option value="" disabled>Select a campus</option>
              {availableCampuses.map(c => (
                <option key={c._id} value={c.campusName}>{c.campusName}</option>
              ))}
            </select>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Roll Number</label>
              <input
                type="text"
                name="rollNo"
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all font-medium text-slate-900 placeholder-slate-400"
                placeholder="e.g. CS123"
                value={formData.rollNo}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                {formData.campus === 'Eternal Campus' ? 'Class' : 'School'}
              </label>
              {(() => {
                const selectedCampusConfig = availableCampuses.find(c => c.campusName === formData.campus);
                
                if (selectedCampusConfig && Array.isArray(selectedCampusConfig.classes) && selectedCampusConfig.classes.length > 0) {
                  return (
                    <select
                      name="studentClass"
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all font-medium text-slate-900"
                      value={formData.studentClass}
                      onChange={handleInputChange}
                    >
                      <option value="" disabled>Select Class/School</option>
                      {selectedCampusConfig.classes.map((className, idx) => (
                        <option key={idx} value={className}>{className}</option>
                      ))}
                    </select>
                  );
                }

                // Fallback for campuses without classes defined
                return (
                  <input
                    type="text"
                    name="studentClass"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all font-medium text-slate-900 placeholder-slate-400"
                    placeholder="e.g. BCA-I or SOP"
                    value={formData.studentClass}
                    onChange={handleInputChange}
                  />
                );
              })()}
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100">
            <button
              type="submit"
              disabled={isSubmitting || embeddings.length < 5 || !modelsLoaded}
              className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold py-3.5 px-6 rounded-xl shadow-md hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-indigo-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 transform hover:-translate-y-0.5 active:translate-y-0 disabled:transform-none"
            >
              {isSubmitting ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Submitting...</>
              ) : (
                'Register Student'
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Camera Section */}
      <div className="flex-1 flex flex-col gap-5">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex-1 flex flex-col">
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Camera className="w-5 h-5 text-indigo-500" />
              Face Capture
            </h3>
            <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-3 py-1.5 rounded-full border border-indigo-100">
              {embeddings.length} / 5 Captured
            </span>
          </div>
          
          <div className="relative bg-slate-900 rounded-2xl overflow-hidden w-full aspect-square max-h-[500px] mx-auto shadow-inner flex items-center justify-center border-4 border-slate-50 ring-1 ring-slate-200">
            {modelsLoaded ? (
              cameraError ? (
                <div className="text-slate-400 text-center p-6 flex flex-col items-center">
                  <AlertCircle className="w-10 h-10 mb-3 text-red-400/80" />
                  <p className="font-medium text-sm">Camera access denied or unavailable.</p>
                </div>
              ) : (
                <>
                  <Webcam
                    ref={webcamRef}
                    audio={false}
                    screenshotFormat="image/jpeg"
                    videoConstraints={{ facingMode: "user" }}
                    onUserMediaError={() => setCameraError(true)}
                    className="object-cover w-full h-full transform scale-x-[-1]" 
                  />
                  {isCapturing && (
                    <motion.div 
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="absolute inset-0 border-4 border-indigo-500 rounded-xl"
                    ></motion.div>
                  )}
                </>
              )
            ) : (
              <div className="flex flex-col items-center text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin mb-3 text-indigo-500" />
                <span className="text-sm font-medium tracking-wide">Loading AI Models...</span>
              </div>
            )}
            
            <AnimatePresence>
              {status && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                  className="absolute inset-x-0 bottom-4 flex justify-center"
                >
                  <div className="bg-slate-900/80 backdrop-blur-md text-white text-sm font-semibold px-5 py-2 rounded-full shadow-xl border border-slate-700/50">
                    {status}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={captureFace}
              disabled={embeddings.length >= 5 || isCapturing || !modelsLoaded || cameraError}
              className="flex-1 bg-slate-900 text-white font-semibold py-3.5 px-4 rounded-xl hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
            >
              {isCapturing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
              {embeddings.length >= 5 ? 'Capture Complete' : 'Capture Angle'}
            </button>
            <button
              type="button"
              onClick={clearCaptures}
              disabled={embeddings.length === 0 || isSubmitting}
              className="px-5 py-3.5 border-2 border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-100 transition-all disabled:opacity-50"
            >
              Reset
            </button>
          </div>
          
          <div className="mt-5 p-4 bg-indigo-50/60 rounded-2xl border border-indigo-100/50">
            <p className="text-xs text-indigo-800 leading-relaxed font-medium">
              <span className="font-bold text-indigo-900 block mb-1">Capture Guide:</span>
              Look directly at the camera for the first capture, then slightly turn your head left, right, up, and down for the remaining captures.
            </p>
          </div>
        </div>
      </div>

      {/* Snackbar Toast */}
      <AnimatePresence>
        {(success || error) && (
          <motion.div 
            initial={{ opacity: 0, y: 20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            className={`fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50 flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl font-semibold border ${
              success ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-red-600 text-white border-red-500'
            }`}
          >
            {success ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            {success || error}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
