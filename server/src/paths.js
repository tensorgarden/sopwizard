// Where SOPWizard keeps its data. Outside the application folder by default, so
// replacing the app with a new build never destroys a customer's SOPs. Override
// the whole location with SOPWIZARD_DATA_DIR.

import { homedir, platform } from 'node:os';
import { join } from 'node:path';

function defaultRoot() {
  const home = homedir();
  if (platform() === 'darwin') return join(home, 'Library', 'Application Support', 'SOPWizard');
  if (platform() === 'win32') return join(process.env.APPDATA || join(home, 'AppData', 'Roaming'), 'SOPWizard');
  return join(process.env.XDG_DATA_HOME || join(home, '.local', 'share'), 'SOPWizard');
}

export const DATA_ROOT = process.env.SOPWIZARD_DATA_DIR || join(defaultRoot(), 'data');
export const DATA_DIR = join(DATA_ROOT, 'sops');
