import { describe, it } from 'vitest';
import { generateLayoutCandidates } from '../../src/game/world/layout/layoutGenerator';

describe('Seed regeneration diversity: ADAY A across sequential seeds', () => {
  it('should show ADAY A structural differences across seeds 41001-41005', () => {
    const seeds = [41001, 41002, 41003, 41004, 41005];

    console.log('\n=== ADAY A (Visual Candidate 0) Across Seeds ===\n');
    console.log('Seed\tArchetype\t\tHabitat\t\t\tRoads\tJunctions\tOrientation');
    console.log('----\t---------\t\t-------\t\t\t-----\t---------\t-----------');

    const adayAMetrics: Array<{seed: number; archetype: string; habitat: string; roadCount: number; junctionCount: number; orientation: string}> = [];

    seeds.forEach(seed => {
      const result = generateLayoutCandidates({ seed });
      if (result.status !== 'success') {
        console.log(`${seed}\tFAILED`);
        return;
      }

      const candidate = result.candidates[0]; // ADAY A
      if (!candidate) return;

      const archetype = candidate.structure.archetype;
      const habitat = candidate.structure.habitatVariant;
      const junctionCount = candidate.structure.junctionCount;
      const orientation = candidate.structure.mainSpineOrientation;
      const roadCount = candidate.roads.filter(r => r.role === 'main-spine').length;
      const facilityCount = candidate.facilities.length;

      adayAMetrics.push({
        seed,
        archetype,
        habitat,
        roadCount,
        junctionCount,
        orientation,
      });

      console.log(
        `${seed}\t${archetype.padEnd(15)}\t${habitat.padEnd(20)}\t${roadCount}\t${junctionCount}\t\t${orientation}`
      );
    });

    console.log('\n\n=== Diversity Analysis ===\n');

    const uniqueArchetypes = new Set(adayAMetrics.map(m => m.archetype)).size;
    const uniqueHabitats = new Set(adayAMetrics.map(m => m.habitat)).size;
    const uniqueJunctions = new Set(adayAMetrics.map(m => m.junctionCount)).size;
    const uniqueOrientations = new Set(adayAMetrics.map(m => m.orientation)).size;
    const uniqueRoads = new Set(adayAMetrics.map(m => m.roadCount)).size;

    console.log(`Unique Archetypes: ${uniqueArchetypes}/5`);
    console.log(`Unique Habitats: ${uniqueHabitats}`);
    console.log(`Unique Junctions: ${uniqueJunctions}`);
    console.log(`Unique Orientations: ${uniqueOrientations}`);
    console.log(`Unique Road Counts: ${uniqueRoads}`);

    // Check if same archetype appears multiple times
    const archetypeFreq = new Map<string, number>();
    adayAMetrics.forEach(m => {
      archetypeFreq.set(m.archetype, (archetypeFreq.get(m.archetype) ?? 0) + 1);
    });

    console.log('\nArchetype Frequency in ADAY A:');
    archetypeFreq.forEach((count, arch) => {
      if (count > 1) {
        console.log(`  ${arch}: ${count}x ← REPEATED (low diversity!)`);
      } else {
        console.log(`  ${arch}: ${count}x`);
      }
    });

    const diversity = ((uniqueArchetypes / 5) * 50 + (uniqueJunctions / 3) * 30 + (uniqueOrientations / 4) * 20).toFixed(1);
    console.log(`\nDiversity Score: ${diversity}%`);

    if (uniqueArchetypes < 3) {
      console.log('\n⚠️  LOW DIVERSITY: Less than 3 unique archetypes in 5 consecutive seeds!');
    }
  });
});
