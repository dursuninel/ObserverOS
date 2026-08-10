import type { GeneratedPlanetLayout, Point2 } from '../layout/layoutTypes';

function Segment({ color, end, start, y = 0.13 }: { readonly color: string; readonly end: Point2; readonly start: Point2; readonly y?: number }) {
  const dx = end[0] - start[0];
  const dz = end[1] - start[1];
  const length = Math.hypot(dx, dz);
  return <mesh position={[(start[0] + end[0]) / 2, y, (start[1] + end[1]) / 2]} rotation-y={Math.atan2(dx, dz)}><boxGeometry args={[0.08, 0.025, length]} /><meshBasicMaterial color={color} depthTest={false} transparent opacity={0.9} /></mesh>;
}

function RectOutline({ center, color, depth, width, y = 0.16 }: { readonly center: Point2; readonly color: string; readonly depth: number; readonly width: number; readonly y?: number }) {
  const halfWidth = width / 2; const halfDepth = depth / 2;
  const corners: readonly Point2[] = [[center[0] - halfWidth, center[1] - halfDepth], [center[0] + halfWidth, center[1] - halfDepth], [center[0] + halfWidth, center[1] + halfDepth], [center[0] - halfWidth, center[1] + halfDepth]];
  return <>{corners.map((corner, index) => <Segment color={color} end={corners[(index + 1) % corners.length] ?? corner} key={index} start={corner} y={y} />)}</>;
}

export function LayoutDebugOverlay({ layout }: { readonly layout: GeneratedPlanetLayout }) {
  return <group renderOrder={1000}>
    {layout.zones.map((zone) => <mesh key={zone.id} position={[zone.center[0], 0.08, zone.center[1]]} rotation-x={-Math.PI / 2}><planeGeometry args={[zone.width, zone.depth]} /><meshBasicMaterial color={zone.tags.includes('blocked') ? '#f05d5d' : zone.tags.includes('resourceZone') ? '#d7ad54' : zone.tags.includes('preferredExpansionArea') ? '#9b75e8' : '#4ba89a'} depthWrite={false} opacity={0.055} transparent /></mesh>)}
    {layout.facilities.map((facility) => <group key={facility.id}>
      <RectOutline center={facility.position} color="#72e2d0" depth={facility.visualFootprint.depth} width={facility.visualFootprint.width} />
      <RectOutline center={facility.position} color="#e7bd65" depth={facility.visualFootprint.depth + facility.serviceClearance * 2} width={facility.visualFootprint.width + facility.serviceClearance * 2} y={0.145} />
      <mesh position={[facility.entrance[0], 0.25, facility.entrance[1]]}><sphereGeometry args={[0.13, 8, 8]} /><meshBasicMaterial color="#66e59a" depthTest={false} /></mesh>
      <mesh position={[facility.workPoint[0], 0.25, facility.workPoint[1]]}><sphereGeometry args={[0.12, 8, 8]} /><meshBasicMaterial color="#ff9e64" depthTest={false} /></mesh>
    </group>)}
    {layout.roads.flatMap((road) => road.points.slice(1).map((end, index) => <Segment color={road.role === 'main-spine' ? '#56b9ff' : '#9bd8ff'} end={end} key={`${road.edgeId}-${index}`} start={road.points[index] ?? end} y={0.2} />))}
    {layout.navigationNodes.map((node) => <mesh key={node.id} position={[node.position[0], 0.24, node.position[1]]}><sphereGeometry args={[node.kind === 'spine' ? 0.11 : 0.085, 7, 7]} /><meshBasicMaterial color={node.kind === 'spine' ? '#ffffff' : '#62c5ff'} depthTest={false} /></mesh>)}
    {layout.expansionSlots.map((slot) => <RectOutline center={slot.position} color="#b985ff" depth={slot.footprintCapacity.depth} key={slot.id} width={slot.footprintCapacity.width} y={0.22} />)}
    <RectOutline center={layout.cameraBounds.center} color="#ff7aac" depth={layout.cameraBounds.maxZ - layout.cameraBounds.minZ} width={layout.cameraBounds.maxX - layout.cameraBounds.minX} y={0.12} />
  </group>;
}
