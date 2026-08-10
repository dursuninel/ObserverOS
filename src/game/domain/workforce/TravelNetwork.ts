export interface TravelNetworkNode {
  readonly id: string;
  readonly x: number;
  readonly z: number;
}

export interface TravelNetworkEdge {
  readonly from: string;
  readonly to: string;
}

export interface TravelNetworkConfig {
  readonly edges: readonly TravelNetworkEdge[];
  readonly locationNodes: Readonly<Record<string, string>>;
  readonly nodes: readonly TravelNetworkNode[];
  readonly walkingSpeedUnitsPerSimulationMinute: number;
}

function distance(left: TravelNetworkNode, right: TravelNetworkNode): number {
  return Math.hypot(left.x - right.x, left.z - right.z);
}

export function findTravelRoute(network: TravelNetworkConfig, sourceLocationId: string, targetLocationId: string): readonly string[] {
  const start = network.locationNodes[sourceLocationId];
  const goal = network.locationNodes[targetLocationId];
  if (start === undefined || goal === undefined) throw new Error(`Travel location is missing from the network: ${sourceLocationId} -> ${targetLocationId}`);
  if (start === goal) return Object.freeze([start]);
  const nodes = new Map(network.nodes.map((node) => [node.id, node]));
  const open = new Set<string>([start]);
  const cameFrom = new Map<string, string>();
  const cost = new Map<string, number>([[start, 0]]);
  while (open.size > 0) {
    const current = [...open].sort((left, right) => (cost.get(left) ?? Number.POSITIVE_INFINITY) - (cost.get(right) ?? Number.POSITIVE_INFINITY) || left.localeCompare(right))[0];
    if (current === undefined) break;
    if (current === goal) {
      const route = [current];
      let cursor = current;
      while (cameFrom.has(cursor)) {
        cursor = cameFrom.get(cursor) as string;
        route.unshift(cursor);
      }
      return Object.freeze(route);
    }
    open.delete(current);
    const currentNode = nodes.get(current);
    if (currentNode === undefined) throw new Error(`Travel node is missing: ${current}`);
    const neighbors = network.edges.flatMap((edge) => edge.from === current ? [edge.to] : edge.to === current ? [edge.from] : []).sort();
    for (const neighbor of neighbors) {
      const neighborNode = nodes.get(neighbor);
      if (neighborNode === undefined) throw new Error(`Travel node is missing: ${neighbor}`);
      const candidate = (cost.get(current) ?? 0) + distance(currentNode, neighborNode);
      if (candidate < (cost.get(neighbor) ?? Number.POSITIVE_INFINITY)) {
        cameFrom.set(neighbor, current);
        cost.set(neighbor, candidate);
        open.add(neighbor);
      }
    }
  }
  throw new Error(`No travel route exists: ${sourceLocationId} -> ${targetLocationId}`);
}

export function getTravelRouteDistance(network: TravelNetworkConfig, routeNodeIds: readonly string[]): number {
  const nodes = new Map(network.nodes.map((node) => [node.id, node]));
  return routeNodeIds.slice(1).reduce((total, nodeId, index) => {
    const previous = nodes.get(routeNodeIds[index] ?? '');
    const current = nodes.get(nodeId);
    if (previous === undefined || current === undefined) throw new Error(`Travel route contains an unknown node: ${nodeId}`);
    return total + distance(previous, current);
  }, 0);
}

export function resolveTravelDuration(network: TravelNetworkConfig, sourceLocationId: string, targetLocationId: string): { readonly durationMinutes: number; readonly routeNodeIds: readonly string[] } {
  const routeNodeIds = findTravelRoute(network, sourceLocationId, targetLocationId);
  const distanceUnits = getTravelRouteDistance(network, routeNodeIds);
  return Object.freeze({ durationMinutes: Math.max(1, Math.ceil(distanceUnits / network.walkingSpeedUnitsPerSimulationMinute)), routeNodeIds });
}
