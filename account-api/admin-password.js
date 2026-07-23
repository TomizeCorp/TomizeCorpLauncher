import crypto from 'node:crypto';
import readline from 'node:readline/promises';

const terminal = readline.createInterface({ input: process.stdin, output: process.stdout });
const password = await terminal.question('Nouveau mot de passe administrateur (16 caractères minimum) : ');
terminal.close();
if (password.length < 16) {
  console.error('Mot de passe trop court.');
  process.exit(1);
}
const salt = crypto.randomBytes(16);
crypto.scrypt(password, salt, 64, (error, key) => {
  if (error) throw error;
  console.log(`${salt.toString('hex')}:${key.toString('hex')}`);
});
