import { existsSync, copyFileSync } from 'fs';
import path from 'path';

const VAULT_PLUGIN_DIR = 'C:\\Users\\lucys\\Documents\\_workspace\\ObsidianVault\\.obsidian\\plugins\\unread-plus';
const FILES = ['main.js', 'styles.css', 'manifest.json'];

if (!existsSync(VAULT_PLUGIN_DIR)) {
  console.log(`Skipping vault copy — ${VAULT_PLUGIN_DIR} not found (not on the dev machine).`);
  process.exit(0);
}

for (const file of FILES) {
  copyFileSync(file, path.join(VAULT_PLUGIN_DIR, file));
}
console.log(`Copied ${FILES.join(', ')} to ${VAULT_PLUGIN_DIR}`);
