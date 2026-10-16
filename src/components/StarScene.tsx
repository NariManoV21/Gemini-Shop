/**
 * ستاره‌ی کریستالی سه‌بعدی بازطراحی‌شده و بهینه‌سازی‌شده (Three.js) + GSAP ScrollTrigger.
 *
 * - بازگردانی کامل رنگ‌بندی اولیه لوگوی جمینای (آبی #2f6bff، بنفش #8a7bff، صورتی #f0a0f0 و حاشیه #2446e6).
 * - لبه‌های صیقلی، نرم و فیله‌شده (بدون توخالی شدن یا شکستگی هندسی).
 * - چرخش ۳۶۰ درجه پیوسته و هماهنگ با اسکرول تا نشستن در هدر.
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useReducedMotion } from '../hooks/useReducedMotion';
import './StarScene.css';

gsap.registerPlugin(ScrollTrigger);

const TAU = Math.PI * 2;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = gsap.parseEase('power2.inOut');
const easeSpin = gsap.parseEase('power1.inOut');

/**
 * شکل ستاره‌ی چهارپر با نوک‌های منحنی و لبه‌های نرم ارگانیک
 * متناسب با فرم بالشتکی و صیقلی رفرنس (firstframe.jpg)
 */
function roundedStarShape(): THREE.Shape {
  const s = new THREE.Shape();
  const tipR = 1.0;
  const tipFillet = 0.065; // گرد کردن نوک ۴ پره جهت حذف تیزی و پخ‌خوردگی نامطلوب
  const waistK = 0.09;
  const waistQ = 0.43;

  // نوک بالا با انحنای گرد
  s.moveTo(-tipFillet, tipR - tipFillet * 0.35);
  s.quadraticCurveTo(0, tipR, tipFillet, tipR - tipFillet * 0.35);
  // انحنای مقعر به سمت راست
  s.bezierCurveTo(waistK, waistQ, waistQ, waistK, tipR * 1.02 - tipFillet * 0.35, tipFillet);
  // نوک راست با انحنای گرد
  s.quadraticCurveTo(tipR * 1.02, 0, tipR * 1.02 - tipFillet * 0.35, -tipFillet);
  // انحنای مقعر به سمت پایین
  s.bezierCurveTo(waistQ, -waistK, waistK, -waistQ, tipFillet, -tipR + tipFillet * 0.35);
  // نوک پایین با انحنای گرد
  s.quadraticCurveTo(0, -tipR, -tipFillet, -tipR + tipFillet * 0.35);
  // انحنای مقعر به سمت چپ
  s.bezierCurveTo(-waistK, -waistQ, -waistQ, -waistK, -tipR * 1.02 + tipFillet * 0.35, -tipFillet);
  // نوک چپ با انحنای گرد
  s.quadraticCurveTo(-tipR * 1.02, 0, -tipR * 1.02 + tipFillet * 0.35, tipFillet);
  // بازگشت به نوک بالا
  s.bezierCurveTo(-waistQ, waistK, -waistK, waistQ, -tipFillet, tipR - tipFillet * 0.35);

  return s;
}

/**
 * رنگ‌بندی اصیل لوگوی جمینای (Google Gemini Original Colors)
 * گرادیان آبی (#2f6bff) -> بنفش (#8a7bff) -> صورتی (#f0a0f0) روی رأس‌ها و لبه پخ‌خورده آبی عمیق (#2446e6)
 */
function paintGradient(geo: THREE.BufferGeometry) {
  geo.computeBoundingBox();
  const zMax = geo.boundingBox!.max.z;
  const pos = geo.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  const stops = [
    new THREE.Color('#2f6bff'), // آبی جمینای
    new THREE.Color('#8a7bff'), // بنفش جمینای
    new THREE.Color('#f0a0f0'), // صورتی جمینای
  ];
  const rim = new THREE.Color('#2446e6'); // لبه عمیق نیلگون
  const c = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = Math.abs(pos.getZ(i));

    const t = THREE.MathUtils.clamp(0.5 + x * 0.36 + y * 0.2, 0, 1);
    if (t < 0.5) {
      c.copy(stops[0]).lerp(stops[1], t * 2);
    } else {
      c.copy(stops[1]).lerp(stops[2], (t - 0.5) * 2);
    }

    const edge = THREE.MathUtils.smoothstep(1 - z / zMax, 0.15, 0.85); // ۰ روی سطح صاف، ۱ روی لبه
    c.lerp(rim, edge * 0.55);

    colors.set([c.r, c.g, c.b], i * 3);
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

export function StarScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current!;
    const state = { p: 0 };
    const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
    let start = { x: 0, y: 0, size: 400 };
    let w = window.innerWidth,
      h = window.innerHeight;

    // ---------- WebGL Renderer ----------
    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      });
    } catch {
      renderer = null;
    }
    const ctx2d = renderer ? null : canvas.getContext('2d');

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, -2000, 2000);
    camera.position.z = 10;

    const star = new THREE.Group();
    scene.add(star);

    let geo: THREE.BufferGeometry | null = null;
    let mat: THREE.MeshPhysicalMaterial | null = null;

    if (renderer) {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;
      renderer.outputColorSpace = THREE.SRGBColorSpace;

      // محیط بازتابی طبیعی
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

      // ژئومتری ستاره با پخ‌خوردگی بالشتکی نرم و بدون تداخل
      const shape = roundedStarShape();
      geo = new THREE.ExtrudeGeometry(shape, {
        depth: 0.16,
        curveSegments: 64,
        bevelEnabled: true,
        bevelThickness: 0.18,
        bevelSize: 0.075,
        bevelOffset: -0.01,
        bevelSegments: 20, // ۲۰ سگمنت در پخ برای نرمی ابریشمی
      });
      geo.center();
      geo = mergeVertices(geo, 1e-4);
      geo.computeVertexNormals();

      // اعمال رنگ‌بندی اولیه لوگوی جمینای
      paintGradient(geo);

      // متریال کریستال فیزیکی با جلای شیشه‌ای و رنگ‌های اولیه
      mat = new THREE.MeshPhysicalMaterial({
        vertexColors: true,
        metalness: 0.15,
        roughness: 0.08,
        clearcoat: 1.0,
        clearcoatRoughness: 0.02,
        iridescence: 0.75,
        iridescenceIOR: 1.5,
        iridescenceThicknessRange: [180, 520],
        envMapIntensity: 1.25,
        side: THREE.DoubleSide,
      });

      const starMesh = new THREE.Mesh(geo, mat);
      star.add(starMesh);

      // نورپردازی استودیویی
      scene.add(new THREE.AmbientLight('#ffffff', 1.2));

      // نور خورشیدی مورب از بالا-چپ
      const sunLight = new THREE.DirectionalLight('#ffffff', 2.2);
      sunLight.position.set(-w * 0.4, h * 0.55, 500);
      scene.add(sunLight);

      // نور آسمانی مکمل از پایین-راست
      const fillLight = new THREE.DirectionalLight('#9fb4ff', 1.2);
      fillLight.position.set(w * 0.35, -h * 0.3, 400);
      scene.add(fillLight);
    }

    // ---------- محاسبه مختصات شروع و پایان ----------
    const measure = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      if (renderer) {
        renderer.setSize(w, h, false);
        camera.left = -w / 2;
        camera.right = w / 2;
        camera.top = h / 2;
        camera.bottom = -h / 2;
        camera.updateProjectionMatrix();
      } else {
        const dpr = Math.min(window.devicePixelRatio, 2);
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      const slot = document.getElementById('star-slot');
      if (slot) {
        const r = slot.getBoundingClientRect();
        start = {
          x: r.left + r.width / 2,
          y: r.top + window.scrollY + r.height / 2,
          size: r.width,
        };
      }
    };

    const render = () => {
      const logo = document.getElementById('logo-star-slot');
      const lr = logo?.getBoundingClientRect();
      const end = lr
        ? { x: lr.left + lr.width / 2, y: lr.top + lr.height / 2, size: lr.width }
        : { x: w - 60, y: 40, size: 34 };

      const p = state.p;
      const m = ease(p);
      const x = lerp(start.x, end.x, m);
      const y = lerp(start.y, end.y, m);
      const size = lerp(start.size, end.size, m);
      const spin = reduced ? 0 : easeSpin(p) * TAU; // چرخش ۳۶۰ درجه
      const idle = 1 - Math.min(p * 8, 1);

      pointer.sx += (pointer.x - pointer.sx) * 0.08;
      pointer.sy += (pointer.y - pointer.sy) * 0.08;
      const tiltY = reduced ? 0 : pointer.sx * 0.28 * idle;
      const tiltX = reduced ? 0 : Math.sin(p * Math.PI) * 0.18 - pointer.sy * 0.18 * idle;

      if (renderer) {
        star.position.set(x - w / 2, h / 2 - y, 0);
        star.scale.setScalar(size / 2);
        star.rotation.set(tiltX, spin + tiltY, 0);
        renderer.render(scene, camera);
      } else if (ctx2d) {
        drawFallback(ctx2d, w, h, x, y, size, spin);
      }
    };

    // ---------- اسکرول با GSAP ScrollTrigger ----------
    const tween = gsap.to(state, {
      p: 1,
      ease: 'none',
      onUpdate: render,
      scrollTrigger: {
        trigger: document.body,
        start: 'top top',
        end: () => `+=${Math.round(window.innerHeight * 0.95)}`,
        scrub: reduced ? true : 0.7,
        invalidateOnRefresh: true,
        onRefresh: () => {
          measure();
          render();
        },
      },
    });

    const onMove = (e: PointerEvent) => {
      pointer.x = (e.clientX / w - 0.5) * 2;
      pointer.y = (e.clientY / h - 0.5) * 2;
    };

    const idleTick = () => {
      if (reduced || state.p >= 0.01) return;
      if (Math.abs(pointer.x - pointer.sx) + Math.abs(pointer.y - pointer.sy) > 0.002) {
        render();
      }
    };

    const onResize = () => {
      measure();
      ScrollTrigger.refresh();
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('resize', onResize);
    gsap.ticker.add(idleTick);
    document.fonts?.ready.then(() => {
      measure();
      ScrollTrigger.refresh();
    });

    measure();
    render();

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('resize', onResize);
      gsap.ticker.remove(idleTick);

      geo?.dispose();
      mat?.dispose();
      renderer?.dispose();
    };
  }, [reduced]);

  return <canvas ref={canvasRef} className="star-canvas" aria-hidden="true" />;
}

/**
 * رندر دو بعدی در صورت عدم دسترسی مرورگر به WebGL با رنگ‌های اولیه لوگوی جمینای
 */
function drawFallback(
  c: CanvasRenderingContext2D,
  w: number,
  h: number,
  x: number,
  y: number,
  size: number,
  spin: number
) {
  const dpr = Math.min(window.devicePixelRatio, 2);
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, w, h);
  const r = size / 2;
  c.translate(x, y);
  c.scale(Math.max(Math.abs(Math.cos(spin)), 0.06), 1);

  const g = c.createLinearGradient(-r, r, r, -r);
  g.addColorStop(0, '#4f86ff');
  g.addColorStop(0.5, '#8f8cff');
  g.addColorStop(1, '#e4a3f4');
  c.fillStyle = g;

  c.beginPath();
  const fillet = r * 0.065;
  c.moveTo(-fillet, -r + fillet * 0.35);
  c.quadraticCurveTo(0, -r, fillet, -r + fillet * 0.35);
  c.bezierCurveTo(r * 0.09, -r * 0.43, r * 0.43, -r * 0.09, r - fillet * 0.35, -fillet);
  c.quadraticCurveTo(r, 0, r - fillet * 0.35, fillet);
  c.bezierCurveTo(r * 0.43, r * 0.09, r * 0.09, r * 0.43, fillet, r - fillet * 0.35);
  c.quadraticCurveTo(0, r, -fillet, r - fillet * 0.35);
  c.bezierCurveTo(-r * 0.09, r * 0.43, -r * 0.43, r * 0.09, -r + fillet * 0.35, fillet);
  c.quadraticCurveTo(-r, 0, -r + fillet * 0.35, -fillet);
  c.bezierCurveTo(-r * 0.43, -r * 0.09, -r * 0.09, -r * 0.43, -fillet, -r + fillet * 0.35);
  c.fill();
  c.setTransform(1, 0, 0, 1, 0, 0);
}
