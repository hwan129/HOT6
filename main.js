import { Bodies, Body, Engine, Events, Render, Runner, World } from "matter-js";
import { FRUITS_BASE, FRUITS_HLW } from "./fruits";
import "./dark.css";
import * as faceapi from "face-api.js";

// 설정
let THEME = "base"; // { base, halloween }
let FRUITS = THEME === "halloween" ? FRUITS_HLW : FRUITS_BASE;

// 엔진 및 렌더러 설정
const engine = Engine.create();
const render = Render.create({
  engine,
  element: document.getElementById("game-container"),
  options: {
    wireframes: false,
    background: "#F7F4C8",
    width: 620,
    height: 850,
  },
});

// 비디오 설정
const video = document.getElementById("video");

let maxExpression = null;
let disableAction = false;
let interval = null;

// 비디오 시작 함수
function startVideo() {
  navigator.mediaDevices
    .getUserMedia({ video: {} })
    .then((stream) => {
      video.srcObject = stream;
      video.addEventListener("loadedmetadata", () => {
        const canvas = faceapi.createCanvasFromMedia(video);
        document.getElementById("video-container").append(canvas);
        const displaySize = { width: video.width, height: video.height };
        faceapi.matchDimensions(canvas, displaySize);

        setInterval(async () => {
          const detections = await faceapi
            .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
            .withFaceExpressions();

          if (detections.length > 0) {
            const expressions = Object.entries(detections[0].expressions);
            const max = expressions.reduce((a, b) => (a[1] > b[1] ? a : b));
            maxExpression = max[0];
            console.log(`Max expression: ${maxExpression}, Score: ${max[1]}`);
            handleExpression(maxExpression);
          }

          const resizedDetections = faceapi.resizeResults(
            detections,
            displaySize
          );
          const ctx = canvas.getContext("2d");
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          faceapi.draw.drawDetections(canvas, resizedDetections);
          faceapi.draw.drawFaceExpressions(canvas, resizedDetections);
        }, 100);
      });
    })
    .catch((err) => console.error(err));
}

// 표정에 따른 게임 제어 함수
function handleExpression(expression) {
  if (disableAction) return;

  switch (expression) {
    case "happy":
      startInterval(-0.5);
      break;
    case "surprised":
      startInterval(0.5);
      break;
    case "angry":
    case "sad":
      dropFruit();
      break;
    default:
      clearInterval(interval);
      interval = null;
  }
}

// 움직임 인터벌 시작 함수
function startInterval(direction) {
  if (interval) return;
  interval = setInterval(() => {
    if (
      (direction < 0 && currentBody.position.x - currentFruit.radius > 30) ||
      (direction > 0 && currentBody.position.x + currentFruit.radius < 590)
    ) {
      Body.setPosition(currentBody, {
        x: currentBody.position.x + direction,
        y: currentBody.position.y,
      });
    }
  }, 2);
}

// 과일 떨어뜨리기 함수
function dropFruit() {
  currentBody.isSleeping = false;
  disableAction = true;
  setTimeout(() => {
    addFruit();
    disableAction = false;
  }, 1000);
}

// 모델 로드 및 비디오 시작
Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
  faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
  faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
  faceapi.nets.faceExpressionNet.loadFromUri("/models"),
]).then(startVideo);

// 월드 설정
const world = engine.world;

const walls = [
  Bodies.rectangle(15, 395, 30, 790, {
    isStatic: true,
    render: { fillStyle: "#E6B143" },
  }),
  Bodies.rectangle(605, 395, 30, 790, {
    isStatic: true,
    render: { fillStyle: "#E6B143" },
  }),
  Bodies.rectangle(310, 820, 620, 60, {
    isStatic: true,
    render: { fillStyle: "#E6B143" },
  }),
  Bodies.rectangle(310, 150, 620, 2, {
    name: "topLine",
    isStatic: true,
    isSensor: true,
    render: { fillStyle: "#E6B143" },
  }),
];
World.add(world, walls);

Render.run(render);
Runner.run(engine);

let currentBody = null;
let currentFruit = null;

// 과일 추가 함수
function addFruit() {
  const index = Math.floor(Math.random() * 5);
  const fruit = FRUITS[index];

  currentBody = Bodies.circle(300, 50, fruit.radius, {
    index,
    isSleeping: true,
    render: { sprite: { texture: `${fruit.name}.png` } },
    restitution: 0.2,
  });

  currentFruit = fruit;
  World.add(world, currentBody);
}

// 키보드 이벤트
window.onkeydown = (event) => {
  if (disableAction) return;

  switch (event.code) {
    case "KeyA":
      startInterval(-1);
      break;
    case "KeyD":
      startInterval(1);
      break;
    case "KeyS":
      dropFruit();
      break;
  }
};

window.onkeyup = () => {
  clearInterval(interval);
  interval = null;
};

// 충돌 이벤트
Events.on(engine, "collisionStart", (event) => {
  event.pairs.forEach(({ bodyA, bodyB, collision }) => {
    if (bodyA.index === bodyB.index && bodyA.index !== undefined) {
      if (bodyA.index < FRUITS.length - 1) {
        World.remove(world, [bodyA, bodyB]);
        const newFruit = FRUITS[bodyA.index + 1];
        const newBody = Bodies.circle(
          collision.supports[0].x,
          collision.supports[0].y,
          newFruit.radius,
          {
            render: { sprite: { texture: `${newFruit.name}.png` } },
            index: bodyA.index + 1,
          }
        );
        World.add(world, newBody);
      }
    } else if (
      !disableAction &&
      (bodyA.name === "topLine" || bodyB.name === "topLine")
    ) {
      alert("Game over");
    }
  });
});

addFruit();
