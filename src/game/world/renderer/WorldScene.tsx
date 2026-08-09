import { Canvas } from '@react-three/fiber';

/** Renders a future authoritative world view model; it owns no gameplay decisions. */
export function WorldScene() {
  return (
    <div aria-hidden="true" className="world-scene-shell">
      <Canvas orthographic>
        <group name="authoritative-world-root" />
      </Canvas>
    </div>
  );
}
