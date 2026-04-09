import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  AbsoluteFill,
  delayRender,
  continueRender,
  staticFile,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import {
  ORDERED_GAMES,
  GAMES,
  getTowerHeight,
  TOWER_SPACING,
  TOWER_WIDTH,
  TOWER_DEPTH,
  GameData,
} from "./data/games";

// ─── Timing ──────────────────────────────────────────────────────────────────
export const FRAMES_PAUSE = 36;
export const FRAMES_TRAVEL = 54;
const SEGMENT = FRAMES_PAUSE + FRAMES_TRAVEL;
const NUM_TOWERS = 20;

// ─── Scene geometry ───────────────────────────────────────────────────────────
const TOTAL_X = (NUM_TOWERS - 1) * TOWER_SPACING; // 152
const CENTER_X = TOTAL_X / 2;                      // 76

// ─── Helpers ─────────────────────────────────────────────────────────────────
function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

// deterministic pseudo-random from seed
function sRand(seed: number): number {
  return Math.abs(Math.sin(seed * 9301 + 49297)) % 1;
}

// ─── Camera ──────────────────────────────────────────────────────────────────
interface CamState {
  pos: THREE.Vector3;
  tgt: THREE.Vector3;
}

function cameraAtIndex(i: number): CamState {
  const game = ORDERED_GAMES[i];
  const height = getTowerHeight(game.copies);
  const x = i * TOWER_SPACING;
  // Y rises gently as we climb the ranks so the journey feels cinematic
  const camY = 4.5 + height * 0.06;
  return {
    pos: new THREE.Vector3(x, camY, 12),
    tgt: new THREE.Vector3(x, 2.6, 0), // keep cover art centred
  };
}

function getCameraState(frame: number): CamState {
  for (let i = 0; i < NUM_TOWERS; i++) {
    const arrive = i * SEGMENT;
    const depart = arrive + FRAMES_PAUSE;
    const next = (i + 1) * SEGMENT;
    if (frame <= depart || i === NUM_TOWERS - 1) return cameraAtIndex(i);
    if (frame < next) {
      const t = smoothstep((frame - depart) / FRAMES_TRAVEL);
      const a = cameraAtIndex(i);
      const b = cameraAtIndex(i + 1);
      return {
        pos: new THREE.Vector3().lerpVectors(a.pos, b.pos, t),
        tgt: new THREE.Vector3().lerpVectors(a.tgt, b.tgt, t),
      };
    }
  }
  return cameraAtIndex(NUM_TOWERS - 1);
}

function getActiveIndex(frame: number): number {
  for (let i = 0; i < NUM_TOWERS; i++) {
    if (frame >= i * SEGMENT && frame < i * SEGMENT + FRAMES_PAUSE) return i;
  }
  if (frame >= (NUM_TOWERS - 1) * SEGMENT) return NUM_TOWERS - 1;
  return -1;
}

function CameraController({ frame }: { frame: number }) {
  const { camera } = useThree();
  const { pos, tgt } = getCameraState(frame);
  camera.position.copy(pos);
  camera.lookAt(tgt);
  (camera as THREE.PerspectiveCamera).fov = 65;
  camera.updateProjectionMatrix();
  return null;
}

// ─── Canvas textures ──────────────────────────────────────────────────────────
function makeInfoLabel(game: GameData): THREE.CanvasTexture {
  const W = 512, H = 180;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d")!;

  ctx.fillStyle = "rgba(8, 8, 28, 0.93)";
  ctx.fillRect(0, 0, W, H);

  // coloured top stripe
  ctx.fillStyle = game.color;
  ctx.fillRect(0, 0, W, 7);

  // rank
  ctx.font = "bold 56px Arial, sans-serif";
  ctx.fillStyle = game.color;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(`#${game.rank}`, 14, 68);

  // title
  const title = game.title.length > 22 ? game.title.slice(0, 20) + "…" : game.title;
  ctx.font = "bold 30px Arial, sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(title, 14, 112);

  // copies + year
  ctx.font = "24px Arial, sans-serif";
  ctx.fillStyle = "#AAAACC";
  ctx.fillText(`${game.copies}M copies  ·  ${game.year}`, 14, 152);

  return new THREE.CanvasTexture(c);
}

function makeFallbackCover(game: GameData): THREE.CanvasTexture {
  const W = 256, H = 340;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d")!;

  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, game.color);
  grad.addColorStop(1, "#000");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // subtle vignette
  const vig = ctx.createRadialGradient(W/2, H/2, H*0.1, W/2, H/2, H*0.75);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  ctx.font = "bold 22px Arial, sans-serif";
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const words = game.title.split(" ");
  let line = "", y = H / 2 - 16;
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > W - 24 && line) {
      ctx.fillText(line, W / 2, y); line = w; y += 30;
    } else { line = test; }
  }
  ctx.fillText(line, W / 2, y);
  return new THREE.CanvasTexture(c);
}

// ─── Tower ────────────────────────────────────────────────────────────────────
function Tower({
  game, index, isActive, coverTexture,
}: {
  game: GameData;
  index: number;
  isActive: boolean;
  coverTexture: THREE.Texture | null;
}) {
  const height = getTowerHeight(game.copies);
  const x = index * TOWER_SPACING;
  const towerColor = useMemo(() => new THREE.Color(game.color), [game.color]);
  const infoTex = useMemo(() => makeInfoLabel(game), [game]);
  const fallbackTex = useMemo(() => makeFallbackCover(game), [game]);
  const cover = coverTexture ?? fallbackTex;
  const ei = isActive ? 0.38 : 0.07;

  // Cover fills full tower width; height follows the image's natural aspect ratio,
  // capped so it never overflows a short tower.
  const { coverW, coverH } = useMemo(() => {
    const cw = TOWER_WIDTH;
    let aspect = 2 / 3; // default portrait fallback
    const img = cover?.image as (HTMLImageElement | ImageBitmap | null | undefined);
    if (img) {
      const iw = (img as HTMLImageElement).naturalWidth ?? (img as ImageBitmap).width ?? 0;
      const ih = (img as HTMLImageElement).naturalHeight ?? (img as ImageBitmap).height ?? 0;
      if (iw > 0 && ih > 0) aspect = iw / ih;
    }
    const ch = Math.min(cw / aspect, height);
    return { coverW: cw, coverH: ch };
  }, [cover, height]);

  const coverY = coverH / 2;                 // bottom-aligned on the tower face
  const infoY  = coverH + 0.85;              // label floats just above the cover

  return (
    <group position={[x, 0, 0]}>
      {/* Body */}
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[TOWER_WIDTH, height, TOWER_DEPTH]} />
        <meshStandardMaterial
          color={towerColor} emissive={towerColor} emissiveIntensity={ei}
          roughness={0.45} metalness={0.35}
        />
      </mesh>

      {/* Glowing cap */}
      <mesh position={[0, height + 0.22, 0]}>
        <boxGeometry args={[TOWER_WIDTH + 0.55, 0.38, TOWER_DEPTH + 0.55]} />
        <meshStandardMaterial
          color={towerColor} emissive={towerColor}
          emissiveIntensity={isActive ? 1.6 : 0.5}
        />
      </mesh>

      {/* Cover art — fills full tower width, natural aspect ratio height */}
      <mesh position={[0, coverY, TOWER_DEPTH / 2 + 0.055]}>
        <planeGeometry args={[coverW, coverH]} />
        <meshBasicMaterial map={cover} />
      </mesh>

      {/* Info label (rank / title / copies) */}
      <mesh position={[0, infoY, TOWER_DEPTH / 2 + 0.055]}>
        <planeGeometry args={[TOWER_WIDTH - 0.2, 1.45]} />
        <meshBasicMaterial map={infoTex} transparent alphaTest={0.03} />
      </mesh>

      {/* Active tower spot light */}
      {isActive && (
        <pointLight position={[0, height * 0.5, 6]} intensity={2.8}
          color={game.color} distance={22} />
      )}
    </group>
  );
}

// ─── Park background ──────────────────────────────────────────────────────────
const CLOUD_DATA = [
  { bx: 15,  y: 36, z: -32, s: 3.0,  sp: 0.016 },
  { bx: 68,  y: 43, z: -47, s: 4.2,  sp: 0.010 },
  { bx: 118, y: 39, z: -38, s: 3.6,  sp: 0.012 },
  { bx: 38,  y: 46, z: -52, s: 2.6,  sp: 0.008 },
  { bx: 158, y: 41, z: -42, s: 3.2,  sp: 0.011 },
  { bx: 88,  y: 50, z: -58, s: 5.2,  sp: 0.007 },
  { bx: 8,   y: 54, z: -62, s: 4.0,  sp: 0.009 },
  { bx: 142, y: 37, z: -30, s: 2.8,  sp: 0.014 },
  { bx: 200, y: 44, z: -44, s: 3.8,  sp: 0.010 },
];

function Cloud({ bx, y, z, s, sp, frame }: (typeof CLOUD_DATA)[0] & { frame: number }) {
  const range = TOTAL_X + 100;
  const x = (bx + frame * sp) % range;
  const mat = <meshStandardMaterial color="#f9f9ff" roughness={1} transparent opacity={0.88} />;
  return (
    <group position={[x, y, z]}>
      <mesh><sphereGeometry args={[s * 1.4, 9, 7]} />{mat}</mesh>
      <mesh position={[s * 2.0, s * 0.3, 0]}><sphereGeometry args={[s * 1.0, 8, 6]} />{mat}</mesh>
      <mesh position={[-s * 1.8, s * 0.15, 0]}><sphereGeometry args={[s * 0.88, 8, 6]} />{mat}</mesh>
      <mesh position={[s * 0.5, s * 0.95, 0]}><sphereGeometry args={[s * 0.7, 7, 5]} />{mat}</mesh>
    </group>
  );
}

const TREE_DATA = Array.from({ length: 48 }, (_, i) => {
  const r1 = sRand(i * 3), r2 = sRand(i * 3 + 1), r3 = sRand(i * 3 + 2);
  let x: number, z: number;
  if (i < 14) {           // left flank
    x = -6 - r1 * 22; z = -2 - r2 * 25;
  } else if (i < 28) {    // right flank
    x = TOTAL_X + 8 + r1 * 28; z = -2 - r2 * 25;
  } else {                // deep background
    x = r1 * (TOTAL_X + 10) - 5; z = -20 - r2 * 28;
  }
  return { x, z, pine: r3 > 0.45, scale: 1.3 + r1 * 1.9, sway: r2 * Math.PI * 2 };
});

function Tree({ x, z, pine, scale, sway, frame }: (typeof TREE_DATA)[0] & { frame: number }) {
  const rot = Math.sin(frame * 0.04 + sway) * 0.018;
  const trunk = <meshStandardMaterial color="#7B4A28" roughness={0.9} />;
  if (pine) {
    return (
      <group position={[x, 0, z]} rotation={[0, 0, rot]}>
        <mesh position={[0, scale * 0.5, 0]}>
          <cylinderGeometry args={[scale * 0.11, scale * 0.17, scale, 6]} />{trunk}
        </mesh>
        <mesh position={[0, scale * 1.1, 0]}>
          <coneGeometry args={[scale * 1.15, scale * 1.55, 8]} />
          <meshStandardMaterial color="#3A7A2A" roughness={0.85} />
        </mesh>
        <mesh position={[0, scale * 1.85, 0]}>
          <coneGeometry args={[scale * 0.85, scale * 1.3, 8]} />
          <meshStandardMaterial color="#2D6820" roughness={0.85} />
        </mesh>
        <mesh position={[0, scale * 2.5, 0]}>
          <coneGeometry args={[scale * 0.5, scale * 0.95, 8]} />
          <meshStandardMaterial color="#245518" roughness={0.85} />
        </mesh>
      </group>
    );
  }
  return (
    <group position={[x, 0, z]} rotation={[0, 0, rot]}>
      <mesh position={[0, scale * 0.5, 0]}>
        <cylinderGeometry args={[scale * 0.14, scale * 0.21, scale, 6]} />{trunk}
      </mesh>
      <mesh position={[0, scale * 1.55, 0]}>
        <sphereGeometry args={[scale * 1.05, 10, 8]} />
        <meshStandardMaterial color="#4CAF50" roughness={0.85} />
      </mesh>
      <mesh position={[scale * 0.55, scale * 2.0, 0]}>
        <sphereGeometry args={[scale * 0.65, 8, 6]} />
        <meshStandardMaterial color="#66BB6A" roughness={0.85} />
      </mesh>
    </group>
  );
}

const FLOWER_DATA = Array.from({ length: 40 }, (_, i) => ({
  x: sRand(i * 7) * (TOTAL_X + 20) - 4,
  z: sRand(i * 7 + 1) * 20 - 3,
  color: ["#FF69B4","#FFD700","#FF4500","#DA70D6","#00BFFF","#FF1493","#ADFF2F"][i % 7],
  bob: sRand(i * 7 + 2) * Math.PI * 2,
}));

function ParkBackground({ frame }: { frame: number }) {
  return (
    <>
      {/* Sky plane */}
      <mesh position={[CENTER_X, 38, -95]}>
        <planeGeometry args={[450, 160]} />
        <meshBasicMaterial color="#4FC3F7" />
      </mesh>

      {/* Horizon haze */}
      <mesh position={[CENTER_X, 10, -93]}>
        <planeGeometry args={[450, 24]} />
        <meshBasicMaterial color="#B3E5FC" transparent opacity={0.65} />
      </mesh>

      {/* Sun */}
      <mesh position={[CENTER_X + 95, 62, -82]}>
        <sphereGeometry args={[5.5, 16, 16]} />
        <meshBasicMaterial color="#FFF176" />
      </mesh>
      {/* Sun glow halo */}
      <mesh position={[CENTER_X + 95, 62, -83]}>
        <sphereGeometry args={[8, 12, 10]} />
        <meshBasicMaterial color="#FFFDE7" transparent opacity={0.22} />
      </mesh>

      {/* Rolling hills in background */}
      <mesh position={[CENTER_X - 40, -12, -58]}>
        <sphereGeometry args={[24, 16, 10]} />
        <meshStandardMaterial color="#66A855" roughness={1} />
      </mesh>
      <mesh position={[CENTER_X + 65, -14, -63]}>
        <sphereGeometry args={[28, 16, 10]} />
        <meshStandardMaterial color="#5D9E48" roughness={1} />
      </mesh>
      <mesh position={[CENTER_X + 130, -10, -56]}>
        <sphereGeometry args={[22, 14, 9]} />
        <meshStandardMaterial color="#6FAE5A" roughness={1} />
      </mesh>
      <mesh position={[CENTER_X - 100, -11, -54]}>
        <sphereGeometry args={[20, 14, 9]} />
        <meshStandardMaterial color="#5FA84A" roughness={1} />
      </mesh>

      {/* Grass ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[CENTER_X, 0, 0]} receiveShadow>
        <planeGeometry args={[TOTAL_X + 140, 130]} />
        <meshStandardMaterial color="#5DB846" roughness={0.95} />
      </mesh>

      {/* Dirt path under towers */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[CENTER_X, 0.006, 1.5]}>
        <planeGeometry args={[TOTAL_X + 14, 7.5]} />
        <meshStandardMaterial color="#C4A882" roughness={0.92} />
      </mesh>

      {/* Path edge trim (slightly lighter) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[CENTER_X, 0.004, 5.5]}>
        <planeGeometry args={[TOTAL_X + 14, 1.5]} />
        <meshStandardMaterial color="#8BC34A" roughness={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[CENTER_X, 0.004, -2.5]}>
        <planeGeometry args={[TOTAL_X + 14, 1.5]} />
        <meshStandardMaterial color="#8BC34A" roughness={0.9} />
      </mesh>

      {/* Animated clouds */}
      {CLOUD_DATA.map((c, i) => <Cloud key={i} {...c} frame={frame} />)}

      {/* Trees */}
      {TREE_DATA.map((t, i) => <Tree key={i} {...t} frame={frame} />)}

      {/* Flowers */}
      {FLOWER_DATA.map((f, i) => (
        <mesh key={i} position={[f.x, 0.19 + Math.sin(frame * 0.05 + f.bob) * 0.06, f.z]}>
          <sphereGeometry args={[0.14, 6, 4]} />
          <meshStandardMaterial color={f.color} emissive={f.color} emissiveIntensity={0.4} />
        </mesh>
      ))}
    </>
  );
}

// ─── Full 3-D scene ───────────────────────────────────────────────────────────
function Scene({
  frame,
  coverTextures,
}: {
  frame: number;
  coverTextures: Record<number, THREE.Texture>;
}) {
  const active = getActiveIndex(frame);
  return (
    <>
      <color attach="background" args={["#4FC3F7"]} />
      <fog attach="fog" args={["#87CEEB", 65, 135]} />

      {/* Daylight park lighting */}
      <hemisphereLight color="#87CEEB" groundColor="#4CAF50" intensity={0.7} />
      <directionalLight
        position={[55, 85, 45]} intensity={1.9} color="#FFF8E7"
        castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048}
        shadow-camera-far={220} shadow-camera-left={-110}
        shadow-camera-right={110} shadow-camera-top={90} shadow-camera-bottom={-50}
      />
      <directionalLight position={[-30, 40, 20]} intensity={0.45} color="#B3D9FF" />

      <ParkBackground frame={frame} />

      {ORDERED_GAMES.map((game, i) => (
        <Tower
          key={game.rank}
          game={game}
          index={i}
          isActive={active === i}
          coverTexture={coverTextures[game.rank] ?? null}
        />
      ))}

      <CameraController frame={frame} />
    </>
  );
}

// ─── Exported composition ─────────────────────────────────────────────────────
export const VideoGameTowers: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const [coverTextures, setCoverTextures] = useState<Record<number, THREE.Texture>>({});
  const [loaded, setLoaded] = useState(false);
  const doneRef = useRef(false);
  const handleRef = useRef<number | null>(null);

  useEffect(() => {
    doneRef.current = false;
    handleRef.current = delayRender("Loading game covers");

    const loader = new THREE.TextureLoader();
    loader.crossOrigin = "anonymous";

    const promises = GAMES.map(
      (game) =>
        new Promise<[number, THREE.Texture | null]>((resolve) => {
          const url = staticFile(`covers/${game.coverFile}`);
          loader.load(
            url,
            (tex) => { tex.colorSpace = THREE.SRGBColorSpace; resolve([game.rank, tex]); },
            undefined,
            () => resolve([game.rank, null]),
          );
        })
    );

    Promise.all(promises).then((results) => {
      const map: Record<number, THREE.Texture> = {};
      results.forEach(([rank, tex]) => { if (tex) map[rank] = tex; });
      setCoverTextures(map);
      setLoaded(true);
      if (!doneRef.current && handleRef.current !== null) {
        doneRef.current = true;
        continueRender(handleRef.current);
      }
    });

    return () => {
      if (!doneRef.current && handleRef.current !== null) {
        doneRef.current = true;
        continueRender(handleRef.current);
      }
    };
  }, []);

  if (!loaded) return <AbsoluteFill style={{ background: "#87CEEB" }} />;

  return (
    <AbsoluteFill style={{ background: "#87CEEB" }}>
      <ThreeCanvas width={width} height={height}>
        <Scene frame={frame} coverTextures={coverTextures} />
      </ThreeCanvas>

      {/* ── Overlays ─────────────────────────────────────────────────── */}
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        {/* Top title bar */}
        <div
          style={{
            position: "absolute",
            top: 0, left: 0, right: 0,
            padding: "28px 24px 40px",
            background: "linear-gradient(to bottom, rgba(0,0,0,0.62) 0%, transparent 100%)",
            textAlign: "center",
            fontFamily: "'Arial Black', Arial, sans-serif",
            color: "#ffffff",
          }}
        >
          <div style={{ fontSize: 42, fontWeight: 900, letterSpacing: 4, textTransform: "uppercase", textShadow: "0 2px 14px rgba(0,0,0,0.55)" }}>
            Top 20
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#FFD740", marginTop: 4, letterSpacing: 2, textShadow: "0 2px 10px rgba(0,0,0,0.5)" }}>
            Best-Selling Video Games
          </div>
          <div style={{ fontSize: 20, fontWeight: 400, color: "rgba(255,255,255,0.75)", marginTop: 2, letterSpacing: 1 }}>
            of All Time
          </div>
        </div>

        {/* Bottom caption */}
        <div
          style={{
            position: "absolute",
            bottom: 0, left: 0, right: 0,
            padding: "40px 24px 28px",
            background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 100%)",
            textAlign: "center",
            color: "rgba(255,255,255,0.7)",
            fontSize: 22,
            fontFamily: "Arial, sans-serif",
          }}
        >
          Copies sold in millions
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
