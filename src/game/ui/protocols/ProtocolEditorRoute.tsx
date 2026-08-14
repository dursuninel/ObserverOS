import { useMemo } from 'react';
import { Navigate, useParams } from 'react-router-dom';

import { useSimulationEngine } from '../../../app/providers/simulationContext';
import { PHASE_FIVE_PROTOCOL_LIMITS, PHASE_THREE_BASELINE_CONFIG } from '../../simulation/SimulationConfig';
import { buildProtocolCapabilities } from '../../simulation/protocol/protocolCapabilityBridge';
import { useProtocolStore } from '../../state/protocolStore';
import { ProtocolGraphEditor, type ProtocolEditorHost } from './graph/ProtocolGraphEditor';

/**
 * `/protocols/:protocolId` — Graph Editor yüzeyi (spec §14.2).
 *
 * Manager ana ekrandır (§14.1); düzenleyici buradan AÇILIR. Bilinmeyen kimlikte
 * hata ekranı üretilmez, listeye dönülür.
 *
 * Capability iki ayrı yerden okunur ve bu bilinçlidir: alan seçenekleri için tesis
 * durumundan BAĞIMSIZ (dolayısıyla her tick'te kimliği değişmeyen) bir capability
 * kullanılır; `Kontrol Et` ise düğmeye basıldığı andaki yetkili durumu okur, çünkü
 * "zaten bu değerde" uyarısı (§53.3) anlık duruma bağlıdır.
 */
export function ProtocolEditorRoute() {
  const { protocolId } = useParams();
  const engine = useSimulationEngine();
  const protocols = useProtocolStore((state) => state.protocols);
  const upsertProtocol = useProtocolStore((state) => state.upsertProtocol);
  const protocol = protocols.find((entry) => entry.id === protocolId);

  const host = useMemo<ProtocolEditorHost>(() => ({
    capabilities: buildProtocolCapabilities({
      definitions: PHASE_THREE_BASELINE_CONFIG.facilities,
      limits: PHASE_FIVE_PROTOCOL_LIMITS,
      protocols,
    }),
    onApply: upsertProtocol,
    onSaveDraft: upsertProtocol,
    readCapabilities: () => buildProtocolCapabilities({
      definitions: PHASE_THREE_BASELINE_CONFIG.facilities,
      limits: PHASE_FIVE_PROTOCOL_LIMITS,
      protocols,
      states: engine.getSnapshot().facilities,
    }),
  }), [engine, protocols, upsertProtocol]);

  if (protocol === undefined) return <Navigate replace to="/protocols" />;

  return (
    <div className="workspace workspace-protocols">
      <ProtocolGraphEditor host={host} key={protocol.id} protocol={protocol} />
    </div>
  );
}
