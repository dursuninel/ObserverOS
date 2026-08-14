import { ProtocolManager } from './ProtocolManager';

/**
 * `/protocols` rotası. Spec §14.1: bu ekran doğrudan graph DEĞİL, manager'dır.
 * Graph Editor ayrı bir yüzeydir ve buradan açılır (Faz 6/2).
 */
export function ProtocolsWorkspace() {
  return (
    <div className="workspace workspace-protocols">
      <ProtocolManager />
    </div>
  );
}
