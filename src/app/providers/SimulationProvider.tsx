import { type PropsWithChildren, useEffect, useState } from 'react';

import { SimulationEngine } from '../../game/simulation/SimulationEngine';
import {
  buildProtocolCapabilities,
  createProtocolSensorReader,
} from '../../game/simulation/protocol/protocolCapabilityBridge';
import { PHASE_FIVE_PROTOCOL_LIMITS, PHASE_THREE_BASELINE_CONFIG } from '../../game/simulation/SimulationConfig';
import { useProtocolStore } from '../../game/state/protocolStore';
import { compileActiveProtocols } from '../../game/ui/protocols/protocolDraftModel';
import { BrowserSimulationDriver } from '../runtime/BrowserSimulationDriver';
import { SimulationContext } from './simulationContext';

/**
 * Motorun ömrü ve protokol kitaplığının motora bağlanması.
 *
 * `active` protokoller kitaplıktan derlenip koşan kümeye verilir; kitaplık her
 * değiştiğinde (düzenleyicideki `Uygula`) küme tazelenir. Burada saat/hız
 * ELLENMEZ — uygulama simülasyonu duraklatmaz (§14.2 satır 1060).
 */
export function SimulationProvider({ children, engine: suppliedEngine }: PropsWithChildren<{ readonly engine?: SimulationEngine }>) {
  const [engine] = useState(() => {
    if (suppliedEngine !== undefined) return suppliedEngine;
    // Okuyucu motorun kendi anlık durumunu okur; motor kurulmadan önce çağrılmaz.
    const host: { created?: SimulationEngine } = {};
    const readSensor = createProtocolSensorReader(() => host.created?.getSnapshot());
    host.created = new SimulationEngine({ protocols: { protocols: [], readSensor } });
    return host.created;
  });

  const protocols = useProtocolStore((state) => state.protocols);

  useEffect(() => {
    const driver = new BrowserSimulationDriver(engine);
    driver.start();
    return () => driver.stop();
  }, [engine]);

  useEffect(() => {
    // Dışarıdan verilmiş bir motorda ölçüm okuyucusu olmayabilir; protokol koşamaz.
    if (!engine.canRunProtocols()) return;
    const capabilities = buildProtocolCapabilities({
      definitions: PHASE_THREE_BASELINE_CONFIG.facilities,
      limits: PHASE_FIVE_PROTOCOL_LIMITS,
      protocols,
      states: engine.getSnapshot().facilities,
    });
    engine.setProtocolPrograms(compileActiveProtocols(protocols, capabilities).programs);
  }, [engine, protocols]);

  return <SimulationContext.Provider value={engine}>{children}</SimulationContext.Provider>;
}
