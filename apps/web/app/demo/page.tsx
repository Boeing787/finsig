import { ConnectFlow } from '../../src/features/auth/ConnectFlow';

export const metadata = { title: 'Demo workspace · FinSig' };

/** Judge path: no PayPal credentials needed. Starts a signed demo session, then syncs. */
export default function DemoPage() {
  return <ConnectFlow mode="demo" name="Alex Morgan" startDemoSession />;
}
