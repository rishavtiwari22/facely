import * as faceapi from 'face-api.js';

export const loadModels = async () => {
  const MODEL_URL = '/models';
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
  ]);
};

export const getFaceDescriptor = async (videoElement) => {
  try {
    const detections = await faceapi.detectAllFaces(
      videoElement,
      new faceapi.TinyFaceDetectorOptions()
    ).withFaceLandmarks().withFaceDescriptors();

    if (!detections || detections.length === 0) {
      return { error: 'No face detected. Please face the camera.', descriptor: null };
    }
    
    if (detections.length > 1) {
      return { error: 'Multiple faces detected. Please ensure only one person is in frame.', descriptor: null };
    }

    // descriptor is a Float32Array, convert to regular array for JSON stringification and storage
    return { error: null, descriptor: Array.from(detections[0].descriptor) };
  } catch (error) {
    return { error: error.message || 'An error occurred', descriptor: null };
  }
};
