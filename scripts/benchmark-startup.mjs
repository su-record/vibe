import { benchmarkStartup } from '../dist/core/performance.js';
console.log(JSON.stringify(benchmarkStartup(process.cwd()), null, 2));
