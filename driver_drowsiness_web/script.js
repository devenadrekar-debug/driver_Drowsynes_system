const videoElement = document.getElementById("video");
const canvasElement = document.getElementById("output");
const canvasCtx = canvasElement.getContext("2d");
const statusText = document.getElementById("status");
const alarmSound = document.getElementById("alarm");

let EAR_THRESHOLD = 0.25;
let MAR_THRESHOLD = 0.65;
let earCounter = 0, marCounter = 0;
let alarmPlaying = false;

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function eyeAspectRatio(eye) {
  const A = distance(eye[1], eye[5]);
  const B = distance(eye[2], eye[4]);
  const C = distance(eye[0], eye[3]);
  return (A + B) / (2.0 * C);
}

function mouthAspectRatio(mouth) {
  const vertical = distance(mouth[0], mouth[1]);
  const horizontal = distance(mouth[2], mouth[3]);
  return vertical / horizontal;
}

// Eye and mouth landmark indices (same as Mediapipe FaceMesh)
const LEFT_EYE = [33, 160, 158, 133, 153, 144];
const RIGHT_EYE = [362, 385, 387, 263, 373, 380];
const MOUTH = [13, 14, 78, 308];

function onResults(results) {
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

  if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
    const landmarks = results.multiFaceLandmarks[0];

    const leftEye = LEFT_EYE.map(i => landmarks[i]);
    const rightEye = RIGHT_EYE.map(i => landmarks[i]);
    const mouth = MOUTH.map(i => landmarks[i]);

    const leftEAR = eyeAspectRatio(leftEye);
    const rightEAR = eyeAspectRatio(rightEye);
    const ear = (leftEAR + rightEAR) / 2;
    const mar = mouthAspectRatio(mouth);

    // Draw landmarks
    canvasCtx.fillStyle = "yellow";
    for (const p of leftEye.concat(rightEye)) {
      canvasCtx.beginPath();
      canvasCtx.arc(p.x * canvasElement.width, p.y * canvasElement.height, 2, 0, 2 * Math.PI);
      canvasCtx.fill();
    }
    canvasCtx.fillStyle = "cyan";
    for (const p of mouth) {
      canvasCtx.beginPath();
      canvasCtx.arc(p.x * canvasElement.width, p.y * canvasElement.height, 2, 0, 2 * Math.PI);
      canvasCtx.fill();
    }

    // EAR check
    if (ear < EAR_THRESHOLD) earCounter++;
    else earCounter = 0;

    // MAR check
    if (mar > MAR_THRESHOLD) marCounter++;
    else marCounter = 0;

    let status = "Awake 😃";
    statusText.style.color = "#10b981";

    if (earCounter > 15) {
      status = "Drowsy 😴";
      statusText.style.color = "#ef4444";
      playAlarm();
    } else if (marCounter > 15) {
      status = "Yawning 😪";
      statusText.style.color = "#fbbf24";
      playAlarm();
    } else {
      stopAlarm();
    }

    statusText.innerText = `Status: ${status}`;
  }

  canvasCtx.restore();
}

function playAlarm() {
  if (!alarmPlaying) {
    alarmPlaying = true;
    alarmSound.loop = true;
    alarmSound.play();
  }
}

function stopAlarm() {
  if (alarmPlaying) {
    alarmPlaying = false;
    alarmSound.pause();
    alarmSound.currentTime = 0;
  }
}

// Initialize Mediapipe FaceMesh
const faceMesh = new FaceMesh({
  locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
});
faceMesh.setOptions({
  maxNumFaces: 1,
  refineLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});
faceMesh.onResults(onResults);

// Use webcam
const camera = new Camera(videoElement, {
  onFrame: async () => {
    await faceMesh.send({ image: videoElement });
  },
  width: 640,
  height: 480
});
camera.start();
