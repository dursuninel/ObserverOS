import { describe, it } from 'vitest';
import { generateLayoutCandidates } from '../../src/game/world/layout/layoutGenerator';

describe('Seed score analysis: why central-spine always wins', () => {
  it('should show score distribution across archetypes for seeds 41001-41005', () => {
    const seeds = [41001];  // Just seed 41001 for detailed analysis

    console.log('\n=== INTERNAL CANDIDATES SCORE DISTRIBUTION ===\n');

    seeds.forEach(seed => {
      // We can't directly access internal candidates, but we can check visual candidates
      const result = generateLayoutCandidates({ seed, visualCandidateCount: 5, internalCandidateCount: 50 });

      if (result.status !== 'success') {
        console.log(`Seed ${seed}: FAILED`);
        return;
      }

      console.log(`Seed ${seed}:`);
      console.log('Visual Candidates (sorted by score):\n');
      console.log('Index\tArchetype\t\tScore\t\tHabitat\t\tJunctions');
      console.log('-----\t---------\t\t-----\t\t-------\t\t---------');

      result.candidates.forEach((candidate, idx) => {
        const archetype = candidate.structure.archetype;
        const score = candidate.score;
        const habitat = candidate.structure.habitatVariant;
        const junctions = candidate.structure.junctionCount;
        console.log(
          `${idx}\t${archetype.padEnd(15)}\t${score.toFixed(2)}\t${habitat.padEnd(17)}\t${junctions}`
        );
      });

      console.log('\n');
    });

    // Now test across all 5 seeds
    console.log('\n=== BEST CANDIDATE PER SEED ===\n');
    console.log('Seed\tTop Archetype\t\tTop Score\tRank Spread');
    console.log('----\t---------\t\t---------\t-----------');

    const allSeeds = [41001, 41002, 41003, 41004, 41005];
    allSeeds.forEach(seed => {
      const result = generateLayoutCandidates({ seed, visualCandidateCount: 5 });
      if (result.status === 'success') {
        const topArchetype = result.candidates[0]?.structure.archetype;
        const topScore = result.candidates[0]?.score;
        const scores = result.candidates.map(c => c.score);
        const spread = (Math.max(...scores) - Math.min(...scores)).toFixed(2);
        console.log(`${seed}\t${topArchetype?.padEnd(15)}\t${topScore?.toFixed(2)}\t${spread}`);
      }
    });
  });
});
