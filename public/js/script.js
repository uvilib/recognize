const video = document.getElementById("videoInput");
const containerCanvas = document.getElementById("videoContainer");
const containerImage = document.getElementById("imgContainer");
const listFunction = document.getElementById("list");
const imageUpload = document.getElementById("imageUpload");
const imageUploadModel = document.getElementById("imageUploadModel");
const loader = document.getElementById("loader");
const loaderImage = document.getElementById("loaderImage");
const labelSpan = document.getElementById("label-span");
const addModelsBlock = document.getElementById("addModelsBlock");
const blockModel = document.getElementById("blockModel");
const inputContainer = document.getElementById("inputContainer");
const inputContainer2 = document.getElementById("inputContainer2");
const facesVideoBlock = document.getElementById("facesVideo");
const facesImageBlock = document.getElementById("facesImage");
const nameModel = document.getElementById("nameModel");
const btnUpload = document.getElementById("btnUpload");
const goList = document.getElementById("goList");
const functionsList = document.getElementsByClassName("function");
const unknownObj = document.getElementById("unknownObj");
const unknownBtn = document.getElementById("unknownbtn");
let videoStop = false;

var socket = new WebSocket("ws://localhost:5000");

let labels = [];

async function uploadModels(name, file) {
  var reader = new FileReader();
  reader.onloadend = function () {
    socket.send(JSON.stringify({ name, file: reader.result }));
    alert("Успешно загружено");
  };
  reader.readAsDataURL(file);
}

socket.onmessage = function (event) {
  labels = JSON.parse(event.data);
};

btnUpload.addEventListener("click", () => {
  if (nameModel.value.trim() && imageUploadModel.files[0]) {
    uploadModels(nameModel.value, imageUploadModel.files[0]);
    nameModel.value = "";
  }
});

unknownBtn.addEventListener("click", () => {
  unknownObj.style.opacity = "0";
});

addModelsBlock.addEventListener("click", () => {
  listFunction.style.display = "none";
  blockModel.style.display = "flex";
  inputContainer2.style.display = "block";
});

goList.addEventListener("click", () => {
  location.reload();
});

facesVideoBlock.addEventListener("click", () => {
  listFunction.style.display = "none";
  containerCanvas.style.display = "block";
  startPromise("facesVideo");
});

facesImageBlock.addEventListener("click", () => {
  listFunction.style.display = "none";
  containerImage.style.display = "block";
  startPromise("facesImage");
});

function startPromise(typeRecognition) {
  Promise.all([
    faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
    faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
    faceapi.nets.ssdMobilenetv1.loadFromUri("/models"),
    faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
    faceapi.nets.faceExpressionNet.loadFromUri("/models"),
  ]).then(() => {
    start(typeRecognition);
  });
}

function videoDimensions(video) {
  var videoRatio = video.videoWidth / video.videoHeight;
  var width = video.offsetWidth,
    height = video.offsetHeight;
  var elementRatio = width / height;
  if (elementRatio > videoRatio) width = height * videoRatio;
  else height = width / videoRatio;
  return {
    width: width,
    height: height,
  };
}

async function start(typeRecognition) {
  navigator.mediaDevices
    .getUserMedia({ audio: true, video: true })
    .then(function (stream) {
      video.srcObject = stream;
    })
    .catch(function (e) {
      logError(e.name + ": " + e.message);
    });

  switch (typeRecognition) {
    case "expression":
      recognitionExpressions();
      break;
    case "facesVideo":
      recognizeFaces();
      break;
    case "facesImage":
      recognitionFromImage();
      break;
    default:
      break;
  }
}

async function recognizeFaces() {
  const labeledDescriptors = await loadLabeledImages();
  setTimeout(async () => {
    loader.style.display = "none";
    video.style.display = "block";
    video.play();
  }, 3000);
  const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.7);
  video.addEventListener("play", async () => {
    const canvas = faceapi.createCanvasFromMedia(video);
    containerCanvas.append(canvas);
    const videoSize = await videoDimensions(video);
    const displaySize = { ...videoSize };
    faceapi.matchDimensions(canvas, displaySize);
    let isUnknown = false;
    setInterval(async () => {
      const detections = await faceapi
        .detectAllFaces(video)
        .withFaceLandmarks()
        .withFaceDescriptors();
      const resizedDetections = faceapi.resizeResults(detections, displaySize);
      canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
      const results = resizedDetections.map((d) => {
        return faceMatcher.findBestMatch(d.descriptor);
      });
      // console.log(results);
      results.map((item) => {
        item._label === "unknown" ? (isUnknown = true) : (isUnknown = false);
      });
      results.forEach((result, i) => {
        const box = resizedDetections[i].detection.box;
        const drawBox = new faceapi.draw.DrawBox(box, {
          label: result.toString(),
        });
        drawBox.draw(canvas);
      });
      if (isUnknown) {
        unknownObj.style.opacity = "1";
      }
      if (isUnknown === false) {
        unknownObj.style.opacity = "0";
      }
    }, 100);
  });
}

function getFaceLabel(arr) {
  switch (arr.length) {
    case 1:
      return "лицо";
      break;
    case 2:
    case 3:
    case 4:
      return "лица";
    default:
      return "лиц";
      break;
  }
}

function loadLabeledImages() {
  const faces = getFaceLabel(labels);
  labelSpan.append("Загружено " + labels.length + " " + faces);
  return Promise.all(
    labels.map(async (label) => {
      const descriptions = [];
      for (let i = 1; i <= 1; i++) {
        const img = await faceapi.fetchImage(
          `../labeled_images/${label}/${i}.jpg`
        );
        const detections = await faceapi
          .detectSingleFace(img)
          .withFaceLandmarks()
          .withFaceDescriptor();
        descriptions.push(detections.descriptor);
        console.log(detections);
      }
      return new faceapi.LabeledFaceDescriptors(label, descriptions);
    })
  );
}

async function recognitionExpressions() {
  setTimeout(async () => {
    const labeledDescriptors = await loadLabeledImages();
    loader.style.display = "none";
    video.style.display = "block";
    video.play();
  }, 3000);
  video.addEventListener("play", async () => {
    const canvas = faceapi.createCanvasFromMedia(video);
    containerCanvas.append(canvas);
    const videoSize = await videoDimensions(video);
    const displaySize = { ...videoSize };
    faceapi.matchDimensions(canvas, displaySize);
    setInterval(async () => {
      const detections = await faceapi
        .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceExpressions();
      const resizedDetections = faceapi.resizeResults(detections, displaySize);
      canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
      faceapi.draw.drawDetections(canvas, resizedDetections);
      faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
      faceapi.draw.drawFaceExpressions(canvas, resizedDetections);
    }, 50);
  });
}

async function recognitionFromImage() {
  const labeledFaceDescriptors = await loadLabeledImages();
  const faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.6);
  let image;
  let canvas;
  loaderImage.style.display = "none";
  inputContainer.style.display = "flex";
  imageUpload.addEventListener("change", async () => {
    if (image) image.remove();
    if (canvas) canvas.remove();
    image = await faceapi.bufferToImage(imageUpload.files[0]);
    containerImage.prepend(image);
    canvas = faceapi.createCanvasFromMedia(image);
    containerImage.prepend(canvas);
    const displaySize = { width: image.width, height: image.height };
    console.log(displaySize);
    faceapi.matchDimensions(canvas, displaySize);
    const detections = await faceapi
      .detectAllFaces(image)
      .withFaceLandmarks()
      .withFaceDescriptors();
    const resizedDetections = faceapi.resizeResults(detections, displaySize);
    const results = resizedDetections.map((d) =>
      faceMatcher.findBestMatch(d.descriptor)
    );
    console.log(results);
    results.forEach((result, i) => {
      const box = resizedDetections[i].detection.box;
      const drawBox = new faceapi.draw.DrawBox(box, {
        label: result.toString(),
      });
      drawBox.draw(canvas);
    });
  });
}
