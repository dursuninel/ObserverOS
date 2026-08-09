import { Navigate, Route, Routes } from 'react-router-dom';

import { AppLayout } from './routes/AppLayout';
import { ColonyWorkspace } from '../game/ui/colony/ColonyWorkspace';
import { DebuggerWorkspace } from '../game/ui/debugger/DebuggerWorkspace';
import { ProtocolsWorkspace } from '../game/ui/protocols/ProtocolsWorkspace';

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate replace to="/colony" />} />
        <Route path="colony" element={<ColonyWorkspace />} />
        <Route path="protocols" element={<ProtocolsWorkspace />} />
        <Route path="debugger" element={<DebuggerWorkspace />} />
      </Route>
      <Route path="*" element={<Navigate replace to="/colony" />} />
    </Routes>
  );
}

