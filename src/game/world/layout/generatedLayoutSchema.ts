import { z } from 'zod';

const finite = z.number().finite();
const point2 = z.tuple([finite, finite]);
const rect = z.object({ center: point2, depth: finite.positive(), width: finite.positive() });
const terrainTag = z.enum(['blocked', 'buildable', 'hazardZone', 'preferredExpansionArea', 'resourceZone']);
const operationalZone = z.enum(['Emergency', 'Energy', 'Industrial', 'LifeSupport', 'Residential']);

export const generatedPlanetLayoutSchema = z.object({
  cameraBounds: z.object({ center: point2, maxX: finite, maxZ: finite, minX: finite, minZ: finite }),
  candidateId: z.string().min(1),
  expansionSlots: z.array(z.object({ accessNodeId: z.string().min(1), compatibility: z.array(z.string()), footprintCapacity: z.object({ depth: finite.positive(), width: finite.positive() }), id: z.literal('expansion'), position: point2, primaryAssetId: z.literal('expansion-pad'), rotationY: finite })),
  facilities: z.array(z.object({ entrance: point2, footprint: rect, id: z.enum(['reactor', 'solar', 'battery', 'mine', 'habitat', 'oxygen']), position: point2, primaryAssetId: z.string().min(1), rotationY: finite, serviceClearance: finite.nonnegative(), workPoint: point2 })),
  generatorVersion: z.string().min(1),
  navigationEdges: z.array(z.object({ from: z.string().min(1), id: z.string().min(1), role: z.enum(['entrance-link', 'main-spine', 'service']), to: z.string().min(1) })),
  navigationNodes: z.array(z.object({ entityId: z.enum(['reactor', 'solar', 'battery', 'mine', 'habitat', 'oxygen', 'expansion']).optional(), id: z.string().min(1), kind: z.enum(['approach', 'entrance', 'spine']), position: point2 })),
  planetId: z.literal('nivalis-3-prototype'),
  propZones: z.array(rect.extend({ density: z.literal('low'), id: z.string().min(1), seedOffset: z.number().int() })),
  roads: z.array(z.object({ edgeId: z.string().min(1), points: z.array(point2).min(2), role: z.enum(['entrance-link', 'main-spine', 'service']) })),
  score: finite,
  scoreBreakdown: z.object({ adjacency: finite, cameraReadability: finite, compactness: finite, expansionAccess: finite, roadQuality: finite, safetySeparation: finite, screenSpaceOverlap: finite, terrainUsage: finite, visualComposition: finite }),
  seed: z.number().int().nonnegative(),
  streetLights: z.array(z.object({ id: z.string().min(1), position: point2, reason: z.enum(['approach', 'intermediate', 'junction']), roadNodeId: z.string().optional() })),
  style: z.enum(['Compact', 'Distributed', 'Linear']),
  zones: z.array(rect.extend({ id: z.string().min(1), operationalZone: operationalZone.optional(), tags: z.array(terrainTag) })),
}).superRefine((layout, context) => {
  if (layout.cameraBounds.minX >= layout.cameraBounds.maxX || layout.cameraBounds.minZ >= layout.cameraBounds.maxZ) context.addIssue({ code: 'custom', message: 'Camera bounds are inverted.' });
  const nodeIds = new Set(layout.navigationNodes.map((node) => node.id));
  for (const edge of layout.navigationEdges) if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) context.addIssue({ code: 'custom', message: `Navigation edge ${edge.id} has a missing endpoint.` });
  const required = new Set(['reactor', 'solar', 'battery', 'mine', 'habitat', 'oxygen']);
  layout.facilities.forEach((facility) => required.delete(facility.id));
  if (required.size > 0) context.addIssue({ code: 'custom', message: `Missing facilities: ${[...required].join(', ')}` });
});

export type ParsedGeneratedPlanetLayout = z.infer<typeof generatedPlanetLayoutSchema>;
