// U31: the owner's setup script is tested with every outside call stubbed. The tests live beside the script
// (scripts/setup-cloudflare.test.mjs); Vitest only collects src/ and worker/, so they are loaded from here and run in the unit gate.
import '../scripts/setup-cloudflare.test.mjs';
