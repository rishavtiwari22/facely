import re

with open('/Users/sama/Facely/frontend/src/components/Attendance.jsx', 'r') as f:
    content = f.read()

# Replace imports
content = content.replace(
    "import { loadModels, getFaceDescriptor } from '../lib/faceApi';",
    "import { loadModels, getAllFaces } from '../lib/faceApi';\nimport { getIOU } from '../lib/iou';"
)

# Replace matchState with activeFaces
content = content.replace(
    "const [matchState, setMatchState] = useState(null); // { name, rollNo }",
    "const [activeFaces, setActiveFaces] = useState(new Map());"
)

# Add faceHistory ref
content = content.replace(
    "const recentDetections = useRef(new Set()); // Debounce map",
    "const recentDetections = useRef(new Set()); // Debounce map\n  const faceHistory = useRef(new Map()); // trackId -> { frames: [], lastSeen: timestamp, student: obj }"
)

# Add playErrorSound
error_sound = """
  const playErrorSound = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.2);

      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {
      console.warn("Audio Context not supported");
    }
  };
"""
content = content.replace(
    "  // (Manual Slot Selection replaces Automatic Time Window)",
    error_sound + "\n  // (Manual Slot Selection replaces Automatic Time Window)"
)

# Replace detection loop
old_loop = """  // Main Detection Loop
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

          if (bestMatch.label !== 'unknown' && bestMatch.distance < 0.70) {
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
  }, [modelsLoaded, faceMatcher, students, cameraError, matchState, isCampusSelected]);"""

new_loop = """  // Main Detection Loop
  useEffect(() => {
    if (!modelsLoaded || !faceMatcher || cameraError || !isCampusSelected || slot === null) return;

    const interval = setInterval(async () => {
      if (isDetecting.current) return;
      if (!webcamRef.current || !webcamRef.current.video) return;

      isDetecting.current = true;
      try {
        const detectedFaces = await getAllFaces(webcamRef.current.video);
        const now = Date.now();
        
        // Cleanup old history
        for (const [tId, data] of faceHistory.current.entries()) {
          if (now - data.lastSeen > 1000) { // 1 sec memory
            faceHistory.current.delete(tId);
          }
        }

        const currentActiveFaces = new Map(activeFaces);
        // Clear active faces that are no longer seen
        for (const [tId, data] of currentActiveFaces.entries()) {
          if (now - data.lastSeen > 1000 && data.state !== 'CONFIRMED' && data.state !== 'REJECTED' && data.state !== 'NO_MATCH') {
            currentActiveFaces.delete(tId);
          }
        }

        for (const face of detectedFaces) {
          // Find matching trackId via IOU
          let bestTrackId = null;
          let bestIou = 0;
          for (const [tId, data] of faceHistory.current.entries()) {
            if (data.lastBox) {
              const iou = getIOU(face.box, data.lastBox);
              if (iou > 0.3 && iou > bestIou) {
                bestIou = iou;
                bestTrackId = tId;
              }
            }
          }

          if (!bestTrackId) {
            bestTrackId = `track_${Math.random().toString(36).substr(2, 9)}`;
            faceHistory.current.set(bestTrackId, { frames: [], lastSeen: now, lastBox: face.box });
          }

          const trackData = faceHistory.current.get(bestTrackId);
          trackData.lastSeen = now;
          trackData.lastBox = face.box;

          const bestMatch = faceMatcher.findBestMatch(new Float32Array(face.descriptor));
          
          let student = null;
          if (bestMatch.label !== 'unknown' && bestMatch.distance < 0.70) {
             student = students.find(s => s._id === bestMatch.label);
          }

          trackData.frames.push({ student, distance: bestMatch.distance, time: now });
          // keep last 5 frames
          if (trackData.frames.length > 5) trackData.frames.shift();

          const activeFaceState = currentActiveFaces.get(bestTrackId) || { state: 'SCANNING', progress: 0, lastSeen: now, student: null };
          activeFaceState.box = face.box;
          activeFaceState.lastSeen = now;

          // Process state logic
          if (activeFaceState.state === 'SCANNING') {
            // Count valid frames
            const validFrames = trackData.frames.filter(f => f.student).length;
            activeFaceState.progress = Math.min(1, validFrames / 3);

            if (validFrames >= 3) {
              // we have a match!
              const matchedStudent = trackData.frames.filter(f => f.student)[0].student; // get the student object
              activeFaceState.student = matchedStudent;

              if (markedRecordsRef.current.includes(matchedStudent._id) || sessionRecordsRef.current.find(r => r.studentId === matchedStudent._id)) {
                 // Already marked/queued
                 // Just briefly show confirmed but no need to queue again
                 activeFaceState.state = 'CONFIRMED';
                 activeFaceState.message = 'Already Marked';
                 playSuccessSound();
              } else {
                 activeFaceState.state = 'CONFIRMED';
                 playSuccessSound();
                 
                 // Queue
                 const newRecord = {
                   studentId: matchedStudent._id,
                   name: matchedStudent.name,
                   rollNo: matchedStudent.rollNo,
                   class: matchedStudent.class,
                   confidence: 1 - trackData.frames[trackData.frames.length - 1].distance, // approximate
                   time: new Date(),
                   markedBy: 'face',
                   slot: slot
                 };
                 setSessionRecords(prev => [newRecord, ...prev]);
                 setRecentScans(prev => [newRecord, ...prev].slice(0, 50));
              }

              // Set timeout to clear state
              setTimeout(() => {
                setActiveFaces(prev => {
                  const newMap = new Map(prev);
                  newMap.delete(bestTrackId);
                  return newMap;
                });
                faceHistory.current.delete(bestTrackId); // Clear history to avoid re-triggering instantly
              }, 1500);

            } else if (trackData.frames.length >= 5 && validFrames === 0) {
               // no match after 5 frames
               activeFaceState.state = 'NO_MATCH';
               playErrorSound();
               setTimeout(() => {
                 setActiveFaces(prev => {
                   const newMap = new Map(prev);
                   newMap.delete(bestTrackId);
                   return newMap;
                 });
                 faceHistory.current.delete(bestTrackId);
               }, 1500);
            }
          }
          currentActiveFaces.set(bestTrackId, activeFaceState);
        }
        
        setActiveFaces(currentActiveFaces);

      } catch (err) {
        console.error("Detection error:", err);
      } finally {
        isDetecting.current = false;
      }
    }, 400);

    return () => clearInterval(interval);
  }, [modelsLoaded, faceMatcher, students, cameraError, activeFaces, isCampusSelected, slot]);"""

content = content.replace(old_loop, new_loop)


# Replace rendering logic
old_render = """                {/* Status Indicator */}
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
                </AnimatePresence>"""

new_render = """                {/* Status Indicator */}
                <div className="absolute top-6 left-6 bg-black/60 backdrop-blur-xl px-5 py-2.5 rounded-full border border-white/10 flex items-center gap-3 shadow-xl z-20">
                  <div className={`w-3 h-3 rounded-full ${status === 'Active' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></div>
                  <span className="text-white text-sm font-bold uppercase tracking-[0.1em]">{status}</span>
                </div>

                {/* Idle Pulsing Border */}
                <AnimatePresence>
                  {status === 'Active' && activeFaces.size === 0 && (
                    <motion.div
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="absolute inset-0 pointer-events-none flex items-center justify-center p-4 z-10"
                    >
                      <motion.div
                        className="w-full h-full border-[6px] border-white/20 rounded-[2rem]"
                        animate={{ scale: [0.98, 1, 0.98], opacity: [0.3, 0.6, 0.3] }}
                        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Active Faces Overlays */}
                <AnimatePresence>
                  {Array.from(activeFaces.entries()).map(([tId, face]) => {
                     if (!face.box) return null;
                     const video = webcamRef.current?.video;
                     if (!video) return null;
                     
                     const vidW = video.videoWidth;
                     const vidH = video.videoHeight;
                     
                     const boxX = (face.box.x / vidW) * 100;
                     const boxY = (face.box.y / vidH) * 100;
                     const boxW = (face.box.width / vidW) * 100;
                     const boxH = (face.box.height / vidH) * 100;

                     const leftPct = 100 - boxX - boxW; // mirrored

                     let borderColor = 'border-blue-400';
                     let innerUI = null;
                     
                     if (face.state === 'SCANNING') {
                       borderColor = 'border-cyan-400 border-dashed';
                       innerUI = (
                          <>
                             <div className="absolute -bottom-6 left-0 w-full h-1.5 bg-black/50 rounded-full overflow-hidden">
                                <motion.div 
                                   className="h-full bg-cyan-400" 
                                   initial={{ width: 0 }} 
                                   animate={{ width: `${face.progress * 100}%` }} 
                                   transition={{ ease: "linear", duration: 0.2 }}
                                />
                             </div>
                          </>
                       );
                     } else if (face.state === 'CONFIRMED') {
                       borderColor = 'border-emerald-500 border-solid bg-emerald-500/20';
                       innerUI = (
                          <motion.div 
                             initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                             className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-xl p-3 flex flex-col items-center whitespace-nowrap border-2 border-emerald-500 z-50"
                          >
                             <CheckSquare className="w-8 h-8 text-emerald-500 mb-1" />
                             <span className="font-bold text-slate-900 text-lg">{face.student?.name}</span>
                             {face.message && <span className="text-xs text-emerald-600 font-bold">{face.message}</span>}
                          </motion.div>
                       );
                     } else if (face.state === 'NO_MATCH') {
                       borderColor = 'border-rose-500 border-dashed bg-rose-500/20';
                       innerUI = (
                          <motion.div 
                             initial={{ x: -5 }} animate={{ x: [5, -5, 5, 0] }} transition={{ duration: 0.3 }}
                             className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-rose-50 rounded-xl shadow-xl p-2 flex flex-col items-center border-2 border-rose-500 z-50"
                          >
                             <X className="w-8 h-8 text-rose-500 mb-1" />
                             <span className="font-bold text-rose-700 text-sm">Not Recognized</span>
                          </motion.div>
                       );
                     }

                     return (
                        <motion.div
                           key={tId}
                           initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                           style={{
                              position: 'absolute',
                              top: `${boxY}%`,
                              left: `${leftPct}%`,
                              width: `${boxW}%`,
                              height: `${boxH}%`
                           }}
                           className={`border-4 rounded-xl pointer-events-none z-30 transition-all duration-200 ${borderColor}`}
                        >
                           {innerUI}
                        </motion.div>
                     );
                  })}
                </AnimatePresence>"""

content = content.replace(old_render, new_render)

with open('/Users/sama/Facely/frontend/src/components/Attendance.jsx', 'w') as f:
    f.write(content)
