import React, { useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import { loadModels, getFaceDescriptor } from '../lib/faceApi';

export default function TestPage() {
  const webcamRef = useRef(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [status, setStatus] = useState('Loading models...');
  const [descriptor, setDescriptor] = useState(null);

  useEffect(() => {
    loadModels()
      .then(() => {
        setModelsLoaded(true);
        setStatus('Models loaded. Point camera at a face and click Capture.');
      })
      .catch((err) => {
        console.error(err);
        setStatus('Error loading models.');
      });
  }, []);

  const capture = async () => {
    if (!webcamRef.current || !webcamRef.current.video) return;
    setStatus('Detecting...');
    const result = await getFaceDescriptor(webcamRef.current.video);
    if (result.error) {
      setStatus(result.error);
      setDescriptor(null);
    } else {
      setStatus('Face detected!');
      setDescriptor(result.descriptor);
    }
  };

  return (
    <div className="p-8 max-w-xl mx-auto flex flex-col items-center">
      <h1 className="text-2xl font-bold mb-4">Face Detection Test</h1>
      <p className="mb-4 text-gray-700">{status}</p>
      
      <div className="relative mb-4 bg-gray-200 rounded overflow-hidden" style={{ width: 400, height: 300 }}>
        {modelsLoaded ? (
          <Webcam
            ref={webcamRef}
            audio={false}
            width={400}
            height={300}
            screenshotFormat="image/jpeg"
            videoConstraints={{ facingMode: "user" }}
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full">Loading...</div>
        )}
      </div>

      <button 
        onClick={capture}
        disabled={!modelsLoaded}
        className="px-4 py-2 bg-blue-600 text-white rounded shadow disabled:opacity-50 hover:bg-blue-700"
      >
        Capture & Detect
      </button>

      {descriptor && (
        <div className="mt-4 p-4 bg-gray-100 rounded w-full overflow-x-auto text-xs">
          <p className="font-bold mb-2">Descriptor (first 10 of 128):</p>
          <pre>{JSON.stringify(descriptor.slice(0, 10), null, 2)} ...</pre>
        </div>
      )}
    </div>
  );
}
