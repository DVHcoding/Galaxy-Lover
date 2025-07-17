import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import "three/examples/jsm/geometries/TextGeometry.js";
import "three/examples/jsm/loaders/FontLoader.js";

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0, 0.0015);

const camera = new THREE.PerspectiveCamera(
  75, // Field of view
  window.innerWidth / window.innerHeight,
  0.1,
  100000
);
camera.position.set(0, 20, 30);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById("container").appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.2;
controls.enabled = false;
controls.target.set(0, 0, 0);
controls.enablePan = false;
controls.minDistance = 15;
controls.maxDistance = 300;
controls.zoomSpeed = 0.3;
controls.rotateSpeed = 0.3;
controls.update();

function createGlowMaterial(color, size = 128, opacity = 0.55) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2
  );
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  return new THREE.Sprite(material);
}

const centralGlow = createGlowMaterial("rgba(255,255,255,0.8)", 156, 0.25);
centralGlow.scale.set(8, 8, 1);
scene.add(centralGlow);

for (let i = 0; i < 15; i++) {
  const hue = Math.random() * 360;
  const color = `hsla(${hue}, 80%, 50%, 0.6)`;
  const nebula = createGlowMaterial(color, 256);
  nebula.scale.set(100, 100, 1);
  nebula.position.set(
    (Math.random() - 0.5) * 175,
    (Math.random() - 0.5) * 175,
    (Math.random() - 0.5) * 175
  );
  scene.add(nebula);
}

const galaxyParameters = {
  count: 100000,
  arms: 6,
  radius: 100,
  spin: 0.5,
  randomness: 0.2,
  randomnessPower: 20,
  insideColor: new THREE.Color(0xd63ed6),
  outsideColor: new THREE.Color(0x48b8b8),
};

function decodeBase64Unicode(encodedStr) {
  return decodeURIComponent(
    atob(encodedStr)
      .split("")
      .map((char) => {
        return "%" + ("00" + char.charCodeAt(0).toString(16)).slice(-2);
      })
      .join("")
  );
}

function getHeartImagesFromURL() {
  const params = new URLSearchParams(window.location.search);
  const encodedId = params.get("id");
  if (encodedId) {
    const decodedId = decodeBase64Unicode(encodedId);
    const imageUrls = decodedId
      .split(",")
      .map((url) => url.trim())
      .filter(Boolean);
    return imageUrls;
  }
  return null;
}

const heartImages = getHeartImagesFromURL() || [];
const numGroups = heartImages.length;
let pointsPerGroup;
if (numGroups <= 1) {
  pointsPerGroup = 15000;
} else if (numGroups >= 6) {
  pointsPerGroup = 4000;
} else {
  const t = (numGroups - 1) / 5;
  pointsPerGroup = Math.floor(15000 * (1 - t) + 4000 * t);
}

if (pointsPerGroup * numGroups > 100000) {
  pointsPerGroup = Math.floor(100000 / numGroups);
}
console.log(
  `Number of images: ${numGroups}, Points per image: ${pointsPerGroup}`
);

const positions = new Float32Array(300000);
const colors = new Float32Array(300000);
let pointIdx = 0;

for (let i = 0; i < 100000; i++) {
  const radius = Math.pow(Math.random(), 20) * 100;
  const branchAngle = ((i % 6) / 6) * Math.PI * 2;
  const spinAngle = radius * 0.5;
  const randomX = (Math.random() - 0.5) * 0.2 * radius;
  const randomY = (Math.random() - 0.5) * 0.2 * radius * 0.5;
  const randomZ = (Math.random() - 0.5) * 0.2 * radius;
  const totalAngle = branchAngle + spinAngle;

  if (radius < 30 && Math.random() < 0.7) {
    continue;
  }

  const i3 = pointIdx * 3;
  positions[i3] = Math.cos(totalAngle) * radius + randomX;
  positions[i3 + 1] = randomY;
  positions[i3 + 2] = Math.sin(totalAngle) * radius + randomZ;

  const mixedColor = new THREE.Color(0xff66ff);
  mixedColor.lerp(new THREE.Color(0x66ffff), radius / 100);
  mixedColor.multiplyScalar(0.7 + 0.3 * Math.random());
  colors[i3] = mixedColor.r;
  colors[i3 + 1] = mixedColor.g;
  colors[i3 + 2] = mixedColor.b;
  pointIdx++;
}

const galaxyGeometry = new THREE.BufferGeometry();
galaxyGeometry.setAttribute(
  "position",
  new THREE.BufferAttribute(positions.slice(0, pointIdx * 3), 3)
);
galaxyGeometry.setAttribute(
  "color",
  new THREE.BufferAttribute(colors.slice(0, pointIdx * 3), 3)
);

const galaxyMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
    uSize: { value: 50 * renderer.getPixelRatio() },
    uRippleTime: { value: -1 },
    uRippleSpeed: { value: 40 },
    uRippleWidth: { value: 20 },
  },
  vertexShader: `
    uniform float uSize;
    uniform float uTime;
    uniform float uRippleTime;
    uniform float uRippleSpeed;
    uniform float uRippleWidth;

    varying vec3 vColor;

    void main() {
      vColor = color;
      vec4 modelPosition = modelMatrix * vec4(position, 1.0);

      if (uRippleTime > 0.0) {
        float rippleRadius = (uTime - uRippleTime) * uRippleSpeed;
        float particleDist = length(modelPosition.xyz);

        float strength = 1.0 - smoothstep(rippleRadius - uRippleWidth, rippleRadius + uRippleWidth, particleDist);
        strength *= smoothstep(rippleRadius + uRippleWidth, rippleRadius - uRippleWidth, particleDist);

        if (strength > 0.0) {
          vColor += vec3(strength * 2.0);
        }
      }

      vec4 viewPosition = viewMatrix * modelPosition;
      gl_Position = projectionMatrix * viewPosition;
      gl_PointSize = uSize / -viewPosition.z;
    }
  `,
  fragmentShader: `
    varying vec3 vColor;
    void main() {
      float dist = length(gl_PointCoord - vec2(0.5));
      if (dist > 0.5) discard;
      gl_FragColor = vec4(vColor, 1.0);
    }
  `,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  transparent: true,
  vertexColors: true,
});

const galaxy = new THREE.Points(galaxyGeometry, galaxyMaterial);
scene.add(galaxy);

function createNeonTexture(image, size) {
  const pixelRatio = window.devicePixelRatio || 1;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size * pixelRatio;
  canvas.style.width = canvas.style.height = `${size}px`;
  const context = canvas.getContext("2d");
  context.scale(pixelRatio, pixelRatio);

  const aspectRatio = image.width / image.height;
  let drawWidth, drawHeight, offsetX, offsetY;

  if (aspectRatio > 1) {
    drawWidth = size;
    drawHeight = size / aspectRatio;
    offsetX = 0;
    offsetY = (size - drawHeight) / 2;
  } else {
    drawHeight = size;
    drawWidth = size * aspectRatio;
    offsetX = (size - drawWidth) / 2;
    offsetY = 0;
  }

  context.clearRect(0, 0, size, size);
  const cornerRadius = size * 0.1;
  context.save();
  context.beginPath();
  context.moveTo(offsetX + cornerRadius, offsetY);
  context.lineTo(offsetX + drawWidth - cornerRadius, offsetY);
  context.arcTo(
    offsetX + drawWidth,
    offsetY,
    offsetX + drawWidth,
    offsetY + cornerRadius,
    cornerRadius
  );
  context.lineTo(offsetX + drawWidth, offsetY + drawHeight - cornerRadius);
  context.arcTo(
    offsetX + drawWidth,
    offsetY + drawHeight,
    offsetX + drawWidth - cornerRadius,
    offsetY + drawHeight,
    cornerRadius
  );
  context.lineTo(offsetX + cornerRadius, offsetY + drawHeight);
  context.arcTo(
    offsetX,
    offsetY + drawHeight,
    offsetX,
    offsetY + drawHeight - cornerRadius,
    cornerRadius
  );
  context.lineTo(offsetX, offsetY + cornerRadius);
  context.arcTo(
    offsetX,
    offsetY,
    offsetX + cornerRadius,
    offsetY,
    cornerRadius
  );
  context.closePath();
  context.clip();
  context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
  context.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

for (let group = 0; group < numGroups; group++) {
  const groupPositions = new Float32Array(pointsPerGroup * 3);
  const groupColorsNear = new Float32Array(pointsPerGroup * 3);
  const groupColorsFar = new Float32Array(pointsPerGroup * 3);
  let validPointCount = 0;

  for (let i = 0; i < pointsPerGroup; i++) {
    const idx = validPointCount * 3;
    const globalIdx = group * pointsPerGroup + i;
    const radius = Math.pow(Math.random(), 20) * 100;
    if (radius < 30) {
      continue;
    }
    const branchAngle = ((globalIdx % 6) / 6) * Math.PI * 2;
    const spinAngle = radius * 0.5;
    const randomX = (Math.random() - 0.5) * 0.2 * radius;
    const randomY = (Math.random() - 0.5) * 0.2 * radius * 0.5;
    const randomZ = (Math.random() - 0.5) * 0.2 * radius;
    const totalAngle = branchAngle + spinAngle;

    groupPositions[idx] = Math.cos(totalAngle) * radius + randomX;
    groupPositions[idx + 1] = randomY;
    groupPositions[idx + 2] = Math.sin(totalAngle) * radius + randomZ;

    const colorNear = new THREE.Color(0xffffff);
    groupColorsNear[idx] = colorNear.r;
    groupColorsNear[idx + 1] = colorNear.g;
    groupColorsNear[idx + 2] = colorNear.b;

    const colorFar = galaxyParameters.insideColor.clone();
    colorFar.lerp(galaxyParameters.outsideColor, radius / 100);
    colorFar.multiplyScalar(0.7 + 0.3 * Math.random());
    groupColorsFar[idx] = colorFar.r;
    groupColorsFar[idx + 1] = colorFar.g;
    groupColorsFar[idx + 2] = colorFar.b;

    validPointCount++;
  }

  if (validPointCount === 0) {
    continue;
  }

  const groupGeometryNear = new THREE.BufferGeometry();
  groupGeometryNear.setAttribute(
    "position",
    new THREE.BufferAttribute(groupPositions.slice(0, validPointCount * 3), 3)
  );
  groupGeometryNear.setAttribute(
    "color",
    new THREE.BufferAttribute(groupColorsNear.slice(0, validPointCount * 3), 3)
  );

  const groupGeometryFar = new THREE.BufferGeometry();
  groupGeometryFar.setAttribute(
    "position",
    new THREE.BufferAttribute(groupPositions.slice(0, validPointCount * 3), 3)
  );
  groupGeometryFar.setAttribute(
    "color",
    new THREE.BufferAttribute(groupColorsFar.slice(0, validPointCount * 3), 3)
  );

  const posAttr = groupGeometryFar.getAttribute("position");
  let cx = 0,
    cy = 0,
    cz = 0;
  for (let i = 0; i < posAttr.count; i++) {
    cx += posAttr.getX(i);
    cy += posAttr.getY(i);
    cz += posAttr.getZ(i);
  }
  cx /= posAttr.count;
  cy /= posAttr.count;
  cz /= posAttr.count;

  groupGeometryNear.translate(-cx, -cy, -cz);
  groupGeometryFar.translate(-cx, -cy, -cz);

  const img = new window.Image();
  img.crossOrigin = "Anonymous";
  img.src = heartImages[group];
  img.onload = () => {
    const texture = createNeonTexture(img, 256);
    const materialNear = new THREE.PointsMaterial({
      size: 1.8,
      map: texture,
      transparent: false,
      alphaTest: 0.2,
      depthWrite: true,
      depthTest: true,
      blending: THREE.NormalBlending,
      vertexColors: true,
    });
    const materialFar = new THREE.PointsMaterial({
      size: 1.8,
      map: texture,
      transparent: true,
      alphaTest: 0.2,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
    });
    const points = new THREE.Points(groupGeometryFar, materialFar);
    points.position.set(cx, cy, cz);
    points.userData.materialNear = materialNear;
    points.userData.geometryNear = groupGeometryNear;
    points.userData.materialFar = materialFar;
    points.userData.geometryFar = groupGeometryFar;
    scene.add(points);
  };
}

const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
scene.add(ambientLight);

const starGeometry = new THREE.BufferGeometry();
const starPositions = new Float32Array(60000);
for (let i = 0; i < 20000; i++) {
  starPositions[i * 3] = (Math.random() - 0.5) * 900;
  starPositions[i * 3 + 1] = (Math.random() - 0.5) * 900;
  starPositions[i * 3 + 2] = (Math.random() - 0.5) * 900;
}
starGeometry.setAttribute(
  "position",
  new THREE.BufferAttribute(starPositions, 3)
);

const starMaterial = new THREE.PointsMaterial({
  color: 0xffffff,
  size: 0.7,
  transparent: true,
  opacity: 0.7,
  depthWrite: false,
});

const starField = new THREE.Points(starGeometry, starMaterial);
starField.name = "starfield";
starField.renderOrder = 999;
scene.add(starField);

let shootingStars = [];

function createShootingStar() {
  const headGeometry = new THREE.SphereGeometry(2, 32, 32);
  const headMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
  });
  const headMesh = new THREE.Mesh(headGeometry, headMaterial);

  const glowGeometry = new THREE.SphereGeometry(3, 32, 32);
  const glowMaterial = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
    },
    vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vNormal;
      uniform float time;
      void main() {
        float intensity = pow(0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
        gl_FragColor = vec4(1.0, 1.0, 1.0, intensity * (0.8 + sin(time * 5.0) * 0.2));
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
  });
  const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
  headMesh.add(glowMesh);

  const outerGlowGeometry = new THREE.SphereGeometry(10.5, 48, 48);
  const outerGlowMaterial = new THREE.ShaderMaterial({
    uniforms: {
      glowColor: { value: new THREE.Color(0xe0b3ff) },
    },
    vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vNormal;
      uniform vec3 glowColor;
      void main() {
        float intensity = pow(0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
        gl_FragColor = vec4(glowColor, 1.0) * intensity;
      }
    `,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
  });
  const outerGlowMesh = new THREE.Mesh(outerGlowGeometry, outerGlowMaterial);
  planet.add(outerGlowMesh);

  const curve = createRandomCurve();
  const trailPoints = [];
  for (let t = 0; t < 100; t++) {
    trailPoints.push(curve.getPoint(t / 99));
  }

  const trailGeometry = new THREE.BufferGeometry().setFromPoints(trailPoints);
  const trailMaterial = new THREE.LineBasicMaterial({
    color: 0x99eaff,
    transparent: true,
    opacity: 0.7,
    linewidth: 2,
  });
  const trailLine = new THREE.Line(trailGeometry, trailMaterial);

  const shootingStarGroup = new THREE.Group();
  shootingStarGroup.add(headMesh);
  shootingStarGroup.add(trailLine);
  shootingStarGroup.userData = {
    curve,
    progress: 0,
    speed: 0.001 + Math.random() * 0.001,
    life: 0,
    maxLife: 300,
    head: headMesh,
    trail: trailLine,
    trailLength: 100,
    trailPoints,
  };
  scene.add(shootingStarGroup);
  shootingStars.push(shootingStarGroup);
}

function createRandomCurve() {
  const points = [];
  const startPoint = new THREE.Vector3(
    -200 + Math.random() * 100,
    -100 + Math.random() * 200,
    -100 + Math.random() * 200
  );
  const controlPoint1 = new THREE.Vector3(
    600 + Math.random() * 200,
    startPoint.y + (-100 + Math.random() * 200),
    startPoint.z + (-100 + Math.random() * 200)
  );
  const controlPoint2 = new THREE.Vector3(
    startPoint.x + 200 + Math.random() * 100,
    startPoint.y + (-50 + Math.random() * 100),
    startPoint.z + (-50 + Math.random() * 100)
  );
  const endPoint = new THREE.Vector3(
    controlPoint1.x - 200 + Math.random() * 100,
    controlPoint1.y + (-50 + Math.random() * 100),
    controlPoint1.z + (-50 + Math.random() * 100)
  );
  points.push(startPoint, controlPoint2, endPoint, controlPoint1);
  return new THREE.CubicBezierCurve3(
    startPoint,
    controlPoint2,
    endPoint,
    controlPoint1
  );
}

function createPlanetTexture(size = 512) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(
    size / 2,
    size / 2,
    size / 8,
    size / 2,
    size / 2,
    size / 2
  );
  gradient.addColorStop(0, "#f8bbd0");
  gradient.addColorStop(0.12, "#f48fb1");
  gradient.addColorStop(0.22, "#f06292");
  gradient.addColorStop(0.35, "#ffffff");
  gradient.addColorStop(0.5, "#e1aaff");
  gradient.addColorStop(0.62, "#a259f7");
  gradient.addColorStop(0.75, "#b2ff59");
  gradient.addColorStop(1, "#3fd8c7");
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  const colors = [
    "#f8bbd0",
    "#f8bbd0",
    "#f48fb1",
    "#f48fb1",
    "#f06292",
    "#f06292",
    "#ffffff",
    "#e1aaff",
    "#a259f7",
    "#b2ff59",
  ];
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const radius = 30 + Math.random() * 120;
    const color = colors[Math.floor(Math.random() * colors.length)];
    const spotGradient = context.createRadialGradient(x, y, 0, x, y, radius);
    spotGradient.addColorStop(0, color + "cc");
    spotGradient.addColorStop(1, color + "00");
    context.fillStyle = spotGradient;
    context.fillRect(0, 0, size, size);
  }

  for (let i = 0; i < 8; i++) {
    context.beginPath();
    context.moveTo(Math.random() * size, Math.random() * size);
    context.bezierCurveTo(
      Math.random() * size,
      Math.random() * size,
      Math.random() * size,
      Math.random() * size,
      Math.random() * size,
      Math.random() * size
    );
    context.strokeStyle = `rgba(180, 120, 200, ${0.12 + Math.random() * 0.18})`;
    context.lineWidth = 8 + Math.random() * 18;
    context.stroke();
  }

  if (context.filter !== undefined) {
    context.filter = "blur(2px)";
    context.drawImage(canvas, 0, 0);
    context.filter = "none";
  }

  return new THREE.CanvasTexture(canvas);
}

const planetGeometry = new THREE.SphereGeometry(10, 48, 48);
const planetTexture = createPlanetTexture();
const planetMaterial = new THREE.ShaderMaterial({
  uniforms: {
    time: { value: 0 },
    baseTexture: { value: planetTexture },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float time;
    uniform sampler2D baseTexture;
    varying vec2 vUv;
    void main() {
      vec2 uv = vUv;
      float angle = length(uv - vec2(0.5)) * 3.0;
      float twist = sin(angle * 3.0 + time) * 0.1;
      uv.x += twist * sin(time * 0.5);
      uv.y += twist * cos(time * 0.5);
      vec4 texColor = texture2D(baseTexture, uv);
      float noise = sin(uv.x * 10.0 + time) * sin(uv.y * 10.0 + time) * 0.1;
      texColor.rgb += noise * vec3(0.8, 0.4, 0.2);
      gl_FragColor = texColor;
    }
  `,
});

const planet = new THREE.Mesh(planetGeometry, planetMaterial);
planet.position.set(0, 0, 0);
scene.add(planet);

const ringTexts = [
  "Trần Hương ❤️",
  ...(window.dataLove2Loveloom && window.dataLove2Loveloom.data.ringTexts
    ? window.dataLove2Loveloom.data.ringTexts
    : []),
];

function createTextRings() {
  const numRings = ringTexts.length;
  window.textRings = [];
  for (let i = 0; i < numRings; i++) {
    const text = ringTexts[i % ringTexts.length] + "   ";
    const radius = 11 + i * 5;

    function getCharType(char) {
      const code = char.charCodeAt(0);
      if (
        (code >= 0x4e00 && code <= 0x9fff) ||
        (code >= 0x3040 && code <= 0x309f) ||
        (code >= 0x30a0 && code <= 0x30ff) ||
        (code >= 0xac00 && code <= 0xd7af)
      ) {
        return "cjk";
      } else if (code >= 0x0 && code <= 0x7f) {
        return "latin";
      }
      return "other";
    }

    let charCount = { cjk: 0, latin: 0, other: 0 };
    for (let char of text) {
      charCount[getCharType(char)]++;
    }

    const textLength = text.length;
    const cjkRatio = 0 / textLength;
    let config = { fontScale: 0.75, spacingScale: 1.1 };
    if (i === 0) {
      config.fontScale = 0.55;
      config.spacingScale = 0.9;
    } else if (i === 1) {
      config.fontScale = 0.65;
      config.spacingScale = 1;
    }
    if (cjkRatio > 0) {
      config.fontScale *= 0.9;
      config.spacingScale *= 1.1;
    }

    const fontSize = Math.max(120, 180);
    const tempCanvas = document.createElement("canvas");
    const tempContext = tempCanvas.getContext("2d");
    tempContext.font = `bold ${fontSize}px Arial, sans-serif`;
    let displayText = ringTexts[i % ringTexts.length];
    let fullText = displayText + "   ";
    let textWidth = tempContext.measureText(fullText).width;
    let circumference = 2 * Math.PI * radius * 180;
    let repeatCount = Math.ceil(circumference / textWidth);
    let repeatedText = "";
    for (let j = 0; j < repeatCount; j++) {
      repeatedText += fullText;
    }
    let totalTextWidth = textWidth * repeatCount;

    if (totalTextWidth < 1 || !repeatedText) {
      repeatedText = fullText;
      totalTextWidth = textWidth;
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(Math.max(1, totalTextWidth));
    canvas.height = 200;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, 200);
    context.font = `bold ${fontSize}px Arial, sans-serif`;
    context.fillStyle = "white";
    context.textAlign = "left";
    context.textBaseline = "alphabetic";
    context.shadowColor = "#e0b3ff";
    context.shadowBlur = 24;
    context.lineWidth = 6;
    context.strokeStyle = "#fff";
    context.strokeText(repeatedText, 0, 160);
    context.shadowColor = "#ffb3de";
    context.shadowBlur = 16;
    context.fillText(repeatedText, 0, 160);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.repeat.x = totalTextWidth / circumference;
    texture.needsUpdate = true;

    const geometry = new THREE.CylinderGeometry(
      radius,
      radius,
      1,
      128,
      1,
      true
    );
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
      alphaTest: 0.01,
    });
    const ringMesh = new THREE.Mesh(geometry, material);
    ringMesh.position.set(0, 0, 0);
    ringMesh.rotation.y = Math.PI / 2;

    const ringGroup = new THREE.Group();
    ringGroup.add(ringMesh);
    ringGroup.userData = {
      ringRadius: radius,
      angleOffset: 0.15 * Math.PI * 0.5,
      speed: 0.008,
      tiltSpeed: 0,
      rollSpeed: 0,
      pitchSpeed: 0,
      tiltAmplitude: Math.PI / 3,
      rollAmplitude: Math.PI / 6,
      pitchAmplitude: Math.PI / 8,
      tiltPhase: Math.PI * 2,
      rollPhase: Math.PI * 2,
      pitchPhase: Math.PI * 2,
      isTextRing: true,
    };
    ringGroup.rotation.x = (i / numRings) * (Math.PI / 1);
    scene.add(ringGroup);
    window.textRings.push(ringGroup);
  }
}

createTextRings();

function updateTextRingsRotation() {
  if (!window.textRings || !camera) return;
  window.textRings.forEach((ringGroup, index) => {
    ringGroup.children.forEach((ringMesh) => {
      if (ringMesh.userData.initialAngle !== undefined) {
        const angle =
          ringMesh.userData.initialAngle + ringGroup.userData.angleOffset;
        const x = Math.cos(angle) * ringMesh.userData.ringRadius;
        const z = Math.sin(angle) * ringMesh.userData.ringRadius;
        ringMesh.position.set(x, 0, z);
        const worldPos = new THREE.Vector3();
        ringMesh.getWorldPosition(worldPos);
        const direction = new THREE.Vector3()
          .subVectors(camera.position, worldPos)
          .normalize();
        ringMesh.rotation.y = Math.atan2(direction.x, direction.z);
      }
    });
  });
}

function animatePlanetSystem() {
  if (!window.textRings) return;
  const time = Date.now() * 0.001;
  window.textRings.forEach((ringGroup, index) => {
    const data = ringGroup.userData;
    data.angleOffset += data.speed;
    const tilt =
      Math.sin(time * data.tiltSpeed + data.tiltPhase) * data.tiltAmplitude;
    const roll =
      Math.cos(time * data.rollSpeed + data.rollPhase) * data.rollAmplitude;
    const pitch =
      Math.sin(time * data.pitchSpeed + data.pitchPhase) * data.pitchAmplitude;
    ringGroup.rotation.x =
      (index / window.textRings.length) * (Math.PI / 1) + tilt;
    ringGroup.rotation.z = roll;
    ringGroup.rotation.y = data.angleOffset + pitch;
    const verticalOffset =
      Math.sin(time * (data.tiltSpeed * 0.7) + data.tiltPhase) * 0.3;
    ringGroup.position.y = verticalOffset;
    const opacityFactor = (Math.sin(time * 1.5 + index) + 1) / 2;
    const ringMesh = ringGroup.children[0];
    if (ringMesh && ringMesh.material) {
      ringMesh.material.opacity = 0.7 + opacityFactor * 0.3;
    }
  });
  updateTextRingsRotation();
}

let fadeOpacity = 0.1;
let fadeInProgress = false;
let hintIcon;
let hintText;

function createHintIcon() {
  hintIcon = new THREE.Group();
  hintIcon.name = "hint-icon-group";
  scene.add(hintIcon);

  const arrowGroup = new THREE.Group();
  const arrowShape = new THREE.Shape();
  arrowShape.moveTo(0, 0);
  arrowShape.lineTo(-0.3, -1.05);
  arrowShape.lineTo(-0.1875, -1.05);
  arrowShape.lineTo(-0.375, -1.5);
  arrowShape.lineTo(0.375, -1.5);
  arrowShape.lineTo(0.1875, -1.05);
  arrowShape.lineTo(0.3, -1.05);
  arrowShape.closePath();

  const arrowGeometry = new THREE.ShapeGeometry(arrowShape);
  const arrowMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
  });
  const arrowMesh = new THREE.Mesh(arrowGeometry, arrowMaterial);

  const innerArrowGeometry = new THREE.ShapeGeometry(arrowShape);
  const innerArrowMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
  });
  const innerArrowMesh = new THREE.Mesh(innerArrowGeometry, innerArrowMaterial);
  innerArrowMesh.scale.set(0.8, 0.8, 1);
  innerArrowMesh.position.z = 0.01;

  arrowGroup.add(arrowMesh, innerArrowMesh);
  arrowGroup.position.y = 0.75;
  arrowGroup.rotation.x = Math.PI / 2;

  const ringGeometry = new THREE.RingGeometry(1.8, 2, 32);
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.6,
  });
  const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
  ringMesh.rotation.x = Math.PI / 2;

  hintIcon.userData.ringMesh = ringMesh;
  hintIcon.add(arrowGroup, ringMesh);
  hintIcon.position.set(1.5, 1.5, 15);
  hintIcon.scale.set(0.8, 0.8, 0.8);
  hintIcon.lookAt(planet.position);
  hintIcon.userData.initialPosition = hintIcon.position.clone();
}

function animateHintIcon(time) {
  if (!hintIcon) return;
  if (!introStarted) {
    hintIcon.visible = true;
    const offset = Math.sin(time * 2.5) * 1.5;
    const direction = new THREE.Vector3();
    hintIcon.getWorldDirection(direction);
    hintIcon.position
      .copy(hintIcon.userData.initialPosition)
      .addScaledVector(direction, -offset);
    const ringMesh = hintIcon.userData.ringMesh;
    const scale = 1 + Math.sin(time * 2.5) * 0.1;
    ringMesh.scale.set(scale, scale, 1);
    ringMesh.material.opacity = 0.5 + Math.sin(time * 2.5) * 0.2;
    if (hintText) {
      hintText.visible = true;
      hintText.material.opacity = 0.7 + Math.sin(time * 3) * 0.3;
      hintText.position.y = 15 + Math.sin(time * 2) * 0.5;
      hintText.lookAt(camera.position);
    }
  } else {
    hintIcon.visible = false;
    if (hintText) hintText.visible = false;
  }
}

function animate() {
  requestAnimationFrame(animate);
  const time = performance.now() * 0.001;
  animateHintIcon(time);
  controls.update();
  planet.material.uniforms.time.value = time * 0.5;

  if (fadeInProgress && fadeOpacity < 1) {
    fadeOpacity += 0.025;
    if (fadeOpacity > 1) fadeOpacity = 1;
  }

  if (!introStarted) {
    fadeOpacity = 0.1;
    scene.traverse((object) => {
      if (object.name === "starfield") {
        if (object.points && object.material.opacity !== undefined) {
          object.material.transparent = false;
          object.material.opacity = 1;
        }
        return;
      }
      if (
        object.userData.isTextRing ||
        (object.parent &&
          object.parent.userData &&
          object.parent.userData.isTextRing)
      ) {
        if (object.material && object.material.opacity !== undefined) {
          object.material.transparent = false;
          object.material.opacity = 1;
        }
        if (object.material && object.material.color) {
          object.material.color.set(0xffffff);
        }
      } else if (
        object !== planet &&
        object !== centralGlow &&
        object !== hintIcon &&
        object.type !== "Scene" &&
        !object.parent.isGroup
      ) {
        if (object.material && object.material.opacity !== undefined) {
          object.material.transparent = true;
          object.material.opacity = 0.1;
        }
      }
    });
    planet.visible = true;
    centralGlow.visible = true;
  } else {
    scene.traverse((object) => {
      if (
        !(
          object.userData.isTextRing ||
          (object.parent &&
            object.parent.userData &&
            object.parent.userData.isTextRing) ||
          object === planet ||
          object === centralGlow ||
          object.type === "Scene"
        )
      ) {
        if (object.material && object.material.opacity !== undefined) {
          object.material.transparent = true;
          object.material.opacity = fadeOpacity;
        }
      } else if (object.material && object.material.opacity !== undefined) {
        object.material.opacity = 1;
        object.material.transparent = false;
      }
      if (object.material && object.material.color) {
        object.material.color.set(0xffffff);
      }
    });
  }

  for (let i = shootingStars.length - 1; i >= 0; i--) {
    const star = shootingStars[i];
    star.userData.life++;
    let opacity = 1;
    if (star.userData.life < 30) {
      opacity = star.userData.life / 30;
    } else if (star.userData.life > star.userData.maxLife - 30) {
      opacity = (star.userData.maxLife - star.userData.life) / 30;
    }
    star.userData.progress += star.userData.speed;
    if (star.userData.progress > 1) {
      scene.remove(star);
      shootingStars.splice(i, 1);
      continue;
    }
    const position = star.userData.curve.getPoint(star.userData.progress);
    star.position.copy(position);
    star.userData.head.material.opacity = opacity;
    star.userData.head.children[0].material.uniforms.time.value = time;
    const trail = star.userData.trail;
    const trailPoints = star.userData.trailPoints;
    trailPoints[0].copy(position);
    for (let j = 1; j < star.userData.trailLength; j++) {
      const t = Math.max(0, star.userData.progress - j * 0.01);
      trailPoints[j].copy(star.userData.curve.getPoint(t));
    }
    trail.geometry.setFromPoints(trailPoints);
    trail.material.opacity = opacity * 0.7;
  }

  if (shootingStars.length < 3 && Math.random() < 0.02) {
    createShootingStar();
  }

  scene.traverse((object) => {
    if (
      object.isPoints &&
      object.userData.materialNear &&
      object.userData.materialFar
    ) {
      const positions = object.geometry.getAttribute("position");
      let isNear = false;
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i) + object.position.x;
        const y = positions.getY(i) + object.position.y;
        const z = positions.getZ(i) + object.position.z;
        const distance = camera.position.distanceTo(new THREE.Vector3(x, y, z));
        if (distance < 10) {
          isNear = true;
          break;
        }
      }
      if (isNear) {
        if (object.material !== object.userData.materialNear) {
          object.material = object.userData.materialNear;
          object.geometry = object.userData.geometryNear;
        }
      } else if (object.material !== object.userData.materialFar) {
        object.material = object.userData.materialFar;
        object.geometry = object.userData.geometryFar;
      }
    }
  });

  planet.lookAt(camera.position);
  animatePlanetSystem();

  if (
    starField &&
    starField.material &&
    starField.material.opacity !== undefined
  ) {
    starField.material.opacity = 1;
    starField.material.transparent = false;
  }

  renderer.render(scene, camera);
}

function createHintText() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const context = canvas.getContext("2d");
  context.font = "bold 50px Arial, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.shadowColor = "#ffb3de";
  context.shadowBlur = 5;
  context.lineWidth = 2;
  context.strokeStyle = "rgba(255, 200, 220, 0.8)";
  context.strokeText("Chạm Vào Tinh Cầu", 256, 256);
  context.shadowColor = "#e0b3ff";
  context.shadowBlur = 5;
  context.strokeStyle = "rgba(220, 180, 255, 0.5)";
  context.strokeText("Chạm Vào Tinh Cầu", 256, 256);
  context.shadowColor = "transparent";
  context.shadowBlur = 0;
  context.fillStyle = "white";
  context.fillText("Chạm Vào Tinh Cầu", 256, 256);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide,
  });
  const geometry = new THREE.PlaneGeometry(16, 8);
  hintText = new THREE.Mesh(geometry, material);
  hintText.position.set(0, 15, 0);
  scene.add(hintText);
}

createShootingStar();
createHintIcon();
createHintText();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  controls.target.set(0, 0, 0);
  controls.update();
});

function startCameraAnimation() {
  const startPos = {
    x: camera.position.x,
    y: camera.position.y,
    z: camera.position.z,
  };
  const phase1Pos = { x: startPos.x, y: 0, z: startPos.z };
  const phase2Pos = { x: startPos.x, y: 0, z: 160 };
  const finalPos = { x: -40, y: 100, z: 100 };
  let progress = 0;

  function updateCamera() {
    progress += 0.00101;
    let newPos;
    if (progress < 0.2) {
      let t = progress / 0.2;
      newPos = {
        x: startPos.x + (phase1Pos.x - startPos.x) * t,
        y: startPos.y + (0 - startPos.y) * t,
        z: startPos.z + (phase1Pos.z - startPos.z) * t,
      };
    } else if (progress < 0.75) {
      let t = (progress - 0.2) / 0.55;
      newPos = {
        x: phase1Pos.x + (phase2Pos.x - phase1Pos.x) * t,
        y: 0 + 0 * t,
        z: phase1Pos.z + (160 - phase1Pos.z) * t,
      };
    } else if (progress < 1.15) {
      let t = (progress - 0.2 - 0.55) / 0.4;
      let easedT = 0.5 - 0.5 * Math.cos(Math.PI * t);
      newPos = {
        x: phase2Pos.x + (finalPos.x - phase2Pos.x) * easedT,
        y: 0 + 100 * easedT,
        z: 160 + -60 * easedT,
      };
    } else {
      camera.position.set(finalPos.x, 100, 100);
      camera.lookAt(0, 0, 0);
      controls.target.set(0, 0, 0);
      controls.update();
      controls.enabled = true;
      return;
    }
    camera.position.set(newPos.x, newPos.y, newPos.z);
    camera.lookAt(0, 0, 0);
    requestAnimationFrame(updateCamera);
  }

  controls.enabled = false;
  updateCamera();
}

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let introStarted = false;
const originalStarCount = starGeometry.getAttribute("position").count;

if (starField && starField.geometry) {
  starField.geometry.setDrawRange(0, Math.floor(originalStarCount * 0.1));
}

function requestFullScreen() {
  const element = document.documentElement;
  if (element.requestFullscreen) {
    element.requestFullscreen();
  } else if (element.mozRequestFullScreen) {
    element.mozRequestFullScreen();
  } else if (element.webkitRequestFullscreen) {
    element.webkitRequestFullscreen();
  } else if (element.msRequestFullscreen) {
    element.msRequestFullscreen();
  }
}

function onCanvasClick(event) {
  if (introStarted) return;
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(planet);
  if (intersects.length > 0) {
    requestFullScreen();
    introStarted = true;
    fadeInProgress = true;
    document.body.classList.add("intro-started");
    startCameraAnimation();
    if (starField && starField.geometry) {
      starField.geometry.setDrawRange(0, originalStarCount);
    }
  } else if (introStarted) {
    const heartIntersects = raycaster.intersectObjects(heartPointClouds);
    if (heartIntersects.length > 0) {
      const target = heartIntersects[0].object;
      controls.target.copy(target.position);
    }
  }
}

renderer.domElement.addEventListener("click", onCanvasClick);
animate();
planet.name = "main-planet";
centralGlow.name = "main-glow";

function setFullScreen() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty("--vh", `${vh}px`);
  const container = document.getElementById("container");
  if (container) {
    container.style.height = `${window.innerHeight}px`;
  }
}

window.addEventListener("resize", setFullScreen);
window.addEventListener("orientationchange", () => {
  setTimeout(setFullScreen, 300);
});
setFullScreen();

const preventDefault = (event) => event.preventDefault();
document.addEventListener("touchmove", preventDefault, { passive: false });
document.addEventListener("gesturestart", preventDefault, { passive: false });

const container = document.getElementById("container");
if (container) {
  container.addEventListener("touchmove", preventDefault, { passive: false });
}

function checkOrientation() {
  const isPortrait =
    window.innerHeight > window.innerWidth && "ontouchstart" in window;
  if (isPortrait) {
    document.body.classList.add("portrait-mode");
  } else {
    document.body.classList.remove("portrait-mode");
  }
}

window.addEventListener("DOMContentLoaded", checkOrientation);
window.addEventListener("resize", checkOrientation);
window.addEventListener("orientationchange", () => {
  setTimeout(checkOrientation, 200);
});
