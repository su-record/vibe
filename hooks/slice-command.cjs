const path = require('node:path');

// A bounded lexical recognizer, never a shell evaluator. Dynamic expansions remain unresolved.
function tokenize(text) {
  if (typeof text !== 'string' || text.length > 65536) return null;
  const tokens = [];
  let word = '', quote = '';
  const flush = () => { if (word) tokens.push(word); word = ''; };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === quote) quote = '';
      else if (ch === '\\' && quote === '"' && ['"', '\\'].includes(text[i + 1])) word += text[++i];
      else word += ch;
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '\\' && /[\s'"|;&<>]/.test(text[i + 1] ?? '')) word += text[++i];
    else if (/[\n|;&<>]/.test(ch)) { flush(); tokens.push(['|', '&', '<', '>'].includes(ch) && text[i + 1] === ch ? ch + text[++i] : ch); }
    else if (/\s/.test(ch)) flush();
    else word += ch;
    if (tokens.length > 2048) return null;
  }
  if (quote) return null;
  flush();
  return tokens;
}
function sections(tokens) {
  const out = [];
  let words = [], pipe = false;
  for (const token of tokens) {
    if (['|', '||', ';', '&', '&&', '\n'].includes(token)) {
      if (words.length) out.push({ words, pipe });
      words = []; pipe = token === '|';
    } else words.push(token);
  }
  if (words.length) out.push({ words, pipe });
  return out;
}
function command(words) {
  let index = 0;
  const redirects = [];
  if (words[0] === 'env') index++;
  for (;;) {
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(words[index] ?? '')) index++;
    else if (['<', '>', '>>'].includes(words[index]) && words[index + 1]) { redirects.push(words[index], words[index + 1]); index += 2; }
    else break;
  }
  return { name: path.basename(words[index] ?? '').replace(/\.exe$/i, ''), args: [...words.slice(index + 1), ...redirects] };
}
function operands(args, valued = []) {
  const out = [];
  let options = true;
  for (let i = 0; i < args.length; i++) {
    const word = args[i];
    if (word === '--') { options = false; continue; }
    if (word === '>' || word === '>>') { i++; continue; }
    if (word === '<') { if (args[i + 1]) out.push(args[++i]); continue; }
    if (options && valued.includes(word)) { i++; continue; }
    if (options && word.startsWith('-')) continue;
    out.push(word);
  }
  return out;
}
function grepInfo(name, args) {
  const options = args.filter(word => word.startsWith('-'));
  const namesOnly = options.some(word => /^--files(?:-with-matches|-without-match)?$|^-(?!-)[A-Za-z]*[lL][A-Za-z]*$/.test(word));
  const locations = namesOnly || options.some(word => word === '--line-number' || /^-[^-]*n/.test(word));
  const explicitPattern = args.some(word => ['-e', '--regexp', '-f', '--file'].includes(word) || /^--(?:regexp|file)=/.test(word));
  const files = operands(args, ['-e', '--regexp', '-f', '--file', '-g', '--glob', '-t', '--type', '-T', '--type-not', '-m', '--max-count', '--max-columns', '--max-depth', '-A', '-B', '-C']);
  if (!explicitPattern && !options.includes('--files')) files.shift();
  return { files, slice: !locations, namesOnly, implicit: name === 'rg' || options.some(word => /^-[^-]*[rR]/.test(word)) };
}
function transformInfo(name, args) {
  if (name === 'tr') return { files: args.flatMap((word, index) => word === '<' && args[index + 1] ? [args[index + 1]] : []), slice: false };
  const values = {
    nl: ['-b', '-d', '-f', '-h', '-i', '-l', '-n', '-s', '-v', '--body-numbering', '--section-delimiter', '--footer-numbering', '--header-numbering', '--line-increment', '--join-blank-lines', '--number-format', '--number-separator', '--starting-line-number'],
    sort: ['-k', '-t', '-o', '-T', '-S', '--key', '--field-separator', '--output', '--temporary-directory', '--buffer-size', '--parallel'],
    uniq: ['-f', '-s', '-w', '--skip-fields', '--skip-chars', '--check-chars'],
  };
  if (!Object.hasOwn(values, name)) return null;
  const files = operands(args, values[name]);
  return { files: name === 'uniq' ? files.slice(0, 1) : files, slice: false };
}
function readerInfo(name, args) {
  if (['grep', 'rg'].includes(name)) return grepInfo(name, args);
  if (name === 'cat') return { files: operands(args), slice: false };
  if (['head', 'tail'].includes(name)) return { files: operands(args, ['-n', '-c', '--lines', '--bytes', '--sleep-interval']), slice: true };
  if (name === 'cut') return { files: operands(args, ['-b', '-c', '-f', '-d', '--bytes', '--characters', '--fields', '--delimiter', '--output-delimiter']), slice: true };
  if (['sed', 'awk'].includes(name)) {
    const explicit = args.some(word => ['-e', '-f', '--expression', '--file'].includes(word));
    const files = operands(args, ['-e', '-f', '--expression', '--file', '-F', '-v']);
    if (!explicit) files.shift();
    const slice = name === 'awk' ? args.some(word => /\bNR\b|\bprint\b/.test(word)) : args.some(word => /^-[^-]*n/.test(word) || word === '--quiet' || word === '--silent');
    return { files, slice };
  }
  return transformInfo(name, args);
}
function sliceTargets(text, cwd, depth = 0) {
  const tokens = tokenize(text);
  if (!tokens || tokens.includes('<<') || depth > 1) return { unavailable: true, files: [] };
  const found = new Set();
  let input = [], directory = cwd;
  for (const section of sections(tokens)) {
    if (!section.pipe) input = [];
    const { name, args } = command(section.words);
    if (name === 'cd' && args[0] && !/[`$*?]/.test(args[0])) { directory = path.resolve(directory, args[0]); continue; }
    if (['bash', 'sh', 'zsh'].includes(name) && /^-[a-z]*c$/.test(args[0] ?? '')) {
      const nested = sliceTargets(args[1] ?? '', directory, depth + 1);
      if (nested.unavailable) return nested;
      for (const file of nested.files) found.add(file);
    }
    const info = readerInfo(name, args);
    if (!info) { input = []; continue; }
    const files = info.files.filter(file => file !== '-' && !/[`$]/.test(file)).map(file => path.resolve(directory, file));
    if (!files.length && !section.pipe && info.implicit) files.push(directory);
    if (files.length) input = files;
    if (info.slice) for (const file of input) found.add(file);
    if (info.namesOnly) input = [];
  }
  return { unavailable: false, files: [...found].slice(0, 256) };
}
module.exports = { sliceTargets };
