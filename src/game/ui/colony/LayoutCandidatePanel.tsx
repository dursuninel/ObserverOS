import { useTranslation } from 'react-i18next';

import type { GeneratedPlanetLayout } from '../../world/layout/layoutTypes';
import type { SeedSweepReport } from '../../world/layout/layoutGenerator';

interface LayoutCandidatePanelProps {
  readonly candidates: readonly GeneratedPlanetLayout[];
  readonly onNewSeed: () => void;
  readonly onSelect: (index: number) => void;
  readonly seedSweep: SeedSweepReport;
  readonly selectedIndex: number;
}

const candidateLetter = (index: number) => String.fromCharCode(65 + index);

export function LayoutCandidatePanel({ candidates, onNewSeed, onSelect, seedSweep, selectedIndex }: LayoutCandidatePanelProps) {
  const { t } = useTranslation();
  const candidate = candidates[selectedIndex];
  if (!candidate) return null;
  const score = candidate.scoreBreakdown;
  const structure = candidate.structure;
  const translatedArchetype = t(`layoutReview.archetypes.${structure.archetype}`);
  const translatedHabitat = t(`layoutReview.habitatVariants.${structure.habitatVariant}`);
  const translatedTerrain = t(`layoutReview.terrainVariants.${structure.terrainVariant}`);
  const translatedExpansion = t(`layoutReview.expansionRelations.${structure.expansionRelation}`);
  const translatedOrientation = t(`layoutReview.orientations.${structure.mainSpineOrientation}`);
  const turnCount = structure.roadTurningPattern.filter((turn) => turn === 'corner').length;
  const translatedSignature = [translatedArchetype, translatedHabitat, translatedTerrain, translatedExpansion].join(' · ');
  return <section aria-label={t('layoutReview.title')} className="layout-candidate-panel" data-testid="layout-candidate-panel">
    <div className="layout-candidate-title"><strong>{t('layoutReview.title')}</strong><small>{t('layoutReview.notFrozen')}</small></div>
    <div className="layout-candidate-buttons" role="tablist">{candidates.map((item, index) => <button aria-selected={selectedIndex === index} className={selectedIndex === index ? 'selected' : ''} key={item.candidateId} onClick={() => onSelect(index)} role="tab" type="button">{t('layoutReview.candidate', { letter: candidateLetter(index) })}</button>)}</div>
    <dl className="layout-score-grid">
      <div><dt>{t('layoutReview.seed')}</dt><dd>{candidate.seed}</dd></div>
      <div><dt>{t('layoutReview.profile')}</dt><dd>{t(`layoutReview.styles.${candidate.style}`)}</dd></div>
      <div><dt>{t('layoutReview.total')}</dt><dd>{candidate.score.toFixed(2)}</dd></div>
      <div><dt>{t('layoutReview.structure')}</dt><dd>{translatedArchetype}</dd></div>
      <div><dt>{t('layoutReview.habitatStructure')}</dt><dd>{translatedHabitat}</dd></div>
      <div><dt>{t('layoutReview.roadTopology')}</dt><dd>{t('layoutReview.roadTopologyValue', { orientation: translatedOrientation, turns: turnCount })}</dd></div>
      <div><dt>{t('layoutReview.junction')}</dt><dd>{structure.junctionCount}</dd></div>
      <div><dt>{t('layoutReview.gameplayFacilities')}</dt><dd>{candidate.facilities.length}</dd></div>
      <div><dt>{t('layoutReview.visualModules')}</dt><dd>{structure.visualModuleCount}</dd></div>
      <div><dt>{t('layoutReview.expansionPosition')}</dt><dd>{translatedExpansion}</dd></div>
      <div><dt>{t('layoutReview.terrainSilhouette')}</dt><dd>{translatedTerrain}</dd></div>
      <div><dt>{t('layoutReview.structuralDifference')}</dt><dd>{structure.differenceScore.toFixed(3)}</dd></div>
      <div data-structural-signature={structure.signature}><dt>{t('layoutReview.signature')}</dt><dd>{translatedSignature}</dd></div>
      <div><dt>{t('layoutReview.adjacency')}</dt><dd>{score.adjacency.toFixed(1)}</dd></div>
      <div><dt>{t('layoutReview.road')}</dt><dd>{score.roadQuality.toFixed(1)}</dd></div>
      <div><dt>{t('layoutReview.readability')}</dt><dd>{score.cameraReadability.toFixed(1)}</dd></div>
      <div><dt>{t('layoutReview.composition')}</dt><dd>{score.visualComposition.toFixed(1)}</dd></div>
      <div><dt>{t('layoutReview.expansion')}</dt><dd>{score.expansionAccess.toFixed(1)}</dd></div>
      <div><dt>{t('layoutReview.terrain')}</dt><dd>{score.terrainUsage.toFixed(1)}</dd></div>
      <div><dt>{t('layoutReview.roadNetwork')}</dt><dd>{t('layoutReview.connected')}</dd></div>
      <div><dt>{t('layoutReview.navigation')}</dt><dd>{t('layoutReview.connected')}</dd></div>
      <div><dt>{t('layoutReview.valid')}</dt><dd>{t('layoutReview.yes')}</dd></div>
    </dl>
    <div className="layout-review-actions"><button disabled={selectedIndex === 0} onClick={() => onSelect(selectedIndex - 1)} type="button">{t('layoutReview.previous')}</button><button disabled={selectedIndex === candidates.length - 1} onClick={() => onSelect(selectedIndex + 1)} type="button">{t('layoutReview.next')}</button><button onClick={onNewSeed} type="button">{t('layoutReview.newSeed')}</button></div>
    <details><summary>{t('layoutReview.seedSweep.title')}</summary><dl className="layout-score-grid"><div><dt>{t('layoutReview.seedSweep.tested')}</dt><dd>{seedSweep.testedSeeds}</dd></div><div><dt>{t('layoutReview.seedSweep.valid')}</dt><dd>{seedSweep.valid}</dd></div><div><dt>{t('layoutReview.seedSweep.failed')}</dt><dd>{seedSweep.failed}</dd></div><div><dt>{t('layoutReview.seedSweep.averageCandidates')}</dt><dd>{seedSweep.averageCandidateCount}</dd></div><div><dt>{t('layoutReview.seedSweep.averageSignatures')}</dt><dd>{seedSweep.averageStructuralSignatures}</dd></div><div><dt>{t('layoutReview.seedSweep.minimumSignatures')}</dt><dd>{seedSweep.minimumStructuralSignatures}</dd></div><div><dt>{t('layoutReview.seedSweep.highest')}</dt><dd>{seedSweep.highestScore.toFixed(2)}</dd></div><div><dt>{t('layoutReview.seedSweep.lowest')}</dt><dd>{seedSweep.lowestScore.toFixed(2)}</dd></div><div><dt>{t('layoutReview.seedSweep.averageMs')}</dt><dd>{seedSweep.averageGenerationMs} ms</dd></div></dl></details>
  </section>;
}
