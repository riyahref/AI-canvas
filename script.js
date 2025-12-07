import {
  FilesetResolver,
  GestureRecognizer,
  DrawingUtils,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.js";

const video = document.querySelector("video");
const landmarkCanvas = document.getElementById("landmark");
const landmarkCTX = landmarkCanvas.getContext("2d");
const drawingCanvas = document.getElementById("drawing");
const drawingCTX = drawingCanvas.getContext("2d");



let prevX = null, prevY = null;
let setValue;

const SMOOTHING_FACTOR = 0.5;
const PINCH_THRESHOLD = 30;

let gestureRecognizer;

async function getVideo() {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: true,
  });
  video.srcObject = stream;
}

async function startGestureRecognition() {
  if (gestureRecognizer) return;

  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
  );

  gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-tasks/gesture_recognizer/gesture_recognizer.task",
    },
    runningMode: "video",
    numHands: 2,
  });

  videoRecognition();
}

async function videoRecognition() {
  let lastVideoTime = -1;
  function renderLoop() {
    if (video.currentTime !== lastVideoTime) {
      const timestamp = Math.round(video.currentTime * 1000);

      const gestureRecognitionResult = gestureRecognizer.recognizeForVideo(
        video,
        timestamp
      );

      processResult(gestureRecognitionResult);
      lastVideoTime = video.currentTime;
    }
    requestAnimationFrame(() => {
      renderLoop();
    });
  }

  renderLoop();
}

async function processResult(result) {
  const gestureName = result?.gestures?.[0]?.[0]?.categoryName;
  if (gestureName === "Thumb_Down") {
    drawingCTX.clearRect(0, 0, video.videoWidth, video.videoHeight);
  }
  drawLandmark(result.landmarks);
}

async function drawLandmark(landmarks) {
  if (!landmarks || landmarks.length === 0) {
    landmarkCTX.clearRect(0, 0, landmarkCanvas.width, landmarkCanvas.height);
    return;
  }

  const width = video.videoWidth || video.width || landmarkCanvas.width;
  const height = video.videoHeight || video.height || landmarkCanvas.height;

  if (landmarkCanvas.width !== width || landmarkCanvas.height !== height) {
    landmarkCanvas.width = width;
    landmarkCanvas.height = height;
  }
  if (drawingCanvas.width !== width || drawingCanvas.height !== height) {
    drawingCanvas.width = width;
    drawingCanvas.height = height;
  }

  landmarkCTX.clearRect(0, 0, width, height);

  const drawingUtils = new DrawingUtils(landmarkCTX);

  const thumbTip = landmarks[0][4];
  const indexTip = landmarks[0][8];

  const dx = (thumbTip.x - indexTip.x) * width;
  const dy = (thumbTip.y - indexTip.y) * height;

  const distance = Math.sqrt(dx * dx + dy * dy);

  const isPinching = distance <= PINCH_THRESHOLD;

  if (isPinching) {
    const x = indexTip.x * width;
    const y = indexTip.y * height;
    drawLine(x, y);
  }

  for (let i = 0; i < landmarks.length; i++) {
    const handLandmarks = landmarks[i];

    if (!handLandmarks || handLandmarks.length === 0) continue;

    drawingUtils.drawConnectors(
      handLandmarks,
      GestureRecognizer.HAND_CONNECTIONS,
      {
        color: "green",
        lineWidth: 2,
      }
    );

    // drawLandmarks expects a single hand's landmarks
    drawingUtils.drawLandmarks(handLandmarks, {
      color: "#FFFFFF",
      lineWidth: 1,
      radius: 2,
    });
  }
}

const drawLine = (x, y) => {
  if (prevX === null || prevY === null) {
    prevX = x;
    prevY = y;
    return;
  }

  const smoothedX = prevX + SMOOTHING_FACTOR * (x - prevX);
  const smoothedY = prevY + SMOOTHING_FACTOR * (y - prevY);

  drawingCTX.beginPath();
  drawingCTX.lineWidth = 4;
  drawingCTX.strokeStyle = "#00FF88";
  drawingCTX.lineCap = "rounded"; // Basic line cap
  drawingCTX.lineJoin = "miter"; // Basic line join
  drawingCTX.shadowBlur = 10; // Remove shadow for a flat look
  drawingCTX.shadowColor = "blue";
  drawingCTX.moveTo(prevX, prevY);
  drawingCTX.lineTo(smoothedX, smoothedY);
  drawingCTX.stroke();

  prevX = smoothedX;
  prevY = smoothedY;

  clearTimeout(setValue);
  setValue = setTimeout(() => {
    prevX = null;
    prevY = null;
  }, 100);
};

getVideo().then(() => {
  video.onloadeddata = () => {
    startGestureRecognition(); // <-- load AFTER video metadata is ready
  };
});