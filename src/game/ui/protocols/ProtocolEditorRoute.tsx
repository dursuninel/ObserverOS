import { Navigate, useParams } from 'react-router-dom';

import { useProtocolStore } from '../../state/protocolStore';
import { ProtocolGraphEditor } from './graph/ProtocolGraphEditor';

/**
 * `/protocols/:protocolId` — Graph Editor yüzeyi (spec §14.2).
 *
 * Manager ana ekrandır (§14.1); düzenleyici buradan AÇILIR. Bilinmeyen kimlikte
 * hata ekranı üretilmez, listeye dönülür.
 */
export function ProtocolEditorRoute() {
  const { protocolId } = useParams();
  const protocol = useProtocolStore((state) => state.protocols.find((entry) => entry.id === protocolId));

  if (protocol === undefined) return <Navigate replace to="/protocols" />;

  return (
    <div className="workspace workspace-protocols">
      <ProtocolGraphEditor key={protocol.id} protocol={protocol} />
    </div>
  );
}
